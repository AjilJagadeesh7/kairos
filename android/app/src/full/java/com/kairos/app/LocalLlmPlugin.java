package com.kairos.app;

import android.content.ComponentCallbacks2;
import android.content.res.Configuration;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The on-device runtime (Full flavor only): llama.cpp through JNI
 * (src/full/cpp/kairos_llm.cpp), on one worker thread. Streams "token" events
 * shaped like src/types/onDevice.types.ts LocalTokenEvent. Only verified
 * models from the app's models folder (LocalModelPlugin) can be loaded.
 * Generation stops when the app goes to the background, and the model is
 * freed under memory pressure (PRD); the next request reloads it.
 */
@CapacitorPlugin(name = "LocalLlm")
public class LocalLlmPlugin extends Plugin {

    static { System.loadLibrary("kairos_llm"); }

    private static native String nativeLoad(String path, int nCtx);
    private static native void nativeUnload();
    private static native void nativeAbort();
    private native int[] nativeGenerate(String[] roles, String[] contents, int maxTokens, float temperature, String[] stops, String grammar, boolean thinking);

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    /** What to reload after memory pressure freed the model. */
    private volatile String loadedPath;
    private volatile int loadedCtx;
    private volatile boolean resident;

    private final ComponentCallbacks2 memory = new ComponentCallbacks2() {
        @Override public void onTrimMemory(int level) {
            if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW && resident) {
                nativeAbort();
                worker.execute(() -> { nativeUnload(); resident = false; });
            }
        }
        @Override public void onConfigurationChanged(Configuration newConfig) {}
        @Override public void onLowMemory() { onTrimMemory(ComponentCallbacks2.TRIM_MEMORY_COMPLETE); }
    };

    @Override
    public void load() {
        getContext().registerComponentCallbacks(memory);
    }

    @Override
    protected void handleOnDestroy() {
        getContext().unregisterComponentCallbacks(memory);
        nativeUnload();
    }

    /** Never run inference in the background (PRD). */
    @Override
    protected void handleOnPause() {
        nativeAbort();
    }

    @PluginMethod
    public void available(PluginCall call) {
        JSObject out = new JSObject();
        out.put("value", true);
        call.resolve(out);
    }

    @PluginMethod
    public void load(PluginCall call) {
        String path = call.getString("path", "");
        int ctx = call.getInt("contextTokens", 4096);
        try {
            File models = new File(getContext().getFilesDir(), "models").getCanonicalFile();
            File file = new File(path).getCanonicalFile();
            if (!file.getPath().startsWith(models.getPath() + File.separator) || !file.getName().endsWith(".gguf") || !file.exists()) {
                call.reject("only downloaded, verified models can be loaded");
                return;
            }
            worker.execute(() -> {
                String err = nativeLoad(file.getPath(), ctx);
                if (err != null) { call.reject(err); return; }
                loadedPath = file.getPath();
                loadedCtx = ctx;
                resident = true;
                call.resolve();
            });
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void unload(PluginCall call) {
        loadedPath = null;
        nativeAbort();
        worker.execute(() -> { nativeUnload(); resident = false; call.resolve(); });
    }

    @PluginMethod
    public void abort(PluginCall call) {
        nativeAbort();
        call.resolve();
    }

    @PluginMethod
    public void generate(PluginCall call) {
        JSObject req = call.getObject("request", new JSObject());
        worker.execute(() -> {
            try {
                if (!resident) {
                    // Freed under memory pressure: load it again for this request.
                    if (loadedPath == null) throw new RuntimeException("no model is loaded");
                    String err = nativeLoad(loadedPath, loadedCtx);
                    if (err != null) throw new RuntimeException(err);
                    resident = true;
                }
                JSONArray messages = req.getJSONArray("messages");
                String[] roles = new String[messages.length()];
                String[] contents = new String[messages.length()];
                for (int i = 0; i < messages.length(); i++) {
                    JSONObject m = messages.getJSONObject(i);
                    roles[i] = m.optString("role", "user");
                    contents[i] = m.optString("content", "");
                }
                JSONArray stopArr = req.has("stop") ? req.getJSONArray("stop") : new JSONArray();
                String[] stops = new String[stopArr.length()];
                for (int i = 0; i < stops.length; i++) stops[i] = stopArr.getString(i);
                int[] counts = nativeGenerate(roles, contents, req.optInt("maxTokens", 512),
                    (float) req.optDouble("temperature", 0.3), stops, req.optString("grammar", ""), req.optBoolean("thinking", false));
                JSObject done = new JSObject();
                done.put("type", "done");
                done.put("promptTokens", counts[0]);
                done.put("completionTokens", counts[1]);
                notifyListeners("token", done);
                call.resolve();
            } catch (Exception e) {
                JSObject err = new JSObject();
                err.put("type", "error");
                err.put("message", e.getMessage() == null ? e.toString() : e.getMessage());
                notifyListeners("token", err);
                call.resolve();
            }
        });
    }

    /** Called from native code with each complete UTF-8 piece. */
    @SuppressWarnings("unused")
    private void onToken(byte[] utf8) {
        JSObject e = new JSObject();
        e.put("type", "token");
        e.put("text", new String(utf8, StandardCharsets.UTF_8));
        notifyListeners("token", e);
    }
}
