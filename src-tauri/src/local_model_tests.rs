use super::*;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;

/// A tiny HTTP server that serves `body`, honouring `Range: bytes=N-`.
fn serve(body: Vec<u8>, requests: usize) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        for stream in listener.incoming().take(requests) {
            let mut stream = stream.unwrap();
            let mut start = 0usize;
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            loop {
                let mut line = String::new();
                reader.read_line(&mut line).unwrap();
                if line == "\r\n" || line.is_empty() { break }
                if let Some(r) = line.to_ascii_lowercase().strip_prefix("range: bytes=") {
                    start = r.trim().trim_end_matches('-').parse().unwrap();
                }
            }
            let slice = &body[start..];
            let status = if start > 0 { "206 Partial Content" } else { "200 OK" };
            write!(stream, "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", slice.len()).unwrap();
            stream.write_all(slice).unwrap();
        }
    });
    format!("http://{addr}/model.gguf")
}

fn sha(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

#[tokio::test]
async fn resumes_from_a_partial_file_and_verifies() {
    let body: Vec<u8> = (0..300_000u32).map(|i| (i % 251) as u8).collect();
    let url = serve(body.clone(), 1);
    let dir = tempdir();
    let (done, part) = (dir.join("m.gguf"), dir.join("m.gguf.part"));
    std::fs::write(&part, &body[..100_000]).unwrap();
    let events = Mutex::new(Vec::new());
    let never = AtomicBool::new(false);
    download_to(&reqwest::Client::new(), &url, &sha(&body), body.len() as u64, &part, &done, &never, &|e| {
        events.lock().unwrap().push(serde_json::to_string(&e).unwrap())
    }).await.unwrap();
    assert_eq!(std::fs::read(&done).unwrap(), body);
    assert!(!part.exists());
    let ev = events.lock().unwrap().join("\n");
    assert!(ev.contains("\"verifying\"") && ev.contains("\"done\""));
}

#[tokio::test]
async fn rejects_a_checksum_mismatch_and_deletes_the_file() {
    let body = vec![7u8; 50_000];
    let url = serve(body.clone(), 1);
    let dir = tempdir();
    let (done, part) = (dir.join("m.gguf"), dir.join("m.gguf.part"));
    let never = AtomicBool::new(false);
    let err = download_to(&reqwest::Client::new(), &url, &"0".repeat(64), body.len() as u64, &part, &done, &never, &|_| {})
        .await.unwrap_err();
    assert!(err.contains("SHA-256"));
    assert!(!done.exists() && !part.exists());
}

#[tokio::test]
async fn pause_keeps_the_partial_file_for_resume() {
    let body = vec![1u8; 2_000_000];
    let url = serve(body.clone(), 1);
    let dir = tempdir();
    let (done, part) = (dir.join("m.gguf"), dir.join("m.gguf.part"));
    let paused = AtomicBool::new(true);
    download_to(&reqwest::Client::new(), &url, &sha(&body), body.len() as u64, &part, &done, &paused, &|_| {})
        .await.unwrap();
    assert!(!done.exists());
    let kept = std::fs::metadata(&part).unwrap().len();
    assert!(kept > 0 && kept < body.len() as u64);
}

#[test]
fn only_pinned_models_are_known() {
    assert!(pinned("minicpm5-2b-q4km").is_ok());
    assert!(pinned("../../etc/passwd").is_err());
    assert!(MODELS.iter().all(|m| m.url.starts_with("https://huggingface.co/openbmb/") && m.sha256.len() == 64));
}

fn tempdir() -> PathBuf {
    let d = std::env::temp_dir().join(format!("kairos-model-test-{}-{}", std::process::id(), rand_suffix()));
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn rand_suffix() -> u128 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
}
