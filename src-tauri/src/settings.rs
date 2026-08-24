use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::{autostart, logging};

pub fn default_refresh_interval_seconds() -> u64 {
    60
}

pub fn default_ticket_notifications_enabled() -> bool {
    true
}

pub fn default_ticket_notification_volume() -> f64 {
    0.35
}

pub fn default_ticket_notification_sound() -> String {
    "default.mp3".to_string()
}

pub fn default_autostart_enabled() -> bool {
    false
}

const TICKET_NOTIFICATION_SOUNDS: [&str; 8] = [
    "alert.mp3",
    "amongus.mp3",
    "default.mp3",
    "drage.mp3",
    "pacman.mp3",
    "phoning.mp3",
    "ring.mp3",
    "swiggle.mp3",
];

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Language {
    De,
    En,
}

impl Default for Language {
    fn default() -> Self {
        Self::De
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DockSide {
    Left,
    Right,
}

impl Default for DockSide {
    fn default() -> Self {
        Self::Right
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PanelSettings {
    #[serde(default)]
    pub monitor_index: usize,
    #[serde(default)]
    pub dock_side: DockSide,
}

impl Default for PanelSettings {
    fn default() -> Self {
        Self {
            monitor_index: 0,
            dock_side: DockSide::Right,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RedmineSettings {
    pub base_url: String,
    pub api_key: String,
    #[serde(default)]
    pub monitor_index: usize,
    #[serde(default)]
    pub dock_side: DockSide,
    #[serde(default = "default_refresh_interval_seconds")]
    pub refresh_interval_seconds: u64,
    #[serde(default)]
    pub language: Language,
    #[serde(default = "default_autostart_enabled")]
    pub autostart_enabled: bool,
    #[serde(default = "default_ticket_notifications_enabled")]
    pub ticket_notifications_enabled: bool,
    #[serde(default = "default_ticket_notification_volume")]
    pub ticket_notification_volume: f64,
    #[serde(default = "default_ticket_notification_sound")]
    pub ticket_notification_sound: String,
}

impl RedmineSettings {
    pub fn validate(&self) -> Result<(), String> {
        if self.base_url.trim().is_empty() {
            return Err("Missing Redmine URL".to_string());
        }

        if self.api_key.trim().is_empty() {
            return Err("Missing API key".to_string());
        }

        let parsed =
            url::Url::parse(&self.base_url).map_err(|_| "Invalid Redmine URL".to_string())?;
        match parsed.scheme() {
            "http" | "https" => Ok(()),
            _ => Err("Redmine URL must start with http:// or https://".to_string()),
        }?;

        if self.refresh_interval_seconds < 15 {
            return Err("Refresh interval must be at least 15 seconds".to_string());
        }

        if !(0.0..=1.0).contains(&self.ticket_notification_volume) {
            return Err("Ticket notification volume must be between 0 and 1".to_string());
        }

        if !TICKET_NOTIFICATION_SOUNDS.contains(&self.ticket_notification_sound.as_str()) {
            return Err("Invalid ticket notification sound".to_string());
        }

        Ok(())
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|_| "Could not resolve app settings directory".to_string())?;
    fs::create_dir_all(&dir).map_err(|_| "Could not create app settings directory".to_string())?;
    Ok(dir.join("redmine-settings.json"))
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<Option<RedmineSettings>, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path).map_err(|_| "Could not read settings".to_string())?;
    let settings = serde_json::from_str(&content).map_err(|_| {
        logging::log_error("Could not parse settings");
        "Could not parse settings".to_string()
    })?;
    Ok(Some(settings))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: RedmineSettings) -> Result<(), String> {
    settings.validate()?;
    let exe_path = std::env::current_exe().map_err(|_| {
        logging::log_error("Could not resolve current executable for autostart");
        "Could not update Windows autostart".to_string()
    })?;
    autostart::set_enabled(settings.autostart_enabled, &exe_path).map_err(|err| {
        logging::log_error(&err);
        err
    })?;
    let path = settings_path(&app)?;
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|_| "Could not serialize settings".to_string())?;
    fs::write(path, content).map_err(|_| "Could not save settings".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_missing_api_key() {
        let settings = RedmineSettings {
            base_url: "https://redmine.example.com".to_string(),
            api_key: "".to_string(),
            monitor_index: 0,
            dock_side: DockSide::Right,
            refresh_interval_seconds: default_refresh_interval_seconds(),
            language: Language::De,
            autostart_enabled: false,
            ticket_notifications_enabled: true,
            ticket_notification_volume: default_ticket_notification_volume(),
            ticket_notification_sound: default_ticket_notification_sound(),
        };

        assert_eq!(settings.validate().unwrap_err(), "Missing API key");
    }

    #[test]
    fn rejects_invalid_scheme() {
        let settings = RedmineSettings {
            base_url: "file:///redmine".to_string(),
            api_key: "secret".to_string(),
            monitor_index: 0,
            dock_side: DockSide::Right,
            refresh_interval_seconds: default_refresh_interval_seconds(),
            language: Language::De,
            autostart_enabled: false,
            ticket_notifications_enabled: true,
            ticket_notification_volume: default_ticket_notification_volume(),
            ticket_notification_sound: default_ticket_notification_sound(),
        };

        assert_eq!(
            settings.validate().unwrap_err(),
            "Redmine URL must start with http:// or https://"
        );
    }

    #[test]
    fn applies_default_panel_settings_for_legacy_config() {
        let settings: RedmineSettings =
            serde_json::from_str(r#"{"baseUrl":"https://redmine.example.com","apiKey":"secret"}"#)
                .unwrap();

        assert_eq!(settings.monitor_index, 0);
        assert_eq!(settings.dock_side, DockSide::Right);
        assert_eq!(settings.refresh_interval_seconds, 60);
        assert_eq!(settings.language, Language::De);
        assert_eq!(settings.ticket_notification_sound, "default.mp3");
    }

    #[test]
    fn applies_default_notification_settings_for_legacy_config() {
        let settings: RedmineSettings =
            serde_json::from_str(r#"{"baseUrl":"https://redmine.example.com","apiKey":"secret"}"#)
                .unwrap();

        assert_eq!(settings.ticket_notifications_enabled, true);
        assert_eq!(settings.ticket_notification_volume, 0.35);
        assert_eq!(settings.ticket_notification_sound, "default.mp3");
    }

    #[test]
    fn applies_default_autostart_setting_for_legacy_config() {
        let settings: RedmineSettings =
            serde_json::from_str(r#"{"baseUrl":"https://redmine.example.com","apiKey":"secret"}"#)
                .unwrap();

        assert_eq!(settings.autostart_enabled, false);
    }

    #[test]
    fn rejects_refresh_interval_below_minimum() {
        let settings = RedmineSettings {
            base_url: "https://redmine.example.com".to_string(),
            api_key: "secret".to_string(),
            monitor_index: 0,
            dock_side: DockSide::Right,
            refresh_interval_seconds: 5,
            language: Language::De,
            autostart_enabled: false,
            ticket_notifications_enabled: true,
            ticket_notification_volume: default_ticket_notification_volume(),
            ticket_notification_sound: default_ticket_notification_sound(),
        };

        assert_eq!(
            settings.validate().unwrap_err(),
            "Refresh interval must be at least 15 seconds"
        );
    }

    #[test]
    fn rejects_notification_volume_below_zero() {
        let settings = RedmineSettings {
            base_url: "https://redmine.example.com".to_string(),
            api_key: "secret".to_string(),
            monitor_index: 0,
            dock_side: DockSide::Right,
            refresh_interval_seconds: default_refresh_interval_seconds(),
            language: Language::De,
            autostart_enabled: false,
            ticket_notifications_enabled: true,
            ticket_notification_volume: -0.1,
            ticket_notification_sound: default_ticket_notification_sound(),
        };

        assert_eq!(
            settings.validate().unwrap_err(),
            "Ticket notification volume must be between 0 and 1"
        );
    }

    #[test]
    fn rejects_notification_volume_above_one() {
        let settings = RedmineSettings {
            base_url: "https://redmine.example.com".to_string(),
            api_key: "secret".to_string(),
            monitor_index: 0,
            dock_side: DockSide::Right,
            refresh_interval_seconds: default_refresh_interval_seconds(),
            language: Language::De,
            autostart_enabled: false,
            ticket_notifications_enabled: true,
            ticket_notification_volume: 1.1,
            ticket_notification_sound: default_ticket_notification_sound(),
        };

        assert_eq!(
            settings.validate().unwrap_err(),
            "Ticket notification volume must be between 0 and 1"
        );
    }

    #[test]
    fn accepts_valid_notification_sound() {
        let settings = RedmineSettings {
            base_url: "https://redmine.example.com".to_string(),
            api_key: "secret".to_string(),
            monitor_index: 0,
            dock_side: DockSide::Right,
            refresh_interval_seconds: default_refresh_interval_seconds(),
            language: Language::De,
            autostart_enabled: false,
            ticket_notifications_enabled: true,
            ticket_notification_volume: default_ticket_notification_volume(),
            ticket_notification_sound: "ring.mp3".to_string(),
        };

        assert!(settings.validate().is_ok());
    }

    #[test]
    fn rejects_invalid_notification_sound() {
        let settings = RedmineSettings {
            base_url: "https://redmine.example.com".to_string(),
            api_key: "secret".to_string(),
            monitor_index: 0,
            dock_side: DockSide::Right,
            refresh_interval_seconds: default_refresh_interval_seconds(),
            language: Language::De,
            autostart_enabled: false,
            ticket_notifications_enabled: true,
            ticket_notification_volume: default_ticket_notification_volume(),
            ticket_notification_sound: "missing.mp3".to_string(),
        };

        assert_eq!(
            settings.validate().unwrap_err(),
            "Invalid ticket notification sound"
        );
    }
}
