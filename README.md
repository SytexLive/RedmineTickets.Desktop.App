# Redmine Tickets Desktop App

Windows desktop side panel for Redmine tickets, built with Tauri, React, and
TypeScript.

The app docks a slim always-on-top panel to the left or right edge of a selected
monitor. It shows open Redmine issues assigned to the API user, supports quick
browser access, and provides a small set of ticket actions without opening the
full Redmine UI.

## Features

- Tauri 2 desktop app with a React and TypeScript frontend.
- Borderless always-on-top side panel for Windows.
- Docking on the left or right side of a selected monitor.
- Collapsed edge handle for keeping the panel out of the way.
- Redmine REST API integration using an API key.
- Automatic ticket refresh with a configurable interval of at least 15 seconds.
- German and English UI text.
- Quick ticket number field for opening `#12345` directly in the browser.
- Ticket list with project, tracker, status, and priority metadata.
- Priority-aware ticket styling.
- New-ticket notifications with unread state.
- Selectable notification sounds with volume control and preview.
- Tray icon with show/hide and quit actions.
- Ticket context menu for opening tickets, changing status, adding comments, and
  assigning users.

## Prerequisites

- Windows
- Node.js and npm
- Rust
- Tauri prerequisites for Windows, including the Microsoft WebView2 runtime and
  the required Visual Studio Build Tools components

## Development

Install dependencies:

```bash
npm install
```

Run the frontend in development mode:

```bash
npm run dev
```

Run the desktop app:

```bash
npm run tauri dev
```

Run frontend tests:

```bash
npm test
```

Run the frontend build:

```bash
npm run build
```

Run Rust tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Build the desktop package:

```bash
npm run tauri build
```

## Branching

- `main` is the stable default branch for the project.
- Use short-lived working branches for concrete changes.
- Use `feature/...` for feature work.
- Use `codex/...` for Codex-driven implementation branches.
- Do not use a feature or task branch as the repository default branch.

## Configuration

On first launch, open the settings view and enter:

- Redmine base URL, for example `https://redmine.example.com`
- Redmine API key
- Monitor
- Dock side
- Refresh interval
- UI language
- Ticket notification settings

Settings are persisted in the app configuration directory as
`redmine-settings.json`. Ticket notification state is persisted separately as
`ticket-notification-state.json`.

## Redmine API Usage

The ticket list loads open issues assigned to the API user:

```text
/issues.json?assigned_to_id=me&status_id=open
```

Additional API calls are used for ticket actions:

```text
/issue_statuses.json
/issues/{issue_id}.json
/projects/{project_id}/memberships.json?limit=100
```

All Redmine requests send the configured API key through the
`X-Redmine-API-Key` header.

## Ticket Workflow

- Click a ticket to open it in the default browser and mark it as read.
- Enter a ticket number in the header to open that issue directly.
- Right-click a ticket to open the context menu.
- Use the context menu to change status, add a comment, or assign the ticket to
  a project member.
- New tickets discovered after the initial refresh are marked unread and can play
  the configured notification sound.

## Project Structure

```text
src/                 React frontend
src/api/             Tauri command wrappers
src/components/      UI components
src/domain/          Ticket and notification state logic
src/notifications/   Notification sound helpers and sound options
src-tauri/src/       Tauri backend commands and window management
src-tauri/icons/     App and tray icons
docs/                Planning and design notes
scripts/             Utility scripts
```

## Current Limits

- The app is primarily designed for Windows.
- Ticket editing is limited to status, comments, and assignee changes.
- Time tracking is not implemented.
- Auto-update and installer signing are not configured.
