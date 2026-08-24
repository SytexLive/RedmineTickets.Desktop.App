# App Settings

Settings are stored as one `RedmineSettings` object and shared between the
React frontend and the Tauri backend.

## Files To Update

When adding a new persisted setting, update these places together:

- `src/api/redmine.ts`: TypeScript `RedmineSettings` shape.
- `src-tauri/src/settings.rs`: Rust `RedmineSettings`, serde default for legacy
  config files, and validation if the value has a constrained format.
- `src/components/SettingsForm.tsx`: form state, input control, `currentSettings`,
  and `onChange` dependencies.
- `src/i18n.ts`: labels for German and English UI.
- `src/styles.css`: styling for any new control or CSS variable.
- Tests next to the touched code.

## Accent Color

`accentColor` is stored as a `#RRGGBB` hex string. The frontend normalizes it in
`src/theme.ts`; the backend validates the same shape before saving. Missing
legacy values default to `#1457a8`.

The app root in `src/App.tsx` exposes the value as `--accent-color`. CSS derives
related focus and soft colors from that variable with `color-mix()`, so new
accent-aware UI should use the existing CSS variables instead of hard-coded blue
values.
