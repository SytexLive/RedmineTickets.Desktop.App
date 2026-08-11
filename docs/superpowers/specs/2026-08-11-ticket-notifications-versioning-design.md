# Ticket Notifications and Automated Versioning Design

## Context

The app is a Tauri 2 desktop side panel with a React/Vite frontend. It already polls Redmine tickets on an interval, persists Redmine settings through the Tauri backend, and keeps version metadata in three places:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

The requested work adds automated versioning, an optional subtle sound for newly received tickets, and a visual unread state for newly received tickets.

## Goals

- Version numbers are not manually edited during normal releases.
- A GitHub-based release flow decides the next version from commit history and keeps all app version files synchronized.
- Newly received tickets can play a subtle notification sound.
- Users can turn ticket sounds on or off and set the volume in settings.
- Newly received tickets are visually highlighted until the user clicks them.
- Existing tickets must not be treated as unread when the app starts.

## Non-Goals

- No native Windows notification center integration in the first version.
- No per-project or per-priority notification rules.
- No custom sound picker in the first version.
- No automatic marking as read based on time or ticket status changes.

## Versioning Design

Use GitHub Actions as the release authority. The workflow will read Conventional Commits and determine the next semantic version:

- `fix:` increments patch.
- `feat:` increments minor.
- Breaking changes increment major.

The release automation will update `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` to the same version before creating the release tag. This keeps Tauri installer metadata and frontend package metadata aligned while avoiding manual version edits.

The first implementation should focus on version calculation and file synchronization. Building and attaching Tauri installers can be added to the same workflow later if desired.

## Notification Settings Design

Extend the existing settings model with:

- `ticketNotificationsEnabled: boolean`, default `true`
- `ticketNotificationVolume: number`, default `0.35`

The backend validates volume as a value from `0` to `1`. Existing settings files remain valid through serde defaults.

The settings form adds:

- A checkbox or toggle for sound on/off.
- A volume slider shown near the toggle.

The setting only controls sound playback. It does not disable unread highlighting.

## New Ticket Detection Design

Ticket detection runs in the frontend where ticket polling already happens.

The app keeps three local concepts:

- `knownTicketIds`: ticket IDs already seen by this app installation.
- `unreadTicketIds`: ticket IDs that should currently be highlighted.
- `hasInitializedTicketBaseline`: whether the first successful ticket fetch for this app session has completed.

On the first successful ticket fetch after app start:

- Store all returned ticket IDs as known.
- Do not play a sound.
- Do not mark returned tickets as unread just because they exist.
- Keep any previously persisted unread ticket IDs that still appear in the returned list.

On later successful ticket fetches:

- Compare returned ticket IDs with `knownTicketIds`.
- Any returned ID not already known is a new ticket.
- Add new IDs to `knownTicketIds`.
- Add new IDs to `unreadTicketIds`.
- If sound is enabled and at least one new ticket was found, play one subtle notification sound.

If a refresh fails, do not alter known or unread ticket state. The next successful refresh continues from the previous successful state.

## Read State Design

Clicking a ticket marks it as read before or while opening it in the browser. Marking as read means removing that ticket ID from `unreadTicketIds` and persisting the updated unread state locally.

Right-clicking a ticket to open the context menu does not mark it as read. The explicit open action from the context menu does mark it as read.

Persist `unreadTicketIds` locally so tickets that arrived in a previous session and were never clicked can remain highlighted after restart. Persisting `knownTicketIds` is useful to prevent old tickets from being treated as new after restart, but the first-fetch baseline still protects against accidental mass-unread marking if that data is missing.

## Visual Highlight Design

`TicketList` receives unread ticket IDs or an `isUnread` flag per ticket. Unread rows get an additional CSS class.

The highlight should be noticeable but restrained:

- Slightly brighter border or accent glow.
- Soft shimmer or pulse animation.
- No layout shift.
- Respect reduced-motion preferences by falling back to a static highlight.

The highlight disappears immediately after the ticket is marked as read.

## Sound Design

Use a short bundled audio asset or a small Web Audio generated tone. The first implementation should prefer a generated Web Audio tone to avoid adding binary assets unless product taste later requires a custom sound file.

Playback rules:

- Never play on the first successful fetch after startup.
- Play at most once per successful refresh, even if multiple new tickets arrive.
- Respect `ticketNotificationsEnabled`.
- Use `ticketNotificationVolume`.
- Swallow playback errors because browser audio policies or device issues should not break ticket refresh.

## Data Flow

1. App loads settings and persisted ticket notification state.
2. App performs the first ticket refresh.
3. First successful refresh establishes the current known ticket baseline.
4. Later refreshes identify new ticket IDs.
5. New IDs update unread state and optionally trigger sound.
6. Ticket list renders unread styling for matching IDs.
7. User opens a ticket.
8. App removes that ID from unread state and persists the change.

## Error Handling

- Invalid volume settings are rejected by backend validation.
- Missing notification fields in older settings files use defaults.
- Ticket refresh errors leave known and unread state unchanged.
- Sound playback errors are ignored after optionally logging to the console in development.
- Local unread-state persistence failures should not prevent ticket display, but should surface as a non-blocking error if the existing app error pattern can represent it cleanly.

## Testing

Frontend tests should cover:

- First successful fetch does not create unread tickets.
- Later fetch with a new ID marks only that ID unread.
- Later fetch with multiple new IDs triggers only one sound event.
- Clicking a highlighted ticket marks it read.
- Right-clicking alone does not mark read.
- Sound respects enabled and volume settings.
- Reduced-motion CSS keeps a static readable highlight.

Backend tests should cover:

- Legacy settings deserialize with notification defaults.
- Volume below `0` or above `1` is rejected.
- Valid notification settings pass validation.

Release automation should be verified by a dry-run or test workflow before relying on it for production releases.
