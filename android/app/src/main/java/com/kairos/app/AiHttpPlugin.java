package com.kairos.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Streaming HTTP for AI providers (src/ai/transport/httpStream.ts).
 *
 * CapacitorHttp buffers the whole response, so token streaming needs its own
 * bridge: the body is read on a worker thread and pushed to JS as "event"
 * notifications ({id, type: head|chunk|end|error}). abort() disconnects the
 * socket, which also tells servers like Ollama to stop generating.
 *
 * Plain HTTP is accepted only for loopback / private-LAN / .local hosts —
 * the same rule as src/ai/net/urlPolicy.ts and src-tauri/src/ai_http.rs.
 */
@CapacitorPlugin(name = "AiHttp")
public class AiHttpPlugin extends Plugin {

    private static final int CONNECT_TIMEOUT_MS = 15_000;
    /** Max silence between bytes — long enough for a slow first token. */
    private static final int READ_TIMEOUT_MS = 300_000;

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, HttpURLConnection> active = new ConcurrentHashMap<>();
    private final Set<String> aborted = ConcurrentHashMap.newKeySet();

    @PluginMethod
    public void start(PluginCall call) {
        String id = call.getString("id");
        String url = call.getString("url");
        String method = call.getString("method", "POST");
        JSObject headers = call.getObject("headers", new JSObject());
        String body = call.getString("body");

        if (id == null || url == null) {
            call.reject("id and url are required");
            return;
        }
        String policyError = checkUrl(url);
        if (policyError != null) {
            call.reject(policyError);
            return;
        }
        call.resolve();
        executor.execute(() -> run(id, url, method, headers, body));
    }

    @PluginMethod
    public void abort(PluginCall call) {
        String id = call.getString("id");
        if (id != null) {
            aborted.add(id);
            HttpURLConnection conn = active.remove(id);
            // disconnect() closes the socket, which unblocks the reader thread.
            if (conn != null) executor.execute(conn::disconnect);
        }
        call.resolve();
    }

    private void run(String id, String url, String method, JSObject headers, String body) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            active.put(id, conn);
            if (aborted.contains(id)) throw new IOException("aborted");
            conn.setRequestMethod(method);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            // Redirects could leave the allowed URL policy; surface them instead.
            conn.setInstanceFollowRedirects(false);
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                conn.setRequestProperty(key, headers.getString(key));
            }
            if (body != null) {
                conn.setDoOutput(true);
                try (OutputStream out = conn.getOutputStream()) {
                    out.write(body.getBytes(StandardCharsets.UTF_8));
                }
            }

            int status = conn.getResponseCode();
            JSObject head = event(id, "head");
            head.put("status", status);
            notifyListeners("event", head);

            InputStream in = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (in != null) {
                try (InputStream stream = in) {
                    pump(id, stream);
                }
            }
            notifyListeners("event", event(id, "end"));
        } catch (IOException e) {
            JSObject err = event(id, "error");
            // The message never includes the URL (query strings may carry keys).
            err.put("message", aborted.contains(id) ? "aborted" : "request failed: " + e.getClass().getSimpleName()
                    + (e.getMessage() != null ? " — " + e.getMessage() : ""));
            notifyListeners("event", err);
        } finally {
            active.remove(id);
            aborted.remove(id);
            if (conn != null) conn.disconnect();
        }
    }

    /** Decodes UTF-8 incrementally so multi-byte characters split across reads survive. */
    private void pump(String id, InputStream in) throws IOException {
        CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPLACE)
                .onUnmappableCharacter(CodingErrorAction.REPLACE);
        byte[] buf = new byte[8192];
        ByteBuffer bytes = ByteBuffer.allocate(16384);
        CharBuffer chars = CharBuffer.allocate(16384);
        int n;
        while ((n = in.read(buf)) != -1) {
            bytes.put(buf, 0, n);
            bytes.flip();
            decoder.decode(bytes, chars, false);
            bytes.compact();
            emitChars(id, chars);
        }
        bytes.flip();
        decoder.decode(bytes, chars, true);
        decoder.flush(chars);
        emitChars(id, chars);
    }

    private void emitChars(String id, CharBuffer chars) {
        chars.flip();
        if (chars.hasRemaining()) {
            JSObject chunk = event(id, "chunk");
            chunk.put("data", chars.toString());
            notifyListeners("event", chunk);
        }
        chars.clear();
    }

    private static JSObject event(String id, String type) {
        JSObject e = new JSObject();
        e.put("id", id);
        e.put("type", type);
        return e;
    }

    /** Returns an error message, or null when the URL is allowed. */
    static String checkUrl(String raw) {
        URL url;
        try {
            url = new URL(raw);
        } catch (IOException e) {
            return "invalid URL";
        }
        String scheme = url.getProtocol().toLowerCase(Locale.ROOT);
        if (scheme.equals("https")) return null;
        if (!scheme.equals("http")) return "unsupported URL scheme: " + scheme;
        return isLocalHost(url.getHost())
                ? null
                : "plain HTTP is only allowed for local and private-network addresses";
    }

    static boolean isLocalHost(String rawHost) {
        String host = rawHost.toLowerCase(Locale.ROOT).replace("[", "").replace("]", "");
        if (host.equals("localhost") || host.endsWith(".localhost") || host.endsWith(".local")) return true;
        String[] p = host.split("\\.");
        if (p.length == 4) {
            int[] o = new int[4];
            for (int i = 0; i < 4; i++) {
                if (!p[i].matches("\\d{1,3}")) return false;
                o[i] = Integer.parseInt(p[i]);
                if (o[i] > 255) return false;
            }
            return o[0] == 127 || o[0] == 10
                    || (o[0] == 172 && o[1] >= 16 && o[1] <= 31)
                    || (o[0] == 192 && o[1] == 168)
                    || (o[0] == 169 && o[1] == 254);
        }
        if (host.contains(":")) {
            if (host.equals("::1")) return true;
            String first = host.split(":")[0];
            if (first.isEmpty()) return false;
            try {
                int seg = Integer.parseInt(first, 16);
                return (seg & 0xfe00) == 0xfc00 || (seg & 0xffc0) == 0xfe80;
            } catch (NumberFormatException e) {
                return false;
            }
        }
        return false;
    }
}
