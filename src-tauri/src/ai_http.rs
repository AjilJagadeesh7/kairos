//! Streaming HTTP for AI providers.
//!
//! The webview cannot stream through the `mvproxy://` scheme (it buffers the
//! whole body) and is subject to CORS, so provider requests run here and the
//! response body is pushed to JS chunk by chunk over a Tauri `Channel`.
//! `ai_http_abort` cancels the task, which drops the connection — servers such
//! as Ollama stop generating when the client disconnects.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::async_runtime::JoinHandle;
use tauri::ipc::Channel;
use tauri::State;
use tokio::sync::Mutex;

pub type AiHttpHandles = Arc<Mutex<HashMap<String, JoinHandle<()>>>>;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHttpRequest {
    id: String,
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AiHttpEvent {
    Head { status: u16 },
    Chunk { data: String },
    End,
    Error { message: String },
}

/// Plain HTTP is allowed only for loopback, private-LAN and `.local` hosts;
/// everything else must be HTTPS. Mirrors `src/ai/net/urlPolicy.ts`.
fn url_allowed(url: &reqwest::Url) -> Result<(), String> {
    match url.scheme() {
        "https" => Ok(()),
        "http" => {
            let local = match url.host() {
                Some(url::Host::Domain(d)) => {
                    let d = d.to_ascii_lowercase();
                    d == "localhost" || d.ends_with(".localhost") || d.ends_with(".local")
                }
                Some(url::Host::Ipv4(ip)) => is_private(IpAddr::V4(ip)),
                Some(url::Host::Ipv6(ip)) => is_private(IpAddr::V6(ip)),
                None => false,
            };
            if local { Ok(()) } else { Err("plain HTTP is only allowed for local and private-network addresses".into()) }
        }
        other => Err(format!("unsupported URL scheme: {other}")),
    }
}

fn is_private(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_loopback() || v4.is_private() || v4.is_link_local(),
        IpAddr::V6(v6) => {
            let first = v6.segments()[0];
            v6.is_loopback()
                || (first & 0xfe00) == 0xfc00 // unique local fc00::/7
                || (first & 0xffc0) == 0xfe80 // link local fe80::/10
        }
    }
}

/// Decode the longest valid UTF-8 prefix of `buf`, leaving a split multi-byte
/// character at the end for the next chunk.
fn take_utf8(buf: &mut Vec<u8>) -> String {
    match std::str::from_utf8(buf) {
        Ok(s) => {
            let out = s.to_owned();
            buf.clear();
            out
        }
        Err(e) if e.error_len().is_none() => {
            let valid = e.valid_up_to();
            let out = String::from_utf8_lossy(&buf[..valid]).into_owned();
            buf.drain(..valid);
            out
        }
        Err(_) => {
            let out = String::from_utf8_lossy(buf).into_owned();
            buf.clear();
            out
        }
    }
}

async fn run(req: AiHttpRequest, ch: Channel<AiHttpEvent>) {
    let fail = |message: String| { let _ = ch.send(AiHttpEvent::Error { message }); };

    let client = match reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 3 || url_allowed(attempt.url()).is_err() {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }))
        .build()
    {
        Ok(c) => c,
        Err(e) => return fail(format!("client error: {}", e.without_url())),
    };

    let method = reqwest::Method::from_bytes(req.method.as_bytes()).unwrap_or(reqwest::Method::POST);
    let mut builder = client.request(method, &req.url);
    for (k, v) in &req.headers {
        builder = builder.header(k, v);
    }
    if let Some(body) = req.body {
        builder = builder.body(body);
    }

    let mut resp = match builder.send().await {
        Ok(r) => r,
        // without_url(): provider URLs can carry keys in the query string.
        Err(e) => return fail(format!("request failed: {}", e.without_url())),
    };
    if ch.send(AiHttpEvent::Head { status: resp.status().as_u16() }).is_err() {
        return;
    }

    let mut pending: Vec<u8> = Vec::new();
    loop {
        match resp.chunk().await {
            Ok(Some(bytes)) => {
                pending.extend_from_slice(&bytes);
                let data = take_utf8(&mut pending);
                if !data.is_empty() && ch.send(AiHttpEvent::Chunk { data }).is_err() {
                    return;
                }
            }
            Ok(None) => break,
            Err(e) => return fail(format!("stream interrupted: {}", e.without_url())),
        }
    }
    if !pending.is_empty() {
        let _ = ch.send(AiHttpEvent::Chunk { data: String::from_utf8_lossy(&pending).into_owned() });
    }
    let _ = ch.send(AiHttpEvent::End);
}

#[tauri::command]
pub async fn ai_http_stream(
    request: AiHttpRequest,
    on_event: Channel<AiHttpEvent>,
    handles: State<'_, AiHttpHandles>,
) -> Result<(), String> {
    let parsed = reqwest::Url::parse(&request.url).map_err(|_| "invalid URL".to_string())?;
    url_allowed(&parsed)?;

    let id = request.id.clone();
    let map = handles.inner().clone();
    // Hold the lock across spawn + insert so the task's own cleanup can't run first.
    let mut guard = handles.lock().await;
    let task_id = id.clone();
    let task = tauri::async_runtime::spawn(async move {
        run(request, on_event).await;
        map.lock().await.remove(&task_id);
    });
    guard.insert(id, task);
    Ok(())
}

#[tauri::command]
pub async fn ai_http_abort(id: String, handles: State<'_, AiHttpHandles>) -> Result<(), String> {
    if let Some(task) = handles.lock().await.remove(&id) {
        task.abort();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn allowed(u: &str) -> bool {
        url_allowed(&reqwest::Url::parse(u).unwrap()).is_ok()
    }

    #[test]
    fn url_policy() {
        assert!(allowed("https://api.openai.com/v1"));
        assert!(allowed("http://localhost:11434/v1"));
        assert!(allowed("http://127.0.0.1:1234"));
        assert!(allowed("http://192.168.1.20:11434"));
        assert!(allowed("http://10.0.2.2:11434"));
        assert!(allowed("http://172.20.0.5"));
        assert!(allowed("http://[::1]:8080"));
        assert!(allowed("http://nas.local:11434"));
        assert!(!allowed("http://example.com"));
        assert!(!allowed("http://8.8.8.8"));
        assert!(!allowed("http://172.32.0.1"));
        assert!(!allowed("ftp://localhost"));
    }

    #[test]
    fn utf8_split() {
        let mut buf = "héllo".as_bytes()[..2].to_vec(); // "h" + first byte of "é"
        assert_eq!(take_utf8(&mut buf), "h");
        assert_eq!(buf.len(), 1);
        buf.extend_from_slice(&"héllo".as_bytes()[2..]);
        assert_eq!(take_utf8(&mut buf), "éllo");
        assert!(buf.is_empty());
    }
}
