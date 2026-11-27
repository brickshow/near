fn main() {
    println!("cargo:rerun-if-env-changed=NEAR_LANDING_URL");
    tauri_build::build()
}
