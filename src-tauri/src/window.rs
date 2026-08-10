use tauri::{LogicalPosition, LogicalSize, WebviewWindow};

const EXPANDED_WIDTH: f64 = 360.0;
const COLLAPSED_WIDTH: f64 = 42.0;

pub fn docked_window_position(
    monitor_x: f64,
    monitor_y: f64,
    monitor_width: f64,
    monitor_height: f64,
    window_width: f64,
) -> (f64, f64, f64, f64) {
    (
        monitor_x + monitor_width - window_width,
        monitor_y,
        window_width,
        monitor_height,
    )
}

pub fn dock_webview_window(window: &WebviewWindow) -> Result<(), String> {
    let monitor = window
        .primary_monitor()
        .map_err(|_| "Could not read primary monitor".to_string())?
        .ok_or_else(|| "No primary monitor found".to_string())?;
    let size = monitor.size();
    let position = monitor.position();
    let scale = monitor.scale_factor();
    let logical_width = size.width as f64 / scale;
    let logical_height = size.height as f64 / scale;
    let logical_x = position.x as f64 / scale;
    let logical_y = position.y as f64 / scale;
    let (x, y, width, height) =
        docked_window_position(logical_x, logical_y, logical_width, logical_height, EXPANDED_WIDTH);

    window
        .set_always_on_top(true)
        .map_err(|_| "Could not keep panel on top".to_string())?;
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|_| "Could not size panel".to_string())?;
    window
        .set_position(LogicalPosition::new(x, y))
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
    let position = monitor.position();
    let scale = monitor.scale_factor();
    let logical_width = size.width as f64 / scale;
    let logical_height = size.height as f64 / scale;
    let logical_x = position.x as f64 / scale;
    let logical_y = position.y as f64 / scale;
    let (x, y, width, height) = docked_window_position(
        logical_x,
        logical_y,
        logical_width,
        logical_height,
        COLLAPSED_WIDTH,
    );

    window
        .set_always_on_top(true)
        .map_err(|_| "Could not keep panel on top".to_string())?;
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|_| "Could not collapse panel".to_string())?;
    window
        .set_position(LogicalPosition::new(x, y))
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

    #[test]
    fn docks_inside_primary_monitor_with_global_origin() {
        let position = docked_window_position(1920.0, 0.0, 2560.0, 1440.0, 360.0);

        assert_eq!(position, (4120.0, 0.0, 360.0, 1440.0));
    }
}
