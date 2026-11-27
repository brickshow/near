# NEAR Hackathon Preview

NEAR starts a free 72-hour preview automatically on the first desktop launch. Rust saves the activation and expiration dates in the OS credential store and uses the device clock to calculate the time remaining. The timer keeps running while the app is closed. Activation and access checks work offline. AI providers still require their own authentication and connectivity.

## Build

From the repository root, follow the platform prerequisites in the [README](../README.md), then run:

```sh
npm ci
npm run tauri build
```

The optional `NEAR_LANDING_URL` build variable overrides the HTTPS link on the expired preview screen. The default is `https://near.brickshow.site/#get-near`. Commercial licenses are coming soon at a planned price of $10.

## Local storage and expiration

- The dates are stored per OS user in Windows Credential Manager, macOS Keychain, or Linux Secret Service. Existing previews with saved dates keep them. If a legacy activation never saved its dates, the app starts a new local preview.
- Restarting or removing NEAR's personal data leaves the dates in the credential store. Changing the device clock changes the time remaining. Removing the OS credential allows a new preview.
- Settings shows the time remaining. NEAR saves the flags for its one-time 24-hour and one-hour notices in the same credential.
- At expiry, Rust blocks primary commands, closes companion windows, and stops active voice and downloads. The expired screen keeps personal data export and deletion available.

## Verification

```sh
npm run build
npm run build --prefix landing
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

With `agent-browser` installed, run `npm run dev` in one terminal and `node scripts/access-ui-test.mjs` in another. The browser fixture uses mocked Tauri IPC.

To check an installed build, launch it offline using a clean OS test user, check the countdown in Settings, then quit and relaunch offline to confirm the original deadline. On that test user, move the clock past the deadline and verify that the lock screen and personal data export are available.
