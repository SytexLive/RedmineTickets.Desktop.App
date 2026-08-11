# Ticket Notifications and Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated GitHub-based version synchronization plus local new-ticket sound and unread highlighting without marking existing startup tickets as unread.

**Architecture:** Keep Redmine polling in `App.tsx`, but move new-ticket state transitions and sound playback into small frontend helpers so they can be tested without rendering the whole app. Persist notification settings through the existing Tauri settings model and persist known/unread ticket IDs through a new local Tauri command pair. Use a GitHub release workflow plus a Node sync script to keep all version files aligned.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, Vitest, GitHub Actions, Node.js scripts.

## Global Constraints

- Version numbers are not manually edited during normal releases.
- GitHub Actions is the release authority.
- `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` must stay synchronized.
- Existing tickets must not be treated as unread when the app starts.
- Never play notification sound on the first successful ticket fetch after startup.
- Sound is controlled by settings; unread highlighting is not disabled by the sound setting.
- Keep existing uncommitted changes in `src-tauri/Cargo.toml` and `.serena/` intact unless the user explicitly allows otherwise.
- Use ASCII in new source files unless modifying existing localized UI strings.

---

## File Structure

- Modify `src-tauri/src/settings.rs`: add notification setting fields and validation defaults.
- Modify `src/api/redmine.ts`: expose the new settings fields and new ticket state commands.
- Create `src-tauri/src/ticket_state.rs`: load and save known/unread ticket ID state next to app settings.
- Modify `src-tauri/src/lib.rs`: register ticket state commands.
- Create `src/domain/ticketNotifications.ts`: pure helpers for baseline/new-ticket detection and read-state updates.
- Create `src/domain/ticketNotifications.test.ts`: unit tests for first-fetch baseline and later new-ticket handling.
- Create `src/notifications/sound.ts`: Web Audio notification helper.
- Create `src/notifications/sound.test.ts`: tests for enabled/disabled/volume behavior.
- Modify `src/App.tsx`: wire loaded/persisted ticket state into refresh and open flows.
- Modify `src/components/TicketList.tsx`: accept `unreadTicketIds` and add unread class/ARIA label.
- Modify `src/components/TicketList.test.tsx`: cover unread rendering and right-click behavior.
- Modify `src/components/SettingsForm.tsx`: add sound toggle and volume slider.
- Modify `src/components/SettingsForm.test.tsx`: cover new settings values.
- Modify `src/i18n.ts`: add German and English settings labels.
- Modify `src/styles.css`: add restrained unread highlight and reduced-motion fallback.
- Create `scripts/sync-version.mjs`: update all three version files from one version value.
- Create `.github/workflows/release.yml`: GitHub release automation.
- Modify `package.json`: add a `version:sync` script if useful for the workflow.

---

### Task 1: Persist Notification Settings and Ticket State

**Files:**
- Modify: `src-tauri/src/settings.rs`
- Create: `src-tauri/src/ticket_state.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/api/redmine.ts`

**Interfaces:**
- Produces: `RedmineSettings.ticketNotificationsEnabled: boolean`
- Produces: `RedmineSettings.ticketNotificationVolume: number`
- Produces: Rust command `load_ticket_state() -> Result<TicketNotificationState, String>`
- Produces: Rust command `save_ticket_state(state: TicketNotificationState) -> Result<(), String>`
- Produces: TypeScript type `TicketNotificationState = { knownTicketIds: number[]; unreadTicketIds: number[] }`
- Consumes: existing Tauri app config directory pattern from `settings.rs`

- [ ] **Step 1: Add failing Rust settings tests**

Add these tests to the existing `#[cfg(test)] mod tests` in `src-tauri/src/settings.rs`:

```rust
#[test]
fn applies_default_notification_settings_for_legacy_config() {
    let settings: RedmineSettings =
        serde_json::from_str(r#"{"baseUrl":"https://redmine.example.com","apiKey":"secret"}"#)
            .unwrap();

    assert_eq!(settings.ticket_notifications_enabled, true);
    assert_eq!(settings.ticket_notification_volume, 0.35);
}

#[test]
fn rejects_notification_volume_below_zero() {
    let settings = RedmineSettings {
        base_url: "https://redmine.example.com".to_string(),
        api_key: "secret".to_string(),
        monitor_index: 0,
        dock_side: DockSide::Right,
        refresh_interval_seconds: default_refresh_interval_seconds(),
        language: Language::De,
        ticket_notifications_enabled: true,
        ticket_notification_volume: -0.1,
    };

    assert_eq!(
        settings.validate().unwrap_err(),
        "Ticket notification volume must be between 0 and 1"
    );
}

#[test]
fn rejects_notification_volume_above_one() {
    let settings = RedmineSettings {
        base_url: "https://redmine.example.com".to_string(),
        api_key: "secret".to_string(),
        monitor_index: 0,
        dock_side: DockSide::Right,
        refresh_interval_seconds: default_refresh_interval_seconds(),
        language: Language::De,
        ticket_notifications_enabled: true,
        ticket_notification_volume: 1.1,
    };

    assert_eq!(
        settings.validate().unwrap_err(),
        "Ticket notification volume must be between 0 and 1"
    );
}
```

- [ ] **Step 2: Run Rust tests and verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml settings`

Expected: compile failures for missing `ticket_notifications_enabled` and `ticket_notification_volume`.

- [ ] **Step 3: Implement notification setting defaults and validation**

In `src-tauri/src/settings.rs`, add:

```rust
pub fn default_ticket_notifications_enabled() -> bool {
    true
}

pub fn default_ticket_notification_volume() -> f64 {
    0.35
}
```

Extend `RedmineSettings`:

```rust
#[serde(default = "default_ticket_notifications_enabled")]
pub ticket_notifications_enabled: bool,
#[serde(default = "default_ticket_notification_volume")]
pub ticket_notification_volume: f64,
```

Add to `validate()` after the refresh interval check:

```rust
if !(0.0..=1.0).contains(&self.ticket_notification_volume) {
    return Err("Ticket notification volume must be between 0 and 1".to_string());
}
```

Update all existing `RedmineSettings { ... }` test literals in `settings.rs` with:

```rust
ticket_notifications_enabled: true,
ticket_notification_volume: default_ticket_notification_volume(),
```

- [ ] **Step 4: Add ticket state backend module**

Create `src-tauri/src/ticket_state.rs`:

```rust
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TicketNotificationState {
    #[serde(default)]
    pub known_ticket_ids: Vec<u64>,
    #[serde(default)]
    pub unread_ticket_ids: Vec<u64>,
}

fn ticket_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|_| "Could not resolve app settings directory".to_string())?;
    fs::create_dir_all(&dir).map_err(|_| "Could not create app settings directory".to_string())?;
    Ok(dir.join("ticket-notification-state.json"))
}

#[tauri::command]
pub fn load_ticket_state(app: AppHandle) -> Result<TicketNotificationState, String> {
    let path = ticket_state_path(&app)?;
    if !path.exists() {
        return Ok(TicketNotificationState::default());
    }

    let content =
        fs::read_to_string(path).map_err(|_| "Could not read ticket state".to_string())?;
    let state = serde_json::from_str(&content)
        .map_err(|_| "Could not parse ticket state".to_string())?;
    Ok(state)
}

#[tauri::command]
pub fn save_ticket_state(
    app: AppHandle,
    state: TicketNotificationState,
) -> Result<(), String> {
    let path = ticket_state_path(&app)?;
    let content = serde_json::to_string_pretty(&state)
        .map_err(|_| "Could not serialize ticket state".to_string())?;
    fs::write(path, content).map_err(|_| "Could not save ticket state".to_string())
}
```

- [ ] **Step 5: Register ticket state commands**

In `src-tauri/src/lib.rs`, add the module and commands. The final command list must include:

```rust
mod ticket_state;
```

and:

```rust
ticket_state::load_ticket_state,
ticket_state::save_ticket_state,
```

inside the existing `tauri::generate_handler![...]`.

- [ ] **Step 6: Update frontend API types**

In `src/api/redmine.ts`, extend `RedmineSettings`:

```ts
ticketNotificationsEnabled: boolean;
ticketNotificationVolume: number;
```

Add:

```ts
export type TicketNotificationState = {
  knownTicketIds: number[];
  unreadTicketIds: number[];
};

export function loadTicketState(): Promise<TicketNotificationState> {
  return invoke("load_ticket_state");
}

export function saveTicketState(state: TicketNotificationState): Promise<void> {
  return invoke("save_ticket_state", { state });
}
```

- [ ] **Step 7: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

Run: `npm test`

Expected: TypeScript compile may fail until Task 3 updates settings test fixtures. If it fails only because test fixtures lack the new settings fields, proceed to Task 3 before final full verification.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/settings.rs src-tauri/src/ticket_state.rs src-tauri/src/lib.rs src/api/redmine.ts
git commit -m "feat: persist ticket notification settings"
```

---

### Task 2: Add Pure New-Ticket State and Sound Helpers

**Files:**
- Create: `src/domain/ticketNotifications.ts`
- Create: `src/domain/ticketNotifications.test.ts`
- Create: `src/notifications/sound.ts`
- Create: `src/notifications/sound.test.ts`

**Interfaces:**
- Consumes: `TicketNotificationState` from `src/api/redmine.ts`
- Produces: `applyTicketRefresh(previous, ticketIds, initialized) -> TicketRefreshResult`
- Produces: `markTicketRead(previous, ticketId) -> TicketNotificationState`
- Produces: `playTicketNotificationSound(options: { enabled: boolean; volume: number }) -> void`

- [ ] **Step 1: Write failing pure state tests**

Create `src/domain/ticketNotifications.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyTicketRefresh, markTicketRead } from "./ticketNotifications";

describe("ticket notification state", () => {
  it("uses the first successful fetch as a baseline without unread tickets", () => {
    const result = applyTicketRefresh(
      { knownTicketIds: [], unreadTicketIds: [] },
      [1, 2],
      false
    );

    expect(result.state).toEqual({ knownTicketIds: [1, 2], unreadTicketIds: [] });
    expect(result.newTicketIds).toEqual([]);
    expect(result.initialized).toBe(true);
  });

  it("keeps previously unread tickets during first baseline when they still exist", () => {
    const result = applyTicketRefresh(
      { knownTicketIds: [], unreadTicketIds: [7, 8] },
      [7, 9],
      false
    );

    expect(result.state).toEqual({ knownTicketIds: [7, 9], unreadTicketIds: [7] });
    expect(result.newTicketIds).toEqual([]);
  });

  it("marks only later unseen ticket ids as new and unread", () => {
    const result = applyTicketRefresh(
      { knownTicketIds: [1, 2], unreadTicketIds: [] },
      [2, 3, 4],
      true
    );

    expect(result.state).toEqual({ knownTicketIds: [1, 2, 3, 4], unreadTicketIds: [3, 4] });
    expect(result.newTicketIds).toEqual([3, 4]);
  });

  it("removes a clicked ticket from unread state", () => {
    expect(markTicketRead({ knownTicketIds: [1, 2], unreadTicketIds: [1, 2] }, 1)).toEqual({
      knownTicketIds: [1, 2],
      unreadTicketIds: [2]
    });
  });
});
```

- [ ] **Step 2: Run state tests and verify they fail**

Run: `npm test -- src/domain/ticketNotifications.test.ts`

Expected: FAIL because `ticketNotifications.ts` does not exist.

- [ ] **Step 3: Implement pure ticket state helper**

Create `src/domain/ticketNotifications.ts`:

```ts
import type { TicketNotificationState } from "../api/redmine";

export type TicketRefreshResult = {
  state: TicketNotificationState;
  newTicketIds: number[];
  initialized: boolean;
};

function uniqueSorted(ids: number[]) {
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

export function applyTicketRefresh(
  previous: TicketNotificationState,
  ticketIds: number[],
  initialized: boolean
): TicketRefreshResult {
  const currentIds = uniqueSorted(ticketIds);
  const currentIdSet = new Set(currentIds);

  if (!initialized) {
    return {
      state: {
        knownTicketIds: currentIds,
        unreadTicketIds: uniqueSorted(
          previous.unreadTicketIds.filter((id) => currentIdSet.has(id))
        )
      },
      newTicketIds: [],
      initialized: true
    };
  }

  const knownIdSet = new Set(previous.knownTicketIds);
  const newTicketIds = currentIds.filter((id) => !knownIdSet.has(id));

  return {
    state: {
      knownTicketIds: uniqueSorted([...previous.knownTicketIds, ...currentIds]),
      unreadTicketIds: uniqueSorted([...previous.unreadTicketIds, ...newTicketIds])
    },
    newTicketIds,
    initialized: true
  };
}

export function markTicketRead(
  previous: TicketNotificationState,
  ticketId: number
): TicketNotificationState {
  return {
    knownTicketIds: previous.knownTicketIds,
    unreadTicketIds: previous.unreadTicketIds.filter((id) => id !== ticketId)
  };
}
```

- [ ] **Step 4: Write failing sound tests**

Create `src/notifications/sound.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { playTicketNotificationSound } from "./sound";

describe("playTicketNotificationSound", () => {
  it("does nothing when disabled", () => {
    const AudioContextMock = vi.fn();
    vi.stubGlobal("AudioContext", AudioContextMock);

    playTicketNotificationSound({ enabled: false, volume: 0.5 });

    expect(AudioContextMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("uses the configured volume when enabled", () => {
    const gain = { gain: { value: 0 }, connect: vi.fn() };
    const oscillator = {
      frequency: { value: 0 },
      type: "",
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
    const context = {
      currentTime: 10,
      destination: {},
      createGain: vi.fn(() => gain),
      createOscillator: vi.fn(() => oscillator),
      close: vi.fn()
    };
    vi.stubGlobal("AudioContext", vi.fn(() => context));

    playTicketNotificationSound({ enabled: true, volume: 0.25 });

    expect(gain.gain.value).toBe(0.25);
    expect(oscillator.start).toHaveBeenCalledWith(10);
    expect(oscillator.stop).toHaveBeenCalledWith(10.18);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 5: Run sound tests and verify they fail**

Run: `npm test -- src/notifications/sound.test.ts`

Expected: FAIL because `sound.ts` does not exist.

- [ ] **Step 6: Implement sound helper**

Create `src/notifications/sound.ts`:

```ts
type TicketSoundOptions = {
  enabled: boolean;
  volume: number;
};

export function playTicketNotificationSound({ enabled, volume }: TicketSoundOptions) {
  if (!enabled) {
    return;
  }

  try {
    const AudioContextCtor = window.AudioContext;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 740;
    gain.gain.value = Math.max(0, Math.min(volume, 1));

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.18);
    window.setTimeout(() => {
      void context.close();
    }, 240);
  } catch {
    // Audio playback must not break ticket refresh.
  }
}
```

- [ ] **Step 7: Run helper tests**

Run: `npm test -- src/domain/ticketNotifications.test.ts src/notifications/sound.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/ticketNotifications.ts src/domain/ticketNotifications.test.ts src/notifications/sound.ts src/notifications/sound.test.ts
git commit -m "feat: add ticket notification helpers"
```

---

### Task 3: Wire Notification State Into the App UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TicketList.tsx`
- Modify: `src/components/TicketList.test.tsx`
- Modify: `src/components/SettingsForm.tsx`
- Modify: `src/components/SettingsForm.test.tsx`
- Modify: `src/i18n.ts`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `loadTicketState()` and `saveTicketState(state)` from Task 1.
- Consumes: `applyTicketRefresh()` and `markTicketRead()` from Task 2.
- Consumes: `playTicketNotificationSound()` from Task 2.
- Produces: `TicketList` prop `unreadTicketIds?: number[]`.

- [ ] **Step 1: Add failing TicketList unread rendering test**

Append to `src/components/TicketList.test.tsx`:

```ts
it("adds an unread class for unread ticket ids", () => {
  render(
    <TicketList
      tickets={[
        {
          id: 12,
          subject: "New assignment",
          status: "New",
          priority: "Normal",
          project: "Desktop",
          projectId: 12,
          tracker: "Bug",
          updatedAt: "2026-08-10T08:00:00Z",
          url: "https://redmine.example.com/issues/12"
        }
      ]}
      unreadTicketIds={[12]}
      onOpenTicket={() => undefined}
    />
  );

  expect(screen.getByRole("button", { name: /new assignment/i })).toHaveClass(
    "ticket-row-unread"
  );
});
```

- [ ] **Step 2: Run TicketList test and verify it fails**

Run: `npm test -- src/components/TicketList.test.tsx`

Expected: FAIL because `unreadTicketIds` is not a valid prop yet.

- [ ] **Step 3: Implement TicketList unread prop**

In `src/components/TicketList.tsx`, update props:

```ts
type TicketListProps = {
  tickets: Ticket[];
  unreadTicketIds?: number[];
  onOpenTicket: (ticket: Ticket) => void;
  onTicketContextMenu?: (ticket: Ticket, position: { x: number; y: number }) => void;
};
```

Inside the component:

```ts
const unreadIdSet = new Set(unreadTicketIds ?? []);
```

Use per ticket:

```tsx
const isUnread = unreadIdSet.has(ticket.id);
```

and set:

```tsx
className={`ticket-row ${priorityClassName(ticket.priority)}${isUnread ? " ticket-row-unread" : ""}`}
aria-label={isUnread ? `${ticket.subject} unread` : ticket.subject}
```

- [ ] **Step 4: Add failing SettingsForm test for notification settings**

Update the existing expected settings in `src/components/SettingsForm.test.tsx` so `initialSettings` includes:

```ts
ticketNotificationsEnabled: true,
ticketNotificationVolume: 0.35
```

After changing language, add:

```ts
fireEvent.click(screen.getByLabelText("Ticketton aktiv"));
fireEvent.change(screen.getByLabelText("Ticketton Lautstärke"), {
  target: { value: "0.6" }
});
```

Update `expect(onSave).toHaveBeenCalledWith(...)` to include:

```ts
ticketNotificationsEnabled: false,
ticketNotificationVolume: 0.6
```

- [ ] **Step 5: Run SettingsForm test and verify it fails**

Run: `npm test -- src/components/SettingsForm.test.tsx`

Expected: FAIL because labels and fields do not exist.

- [ ] **Step 6: Implement settings UI and translations**

In `src/i18n.ts`, add translation keys:

```ts
| "ticketNotifications"
| "ticketNotificationVolume"
```

German:

```ts
ticketNotifications: "Ticketton aktiv",
ticketNotificationVolume: "Ticketton Lautstärke",
```

English:

```ts
ticketNotifications: "Ticket sound enabled",
ticketNotificationVolume: "Ticket sound volume",
```

In `src/components/SettingsForm.tsx`, add state:

```ts
const [ticketNotificationsEnabled, setTicketNotificationsEnabled] = useState(
  initialSettings?.ticketNotificationsEnabled ?? true
);
const [ticketNotificationVolume, setTicketNotificationVolume] = useState(
  String(initialSettings?.ticketNotificationVolume ?? 0.35)
);
```

Add to `onSave` payload:

```ts
ticketNotificationsEnabled,
ticketNotificationVolume: Number(ticketNotificationVolume)
```

Add fields before the save button:

```tsx
<label className="settings-checkbox">
  <input
    checked={ticketNotificationsEnabled}
    onChange={(event) => setTicketNotificationsEnabled(event.target.checked)}
    type="checkbox"
  />
  <span>{t("ticketNotifications")}</span>
</label>
<label>
  <span>{t("ticketNotificationVolume")}</span>
  <input
    aria-label={t("ticketNotificationVolume")}
    max="1"
    min="0"
    onChange={(event) => setTicketNotificationVolume(event.target.value)}
    step="0.05"
    type="range"
    value={ticketNotificationVolume}
  />
</label>
```

- [ ] **Step 7: Add failing App integration tests for first fetch and later new ticket**

In `src/App.test.tsx`, add a helper fixture:

```ts
function settingsFixture() {
  return {
    baseUrl: "https://redmine.example.com",
    apiKey: "secret",
    monitorIndex: 0,
    dockSide: "right",
    refreshIntervalSeconds: 15,
    language: "de",
    ticketNotificationsEnabled: true,
    ticketNotificationVolume: 0.35
  };
}
```

Then add:

```ts
it("does not mark initial tickets unread on the first successful fetch", async () => {
  invokeMock.mockImplementation((command: string) => {
    if (command === "dock_window") return Promise.resolve();
    if (command === "list_monitors") return Promise.resolve([]);
    if (command === "load_ticket_state") {
      return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
    }
    if (command === "save_ticket_state") return Promise.resolve();
    if (command === "load_settings") return Promise.resolve(settingsFixture());
    if (command === "fetch_issue_statuses") return Promise.resolve([]);
    if (command === "fetch_tickets") {
      return Promise.resolve([
        {
          id: 42,
          subject: "Existing ticket",
          status: "Neu",
          priority: "Normal",
          project: "Desktop",
          projectId: 12,
          tracker: "Bug",
          updatedAt: "2026-08-10T08:00:00Z",
          url: "https://redmine.example.com/issues/42"
        }
      ]);
    }
    return Promise.resolve();
  });

  render(<App />);

  expect(await screen.findByRole("button", { name: /existing ticket/i })).not.toHaveClass(
    "ticket-row-unread"
  );
});
```

Add a later-refresh test using fake timers:

```ts
it("marks later unseen tickets unread and saves the state", async () => {
  vi.useFakeTimers();
  let fetchCount = 0;
  invokeMock.mockImplementation((command: string, args?: unknown) => {
    if (command === "dock_window") return Promise.resolve();
    if (command === "list_monitors") return Promise.resolve([]);
    if (command === "load_ticket_state") {
      return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
    }
    if (command === "save_ticket_state") return Promise.resolve();
    if (command === "load_settings") return Promise.resolve(settingsFixture());
    if (command === "fetch_issue_statuses") return Promise.resolve([]);
    if (command === "fetch_tickets") {
      fetchCount += 1;
      return Promise.resolve(
        fetchCount === 1
          ? [
              {
                id: 42,
                subject: "Existing ticket",
                status: "Neu",
                priority: "Normal",
                project: "Desktop",
                projectId: 12,
                tracker: "Bug",
                updatedAt: "2026-08-10T08:00:00Z",
                url: "https://redmine.example.com/issues/42"
              }
            ]
          : [
              {
                id: 42,
                subject: "Existing ticket",
                status: "Neu",
                priority: "Normal",
                project: "Desktop",
                projectId: 12,
                tracker: "Bug",
                updatedAt: "2026-08-10T08:00:00Z",
                url: "https://redmine.example.com/issues/42"
              },
              {
                id: 43,
                subject: "Brand new ticket",
                status: "Neu",
                priority: "Normal",
                project: "Desktop",
                projectId: 12,
                tracker: "Bug",
                updatedAt: "2026-08-10T08:01:00Z",
                url: "https://redmine.example.com/issues/43"
              }
            ]
      );
    }
    return Promise.resolve(args);
  });

  render(<App />);
  await screen.findByText("Existing ticket");

  await vi.advanceTimersByTimeAsync(15000);

  expect(await screen.findByRole("button", { name: /brand new ticket/i })).toHaveClass(
    "ticket-row-unread"
  );
  expect(invokeMock).toHaveBeenCalledWith("save_ticket_state", {
    state: { knownTicketIds: [42, 43], unreadTicketIds: [43] }
  });
  vi.useRealTimers();
});
```

- [ ] **Step 8: Run App tests and verify they fail**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL until App wires ticket state commands and helpers.

- [ ] **Step 9: Wire App refresh flow**

In `src/App.tsx`, import:

```ts
loadTicketState,
saveTicketState,
type TicketNotificationState,
```

from `./api/redmine`, plus:

```ts
import { applyTicketRefresh, markTicketRead } from "./domain/ticketNotifications";
import { playTicketNotificationSound } from "./notifications/sound";
```

Add state:

```ts
const [ticketState, setTicketState] = useState<TicketNotificationState>({
  knownTicketIds: [],
  unreadTicketIds: []
});
const [hasInitializedTicketBaseline, setHasInitializedTicketBaseline] = useState(false);
```

During initial load, call `loadTicketState()` before or alongside `loadSettings()` and set state. If loading ticket state fails, continue with the empty default.

Change `refreshTickets` so after successful `fetchTickets(nextSettings)` it does:

```ts
setTicketState((previousTicketState) => {
  const result = applyTicketRefresh(
    previousTicketState,
    loadedTickets.map((ticket) => ticket.id),
    hasInitializedTicketBaseline
  );
  setHasInitializedTicketBaseline(result.initialized);
  void saveTicketState(result.state).catch(() => undefined);
  if (result.newTicketIds.length > 0) {
    playTicketNotificationSound({
      enabled: nextSettings.ticketNotificationsEnabled,
      volume: nextSettings.ticketNotificationVolume
    });
  }
  return result.state;
});
```

If stale closure behavior appears in tests, replace `hasInitializedTicketBaseline` state with a `useRef(false)` and set `hasInitializedTicketBaselineRef.current = result.initialized`.

Add helper:

```ts
function markTicketAsRead(ticketId: number) {
  setTicketState((previousTicketState) => {
    const nextTicketState = markTicketRead(previousTicketState, ticketId);
    void saveTicketState(nextTicketState).catch(() => undefined);
    return nextTicketState;
  });
}
```

Update `handleOpenTicket(ticket)` to call `markTicketAsRead(ticket.id)` before `openTicketUrl(ticket.url)`.

Update the context menu "Im Browser öffnen" click path to use `handleOpenTicket(ticketContextMenu.ticket)`, which already marks read.

Pass to `TicketList`:

```tsx
unreadTicketIds={ticketState.unreadTicketIds}
```

- [ ] **Step 10: Add unread highlight CSS**

In `src/styles.css`, add:

```css
.ticket-row-unread {
  border-color: #4f9ce8;
  box-shadow: 0 0 0 1px rgb(79 156 232 / 18%), 0 8px 20px rgb(20 87 168 / 10%);
  animation: unread-ticket-pulse 1.8s ease-in-out infinite;
}

.ticket-row-unread::after {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: linear-gradient(
    110deg,
    transparent 0%,
    rgb(255 255 255 / 0%) 35%,
    rgb(255 255 255 / 45%) 50%,
    rgb(255 255 255 / 0%) 65%,
    transparent 100%
  );
  content: "";
  pointer-events: none;
  transform: translateX(-100%);
  animation: unread-ticket-shimmer 2.4s ease-in-out infinite;
}

@keyframes unread-ticket-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 1px rgb(79 156 232 / 18%), 0 8px 20px rgb(20 87 168 / 10%);
  }

  50% {
    box-shadow: 0 0 0 1px rgb(79 156 232 / 34%), 0 10px 24px rgb(20 87 168 / 16%);
  }
}

@keyframes unread-ticket-shimmer {
  0% {
    transform: translateX(-100%);
  }

  55%,
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ticket-row-unread,
  .ticket-row-unread::after {
    animation: none;
  }

  .ticket-row-unread::after {
    display: none;
  }
}
```

Add checkbox alignment:

```css
.settings-form .settings-checkbox {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.settings-form .settings-checkbox input {
  width: 16px;
  height: 16px;
}
```

- [ ] **Step 11: Update all App test settings fixtures**

Every mocked `load_settings` return in `src/App.test.tsx` must include:

```ts
ticketNotificationsEnabled: true,
ticketNotificationVolume: 0.35
```

Every mock must handle:

```ts
if (command === "load_ticket_state") {
  return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
}

if (command === "save_ticket_state") {
  return Promise.resolve();
}
```

- [ ] **Step 12: Run frontend tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/components/TicketList.tsx src/components/TicketList.test.tsx src/components/SettingsForm.tsx src/components/SettingsForm.test.tsx src/i18n.ts src/styles.css
git commit -m "feat: notify and highlight new tickets"
```

---

### Task 4: Add GitHub Version Automation

**Files:**
- Create: `scripts/sync-version.mjs`
- Create: `.github/workflows/release.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: CLI `node scripts/sync-version.mjs 1.2.3`
- Produces: npm script `version:sync`
- Produces: GitHub workflow `release`
- Consumes: Conventional Commit messages in Git history.

- [ ] **Step 1: Add version sync script**

Create `scripts/sync-version.mjs`:

```js
import fs from "node:fs";

const nextVersion = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(nextVersion ?? "")) {
  console.error("Usage: node scripts/sync-version.mjs <major.minor.patch>");
  process.exit(1);
}

function writeJsonVersion(path) {
  const content = JSON.parse(fs.readFileSync(path, "utf8"));
  content.version = nextVersion;
  fs.writeFileSync(`${path}`, `${JSON.stringify(content, null, 2)}\n`);
}

function writeCargoVersion(path) {
  const content = fs.readFileSync(path, "utf8");
  const nextContent = content.replace(
    /^version = "\d+\.\d+\.\d+"/m,
    `version = "${nextVersion}"`
  );

  if (nextContent === content) {
    console.error(`Could not find package version in ${path}`);
    process.exit(1);
  }

  fs.writeFileSync(path, nextContent);
}

writeJsonVersion("package.json");
writeJsonVersion("src-tauri/tauri.conf.json");
writeCargoVersion("src-tauri/Cargo.toml");
```

- [ ] **Step 2: Add package script**

In `package.json`, add:

```json
"version:sync": "node scripts/sync-version.mjs"
```

Keep the existing scripts unchanged.

- [ ] **Step 3: Test sync script locally on a throwaway version**

Run: `npm run version:sync -- 0.1.999`

Expected: all three files show `0.1.999`.

Run: `npm run version:sync -- 0.1.0`

Expected: all three files return to the current version unless the current branch already has a different version from user changes. If the branch version is not `0.1.0`, restore the exact pre-test version read from each file before Step 3.

- [ ] **Step 4: Add release workflow**

Create `.github/workflows/release.yml`:

```yaml
name: release

on:
  workflow_dispatch:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Determine release version
        id: version
        uses: paulhatch/semantic-version@v5.4.0
        with:
          tag_prefix: "v"
          major_pattern: "BREAKING CHANGE"
          minor_pattern: "feat:"
          version_format: "${major}.${minor}.${patch}"

      - name: Sync version files
        if: steps.version.outputs.changed == 'true'
        run: npm run version:sync -- "${{ steps.version.outputs.version }}"

      - name: Run tests
        if: steps.version.outputs.changed == 'true'
        run: npm test

      - name: Commit version files
        if: steps.version.outputs.changed == 'true'
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore(release): v${{ steps.version.outputs.version }}"
          file_pattern: "package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json"
          tagging_message: "v${{ steps.version.outputs.version }}"

      - name: Create GitHub Release
        if: steps.version.outputs.changed == 'true'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: "v${{ steps.version.outputs.version }}"
          name: "v${{ steps.version.outputs.version }}"
          generate_release_notes: true
```

- [ ] **Step 5: Validate workflow YAML exists and script still works**

Run: `npm run version:sync -- 0.1.0`

Expected: command exits 0 and version files are synchronized.

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-version.mjs .github/workflows/release.yml package.json package-lock.json
git commit -m "ci: automate release versioning"
```

---

### Task 5: Final Verification

**Files:**
- No new files.
- Verify all files changed by Tasks 1-4.

**Interfaces:**
- Consumes: all task outputs.
- Produces: final verified branch state.

- [ ] **Step 1: Run frontend tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 3: Run production frontend build**

Run: `npm run build`

Expected: PASS and `dist/` generated.

- [ ] **Step 4: Inspect changed files**

Run: `git status --short`

Expected: no uncommitted changes from this implementation except pre-existing user changes such as `src-tauri/Cargo.toml` or `.serena/` if they were present before the implementation.

- [ ] **Step 5: Manual behavior check**

Run: `npm run tauri dev`

Expected:

- App starts without marking currently returned tickets unread.
- A later new ticket appears highlighted.
- One short sound plays for one refresh containing one or more new tickets when enabled.
- Disabling ticket sound prevents the sound but keeps highlighting.
- Clicking a highlighted ticket removes the highlight.

- [ ] **Step 6: Commit verification fixes if needed**

If verification reveals a bug and a fix is required, commit only the fix files:

```bash
git add <fixed-files>
git commit -m "fix: stabilize ticket notifications"
```

---

## Self-Review Notes

- Spec coverage: automated versioning, settings, first-fetch baseline, persisted unread state, visual highlight, sound playback, error handling, and tests are covered.
- Placeholder scan: no placeholder tasks are intentionally left open; every task has explicit files, commands, and expected results.
- Type consistency: `ticketNotificationsEnabled`, `ticketNotificationVolume`, `TicketNotificationState`, `knownTicketIds`, and `unreadTicketIds` are used consistently across Rust serde camelCase and TypeScript.
