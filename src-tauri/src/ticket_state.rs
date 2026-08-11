use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TicketNotificationState {
    #[serde(default)]
    pub known_ticket_ids: Vec<u64>,
    #[serde(default)]
    pub unread_ticket_ids: Vec<u64>,
}

fn ticket_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|_| "Could not resolve app settings directory".to_string())?;
    fs::create_dir_all(&dir).map_err(|_| "Could not create app settings directory".to_string())?;
    Ok(dir.join("ticket-notification-state.json"))
}

#[tauri::command]
pub fn load_ticket_state(app: AppHandle) -> Result<TicketNotificationState, String> {
    let path = ticket_state_path(&app)?;
    if !path.exists() {
        return Ok(TicketNotificationState::default());
    }

    let content = fs::read_to_string(path).map_err(|_| "Could not read ticket state".to_string())?;
    let state =
        serde_json::from_str(&content).map_err(|_| "Could not parse ticket state".to_string())?;
    Ok(state)
}

#[tauri::command]
pub fn save_ticket_state(app: AppHandle, state: TicketNotificationState) -> Result<(), String> {
    let path = ticket_state_path(&app)?;
    let content = serde_json::to_string_pretty(&state)
        .map_err(|_| "Could not serialize ticket state".to_string())?;
    fs::write(path, content).map_err(|_| "Could not save ticket state".to_string())
}
