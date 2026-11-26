# NEAR Hackathon Preview

This release is a temporary AI for Church Hackathon 2026 promotion: one anonymous preview per OS user credential, lasting exactly 259,200 seconds (72 hours). It is not a recurring free trial. NEAR's planned commercial price is $10. Polar payment and license activation are **not implemented**. The Buy button opens https://near.brickshow.site/#get-near in the system browser. Publish the updated `landing/` alongside the release; it explicitly says commercial licenses are coming soon and purchases are not available.

## Deployment

Requires Node 22+ (Node 26 was used for tests), Rust/Tauri prerequisites from the main README, a Cloudflare account with Workers/D1, and an unlocked native credential store on the desktop. No Cloudflare credentials belong in the desktop binary.

1. `cd services/preview && npm ci`
2. `npx wrangler login`
3. `npx wrangler d1 create near-preview`
4. Put the returned database ID into `wrangler.jsonc` (replace `REPLACE_WITH_D1_DATABASE_ID`).
5. `npx wrangler d1 migrations apply near-preview --remote`
6. `npm run deploy`. Record the HTTPS Worker URL, without `/v1/activate` or `/v1/status`.
7. At the repository root, build with:

   ```sh
   NEAR_PREVIEW_API_URL=https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev npm run tauri build
   ```

   PowerShell:

   ```powershell
   $env:NEAR_PREVIEW_API_URL = 'https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev'
   npm run tauri build
   ```

8. Build `landing/` with `npm ci && npm run build` from that directory and publish `landing/dist` using the existing hosting setup for `near.brickshow.site`.
9. Run the packaged-app acceptance checks below on each supported OS, then distribute the newly built installers. Existing checked-in installers are not updated automatically.

Environment/configuration:

| Setting | Location | Purpose |
| --- | --- | --- |
| `NEAR_PREVIEW_API_URL` | Rust build environment, required for release builds | HTTPS Worker base URL. Read by `option_env!`; `.env` files are not loaded automatically. Missing configuration locks debug builds and fails release builds. |
| `NEAR_LANDING_URL` | Rust build environment, optional | Override the official system-browser destination. Default: `https://near.brickshow.site/#get-near`. Must use HTTPS. |
| `DB` | Worker D1 binding in `wrangler.jsonc` | Persistent activation database. |
| `preview_config.activations_enabled` | D1 configuration row `id=1` | Server-controlled public activation switch. Defaults to 1. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Optional deployment CI environment | Use scoped deployment credentials instead of interactive Wrangler login. Never embed them in NEAR. |

To close new activations after the hackathon (from `services/preview`):

```sh
npx wrangler d1 execute near-preview --remote --command 'UPDATE preview_config SET activations_enabled=0 WHERE id=1'
```

Set it back to 1 to reopen. This switch only affects inserts; existing previews retain their exact timestamps, including during activation retries. Back up D1 and retain activation rows when deploying subsequent versions. Deleting a row or recreating the database removes that identity's activation history.

Before exposing a high-traffic public download, set Cloudflare rate limits for `/v1/activate` and `/v1/status`, monitor D1/Worker usage and configure billing alerts. There is no embedded API secret: anyone can download the public client. Do not log Authorization headers or identity bodies. Worker observability is disabled in the checked-in config. Cloudflare may still process connection metadata under its platform policies.

## Lifecycle and enforcement

- Every desktop webview mounts `AccessGate` before the existing `App`; no app hooks, AI, microphone, or reminders start while access is locked.
- New launches display the 72-hour disclosure before automatically requesting activation after 6.5 seconds. There is no account, payment, or license-key step. AI authentication remains unchanged. A failed request offers Retry.
- The desktop single-instance plugin prevents concurrent processes from creating competing identities. Rust generates 32 cryptographically random bytes and writes the resulting anonymous bearer credential to the OS credential store **before** making any activation request. macOS uses Keychain, Linux uses Secret Service, and Windows uses Credential Manager. There is no plaintext fallback. Credential-store errors stop activation.
- D1 stores only a SHA-256 hash of the bearer credential and activation/expiration seconds. SQLite `unixepoch()` supplies the authoritative time. An atomic insert with conflict handling creates the timestamps once. Lost responses and concurrent requests reuse that same credential/row.
- Timestamps and one-time notification flags are also saved in the OS credential store. Persisted timestamps never authorize access by themselves. Each process must verify online again, so an application restart or a powered-off interval cannot reset or pause the preview.
- Runtime verification renews every 15 seconds. A grant lasts at most 30 seconds from the start of its verification request, capped by the preview expiration. Elapsed time uses Rust `Instant`, with a wall/monotonic discrepancy check (2-second tolerance) to invalidate grants on clock changes or suspend/resume. Requests time out after 8 seconds and do not follow redirects.
- Brief network failures retain only the current lease. Longer outages pause features and present Retry; they never create a new identity or change expiration. **Offline launch/use is not supported**. This is a deliberate reliability/security tradeoff for a temporary promotion without trusted hardware time.
- Primary custom commands are denied by default in Rust. SQL plugin select/execute permissions are removed from every capability. Application SQLite queries now use guarded Rust commands while the existing plugin still handles loading/migrations. Named `$N` parameters retain SQLx semantics. Export/delete and notch/window controls are explicitly allowed while locked.
- On expiry or loss of verification the gate unmounts feature UI. A Rust watchdog closes companion windows and reloads the main webview to cancel all JS work, capture tracks, browser audio, and pending microphone acquisition. Local voice workers stop, transcription has an access abort callback, and model downloads check access between chunks. AI response requests and streaming reads are canceled through a 100ms async access check. Closing a provider connection cannot guarantee the remote provider immediately stops its own computation or billing.
- A discreet Settings line shows remaining time. At most one in-app notice is emitted at each 24h/1h threshold, with flags kept in the credential store. If launched below 1h, only the 1h notice is shown. No recurring countdown popups.
- Expiration preserves all personal SQLite records and preferences. Manage personal data offers a native JSON save dialog and separately confirmed deletion. Export includes all current personal tables plus `near.*` local preferences (including Bible progress); it excludes AI credentials and preview credentials. Deletion clears personal tables, checkpoints/VACUUMs SQLite, removes ChatGPT credentials, and clears localStorage in that webview. Activation records/credentials and public downloaded model/Bible assets are deliberately retained. Files previously exported, OS backups, and external provider records are outside this deletion operation.

## Privacy, limitations, and threat model

The identifier is a random per-OS-user credential, not a hardware fingerprint. No serial numbers, MAC addresses, installed-program lists, email addresses, notes, Scripture reflections, or AI tokens are sent to the preview Worker. HTTPS authenticates service responses; grant files are not accepted and there is no offline bearer grant to replay.

Ordinary reinstall and removal of NEAR's app config/data preserve the identity because it lives in the OS credential store. **Deleting that credential, resetting the OS/keychain, using another OS user, cloning an OS image, modifying the executable, or replacing the trusted server can bypass a public anonymous promotion.** Stronger per-physical-device reset prevention is incompatible with collecting no durable hardware identity and requiring no user account. This implementation does not claim DRM or tamper-proof enforcement. Keep signing identities stable for Keychain access. Linux needs an available, unlocked Secret Service; headless hosts may not provide one.

Server expiration is exact to whole seconds; client locks conservatively using the request start time, so transport latency can lock slightly early. Lease/watchdog polling has sub-second scheduling latency. No server-supplied expiry can extend beyond 72h. Deliberately altering both clock sources or controlling the OS is outside the threat model. Network downtime does not extend the promotional period.

The existing app stores personal data locally and currently has no CSP. This work does not redesign its entire renderer trust model. Do not expose untrusted remote pages in privileged webviews. Previously distributed binaries have no enforcement and cannot be retroactively locked. The public activation service must remain available until all issued previews have expired.

## Future Polar licensing

`access.rs` and the matching TypeScript contract define five states: `preview_not_activated`, `preview_active`, `preview_expired`, `commercial_license_active`, and `commercial_license_invalid`. Currently the Worker issues only preview states, and Rust rejects unexpected commercial grants. There is no renderer command that toggles commercial access.

Add a separate server-verified Polar license provider behind the Rust access module when ready. Implement license activation/validation/revocation and its lease policy before accepting commercial states, then expose only a validated grant to the same guards. Do not reuse the preview activation endpoint to simulate purchases, infer purchases from a browser redirect, or store privileged Polar credentials in the desktop client. The Buy button currently has no payment-success callback.

## Verification

Run:

```sh
npm run build
npm run build --prefix landing
npm run test:faith
npm test --prefix services/preview
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

For the browser fixture (requires `agent-browser` installed): start `npm run dev`, then run `node scripts/access-ui-test.mjs`. It exercises the actual React gate with Tauri's official **mocked** IPC. It checks automatic first-launch activation after the disclosure, expiry, feature mounting/unmounting, the native landing command, export, delete confirmation, and unverified/network locking. It does not prove native OS dialogs or browser opening.

Local real Cloudflare runtime:

```sh
cd services/preview
npx wrangler d1 migrations apply near-preview --local
npx wrangler dev --port 8787
```

POST to `/v1/status` and `/v1/activate` using `Authorization: Bearer ` followed by a **synthetic** 64-character lowercase hex token. No body is required. Status for an unknown token must not insert a row; repeated activation must return identical dates. Desktop builds intentionally require HTTPS, so use a deployed staging Worker for native end-to-end testing.

Automated coverage includes real migration SQL for first activation, status/restart/reinstall identity reuse, concurrent retries, expired records, activation shutdown, clock inputs, malformed tokens, unavailable D1, Rust lease/expiry boundaries, denied command allowlists, numeric SQLite binding compatibility, and the existing personal-data tests. A local workerd + D1 smoke test also confirmed first activation, exact duration and idempotent retry.

Packaged acceptance checks still required on Windows, macOS, and Linux:

1. With a clean **test OS user**, launch once; confirm disclosure precedes activation, no account/key is requested, every existing feature opens, and AI still requires provider authentication.
2. Quit/restart, reinstall the same build, and separately remove only NEAR app config/data. Verify the OS preview credential survives and D1 dates stay identical. Do not delete the preview credential to represent an ordinary reinstall.
3. Run `cargo test --manifest-path src-tauri/Cargo.toml preview_identity_survives_app_data_deletion -- --ignored` with an unlocked credential store. This uses a separate synthetic test entry, not the real preview identity.
4. In a **staging** D1 database, set the synthetic activation to expired while maintaining the duration constraint: `UPDATE preview_activations SET activated_at=unixepoch()-259201, expires_at=unixepoch()-1 WHERE token_hash='TEST_TOKEN_HASH'`. Confirm primary features close, microphone capture ends, speech stops, companion windows close, and direct primary/SQL IPC calls reject. Verify notes/reflections remain exportable. Never shorten production previews for testing.
5. Move the system clock backward/forward and suspend/resume. Verify no extension or replacement activation; reconnect to recover verification.
6. Disconnect the network on first launch, during activation, during active use, and after expiration. Verify no new token after a lost response; active use pauses by lease expiry; Retry restores only remaining access. Restart offline must stay locked.
7. Click Buy and confirm the OS browser opens `https://near.brickshow.site/#get-near`, showing coming-soon commercial licensing. Verify no payment or license success is simulated. Cancel the export dialog, complete an export, and test both cancel and confirm for deletion.
8. Seed staging timestamps to just above the 24h/1h thresholds, verify each quiet notice once, then restart to check notification flags persist. Close new activations in D1; verify new users are blocked while existing active previews continue.

No production Worker/database deployment, platform installer rebuild, live purchase, or real native reinstall/browser-opening verification was performed by the repository tests. Complete these release checks before submission.
