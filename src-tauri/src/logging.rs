use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
static LOG_LOCK: Mutex<()> = Mutex::new(());

fn timestamp_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

fn write_log_line(path: &Path, level: &str, message: &str) {
    let _guard = LOG_LOCK.lock().ok();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{} [{}] {}", timestamp_seconds(), level, message);
    }
}

fn fallback_log_path() -> PathBuf {
    std::env::temp_dir().join("redmine-tickets.log")
}

pub fn init(app: &AppHandle) {
    if let Ok(dir) = app.path().app_log_dir() {
        let path = dir.join("redmine-tickets.log");
        let _ = LOG_PATH.set(path.clone());
        write_log_line(&path, "INFO", "Application logging initialized");
    }
}

pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|panic_info| {
        log_error(&format!("Application panic: {panic_info}"));
    }));
}

pub fn log_info(message: &str) {
    let fallback_path;
    let path = if let Some(path) = LOG_PATH.get() {
        path
    } else {
        fallback_path = fallback_log_path();
        &fallback_path
    };
    write_log_line(path, "INFO", message);
}

pub fn log_error(message: &str) {
    let fallback_path;
    let path = if let Some(path) = LOG_PATH.get() {
        path
    } else {
        fallback_path = fallback_log_path();
        &fallback_path
    };
    write_log_line(path, "ERROR", message);
}
