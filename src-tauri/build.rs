fn main() {
    println!("cargo:rerun-if-env-changed=NEAR_PREVIEW_API_URL");
    println!("cargo:rerun-if-env-changed=NEAR_LANDING_URL");
    if std::env::var("PROFILE").as_deref() == Ok("release")
        && std::env::var("NEAR_PREVIEW_API_URL").map_or(true, |value| !value.starts_with("https://"))
    {
        panic!("Set NEAR_PREVIEW_API_URL to the deployed HTTPS Worker URL before building a release. See docs/hackathon-preview.md.");
    }
    tauri_build::build()
}
