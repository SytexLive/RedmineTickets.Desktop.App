use serde::Serialize;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Monitor, WebviewWindow};

use crate::settings::{DockSide, PanelSettings};

const EXPANDED_WIDTH: f64 = 360.0;
const COLLAPSED_WIDTH: f64 = 42.0;

pub fn docked_window_position(
    monitor_x: f64,
    monitor_y: f64,
    monitor_width: f64,
    monitor_height: f64,
    window_width: f64,
    dock_side: DockSide,
) -> (f64, f64, f64, f64) {
    let x = match dock_side {
        DockSide::Left => monitor_x,
        DockSide::Right => monitor_x + monitor_width - window_width,
    };

    (x, monitor_y, window_width, monitor_height)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub index: usize,
    pub label: String,
    pub is_primary: bool,
}

fn primary_monitor_position(app: &AppHandle) -> Result<Option<tauri::PhysicalPosition<i32>>, String> {
    Ok(app
        .primary_monitor()
        .map_err(|_| "Could not read primary monitor".to_string())?
        .as_ref()
        .map(|monitor| *monitor.position()))
}

fn primary_monitor_position_for_window(
    window: &WebviewWindow,
) -> Result<Option<tauri::PhysicalPosition<i32>>, String> {
    Ok(window
        .primary_monitor()
        .map_err(|_| "Could not read primary monitor".to_string())?
        .as_ref()
        .map(|monitor| *monitor.position()))
}

fn order_monitors(
    monitors: Vec<Monitor>,
    primary_position: Option<tauri::PhysicalPosition<i32>>,
) -> Vec<Monitor> {
    let mut primary = Vec::new();
    let mut rest = Vec::new();

    for monitor in monitors {
        if primary_position
            .map(|position| position == *monitor.position())
            .unwrap_or(false)
        {
            primary.push(monitor);
        } else {
            rest.push(monitor);
        }
    }

    primary.extend(rest);
    primary
}

#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let primary_position = primary_monitor_position(&app)?;
    let monitors = order_monitors(
        app
        .available_monitors()
            .map_err(|_| "Could not read monitors".to_string())?,
        primary_position,
    );

    Ok(monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            let size = monitor.size();
            let is_primary = primary_position
                .map(|position| position == *monitor.position())
                .unwrap_or(index == 0);
            MonitorInfo {
                index,
                label: format!(
                    "Monitor {} ({}x{}){}",
                    index + 1,
                    size.width,
                    size.height,
                    if is_primary { " - Primary" } else { "" }
                ),
                is_primary,
            }
        })
        .collect())
}

fn selected_monitor(window: &WebviewWindow, settings: PanelSettings) -> Result<Monitor, String> {
    let primary_position = primary_monitor_position_for_window(window)?;
    let monitors = order_monitors(
        window
        .available_monitors()
            .map_err(|_| "Could not read monitors".to_string())?,
        primary_position,
    );

    if let Some(monitor) = monitors.into_iter().nth(settings.monitor_index) {
        return Ok(monitor);
    }

    window
        .primary_monitor()
        .map_err(|_| "Could not read primary monitor".to_string())?
        .ok_or_else(|| "No primary monitor found".to_string())
}

pub fn dock_webview_window(window: &WebviewWindow, settings: PanelSettings) -> Result<(), String> {
    let monitor = selected_monitor(window, settings)?;
    let work_area = monitor.work_area();
    let size = work_area.size;
    let position = work_area.position;
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
        EXPANDED_WIDTH,
        settings.dock_side,
    );

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
pub fn dock_window(window: WebviewWindow, settings: Option<PanelSettings>) -> Result<(), String> {
    dock_webview_window(&window, settings.unwrap_or_default())
}

#[tauri::command]
pub fn expand_window(window: WebviewWindow, settings: Option<PanelSettings>) -> Result<(), String> {
    dock_webview_window(&window, settings.unwrap_or_default())
}

#[tauri::command]
pub fn collapse_window(window: WebviewWindow, settings: Option<PanelSettings>) -> Result<(), String> {
    let settings = settings.unwrap_or_default();
    let monitor = selected_monitor(&window, settings)?;
    let work_area = monitor.work_area();
    let size = work_area.size;
    let position = work_area.position;
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
        settings.dock_side,
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
        let position =
            docked_window_position(1920.0, 0.0, 2560.0, 1440.0, 360.0, DockSide::Right);

        assert_eq!(position, (4120.0, 0.0, 360.0, 1440.0));
    }

    #[test]
    fn docks_to_left_side_of_selected_monitor() {
        let position =
            docked_window_position(-1920.0, 0.0, 1920.0, 1080.0, 360.0, DockSide::Left);

        assert_eq!(position, (-1920.0, 0.0, 360.0, 1080.0));
    }

    #[test]
    fn uses_work_area_height_to_avoid_taskbar() {
        let position =
            docked_window_position(0.0, 0.0, 1920.0, 1040.0, 360.0, DockSide::Right);

        assert_eq!(position, (1560.0, 0.0, 360.0, 1040.0));
    }
}
