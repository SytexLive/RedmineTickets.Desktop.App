# Redmine Tickets Desktop App

Windows desktop side panel for Redmine tickets.

## Features

- Tauri desktop app with React and TypeScript UI.
- Right-docked always-on-top panel.
- Collapsed handle and expanded ticket list.
- Redmine REST API integration with API key.
- Ticket click opens the issue in the default browser.

## Development

Prerequisites:

- Node.js
- Rust
- Tauri prerequisites for Windows

Install dependencies:

```bash
npm install
```

Run the frontend checks:

```bash
npm test
npm run build
```

Run Rust tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Run the desktop app:

```bash
npm run tauri dev
```

Build the Windows package:

```bash
npm run tauri build
```

## Redmine Setup

Open the app, enter the Redmine base URL and an API key, then save. The app queries open issues assigned to the API user with:

```text
/issues.json?assigned_to_id=me&status_id=open
```

## Version 1 Limits

- Primary monitor only.
- No ticket editing inside the panel.
- No time tracking.
- No auto-update or installer signing.
