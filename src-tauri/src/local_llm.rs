//! The on-device runtime (P8, `local-llm` feature = Full build only):
//! llama.cpp through the `llama-cpp-2` crate, on its own worker thread so the
//! UI never waits on inference. Tokens stream to the webview over a Channel.
//! Only model files in the app's verified models folder can be loaded; no
//! network is used. The contract matches `src/ai/onDevice/native.ts`.

use std::num::NonZeroU32;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};

use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{LlamaChatMessage, LlamaModel};
use llama_cpp_2::sampling::LlamaSampler;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};
use tokio::sync::oneshot;

/// Prompt tokens are fed to the model this many at a time.
const N_BATCH: usize = 512;

#[derive(Deserialize)]
pub struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateRequest {
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f32,
    #[serde(default)]
    stop: Vec<String>,
    /// GBNF; decoding is constrained to it when present.
    grammar: Option<String>,
    /// Let a reasoning model think first. Off: the prompt closes an empty think block,
    /// as the model's own template does for `enable_thinking=false`.
    #[serde(default)]
    thinking: bool,
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TokenEvent {
    Token { text: String },
    #[serde(rename_all = "camelCase")]
    Done { prompt_tokens: u32, completion_tokens: u32 },
    Error { message: String },
}

enum Job {
    Load { path: PathBuf, n_ctx: u32, reply: oneshot::Sender<Result<(), String>> },
    Unload { reply: oneshot::Sender<()> },
    Generate { req: GenerateRequest, emit: Box<dyn Fn(TokenEvent) + Send>, reply: oneshot::Sender<Result<(), String>> },
}

/// Handle to the worker thread that owns llama.cpp.
pub struct LocalLlm {
    jobs: Mutex<mpsc::Sender<Job>>,
    abort: Arc<AtomicBool>,
}

impl Default for LocalLlm {
    fn default() -> Self {
        let (tx, rx) = mpsc::channel::<Job>();
        let abort = Arc::new(AtomicBool::new(false));
        let flag = abort.clone();
        std::thread::Builder::new()
            .name("local-llm".into())
            .spawn(move || worker(rx, flag))
            .expect("could not start the on-device model thread");
        Self { jobs: Mutex::new(tx), abort }
    }
}

impl LocalLlm {
    fn send(&self, job: Job) -> Result<(), String> {
        self.jobs.lock().unwrap().send(job).map_err(|_| "the on-device model thread stopped".to_string())
    }
}

fn worker(rx: mpsc::Receiver<Job>, abort: Arc<AtomicBool>) {
    // llama.cpp's backend is initialised once per process, here, on first use.
    let mut backend: Option<LlamaBackend> = None;
    let mut model: Option<(LlamaModel, u32)> = None;
    for job in rx {
        match job {
            Job::Load { path, n_ctx, reply } => {
                let result = (|| {
                    if backend.is_none() {
                        let mut b = LlamaBackend::init().map_err(|e| e.to_string())?;
                        b.void_logs();
                        backend = Some(b);
                    }
                    model = None; // free the previous model first
                    let m = LlamaModel::load_from_file(backend.as_ref().unwrap(), &path, &LlamaModelParams::default())
                        .map_err(|e| format!("could not load the model: {e}"))?;
                    let n_ctx = n_ctx.min(m.n_ctx_train()).max(512);
                    model = Some((m, n_ctx));
                    Ok(())
                })();
                let _ = reply.send(result);
            }
            Job::Unload { reply } => {
                model = None;
                let _ = reply.send(());
            }
            Job::Generate { req, emit, reply } => {
                abort.store(false, Ordering::SeqCst);
                let result = match (&backend, &model) {
                    (Some(b), Some((m, n_ctx))) => generate(b, m, *n_ctx, &req, &*emit, &abort),
                    _ => Err("no model is loaded".into()),
                };
                if let Err(message) = &result {
                    emit(TokenEvent::Error { message: message.clone() });
                }
                let _ = reply.send(result);
            }
        }
    }
}

/// The model's own chat template; a plain transcript if it has none.
fn prompt_for(model: &LlamaModel, messages: &[ChatMessage], thinking: bool) -> Result<String, String> {
    let chat: Vec<LlamaChatMessage> = messages
        .iter()
        .map(|m| LlamaChatMessage::new(m.role.clone(), m.content.clone()).map_err(|e| e.to_string()))
        .collect::<Result<_, _>>()?;
    match model.chat_template(None) {
        Ok(tmpl) => {
            let mut prompt = model.apply_chat_template(&tmpl, &chat, true).map_err(|e| format!("chat template failed: {e}"))?;
            // llama.cpp's built-in templates take no `enable_thinking`; do what the model's template
            // does when it is false (MiniCPM5, Qwen3-style): open the answer with an empty think block.
            if !thinking && tmpl.to_string().map(|t| t.contains("enable_thinking")).unwrap_or(false) {
                prompt.push_str("<think>\n\n</think>\n\n");
            }
            Ok(prompt)
        }
        Err(_) => Ok(messages.iter().map(|m| format!("{}: {}\n", m.role, m.content)).collect::<String>() + "assistant: "),
    }
}

/// The prompt's tokens, starting with BOS when the model's own template begins with it.
/// Some GGUFs (MiniCPM5) don't flag add_bos, and llama.cpp's built-in templates don't emit
/// it, so without this the model never sees the token it was trained to start from.
pub(crate) fn prompt_tokens(model: &LlamaModel, prompt: &str) -> Vec<llama_cpp_2::token::LlamaToken> {
    let vocab = model.vocab();
    let mut tokens = vocab.tokenize(prompt.as_bytes(), true, true);
    let wants_bos = model.chat_template(None).ok().and_then(|t| t.to_string().ok()).map(|t| t.contains("bos_token")).unwrap_or(false);
    if wants_bos && tokens.first() != Some(&vocab.bos()) {
        tokens.insert(0, vocab.bos());
    }
    tokens
}

fn generate(
    backend: &LlamaBackend, model: &LlamaModel, n_ctx: u32, req: &GenerateRequest,
    emit: &dyn Fn(TokenEvent), abort: &AtomicBool,
) -> Result<(), String> {
    let prompt = prompt_for(model, &req.messages, req.thinking)?;
    let vocab = model.vocab();
    let tokens = prompt_tokens(model, &prompt);
    let room = n_ctx as usize;
    if tokens.len() + 16 > room {
        return Err(format!("the prompt is {} tokens; the on-device context holds {room}", tokens.len()));
    }
    let max_new = (req.max_tokens as usize).min(room - tokens.len());

    let threads = std::thread::available_parallelism().map(|n| n.get() as i32).unwrap_or(4).clamp(1, 8);
    let params = LlamaContextParams::default()
        .with_n_ctx(NonZeroU32::new(n_ctx))
        .with_n_batch(N_BATCH as u32)
        .with_n_threads(threads)
        .with_n_threads_batch(threads);
    let mut ctx = model.new_context(backend, params).map_err(|e| format!("could not create a context: {e}"))?;

    // Prompt in chunks; logits only for the last token.
    let mut batch = LlamaBatch::new(N_BATCH, 1);
    for (c, chunk) in tokens.chunks(N_BATCH).enumerate() {
        batch.clear();
        for (i, t) in chunk.iter().enumerate() {
            let pos = (c * N_BATCH + i) as i32;
            batch.add(*t, pos, &[0], c * N_BATCH + i == tokens.len() - 1).map_err(|e| e.to_string())?;
        }
        ctx.decode(&mut batch).map_err(|e| format!("decode failed: {e}"))?;
        if abort.load(Ordering::SeqCst) {
            emit(TokenEvent::Done { prompt_tokens: tokens.len() as u32, completion_tokens: 0 });
            return Ok(());
        }
    }

    let mut chain = Vec::new();
    if let Some(g) = req.grammar.as_deref().filter(|g| !g.trim().is_empty()) {
        chain.push(LlamaSampler::grammar(model, g, "root").map_err(|e| format!("invalid grammar: {e}"))?);
    }
    if req.grammar.is_none() {
        // Guards against small-model loops: DRY penalises repeated sequences (llama.cpp's
        // recommended settings), plus a very mild token penalty. A strong token penalty
        // instead pushes small models into counting ("0, 1, 2, 3…"). Not under a grammar:
        // JSON legitimately repeats quotes and braces.
        chain.push(LlamaSampler::dry(model, 0.8, 1.75, 2, -1, ["
", ":", "\"", "*"]));
        chain.push(LlamaSampler::penalties(vocab.n_tokens(), 64, 1.05, 0.0, 0.0));
    }
    if req.temperature <= 0.0 {
        chain.push(LlamaSampler::greedy());
    } else {
        chain.push(LlamaSampler::min_p(0.05, 1));
        chain.push(LlamaSampler::temp(req.temperature));
        chain.push(LlamaSampler::dist(rand_seed()));
    }
    let mut sampler = LlamaSampler::chain_simple(chain);

    let mut pos = tokens.len() as i32;
    let mut pending: Vec<u8> = Vec::new(); // bytes of a UTF-8 character split across tokens
    let mut text = String::new();
    let mut produced = 0u32;
    while (produced as usize) < max_new && !abort.load(Ordering::SeqCst) {
        let token = sampler.sample(&ctx, batch.n_tokens() - 1);
        if vocab.is_eog(token) {
            break;
        }
        produced += 1;
        pending.extend(vocab.token_to_piece(token, false, None));
        let valid = match std::str::from_utf8(&pending) {
            Ok(s) => s.len(),
            Err(e) => e.valid_up_to(),
        };
        if valid > 0 {
            let piece = String::from_utf8_lossy(&pending[..valid]).into_owned();
            pending.drain(..valid);
            text.push_str(&piece);
            emit(TokenEvent::Token { text: piece });
        }
        if req.stop.iter().any(|s| !s.is_empty() && text.ends_with(s.as_str())) {
            break;
        }
        batch.clear();
        batch.add(token, pos, &[0], true).map_err(|e| e.to_string())?;
        pos += 1;
        ctx.decode(&mut batch).map_err(|e| format!("decode failed: {e}"))?;
    }
    emit(TokenEvent::Done { prompt_tokens: tokens.len() as u32, completion_tokens: produced });
    Ok(())
}

fn rand_seed() -> u32 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.subsec_nanos()).unwrap_or(42)
}

#[tauri::command]
pub fn llm_available() -> bool {
    true
}

#[tauri::command]
pub async fn llm_load(app: AppHandle, llm: State<'_, LocalLlm>, path: String, context_tokens: u32) -> Result<(), String> {
    // Only verified files from the app's models folder (see local_model.rs) can be loaded.
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("models");
    let path = PathBuf::from(path);
    let canonical = path.canonicalize().map_err(|_| "the model file is missing — download it again".to_string())?;
    let dir = dir.canonicalize().map_err(|e| e.to_string())?;
    if !canonical.starts_with(&dir) || canonical.extension().and_then(|e| e.to_str()) != Some("gguf") {
        return Err("only downloaded, verified models can be loaded".into());
    }
    let (reply, rx) = oneshot::channel();
    llm.send(Job::Load { path: canonical, n_ctx: context_tokens, reply })?;
    rx.await.map_err(|_| "the on-device model thread stopped".to_string())?
}

#[tauri::command]
pub async fn llm_unload(llm: State<'_, LocalLlm>) -> Result<(), String> {
    let (reply, rx) = oneshot::channel();
    llm.send(Job::Unload { reply })?;
    rx.await.map_err(|_| "the on-device model thread stopped".to_string())
}

#[tauri::command]
pub async fn llm_generate(llm: State<'_, LocalLlm>, request: GenerateRequest, on_event: Channel<TokenEvent>) -> Result<(), String> {
    let (reply, rx) = oneshot::channel();
    let emit = Box::new(move |e: TokenEvent| {
        let _ = on_event.send(e);
    });
    llm.send(Job::Generate { req: request, emit, reply })?;
    rx.await.map_err(|_| "the on-device model thread stopped".to_string())?
}

#[tauri::command]
pub fn llm_abort(llm: State<'_, LocalLlm>) {
    llm.abort.store(true, Ordering::SeqCst);
}

#[cfg(test)]
#[path = "local_llm_tests.rs"]
mod tests;
