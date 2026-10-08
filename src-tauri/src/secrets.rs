//! OS secret storage (Windows Credential Manager, macOS Keychain, Linux Secret
//! Service) for API keys and sync credentials. Values never touch the vault,
//! the webview's localStorage, or logs.

const SERVICE: &str = "com.kairos.app";

fn entry(key: &str) -> Result<keyring::Entry, String> {
    if key.is_empty() || key.len() > 200 {
        return Err("invalid secret key".into());
    }
    keyring::Entry::new(SERVICE, key).map_err(|e| format!("secure storage unavailable: {e}"))
}

#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("secure storage read failed: {e}")),
    }
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    entry(&key)?
        .set_password(&value)
        .map_err(|e| format!("secure storage write failed: {e}"))
}

#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("secure storage delete failed: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Touches the real OS keychain — run manually: `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn os_keychain_round_trip() {
        let key = "kairos.test.roundtrip".to_string();
        secret_set(key.clone(), "s3cret-é".into()).unwrap();
        assert_eq!(secret_get(key.clone()).unwrap().as_deref(), Some("s3cret-é"));
        secret_delete(key.clone()).unwrap();
        assert_eq!(secret_get(key.clone()).unwrap(), None);
        secret_delete(key).unwrap(); // deleting a missing entry is not an error
    }
}
