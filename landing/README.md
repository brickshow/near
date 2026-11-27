# NEAR landing page

This is a standalone Vite app in `landing/`. It does not change the Tauri desktop app or its build configuration.

## Run locally

```sh
cd landing
npm install
npm run dev
```

Open the local URL printed by Vite (port 4173 by default). To create a production build, run `npm run build`; use `npm run preview` to serve that build locally.

The app previews use checked-in captures of the real Home, Faith Journey, and Bible screens. The feature descriptions are based on the desktop app source in `../src/` and `../src-tauri/`.

The platform section links to the available Windows installers and to the Linux and macOS build guides. It does not claim that Linux or macOS installers are currently published.

The Bible preview uses the pinned ASV database referenced by `../THIRD_PARTY_BIBLES.md`.