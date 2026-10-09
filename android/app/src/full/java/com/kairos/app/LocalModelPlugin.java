package com.kairos.app;

import android.app.ActivityManager;
import android.content.Context;
import android.os.StatFs;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * On-device model files (Full flavor only): device check, and downloads from a
 * fixed, pinned list with resume, pause, progress and SHA-256 verification.
 * A file is moved into place only after its checksum matches. Mirrors
 * src-tauri/src/local_model.rs and src/ai/onDevice/models.ts.
 * Events: "download" {id, type: progress|verifying|done|paused|error, ...}.
 */
@CapacitorPlugin(name = "LocalModel")
public class LocalModelPlugin extends Plugin {

    private static final class Pinned {
        final String url; final String sha256; final long size;
        Pinned(String url, String sha256, long size) { this.url = url; this.sha256 = sha256; this.size = size; }
    }

    /** Hugging Face, openbmb, Apache-2.0 — each URL pinned to a repository revision. */
    private static final Map<String, Pinned> MODELS = new HashMap<>();
    static {
        // Map.of needs API 30; minSdk is lower.
        MODELS.put("minicpm5-1b-q4km", new Pinned(
            "https://huggingface.co/openbmb/MiniCPM5-1B-GGUF/resolve/3d55fac80935ae6456986ad2384b5cbcc4d6c948/MiniCPM5-1B-Q4_K_M.gguf",
            "81b64d05a23b17b34c475f42b3e72fbde62d4b92cc34541f7a8031d0752deafa", 688_065_920L));
        MODELS.put("minicpm5-2b-q4km", new Pinned(
            "https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/resolve/2079a22f3beaa4e306449978533478fe0522f4b3/MiniCPM5-2B-Q4_K_M.gguf",
            "ec2d5801640099e97d8d7e8003ad4d81f336e757811f03a26173dddf386602fd", 1_561_318_368L));
    }

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final ConcurrentHashMap<String, AtomicBoolean> paused = new ConcurrentHashMap<>();

    private File dir() {
        File d = new File(getContext().getFilesDir(), "models");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    private File done(String id) { return new File(dir(), id + ".gguf"); }
    private File part(String id) { return new File(dir(), id + ".gguf.part"); }

    @PluginMethod
    public void deviceInfo(PluginCall call) {
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mem = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mem);
        StatFs fs = new StatFs(dir().getAbsolutePath());
        JSObject out = new JSObject();
        out.put("totalRam", mem.totalMem);
        out.put("availableRam", mem.availMem);
        out.put("freeDisk", fs.getAvailableBytes());
        call.resolve(out);
    }

    @PluginMethod
    public void status(PluginCall call) {
        String id = call.getString("id", "");
        if (!MODELS.containsKey(id)) { call.reject("unknown model " + id); return; }
        JSObject out = new JSObject();
        out.put("id", id);
        if (done(id).exists()) {
            out.put("state", "ready");
            out.put("bytes", done(id).length());
            out.put("path", done(id).getAbsolutePath());
        } else {
            long bytes = part(id).exists() ? part(id).length() : 0;
            out.put("state", bytes > 0 ? "partial" : "none");
            out.put("bytes", bytes);
            out.put("path", null);
        }
        call.resolve(out);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        AtomicBoolean flag = paused.get(call.getString("id", ""));
        if (flag != null) flag.set(true);
        call.resolve();
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String id = call.getString("id", "");
        AtomicBoolean flag = paused.get(id);
        if (flag != null) flag.set(true);
        done(id).delete();
        part(id).delete();
        call.resolve();
    }

    @PluginMethod
    public void download(PluginCall call) {
        String id = call.getString("id", "");
        Pinned model = MODELS.get(id);
        if (model == null) { call.reject("unknown model " + id); return; }
        AtomicBoolean flag = new AtomicBoolean(false);
        paused.put(id, flag);
        call.resolve();
        executor.execute(() -> {
            try {
                run(id, model, flag);
            } catch (Exception e) {
                emit(id, "error", "message", e.getMessage() == null ? e.toString() : e.getMessage());
            } finally {
                paused.remove(id);
            }
        });
    }

    private void run(String id, Pinned model, AtomicBoolean flag) throws Exception {
        File done = done(id);
        File part = part(id);
        if (done.exists()) { emit(id, "done", "path", done.getAbsolutePath()); return; }
        long have = part.exists() ? part.length() : 0;
        if (have > model.size) { part.delete(); have = 0; }
        if (have < model.size) {
            HttpURLConnection conn = (HttpURLConnection) new URL(model.url).openConnection();
            conn.setConnectTimeout(20_000);
            conn.setReadTimeout(60_000);
            conn.setInstanceFollowRedirects(true);
            if (have > 0) conn.setRequestProperty("Range", "bytes=" + have + "-");
            int status = conn.getResponseCode();
            if (status != 200 && status != 206) throw new Exception("download failed: the server answered " + status);
            // 200 to a Range request means the whole file is coming: start over.
            boolean append = status == 206;
            if (!append) have = 0;
            long lastEmit = 0;
            try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(part, append)) {
                byte[] buf = new byte[256 * 1024];
                int n;
                while ((n = in.read(buf)) != -1) {
                    out.write(buf, 0, n);
                    have += n;
                    if (flag.get()) {
                        JSObject e = event(id, "paused");
                        e.put("done", have);
                        notifyListeners("download", e);
                        return;
                    }
                    long now = System.currentTimeMillis();
                    if (now - lastEmit > 250) {
                        JSObject e = event(id, "progress");
                        e.put("done", have);
                        e.put("total", model.size);
                        notifyListeners("download", e);
                        lastEmit = now;
                    }
                }
            } finally {
                conn.disconnect();
            }
        }
        if (have != model.size) throw new Exception("download incomplete: " + have + " of " + model.size + " bytes — try again to resume");
        notifyListeners("download", event(id, "verifying"));
        if (!sha256(part).equals(model.sha256)) {
            part.delete();
            throw new Exception("the downloaded file failed SHA-256 verification and was deleted — try again");
        }
        if (!part.renameTo(done)) throw new Exception("could not move the verified model into place");
        emit(id, "done", "path", done.getAbsolutePath());
    }

    private static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[8 * 1024 * 1024];
            int n;
            while ((n = in.read(buf)) != -1) md.update(buf, 0, n);
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : md.digest()) hex.append(String.format(Locale.ROOT, "%02x", b));
        return hex.toString();
    }

    private JSObject event(String id, String type) {
        JSObject e = new JSObject();
        e.put("id", id);
        e.put("type", type);
        return e;
    }

    private void emit(String id, String type, String key, String value) {
        JSObject e = event(id, type);
        e.put(key, value);
        notifyListeners("download", e);
    }
}
