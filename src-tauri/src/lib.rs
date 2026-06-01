use std::sync::Arc;
use tauri::{AppHandle, State, WebviewUrl, WebviewWindowBuilder};
use tauri::http::{Request, Response};
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use tantivy::{
    collector::TopDocs,
    directory::RamDirectory,
    query::QueryParser,
    schema::{Field, IndexRecordOption, Schema, Value, STRING, STORED, TEXT},
    Index, IndexWriter, TantivyDocument, Term,
};

// ---------------------------------------------------------------------------
// HTTP proxy (unchanged)
// ---------------------------------------------------------------------------

const STRIP_RESPONSE_HEADERS: &[&str] = &[
    "x-frame-options",
    "content-security-policy",
    "content-security-policy-report-only",
];

async fn proxy_fetch(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    // The webview issues a CORS preflight (OPTIONS) before WebDAV verbs such as
    // PROPFIND/PUT/MKCOL and before requests carrying custom headers (Depth,
    // Authorization, Destination). Approve it locally — never forward upstream.
    if request.method().as_str().eq_ignore_ascii_case("OPTIONS") {
        let allow_headers = request
            .headers()
            .get("access-control-request-headers")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Authorization, Content-Type, Depth, Destination, Overwrite".to_string());
        return Response::builder()
            .status(204)
            .header("Access-Control-Allow-Origin", "*")
            .header(
                "Access-Control-Allow-Methods",
                "GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK",
            )
            .header("Access-Control-Allow-Headers", allow_headers)
            .header("Access-Control-Max-Age", "86400")
            .body(Vec::new())
            .unwrap();
    }

    let uri = request.uri().to_string();
    let target = match uri.strip_prefix("mvproxy://") {
        Some(rest) => format!("https://{}", rest),
        None => return Response::builder().status(400).body(b"bad request".to_vec()).unwrap(),
    };

    let client = match reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
        .redirect(reqwest::redirect::Policy::limited(5))
        .timeout(std::time::Duration::from_secs(60))
        .build()
    {
        Ok(c) => c,
        Err(e) => return Response::builder().status(500).body(format!("client error: {e}").into_bytes()).unwrap(),
    };

    // Preserve the real HTTP method — WebDAV relies on PROPFIND, PUT, MKCOL,
    // DELETE, MOVE, COPY, etc. Anything unparseable falls back to GET.
    let method = reqwest::Method::from_bytes(request.method().as_str().as_bytes())
        .unwrap_or(reqwest::Method::GET);

    // Copy forwardable headers before consuming the request to take its body.
    let mut fwd_headers: Vec<(String, String)> = Vec::new();
    for (name, value) in request.headers() {
        let n = name.as_str().to_lowercase();
        if !matches!(n.as_str(), "host" | "origin" | "referer") {
            if let Ok(v) = value.to_str() { fwd_headers.push((name.as_str().to_string(), v.to_string())); }
        }
    }
    let body = request.into_body();

    let mut req = client.request(method, &target);
    for (name, v) in fwd_headers { req = req.header(name.as_str(), v); }
    // PROPFIND carries an XML query body; PUT carries the file contents.
    if !body.is_empty() { req = req.body(body); }

    match req.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let mut builder = Response::builder().status(status);
            for (name, value) in resp.headers() {
                let n = name.as_str().to_lowercase();
                if STRIP_RESPONSE_HEADERS.contains(&n.as_str()) { continue; }
                if let Ok(v) = value.to_str() { builder = builder.header(name.as_str(), v); }
            }
            builder = builder.header("Access-Control-Allow-Origin", "*");
            let body = resp.bytes().await.unwrap_or_default().to_vec();
            builder.body(body).unwrap_or_else(|_| Response::builder().status(500).body(vec![]).unwrap())
        }
        Err(e) => Response::builder().status(502)
            .header("Content-Type", "text/plain; charset=utf-8")
            .header("Access-Control-Allow-Origin", "*")
            .body(format!("proxy error: {e}").into_bytes())
            .unwrap(),
    }
}

// ---------------------------------------------------------------------------
// In-app browser command (unchanged)
// ---------------------------------------------------------------------------

#[tauri::command]
fn open_app_browser(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = url.parse::<reqwest::Url>().map_err(|e| e.to_string())?;
    let label = format!("appbrowser-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());
    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(parsed))
        .title("Kairos — Browser").inner_size(1100.0, 760.0).resizable(true)
        .build().map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tantivy full-text search state
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteDoc {
    pub id: String,
    pub title: String,
    pub content: String,
    pub tags: String,
}

#[derive(Debug, Serialize)]
pub struct SearchHit {
    pub id: String,
    pub score: f32,
}

struct TantivyFields {
    id:      Field,
    title:   Field,
    content: Field,
    tags:    Field,
}

pub struct SearchState {
    index:  Option<Index>,
    writer: Option<Arc<Mutex<IndexWriter>>>,
    fields: Option<TantivyFields>,
    schema: Option<Schema>,
}

impl Default for SearchState { fn default() -> Self { Self { index: None, writer: None, fields: None, schema: None } } }
pub type SearchHandle = Arc<Mutex<SearchState>>;

fn build_schema() -> (Schema, TantivyFields) {
    let mut b = Schema::builder();
    let id      = b.add_text_field("id",      STRING | STORED);
    let title   = b.add_text_field("title",   TEXT | STORED);
    let content = b.add_text_field("content", TEXT);
    let tags    = b.add_text_field("tags",    TEXT);
    (b.build(), TantivyFields { id, title, content, tags })
}

// ---------------------------------------------------------------------------
// Tantivy Tauri commands
// ---------------------------------------------------------------------------

/// Rebuild the full in-memory index from all notes.
/// Called once after phase-2 content load; fast (Rust + RAM).
#[tauri::command]
async fn build_search_index(
    notes: Vec<NoteDoc>,
    state: State<'_, SearchHandle>,
) -> Result<(), String> {
    let mut guard = state.lock().await;
    let (schema, fields) = build_schema();
    let dir   = RamDirectory::create();
    let index = Index::open_or_create(dir, schema.clone()).map_err(|e| e.to_string())?;
    let mut writer: IndexWriter = index.writer(50_000_000).map_err(|e| e.to_string())?;

    for note in &notes {
        let mut doc = TantivyDocument::default();
        doc.add_text(fields.id,      &note.id);
        doc.add_text(fields.title,   &note.title);
        // Truncate content to 8 KB — same limit as MiniSearch side
        doc.add_text(fields.content, &note.content[..note.content.len().min(8192)]);
        doc.add_text(fields.tags,    &note.tags);
        writer.add_document(doc).map_err(|e| e.to_string())?;
    }
    writer.commit().map_err(|e| e.to_string())?;

    let writer_arc = Arc::new(Mutex::new(writer));
    guard.schema = Some(schema);
    guard.fields = Some(fields);
    guard.writer = Some(writer_arc);
    guard.index  = Some(index);
    Ok(())
}

/// Add or replace a single note in the index after a save.
#[tauri::command]
async fn update_note_index(
    note: NoteDoc,
    state: State<'_, SearchHandle>,
) -> Result<(), String> {
    let guard = state.lock().await;
    let (Some(index), Some(writer_arc), Some(fields)) =
        (guard.index.as_ref(), guard.writer.as_ref(), guard.fields.as_ref())
    else { return Ok(()); };  // index not built yet — skip

    let id_term = Term::from_field_text(fields.id, &note.id);
    let reader  = index.reader().map_err(|e| e.to_string())?;
    let _ = reader; // suppress unused

    let mut writer = writer_arc.lock().await;
    writer.delete_term(id_term);
    let mut doc = TantivyDocument::default();
    doc.add_text(fields.id,      &note.id);
    doc.add_text(fields.title,   &note.title);
    doc.add_text(fields.content, &note.content[..note.content.len().min(8192)]);
    doc.add_text(fields.tags,    &note.tags);
    writer.add_document(doc).map_err(|e| e.to_string())?;
    writer.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove a note from the index.
#[tauri::command]
async fn remove_note_index(
    id: String,
    state: State<'_, SearchHandle>,
) -> Result<(), String> {
    let guard = state.lock().await;
    let (Some(_), Some(writer_arc), Some(fields)) =
        (guard.index.as_ref(), guard.writer.as_ref(), guard.fields.as_ref())
    else { return Ok(()); };
    let id_term = Term::from_field_text(fields.id, &id);
    let mut writer = writer_arc.lock().await;
    writer.delete_term(id_term);
    writer.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Full-text search — returns up to 50 hits ordered by score.
#[tauri::command]
async fn search_fulltext(
    query: String,
    state: State<'_, SearchHandle>,
) -> Result<Vec<SearchHit>, String> {
    let guard = state.lock().await;
    let (Some(index), Some(schema), Some(fields)) =
        (guard.index.as_ref(), guard.schema.as_ref(), guard.fields.as_ref())
    else { return Ok(vec![]); };

    let reader = index.reader().map_err(|e| e.to_string())?;
    let searcher = reader.searcher();

    // Boost title × 3 over content, include tags
    let mut qp = QueryParser::for_index(index, vec![fields.title, fields.content, fields.tags]);
    qp.set_field_boost(fields.title, 3.0);
    qp.set_field_boost(fields.tags,  2.0);
    // Gracefully handle invalid query syntax
    let q = match qp.parse_query(&query) {
        Ok(q) => q,
        Err(_) => {
            let escaped = tantivy::query::TermQuery::new(
                Term::from_field_text(fields.title, &query),
                IndexRecordOption::Basic,
            );
            Box::new(escaped)
        }
    };

    let top_docs = searcher.search(&q, &TopDocs::with_limit(50).order_by_score()).map_err(|e| e.to_string())?;
    let id_field = schema.get_field("id").map_err(|e| e.to_string())?;

    let mut hits = Vec::with_capacity(top_docs.len());
    for (score, addr) in top_docs {
        let doc: TantivyDocument = searcher.doc(addr).map_err(|e| e.to_string())?;
        if let Some(id) = doc.get_first(id_field).and_then(|v| v.as_str()) {
            hits.push(SearchHit { id: id.to_string(), score });
        }
    }
    Ok(hits)
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let search_state: SearchHandle = Arc::new(Mutex::new(SearchState::default()));

    tauri::Builder::default()
        .manage(search_state)
        .invoke_handler(tauri::generate_handler![
            open_app_browser,
            build_search_index,
            update_note_index,
            remove_note_index,
            search_fulltext,
        ])
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
        .expect("error while running Kairos");
}
