use tauri::http::{Request, Response};

// Headers that must be stripped from proxied responses so the browser
// won't refuse to display the page in an iframe.
const STRIP_RESPONSE_HEADERS: &[&str] = &[
    "x-frame-options",
    "content-security-policy",
    "content-security-policy-report-only",
];

async fn proxy_fetch(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let uri = request.uri().to_string();

    // mvproxy://www.youtube.com/watch?v=... → https://www.youtube.com/watch?v=...
    let target = match uri.strip_prefix("mvproxy://") {
        Some(rest) => format!("https://{}", rest),
        None => {
            return Response::builder().status(400).body(b"bad request".to_vec()).unwrap();
        }
    };

    let client = match reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .redirect(reqwest::redirect::Policy::limited(5))
        .timeout(std::time::Duration::from_secs(20))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return Response::builder()
                .status(500)
                .body(format!("client error: {e}").into_bytes())
                .unwrap();
        }
    };

    let method = match request.method().as_str() {
        "POST" => reqwest::Method::POST,
        _ => reqwest::Method::GET,
    };

    let mut req = client.request(method, &target);

    // Forward safe request headers
    for (name, value) in request.headers() {
        let n = name.as_str().to_lowercase();
        if !matches!(n.as_str(), "host" | "origin" | "referer") {
            if let Ok(v) = value.to_str() {
                req = req.header(name.as_str(), v);
            }
        }
    }

    match req.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let mut builder = Response::builder().status(status);

            for (name, value) in resp.headers() {
                let n = name.as_str().to_lowercase();
                if STRIP_RESPONSE_HEADERS.contains(&n.as_str()) {
                    continue;
                }
                if let Ok(v) = value.to_str() {
                    builder = builder.header(name.as_str(), v);
                }
            }

            // Allow any origin to use this proxied content
            builder = builder.header("Access-Control-Allow-Origin", "*");

            let body = resp.bytes().await.unwrap_or_default().to_vec();
            builder.body(body).unwrap_or_else(|_| {
                Response::builder().status(500).body(vec![]).unwrap()
            })
        }
        Err(e) => Response::builder()
            .status(502)
            .header("Content-Type", "text/plain; charset=utf-8")
            .body(format!("proxy error: {e}").into_bytes())
            .unwrap(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .register_asynchronous_uri_scheme_protocol("mvproxy", |_app, request, responder| {
            tauri::async_runtime::spawn(async move {
                responder.respond(proxy_fetch(request).await);
            });
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .run(tauri::generate_context!())
        .expect("error while running MindVault");
}
