mod autostart;
mod logging;
mod redmine;
mod settings;
mod ticket_state;
mod window;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

const TRAY_ICON_RGBA: &[u8] = include_bytes!("../icons/tray-icon.rgba");
const TRAY_ICON_SIZE: u32 = 256;

#[tauri::command]
fn ping() -> String {
    "ok".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::install_panic_hook();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            logging::init(app.handle());
            logging::log_info("Application setup started");

            let show_hide =
                MenuItem::with_id(app, "show_hide", "Anzeigen/Ausblenden", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_hide, &quit])?;

            TrayIconBuilder::new()
                .icon(tauri::image::Image::new(
                    TRAY_ICON_RGBA,
                    TRAY_ICON_SIZE,
                    TRAY_ICON_SIZE,
                ))
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show_hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let visible = window.is_visible().unwrap_or(false);
                            if visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let visible = window.is_visible().unwrap_or(false);
                            if visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                if let Err(err) =
                    window::dock_webview_window(&window, settings::PanelSettings::default())
                {
                    logging::log_error(&format!("Initial panel docking failed: {err}"));
                }
            }

            logging::log_info("Application setup completed");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            redmine::add_ticket_comment,
            redmine::assign_ticket,
            redmine::create_ticket,
            redmine::fetch_assignable_users,
            redmine::fetch_created_open_tickets,
            redmine::fetch_issue_priorities,
            redmine::fetch_my_open_tickets,
            redmine::fetch_open_tickets,
            redmine::fetch_tickets,
            redmine::fetch_issue_statuses,
            redmine::fetch_projects,
            redmine::fetch_trackers,
            redmine::fetch_watched_open_tickets,
            redmine::update_ticket_status,
            settings::load_settings,
            settings::save_settings,
            ticket_state::load_ticket_state,
            ticket_state::save_ticket_state,
            window::list_monitors,
            window::dock_window,
            window::collapse_window,
            window::expand_window,
            window::open_ticket_url
        ])
        .run(tauri::generate_context!())
        .expect("failed to run app");
}

#[cfg(test)]
mod tests {
    #[test]
    fn tray_uses_dedicated_icon_asset() {
        assert!(include_str!("lib.rs").contains("include_bytes!(\"../icons/tray-icon.rgba\")"));
        assert!(include_str!("lib.rs").contains("Image::new("));
    }
}
