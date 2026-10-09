// JNI bridge for the on-device model (Kairos Full, Android): load a GGUF,
// apply its chat template, and generate with optional GBNF grammar, streaming
// UTF-8 pieces back to LocalLlmPlugin.onToken(byte[]). Mirrors
// src-tauri/src/local_llm.rs. One model at a time, guarded by a mutex.

#include <jni.h>
#include <android/log.h>

#include <algorithm>
#include <atomic>
#include <cstring>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "llama.h"

namespace {

std::mutex g_lock;
llama_model *g_model = nullptr;
int g_n_ctx = 4096;
std::atomic<bool> g_abort{false};
bool g_backend = false;

constexpr int N_BATCH = 512;

void throw_java(JNIEnv *env, const std::string &msg) {
    jclass ex = env->FindClass("java/lang/RuntimeException");
    env->ThrowNew(ex, msg.c_str());
}

std::string jstr(JNIEnv *env, jstring s) {
    if (!s) return {};
    const char *c = env->GetStringUTFChars(s, nullptr);
    std::string out(c);
    env->ReleaseStringUTFChars(s, c);
    return out;
}

// Length of the longest prefix of `b` that is complete UTF-8.
size_t utf8_complete(const std::string &b) {
    size_t i = 0;
    while (i < b.size()) {
        unsigned char c = b[i];
        size_t n = c < 0x80 ? 1 : (c >> 5) == 6 ? 2 : (c >> 4) == 14 ? 3 : (c >> 3) == 30 ? 4 : 1;
        if (i + n > b.size()) break;
        i += n;
    }
    return i;
}

std::string apply_template(const std::vector<llama_chat_message> &chat, size_t chars, bool thinking) {
    const char *tmpl = llama_model_chat_template(g_model, nullptr);
    if (!tmpl) {
        std::string out;
        for (auto &m : chat) out += std::string(m.role) + ": " + m.content + "\n";
        return out + "assistant: ";
    }
    std::vector<char> buf(chars * 2 + 256);
    int n = llama_chat_apply_template(tmpl, chat.data(), chat.size(), true, buf.data(), (int32_t) buf.size());
    if (n > (int) buf.size()) {
        buf.resize(n);
        n = llama_chat_apply_template(tmpl, chat.data(), chat.size(), true, buf.data(), (int32_t) buf.size());
    }
    if (n < 0) return {};
    std::string prompt(buf.data(), n);
    // Built-in templates take no enable_thinking: when thinking is off, do what the model's
    // template does (MiniCPM5, Qwen3-style) and open the answer with an empty think block.
    if (!thinking && std::strstr(tmpl, "enable_thinking")) prompt += "<think>\n\n</think>\n\n";
    return prompt;
}

}  // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_com_kairos_app_LocalLlmPlugin_nativeLoad(JNIEnv *env, jclass, jstring path, jint n_ctx) {
    std::lock_guard<std::mutex> lock(g_lock);
    if (!g_backend) { llama_backend_init(); g_backend = true; }
    if (g_model) { llama_model_free(g_model); g_model = nullptr; }
    llama_model_params mp = llama_model_default_params();
    g_model = llama_model_load_from_file(jstr(env, path).c_str(), mp);
    if (!g_model) return env->NewStringUTF("could not load the model");
    int train = llama_model_n_ctx_train(g_model);
    g_n_ctx = std::max(512, std::min((int) n_ctx, train > 0 ? train : (int) n_ctx));
    return nullptr;
}

extern "C" JNIEXPORT void JNICALL
Java_com_kairos_app_LocalLlmPlugin_nativeUnload(JNIEnv *, jclass) {
    g_abort = true;
    std::lock_guard<std::mutex> lock(g_lock);
    if (g_model) { llama_model_free(g_model); g_model = nullptr; }
}

extern "C" JNIEXPORT void JNICALL
Java_com_kairos_app_LocalLlmPlugin_nativeAbort(JNIEnv *, jclass) {
    g_abort = true;
}

extern "C" JNIEXPORT jintArray JNICALL
Java_com_kairos_app_LocalLlmPlugin_nativeGenerate(
        JNIEnv *env, jobject self, jobjectArray roles, jobjectArray contents, jint max_tokens,
        jfloat temperature, jobjectArray stops, jstring grammar_j, jboolean thinking) {
    std::lock_guard<std::mutex> lock(g_lock);
    g_abort = false;
    if (!g_model) { throw_java(env, "no model is loaded"); return nullptr; }

    // Messages → the model's chat template.
    jsize n = env->GetArrayLength(roles);
    std::vector<std::string> r(n), c(n);
    std::vector<llama_chat_message> chat(n);
    size_t chars = 0;
    for (jsize i = 0; i < n; i++) {
        r[i] = jstr(env, (jstring) env->GetObjectArrayElement(roles, i));
        c[i] = jstr(env, (jstring) env->GetObjectArrayElement(contents, i));
        chars += r[i].size() + c[i].size();
    }
    for (jsize i = 0; i < n; i++) chat[i] = {r[i].c_str(), c[i].c_str()};
    std::string prompt = apply_template(chat, chars, thinking == JNI_TRUE);
    if (prompt.empty()) { throw_java(env, "the chat template failed"); return nullptr; }

    const llama_vocab *vocab = llama_model_get_vocab(g_model);
    int needed = -llama_tokenize(vocab, prompt.c_str(), (int32_t) prompt.size(), nullptr, 0, true, true);
    std::vector<llama_token> tokens(needed);
    if (llama_tokenize(vocab, prompt.c_str(), (int32_t) prompt.size(), tokens.data(), needed, true, true) < 0) {
        throw_java(env, "tokenization failed"); return nullptr;
    }
    // Some GGUFs (MiniCPM5) don't flag add_bos and the built-in templates don't emit it, but the
    // model's own template starts with bos_token: without it the model loops ("the, the, the…").
    const char *tmpl = llama_model_chat_template(g_model, nullptr);
    llama_token bos = llama_vocab_bos(vocab);
    if (tmpl && std::strstr(tmpl, "bos_token") && bos != LLAMA_TOKEN_NULL && (tokens.empty() || tokens[0] != bos)) {
        tokens.insert(tokens.begin(), bos);
    }
    if ((int) tokens.size() + 16 > g_n_ctx) {
        throw_java(env, "the prompt is " + std::to_string(tokens.size()) + " tokens; the on-device context holds " + std::to_string(g_n_ctx));
        return nullptr;
    }
    int max_new = std::min((int) max_tokens, g_n_ctx - (int) tokens.size());

    int threads = std::max(1, std::min(4, (int) std::thread::hardware_concurrency()));
    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = g_n_ctx;
    cp.n_batch = N_BATCH;
    cp.n_threads = threads;
    cp.n_threads_batch = threads;
    llama_context *ctx = llama_init_from_model(g_model, cp);
    if (!ctx) { throw_java(env, "could not create a context"); return nullptr; }

    // Prompt in chunks.
    for (size_t i = 0; i < tokens.size(); i += N_BATCH) {
        int len = (int) std::min((size_t) N_BATCH, tokens.size() - i);
        if (llama_decode(ctx, llama_batch_get_one(tokens.data() + i, len)) != 0) {
            llama_free(ctx); throw_java(env, "decode failed"); return nullptr;
        }
        if (g_abort) break;
    }

    llama_sampler *smpl = llama_sampler_chain_init(llama_sampler_chain_default_params());
    std::string grammar = jstr(env, grammar_j);
    if (!grammar.empty()) {
        llama_sampler *g = llama_sampler_init_grammar(vocab, grammar.c_str(), "root");
        if (!g) { llama_sampler_free(smpl); llama_free(ctx); throw_java(env, "invalid grammar"); return nullptr; }
        llama_sampler_chain_add(smpl, g);
    }
    if (grammar.empty()) {
        // Guards against small-model loops (mirrors local_llm.rs): DRY on repeated sequences plus
        // a very mild token penalty; a strong one makes small models count. Not under a grammar.
        const char *breakers[] = {"\n", ":", "\"", "*"};
        llama_sampler_chain_add(smpl, llama_sampler_init_dry(vocab, 0.8f, 1.75f, 2, -1, breakers, 4));
        llama_sampler_chain_add(smpl, llama_sampler_init_penalties(llama_vocab_n_tokens(vocab), 64, 1.05f, 0.0f, 0.0f));
    }
    if (temperature <= 0.0f) {
        llama_sampler_chain_add(smpl, llama_sampler_init_greedy());
    } else {
        llama_sampler_chain_add(smpl, llama_sampler_init_min_p(0.05f, 1));
        llama_sampler_chain_add(smpl, llama_sampler_init_temp(temperature));
        llama_sampler_chain_add(smpl, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
    }

    std::vector<std::string> stop;
    for (jsize i = 0, m = stops ? env->GetArrayLength(stops) : 0; i < m; i++) {
        stop.push_back(jstr(env, (jstring) env->GetObjectArrayElement(stops, i)));
    }
    jclass cls = env->GetObjectClass(self);
    jmethodID on_token = env->GetMethodID(cls, "onToken", "([B)V");

    std::string pending, text;
    int produced = 0;
    char piece[256];
    while (produced < max_new && !g_abort) {
        llama_token tok = llama_sampler_sample(smpl, ctx, -1);
        if (llama_vocab_is_eog(vocab, tok)) break;
        produced++;
        int len = llama_token_to_piece(vocab, tok, piece, sizeof(piece), 0, false);
        if (len > 0) pending.append(piece, len);
        size_t ok = utf8_complete(pending);
        if (ok > 0) {
            jbyteArray bytes = env->NewByteArray((jsize) ok);
            env->SetByteArrayRegion(bytes, 0, (jsize) ok, reinterpret_cast<const jbyte *>(pending.data()));
            env->CallVoidMethod(self, on_token, bytes);
            env->DeleteLocalRef(bytes);
            text.append(pending, 0, ok);
            pending.erase(0, ok);
        }
        bool stopped = false;
        for (auto &s : stop) {
            if (!s.empty() && text.size() >= s.size() && text.compare(text.size() - s.size(), s.size(), s) == 0) stopped = true;
        }
        if (stopped) break;
        if (llama_decode(ctx, llama_batch_get_one(&tok, 1)) != 0) break;
    }
    llama_sampler_free(smpl);
    llama_free(ctx);

    jintArray out = env->NewIntArray(2);
    jint counts[2] = {(jint) tokens.size(), produced};
    env->SetIntArrayRegion(out, 0, 2, counts);
    return out;
}
