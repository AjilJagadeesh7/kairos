/**
 * Open a URL in the user's external browser. Uses the Tauri shell opener on
 * desktop (capability `shell:allow-open`) and falls back to `window.open`
 * on web / Android.
 */
export async function openExternal(url: string): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
