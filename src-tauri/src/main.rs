// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    use_xwayland_when_available();

    near_lib::run()
}

// Native Wayland does not let regular clients choose a top-level window's
// position. Prefer XWayland when available so NEAR can keep its top-center
// notch placement on Linux desktops running a Wayland session.
#[cfg(target_os = "linux")]
fn use_xwayland_when_available() {
    if std::env::var_os("WAYLAND_DISPLAY").is_some()
        && std::env::var_os("DISPLAY").is_some()
        && std::env::var_os("GDK_BACKEND").is_none()
    {
        // Set before Tauri initializes GTK; no app threads have started yet.
        unsafe {
            std::env::set_var("GDK_BACKEND", "x11");
        }
    }
}
