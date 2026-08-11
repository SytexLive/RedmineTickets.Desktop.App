# Notification Sound Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle the selected MP3 files and let users choose the notification sound, with `default.mp3` as the default.

**Architecture:** Store supported sound filenames in a small shared frontend module and mirror the allowed list in Rust settings validation. The React settings form saves the selected filename, and the sound helper resolves it to a bundled asset URL before using `HTMLAudioElement` with the existing volume and enabled settings.

**Tech Stack:** Tauri 2, Rust, React, TypeScript, Vite assets, Vitest.

## Global Constraints

- Bundle these MP3 files with the app so notification sounds work after build and installation.
- Use `default.mp3` as the default notification sound.
- Let the user choose one of the bundled sounds in settings.
- Keep the existing sound on/off setting and volume setting.
- Continue playing sound only for newly discovered tickets after the first successful startup baseline.
- No arbitrary external file picker.
- No preview button in the first implementation.

---

### Task 1: Sound Assets and Setting Schema

**Files:**
- Create: `src/assets/sounds/*.mp3`
- Create: `src/notifications/soundOptions.ts`
- Modify: `src-tauri/src/settings.rs`
- Modify: `src/api/redmine.ts`

**Interfaces:**
- Produces: `ticketNotificationSound: string` on `RedmineSettings`.
- Produces: `DEFAULT_TICKET_NOTIFICATION_SOUND = "default.mp3"`.
- Produces: `TICKET_NOTIFICATION_SOUNDS` list with all bundled filenames.

- [ ] Copy all MP3 files from `C:\Users\Dominik\Downloads\Sounds` into `src/assets/sounds/`.
- [ ] Add frontend sound option constants.
- [ ] Add Rust default/validation for `ticket_notification_sound`.
- [ ] Extend TypeScript settings type.
- [ ] Test legacy default and invalid sound rejection.

### Task 2: Settings UI and Playback

**Files:**
- Modify: `src/components/SettingsForm.tsx`
- Modify: `src/components/SettingsForm.test.tsx`
- Modify: `src/i18n.ts`
- Modify: `src/notifications/sound.ts`
- Modify: `src/notifications/sound.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `ticketNotificationSound`.
- Produces: playback through selected bundled MP3 URL, falling back to `default.mp3`.

- [ ] Add the sound dropdown to settings.
- [ ] Pass selected sound into notification playback.
- [ ] Replace generated tone with selected MP3 playback.
- [ ] Test disabled behavior, selected URL, fallback, and settings submission.

### Task 3: Verification and EXE

**Files:**
- No source changes expected after implementation.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run Cargo tests with `%USERPROFILE%\.cargo\bin` on PATH.
- [ ] Run `npm run tauri -- build`.
- [ ] Report the generated EXE path.

## Self-Review Notes

- Spec coverage: asset bundling, default sound, dropdown selection, backend validation, fallback, tests, and EXE build are covered.
- Placeholder scan: no placeholders remain.
- Type consistency: `ticketNotificationSound` is the single setting name in TypeScript and Rust serde camelCase.
