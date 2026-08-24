use std::path::Path;
use std::process::Command;

const APP_RUN_ENTRY_NAME: &str = "Redmine Tickets";
const WINDOWS_RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";

fn quoted_executable_path(exe_path: &Path) -> String {
    format!(r#""{}""#, exe_path.display())
}

fn registry_command_args(enabled: bool, exe_path: &Path) -> Vec<String> {
    if enabled {
        return vec![
            "add".to_string(),
            WINDOWS_RUN_KEY.to_string(),
            "/v".to_string(),
            APP_RUN_ENTRY_NAME.to_string(),
            "/t".to_string(),
            "REG_SZ".to_string(),
            "/d".to_string(),
            quoted_executable_path(exe_path),
            "/f".to_string(),
        ];
    }

    vec![
        "delete".to_string(),
        WINDOWS_RUN_KEY.to_string(),
        "/v".to_string(),
        APP_RUN_ENTRY_NAME.to_string(),
        "/f".to_string(),
    ]
}

fn registry_status_is_success(enabled: bool, status_success: bool) -> bool {
    status_success || !enabled
}

fn is_debug_build_executable(exe_path: &Path) -> bool {
    exe_path
        .to_string_lossy()
        .replace('/', r"\")
        .to_ascii_lowercase()
        .contains(r"\target\debug\")
}

#[cfg(target_os = "windows")]
pub fn set_enabled(enabled: bool, exe_path: &Path) -> Result<(), String> {
    if enabled && is_debug_build_executable(exe_path) {
        return Err("Autostart must be enabled from the installed app".to_string());
    }

    let status = Command::new("reg")
        .args(registry_command_args(enabled, exe_path))
        .status()
        .map_err(|_| "Could not update Windows autostart".to_string())?;

    if registry_status_is_success(enabled, status.success()) {
        return Ok(());
    }

    Err("Could not update Windows autostart".to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn set_enabled(_enabled: bool, _exe_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_registry_add_arguments_with_quoted_executable_path() {
        let args = registry_command_args(
            true,
            Path::new(r"C:\Program Files\Redmine Tickets\Redmine Tickets.exe"),
        );

        assert_eq!(
            args,
            vec![
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Redmine Tickets",
                "/t",
                "REG_SZ",
                "/d",
                r#""C:\Program Files\Redmine Tickets\Redmine Tickets.exe""#,
                "/f"
            ]
        );
    }

    #[test]
    fn builds_registry_delete_arguments() {
        let args = registry_command_args(false, Path::new(r"C:\Redmine Tickets.exe"));

        assert_eq!(
            args,
            vec![
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Redmine Tickets",
                "/f"
            ]
        );
    }

    #[test]
    fn treats_missing_registry_entry_as_success_when_disabling_autostart() {
        assert_eq!(registry_status_is_success(false, false), true);
    }

    #[test]
    fn detects_debug_build_executables() {
        assert!(is_debug_build_executable(Path::new(
            r"C:\Users\Dominik\Documents\Projekte\RedmineTickets.Desktop.App\src-tauri\target\debug\redmine-tickets-desktop-app.exe"
        )));
        assert!(!is_debug_build_executable(Path::new(
            r"C:\Program Files\Redmine Tickets\Redmine Tickets.exe"
        )));
    }
}
