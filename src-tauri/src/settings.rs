use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RedmineSettings {
    pub base_url: String,
    pub api_key: String,
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
        }
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
    let settings =
        serde_json::from_str(&content).map_err(|_| "Could not parse settings".to_string())?;
    Ok(Some(settings))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: RedmineSettings) -> Result<(), String> {
    settings.validate()?;
    let path = settings_path(&app)?;
    let content =
        serde_json::to_string_pretty(&settings).map_err(|_| "Could not serialize settings".to_string())?;
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
        };

        assert_eq!(settings.validate().unwrap_err(), "Missing API key");
    }

    #[test]
    fn rejects_invalid_scheme() {
        let settings = RedmineSettings {
            base_url: "file:///redmine".to_string(),
            api_key: "secret".to_string(),
        };

        assert_eq!(
            settings.validate().unwrap_err(),
            "Redmine URL must start with http:// or https://"
        );
    }
}
