# Monitor Wall

A live VNC grid for watching every contestant's screen at once during a DOMjudge-run contest. It polls DOMjudge for the current team roster and IPs, proxies each team's VNC feed over WebSocket (via `websockify`), and renders them as a filterable, view-only tile wall in the browser.

- Toolbar: search by name, filter by category/affiliation, choose grid column count (auto or fixed), toggle "lazy load on fullscreen" (only the fullscreened tile stays connected — others unmount to save bandwidth/CPU when many tiles are open).
- Click a tile to fullscreen it; `Esc` or click again to exit.

## Requirements

- [Bun](https://bun.sh)
- `websockify` on `PATH`
- Network access to the DOMjudge API and to each team's VNC port

## Setup

```bash
bun install
cp .env.example .env   # then edit values
```

Environment variables (see `.env.example`):

## Running

Dev (frontend only, hot reload, expects the server running separately):

```bash
bun run dev
```

Production:

```bash
bun run build     # tsc -b && vite build -> dist/
bun run start     # or: bun run server.ts
```

## Notes

- Video is view-only; no mouse/keyboard input is sent to team machines.
