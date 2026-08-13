use serde::Serialize;
use tauri::{AppHandle, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::settings::{DockSide, PanelSettings};

const EXPANDED_WIDTH: f64 = 360.0;
const COLLAPSED_HOTSPOT_WIDTH: f64 = 8.0;

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

pub fn docked_window_frame(
    monitor_position: (f64, f64),
    monitor_size: (f64, f64),
    work_area_position: (f64, f64),
    work_area_size: (f64, f64),
    window_width: f64,
    dock_side: DockSide,
) -> (f64, f64, f64, f64) {
    let (monitor_x, _) = monitor_position;
    let (monitor_width, _) = monitor_size;
    let (_, work_area_y) = work_area_position;
    let (_, work_area_height) = work_area_size;

    docked_window_position(
        monitor_x,
        work_area_y,
        monitor_width,
        work_area_height,
        window_width,
        dock_side,
    )
}

pub fn collapsed_window_frame(
    monitor_position: (f64, f64),
    monitor_size: (f64, f64),
    work_area_position: (f64, f64),
    work_area_size: (f64, f64),
    dock_side: DockSide,
) -> (f64, f64, f64, f64) {
    let (monitor_x, _) = monitor_position;
    let (monitor_width, _) = monitor_size;
    let (_, work_area_y) = work_area_position;
    let (_, work_area_height) = work_area_size;
    let x = match dock_side {
        DockSide::Left => monitor_x,
        DockSide::Right => monitor_x + monitor_width - COLLAPSED_HOTSPOT_WIDTH,
    };

    (x, work_area_y, COLLAPSED_HOTSPOT_WIDTH, work_area_height)
}

fn scaled_dimension(logical_dimension: f64, scale: f64) -> u32 {
    (logical_dimension * scale).round() as u32
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub index: usize,
    pub label: String,
    pub is_primary: bool,
}

fn primary_monitor_position(
    app: &AppHandle,
) -> Result<Option<tauri::PhysicalPosition<i32>>, String> {
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
        app.available_monitors()
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
    let monitor_size = monitor.size();
    let monitor_position = monitor.position();
    let work_area = monitor.work_area();
    let size = work_area.size;
    let position = work_area.position;
    let scale = monitor.scale_factor();
    let physical_window_width = scaled_dimension(EXPANDED_WIDTH, scale) as f64;
    let (x, y, width, height) = docked_window_frame(
        (monitor_position.x as f64, monitor_position.y as f64),
        (monitor_size.width as f64, monitor_size.height as f64),
        (position.x as f64, position.y as f64),
        (size.width as f64, size.height as f64),
        physical_window_width,
        settings.dock_side,
    );

    window
        .set_always_on_top(true)
        .map_err(|_| "Could not keep panel on top".to_string())?;
    window
        .set_size(PhysicalSize::new(
            width.round() as u32,
            height.round() as u32,
        ))
        .map_err(|_| "Could not size panel".to_string())?;
    window
        .set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
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
pub fn collapse_window(
    window: WebviewWindow,
    settings: Option<PanelSettings>,
) -> Result<(), String> {
    let settings = settings.unwrap_or_default();
    let monitor = selected_monitor(&window, settings)?;
    let monitor_size = monitor.size();
    let monitor_position = monitor.position();
    let work_area = monitor.work_area();
    let size = work_area.size;
    let position = work_area.position;
    let (x, y, width, height) = collapsed_window_frame(
        (monitor_position.x as f64, monitor_position.y as f64),
        (monitor_size.width as f64, monitor_size.height as f64),
        (position.x as f64, position.y as f64),
        (size.width as f64, size.height as f64),
        settings.dock_side,
    );

    window
        .set_always_on_top(true)
        .map_err(|_| "Could not keep panel on top".to_string())?;
    window
        .set_size(PhysicalSize::new(
            width.round() as u32,
            height.round() as u32,
        ))
        .map_err(|_| "Could not collapse panel".to_string())?;
    window
        .set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
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
        let position = docked_window_position(1920.0, 0.0, 2560.0, 1440.0, 360.0, DockSide::Right);

        assert_eq!(position, (4120.0, 0.0, 360.0, 1440.0));
    }

    #[test]
    fn docks_to_left_side_of_selected_monitor() {
        let position = docked_window_position(-1920.0, 0.0, 1920.0, 1080.0, 360.0, DockSide::Left);

        assert_eq!(position, (-1920.0, 0.0, 360.0, 1080.0));
    }

    #[test]
    fn uses_work_area_height_to_avoid_taskbar() {
        let position = docked_window_position(0.0, 0.0, 1920.0, 1040.0, 360.0, DockSide::Right);

        assert_eq!(position, (1560.0, 0.0, 360.0, 1040.0));
    }

    #[test]
    fn uses_monitor_edge_even_when_work_area_is_inset() {
        let position = docked_window_frame(
            (0.0, 0.0),
            (1920.0, 1080.0),
            (8.0, 0.0),
            (1904.0, 1040.0),
            360.0,
            DockSide::Right,
        );

        assert_eq!(position, (1560.0, 0.0, 360.0, 1040.0));
    }

    #[test]
    fn collapses_to_full_height_edge_hotspot_on_selected_side() {
        let position = collapsed_window_frame(
            (0.0, 0.0),
            (1920.0, 1080.0),
            (8.0, 0.0),
            (1904.0, 1040.0),
            DockSide::Left,
        );

        assert_eq!(position, (0.0, 0.0, 8.0, 1040.0));
    }

    #[test]
    fn collapses_to_full_height_right_edge_hotspot_on_selected_side() {
        let position = collapsed_window_frame(
            (0.0, 0.0),
            (1920.0, 1080.0),
            (0.0, 0.0),
            (1920.0, 1040.0),
            DockSide::Right,
        );

        assert_eq!(position, (1912.0, 0.0, 8.0, 1040.0));
    }

    #[test]
    fn scales_logical_panel_width_to_physical_pixels() {
        assert_eq!(scaled_dimension(EXPANDED_WIDTH, 1.25), 450);
    }
}
