#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    redmine_tickets_desktop_app_lib::run();
}

#[cfg(test)]
mod tests {
    #[test]
    fn windows_release_build_uses_gui_subsystem() {
        assert!(include_str!("main.rs").contains("windows_subsystem = \"windows\""));
    }
}
