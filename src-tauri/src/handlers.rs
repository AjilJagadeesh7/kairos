//! The app's Tauri command list, shared by the Lite and Full builds.

/// Commands every build has, plus the on-device ones in the Full build (`local-llm`).
macro_rules! app_handlers {
    ($($extra:path),*) => {
        tauri::generate_handler![
            build_search_index,
            update_note_index,
            remove_note_index,
            search_fulltext,
            recognize_ink_available,
            recognize_ink,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
            ai_http::ai_http_stream,
            ai_http::ai_http_abort
            $(, $extra)*
        ]
    };
}

