# Home layout prototype — throwaway

Question: how should Home arrange its orb, daily verse, and conversation actions inside the existing 680 × 180 notch?

Run `npm run prototype:home`, then use the floating arrows or keyboard arrows. The existing `/` route accepts `?variant=A`, `?variant=B`, or `?variant=C` in development only. The real frame, header, navigation, and daily verse hook are retained. Action buttons are stubbed; no messages are sent or settings changed.

- A — Balanced row: the current Home implementation with consistent alignment, a bounded verse card, and navigation inside the silhouette.
- B — Verse first: an open editorial reading area and a compact conversation rail.
- C — Assistant first: a dedicated conversation panel with the verse as secondary content.

Recommendation: A best matches the requested side-by-side arrangement. Selection of a broader visual direction is still pending; B and C are exploratory.

Applied layout correction: the silhouette starts 52.8px inside each window edge and ends 10px above its bottom. Home now shares the header's 540px maximum content width, reserves bottom clearance, keeps navigation in a separate row, and scrolls long verse text inside the card.

Validation: TypeScript and Vite production build passed. Visual inspection of the running Tauri window is still pending. The build reports an existing mixed static/dynamic import warning for the Tauri event module.

This workspace has no Git repository, so no throwaway branch or implementation-issue pointer was created. Once a design is selected and a repository is available, archive these prototype files on a throwaway branch, record the verdict in the implementation issue, and remove the preview entry, switcher, and command from the main implementation.
