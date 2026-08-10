# Redmine Windows Sidepanel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows Tauri desktop app with a right-docked, collapsible, always-on-top Redmine ticket panel that opens tickets in the default browser.

**Architecture:** Use a Tauri shell for native Windows behavior and a React/TypeScript frontend for the side panel UI. Keep Redmine API access, settings storage, ticket normalization, and UI rendering in separate units so future features can be added without rewriting the foundation.

**Tech Stack:** Tauri 2, Rust, React, TypeScript, Vite, Vitest, CSS modules or plain CSS.

## Global Constraints

- Target platform is Windows desktop.
- The app runs from the system tray.
- The panel docks to the right edge of the primary display.
- The panel supports collapsed and expanded states.
- The panel stays always-on-top.
- Redmine integration uses the REST API with an API key.
- Clicking a ticket opens `{redmineBaseUrl}/issues/{ticketId}` in the OS default browser.
- API keys must not be logged.
- First version targets the primary monitor only.
- Polling interval is 60 seconds.

---

## File Structure

- `package.json`: Node scripts and frontend dependencies.
- `index.html`: Vite entry document.
- `src/main.tsx`: React bootstrapping.
- `src/App.tsx`: Application state orchestration.
- `src/api/redmine.ts`: Frontend command wrappers for Redmine/settings calls.
- `src/domain/ticket.ts`: Shared TypeScript ticket model and URL helper.
- `src/components/TicketList.tsx`: Ticket list UI.
- `src/components/SettingsForm.tsx`: Redmine settings UI.
- `src/styles.css`: Compact side-panel styling.
- `src/**/*.test.ts`: Vitest unit tests.
- `src-tauri/Cargo.toml`: Rust dependencies.
- `src-tauri/tauri.conf.json`: Tauri app/window config.
- `src-tauri/src/main.rs`: Tauri app entrypoint, tray, window commands.
- `src-tauri/src/redmine.rs`: Redmine client and response normalization.
- `src-tauri/src/settings.rs`: Settings model and storage abstraction.
- `src-tauri/src/window.rs`: Right-dock and collapse/expand commands.
- `src-tauri/src/*_test.rs`: Rust unit tests.

---

### Task 1: Scaffold Tauri React App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test`, `cargo test`
- Produces: Tauri command `ping() -> String`

- [ ] **Step 1: Add initial frontend package files**

Create `package.json`:

```json
{
  "name": "redmine-tickets-desktop-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Add minimal React app**

Create `src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <header className="panel-header">
        <h1>Redmine Tickets</h1>
      </header>
    </main>
  );
}
```

- [ ] **Step 3: Add Tauri entrypoint**

Create `src-tauri/src/main.rs`:

```rust
#[tauri::command]
fn ping() -> String {
    "ok".to_string()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
```

- [ ] **Step 4: Verify scaffold**

Run: `npm install`

Run: `npm run build`

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: frontend build passes and Rust test command exits successfully.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold tauri react app"
```

---

### Task 2: Add Ticket Domain and URL Construction

**Files:**
- Create: `src/domain/ticket.ts`
- Create: `src/domain/ticket.test.ts`

**Interfaces:**
- Produces: `Ticket` TypeScript type
- Produces: `buildTicketUrl(baseUrl: string, ticketId: number): string`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { buildTicketUrl } from "./ticket";

describe("buildTicketUrl", () => {
  it("builds a Redmine issue URL without duplicate slashes", () => {
    expect(buildTicketUrl("https://redmine.example.com/", 123)).toBe(
      "https://redmine.example.com/issues/123"
    );
  });

  it("rejects non-positive ticket IDs", () => {
    expect(() => buildTicketUrl("https://redmine.example.com", 0)).toThrow(
      "Ticket ID must be positive"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/ticket.test.ts`

Expected: FAIL because `src/domain/ticket.ts` does not exist.

- [ ] **Step 3: Implement domain helper**

```ts
export type Ticket = {
  id: number;
  subject: string;
  status: string;
  priority: string;
  project: string;
  tracker: string;
  updatedAt: string;
  url: string;
};

export function buildTicketUrl(baseUrl: string, ticketId: number): string {
  if (ticketId <= 0) {
    throw new Error("Ticket ID must be positive");
  }

  return `${baseUrl.replace(/\/+$/, "")}/issues/${ticketId}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/domain/ticket.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ticket.ts src/domain/ticket.test.ts
git commit -m "feat: add ticket domain model"
```

---

### Task 3: Add Redmine Client in Rust

**Files:**
- Create: `src-tauri/src/redmine.rs`
- Modify: `src-tauri/src/main.rs`

**Interfaces:**
- Produces: Rust struct `Ticket`
- Produces: Rust function `normalize_issue(base_url: &str, issue: RedmineIssue) -> Ticket`
- Produces: Tauri command `fetch_tickets(settings: RedmineSettings) -> Result<Vec<Ticket>, String>`

- [ ] **Step 1: Write Rust normalization test**

```rust
#[test]
fn normalizes_redmine_issue_into_ticket() {
    let issue = RedmineIssue {
        id: 42,
        subject: "Fix sidebar".to_string(),
        status: NamedValue { name: "New".to_string() },
        priority: NamedValue { name: "Normal".to_string() },
        project: NamedValue { name: "Desktop".to_string() },
        tracker: NamedValue { name: "Bug".to_string() },
        updated_on: "2026-08-10T08:00:00Z".to_string(),
    };

    let ticket = normalize_issue("https://redmine.example.com/", issue);

    assert_eq!(ticket.id, 42);
    assert_eq!(ticket.url, "https://redmine.example.com/issues/42");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml normalizes_redmine_issue_into_ticket`

Expected: FAIL because `redmine.rs` has not been implemented.

- [ ] **Step 3: Implement Redmine normalization and fetch command**

Implement serde models for Redmine issue responses, normalize fields into `Ticket`, call `/issues.json?assigned_to_id=me&status_id=open`, and map HTTP/authentication/network failures to user-safe strings.

- [ ] **Step 4: Register command**

In `src-tauri/src/main.rs`, add `mod redmine;` and include `redmine::fetch_tickets` in `generate_handler!`.

- [ ] **Step 5: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/src/redmine.rs src-tauri/Cargo.toml
git commit -m "feat: add redmine ticket client"
```

---

### Task 4: Add Settings Storage

**Files:**
- Create: `src-tauri/src/settings.rs`
- Modify: `src-tauri/src/main.rs`
- Create: `src/api/redmine.ts`

**Interfaces:**
- Produces: Rust struct `RedmineSettings { base_url: String, api_key: String }`
- Produces: Tauri commands `load_settings() -> Result<Option<RedmineSettings>, String>` and `save_settings(settings: RedmineSettings) -> Result<(), String>`
- Produces: TypeScript functions `loadSettings()`, `saveSettings(settings)`, `fetchTickets(settings)`

- [ ] **Step 1: Write validation tests**

```rust
#[test]
fn rejects_missing_api_key() {
    let settings = RedmineSettings {
        base_url: "https://redmine.example.com".to_string(),
        api_key: "".to_string(),
    };

    assert_eq!(settings.validate().unwrap_err(), "Missing API key");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml rejects_missing_api_key`

Expected: FAIL because settings validation does not exist.

- [ ] **Step 3: Implement settings module**

Add `RedmineSettings`, `validate()`, `load_settings`, and `save_settings`. Store settings via Tauri app config directory for v1, with the storage implementation isolated in `settings.rs`. Never log the API key.

- [ ] **Step 4: Add frontend command wrappers**

Implement `src/api/redmine.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import type { Ticket } from "../domain/ticket";

export type RedmineSettings = {
  baseUrl: string;
  apiKey: string;
};

export function loadSettings(): Promise<RedmineSettings | null> {
  return invoke("load_settings");
}

export function saveSettings(settings: RedmineSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export function fetchTickets(settings: RedmineSettings): Promise<Ticket[]> {
  return invoke("fetch_tickets", { settings });
}
```

- [ ] **Step 5: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/settings.rs src-tauri/src/main.rs src/api/redmine.ts
git commit -m "feat: add redmine settings storage"
```

---

### Task 5: Implement Panel UI

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/TicketList.tsx`
- Create: `src/components/SettingsForm.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Ticket`
- Consumes: `loadSettings`, `saveSettings`, `fetchTickets`
- Produces: UI states for missing settings, loading, empty list, error, and loaded tickets

- [ ] **Step 1: Write TicketList component test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TicketList } from "./TicketList";

describe("TicketList", () => {
  it("renders ticket subject and metadata", () => {
    render(
      <TicketList
        tickets={[{
          id: 7,
          subject: "Fix refresh",
          status: "New",
          priority: "Normal",
          project: "Desktop",
          tracker: "Bug",
          updatedAt: "2026-08-10T08:00:00Z",
          url: "https://redmine.example.com/issues/7"
        }]}
        onOpenTicket={() => undefined}
      />
    );

    expect(screen.getByText("Fix refresh")).toBeTruthy();
    expect(screen.getByText("#7")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/TicketList.test.tsx`

Expected: FAIL because testing library and component are missing.

- [ ] **Step 3: Add test dependencies and implement UI**

Install `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom`. Implement `TicketList`, `SettingsForm`, and `App` state orchestration.

- [ ] **Step 4: Add compact panel styles**

Style the app as a dense right-side work panel with fixed-width layout, readable ticket rows, icon-sized controls, and no marketing hero layout.

- [ ] **Step 5: Run tests and build**

Run: `npm test`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src
git commit -m "feat: add ticket panel ui"
```

---

### Task 6: Add Window Docking, Collapse, Tray, and Browser Open

**Files:**
- Create: `src-tauri/src/window.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: Tauri command `dock_window() -> Result<(), String>`
- Produces: Tauri command `collapse_window() -> Result<(), String>`
- Produces: Tauri command `expand_window() -> Result<(), String>`
- Produces: Tauri command `open_ticket_url(url: String) -> Result<(), String>`

- [ ] **Step 1: Write URL validation test**

```rust
#[test]
fn rejects_non_http_ticket_url() {
    assert_eq!(
        validate_ticket_url("file:///C:/secret.txt").unwrap_err(),
        "Ticket URL must start with http:// or https://"
    );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml rejects_non_http_ticket_url`

Expected: FAIL because `validate_ticket_url` does not exist.

- [ ] **Step 3: Implement native window commands**

Implement right docking using the primary monitor work area, set always-on-top for expanded and collapsed modes, resize expanded panel to 360px width, resize collapsed handle to a narrow width, and expose commands to the React UI.

- [ ] **Step 4: Implement tray menu**

Add tray items for Show/Hide and Quit. Show/Hide toggles the panel without exiting the app. Quit terminates the app.

- [ ] **Step 5: Implement safe browser opening**

Validate `http://` and `https://` URLs only. Use Tauri shell opener to open the ticket URL in the OS default browser.

- [ ] **Step 6: Run native tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 7: Manual verification**

Run: `npm run tauri dev`

Verify on Windows: tray icon exists, panel appears on the right edge, panel stays in front, collapse/expand works, and ticket click opens the default browser.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/window.rs src-tauri/src/main.rs src/App.tsx
git commit -m "feat: add docked always-on-top window behavior"
```

---

### Task 7: Final Build and Documentation

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/plans/2026-08-10-redmine-windows-sidepanel.md`

**Interfaces:**
- Produces: documented local dev workflow
- Produces: documented Redmine API key setup

- [ ] **Step 1: Add README**

Document prerequisites, local development commands, Redmine API key setup, and the known v1 limitations: primary monitor only, no ticket editing, no auto-update.

- [ ] **Step 2: Run full verification**

Run: `npm test`

Run: `npm run build`

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Run: `npm run tauri build`

Expected: all commands pass and Windows app package is produced by Tauri.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/plans/2026-08-10-redmine-windows-sidepanel.md
git commit -m "docs: add desktop app usage guide"
```

---

## Self-Review

- Spec coverage: covered tray app, right docking, collapse/expand, always-on-top, Redmine REST API, settings, ticket opening, errors, security, tests, and Windows packaging.
- Placeholder scan: no TBD/TODO/FIXME placeholders remain.
- Type consistency: `Ticket`, `RedmineSettings`, `fetchTickets`, `loadSettings`, `saveSettings`, and native window command names are consistent across tasks.
