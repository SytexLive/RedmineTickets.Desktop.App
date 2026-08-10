use tauri::{LogicalPosition, LogicalSize, WebviewWindow};

const EXPANDED_WIDTH: f64 = 360.0;
const COLLAPSED_WIDTH: f64 = 42.0;

pub fn dock_webview_window(window: &WebviewWindow) -> Result<(), String> {
    let monitor = window
        .primary_monitor()
        .map_err(|_| "Could not read primary monitor".to_string())?
        .ok_or_else(|| "No primary monitor found".to_string())?;
    let size = monitor.size();
    let scale = monitor.scale_factor();
    let logical_width = size.width as f64 / scale;
    let logical_height = size.height as f64 / scale;

    window
        .set_always_on_top(true)
        .map_err(|_| "Could not keep panel on top".to_string())?;
    window
        .set_size(LogicalSize::new(EXPANDED_WIDTH, logical_height))
        .map_err(|_| "Could not size panel".to_string())?;
    window
        .set_position(LogicalPosition::new(logical_width - EXPANDED_WIDTH, 0.0))
        .map_err(|_| "Could not position panel".to_string())?;
    window
        .show()
        .map_err(|_| "Could not show panel".to_string())?;

    Ok(())
}

#[tauri::command]
pub fn dock_window(window: WebviewWindow) -> Result<(), String> {
    dock_webview_window(&window)
}

#[tauri::command]
pub fn expand_window(window: WebviewWindow) -> Result<(), String> {
    dock_webview_window(&window)
}

#[tauri::command]
pub fn collapse_window(window: WebviewWindow) -> Result<(), String> {
    let monitor = window
        .primary_monitor()
        .map_err(|_| "Could not read primary monitor".to_string())?
        .ok_or_else(|| "No primary monitor found".to_string())?;
    let size = monitor.size();
    let scale = monitor.scale_factor();
    let logical_width = size.width as f64 / scale;
    let logical_height = size.height as f64 / scale;

    window
        .set_always_on_top(true)
        .map_err(|_| "Could not keep panel on top".to_string())?;
    window
        .set_size(LogicalSize::new(COLLAPSED_WIDTH, logical_height))
        .map_err(|_| "Could not collapse panel".to_string())?;
    window
        .set_position(LogicalPosition::new(logical_width - COLLAPSED_WIDTH, 0.0))
        .map_err(|_| "Could not position collapsed panel".to_string())?;

    Ok(())
}

pub fn validate_ticket_url(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|_| "Invalid ticket URL".to_string())?;
    match parsed.scheme() {
        "http" | "https" => Ok(()),
        _ => Err("Ticket URL must start with http:// or https://".to_string()),
    }
}

#[tauri::command]
pub fn open_ticket_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    validate_ticket_url(&url)?;
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_url(url, None::<&str>)
        .map_err(|_| "Could not open ticket in browser".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_http_ticket_url() {
        assert_eq!(
            validate_ticket_url("file:///C:/secret.txt").unwrap_err(),
            "Ticket URL must start with http:// or https://"
        );
    }

    #[test]
    fn accepts_https_ticket_url() {
        assert!(validate_ticket_url("https://redmine.example.com/issues/42").is_ok());
    }
}
