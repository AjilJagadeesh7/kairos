//! On-device model files (P8, `local-llm` feature = Full build only):
//! device check, and downloads from a fixed, pinned list with resume,
//! pause, progress and SHA-256 verification. A file is moved into place only
//! after its checksum matches, so a model on disk is always a verified one.
//! The list mirrors `src/ai/onDevice/models.ts`; anything else is refused.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub struct PinnedModel {
    pub id: &'static str,
    pub url: &'static str,
    pub sha256: &'static str,
    pub size: u64,
}

/// Hugging Face, openbmb, Apache-2.0 — each URL pinned to a repository revision.
pub const MODELS: &[PinnedModel] = &[
    PinnedModel {
        id: "minicpm5-1b-q4km",
        url: "https://huggingface.co/openbmb/MiniCPM5-1B-GGUF/resolve/3d55fac80935ae6456986ad2384b5cbcc4d6c948/MiniCPM5-1B-Q4_K_M.gguf",
        sha256: "81b64d05a23b17b34c475f42b3e72fbde62d4b92cc34541f7a8031d0752deafa",
        size: 688_065_920,
    },
    PinnedModel {
        id: "minicpm5-2b-q4km",
        url: "https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/resolve/2079a22f3beaa4e306449978533478fe0522f4b3/MiniCPM5-2B-Q4_K_M.gguf",
        sha256: "ec2d5801640099e97d8d7e8003ad4d81f336e757811f03a26173dddf386602fd",
        size: 1_561_318_368,
    },
];

fn pinned(id: &str) -> Result<&'static PinnedModel, String> {
    MODELS.iter().find(|m| m.id == id).ok_or_else(|| format!("unknown model {id}"))
}

/// Pause flags for downloads in progress.
#[derive(Default)]
pub struct Downloads(Mutex<HashMap<String, Arc<AtomicBool>>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    total_ram: u64,
    available_ram: u64,
    free_disk: u64,
}

#[derive(Serialize)]
pub struct ModelStatus {
    id: String,
    state: &'static str,
    bytes: u64,
    path: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DownloadEvent {
    Progress { done: u64, total: u64 },
    Verifying,
    Done { path: String },
    Paused { done: u64 },
    Error { message: String },
}

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("models");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn paths(dir: &Path, id: &str) -> (PathBuf, PathBuf) {
    (dir.join(format!("{id}.gguf")), dir.join(format!("{id}.gguf.part")))
}

#[tauri::command]
pub fn model_device_info(app: AppHandle) -> Result<DeviceInfo, String> {
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    // Free space on the volume holding the models folder: the disk with the longest matching mount point.
    let dir = models_dir(&app)?;
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let free_disk = disks
        .list()
        .iter()
        .filter(|d| dir.starts_with(d.mount_point()))
        .max_by_key(|d| d.mount_point().as_os_str().len())
        .map(|d| d.available_space())
        .unwrap_or(0);
    Ok(DeviceInfo { total_ram: sys.total_memory(), available_ram: sys.available_memory(), free_disk })
}

#[tauri::command]
pub fn model_status(app: AppHandle, id: String) -> Result<ModelStatus, String> {
    pinned(&id)?;
    let (done, part) = paths(&models_dir(&app)?, &id);
    if let Ok(m) = std::fs::metadata(&done) {
        return Ok(ModelStatus { id, state: "ready", bytes: m.len(), path: Some(done.to_string_lossy().into_owned()) });
    }
    let bytes = std::fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    Ok(ModelStatus { id, state: if bytes > 0 { "partial" } else { "none" }, bytes, path: None })
}

#[tauri::command]
pub fn model_pause(downloads: State<'_, Downloads>, id: String) {
    if let Some(flag) = downloads.0.lock().unwrap().get(&id) {
        flag.store(true, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn model_delete(app: AppHandle, downloads: State<'_, Downloads>, id: String) -> Result<(), String> {
    model_pause(downloads, id.clone());
    let (done, part) = paths(&models_dir(&app)?, &id);
    for p in [done, part] {
        if p.exists() {
            std::fs::remove_file(&p).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// SHA-256 of a file, read in 8 MB blocks.
pub async fn sha256_file(path: &Path) -> Result<String, String> {
    let mut f = tokio::fs::File::open(path).await.map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 8 * 1024 * 1024];
    loop {
        let n = f.read(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Downloads `url` into `part` (resuming from its current length), verifies size and
/// SHA-256, then moves it to `done`. Shared by the command and the tests.
pub async fn download_to(
    client: &reqwest::Client, url: &str, sha256: &str, size: u64, part: &Path, done: &Path,
    paused: &AtomicBool, emit: &(dyn Fn(DownloadEvent) + Sync),
) -> Result<(), String> {
    let mut have = tokio::fs::metadata(part).await.map(|m| m.len()).unwrap_or(0);
    if have > size {
        tokio::fs::remove_file(part).await.ok();
        have = 0;
    }
    if have < size {
        let mut req = client.get(url);
        if have > 0 {
            req = req.header(reqwest::header::RANGE, format!("bytes={have}-"));
        }
        let mut resp = req.send().await.map_err(|e| format!("download failed: {e}"))?;
        let status = resp.status();
        // 200 to a Range request means the server sent the whole file: start over.
        let append = status == reqwest::StatusCode::PARTIAL_CONTENT;
        if !(status.is_success()) {
            return Err(format!("download failed: the server answered {status}"));
        }
        if !append {
            have = 0;
        }
        let mut file = tokio::fs::OpenOptions::new()
            .create(true).write(true).append(append).truncate(!append)
            .open(part).await.map_err(|e| e.to_string())?;
        let mut last = Instant::now();
        while let Some(chunk) = resp.chunk().await.map_err(|e| format!("download interrupted: {e}"))? {
            file.write_all(&chunk).await.map_err(|e| e.to_string())?;
            have += chunk.len() as u64;
            if paused.load(Ordering::SeqCst) {
                file.flush().await.ok();
                emit(DownloadEvent::Paused { done: have });
                return Ok(());
            }
            if last.elapsed() >= Duration::from_millis(250) {
                emit(DownloadEvent::Progress { done: have, total: size });
                last = Instant::now();
            }
        }
        file.flush().await.map_err(|e| e.to_string())?;
        emit(DownloadEvent::Progress { done: have, total: size });
    }
    if have != size {
        return Err(format!("download incomplete: {have} of {size} bytes — try again to resume"));
    }
    emit(DownloadEvent::Verifying);
    let actual = sha256_file(part).await?;
    if actual != sha256 {
        tokio::fs::remove_file(part).await.ok();
        return Err("the downloaded file failed SHA-256 verification and was deleted — try again".into());
    }
    tokio::fs::rename(part, done).await.map_err(|e| e.to_string())?;
    emit(DownloadEvent::Done { path: done.to_string_lossy().into_owned() });
    Ok(())
}

#[tauri::command]
pub async fn model_download(
    app: AppHandle, downloads: State<'_, Downloads>, id: String, on_event: Channel<DownloadEvent>,
) -> Result<(), String> {
    let model = pinned(&id)?;
    let dir = models_dir(&app)?;
    let (done, part) = paths(&dir, &id);
    if done.exists() {
        let _ = on_event.send(DownloadEvent::Done { path: done.to_string_lossy().into_owned() });
        return Ok(());
    }
    let flag = Arc::new(AtomicBool::new(false));
    downloads.0.lock().unwrap().insert(id.clone(), flag.clone());
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let ch = on_event.clone();
    let result = download_to(&client, model.url, model.sha256, model.size, &part, &done, &flag, &move |e| {
        let _ = ch.send(e);
    })
    .await;
    downloads.0.lock().unwrap().remove(&id);
    if let Err(message) = &result {
        let _ = on_event.send(DownloadEvent::Error { message: message.clone() });
    }
    result
}

#[cfg(test)]
#[path = "local_model_tests.rs"]
mod tests;
