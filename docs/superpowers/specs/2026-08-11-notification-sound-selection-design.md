# Notification Sound Selection Design

## Context

The app already supports ticket notification sound enablement and volume. It currently plays a generated Web Audio tone when later refreshes discover new ticket IDs.

The user has selected MP3 files in `C:\Users\Dominik\Downloads\Sounds`:

- `alert.mp3`
- `amongus.mp3`
- `default.mp3`
- `drage.mp3`
- `pacman.mp3`
- `phoning.mp3`
- `ring.mp3`
- `swiggle.mp3`

## Goals

- Bundle these MP3 files with the app so notification sounds work after build and installation.
- Use `default.mp3` as the default notification sound.
- Let the user choose one of the bundled sounds in settings.
- Keep the existing sound on/off setting and volume setting.
- Continue playing sound only for newly discovered tickets after the first successful startup baseline.

## Non-Goals

- No arbitrary external file picker.
- No editing or trimming sound files.
- No per-project, per-priority, or per-ticket sound rules.
- No preview button in the first implementation.

## Design

Copy the MP3 files into a tracked frontend asset directory, for example `src/assets/sounds/`. The application code references only bundled assets, not the original `Downloads` directory.

Add a new setting:

- `ticketNotificationSound: string`, default `default.mp3`

The backend validates that the value is one of the bundled sound filenames. Existing settings files remain valid through serde defaults.

The settings form adds a dropdown labeled "Ticketton" / "Ticket sound" with all bundled sound names. The submitted settings include the selected filename.

The sound playback helper changes from generated Web Audio to an `HTMLAudioElement` loaded from the selected bundled asset URL. It applies the existing clamped volume setting before playback. Playback errors remain non-fatal.

If a saved filename is missing or invalid in the frontend, playback falls back to `default.mp3`. Backend validation prevents newly saved invalid names.

## Data Flow

1. Settings load from the Tauri backend.
2. Legacy settings without `ticketNotificationSound` receive `default.mp3`.
3. Settings form displays the selected sound in a dropdown.
4. User saves settings with a selected bundled filename.
5. When a later ticket refresh detects one or more new IDs, the app plays the selected sound once if sound is enabled.

## Testing

Frontend tests should cover:

- Settings form submits `ticketNotificationSound`.
- The audio helper uses the selected sound URL.
- Invalid or missing selected sound falls back to `default.mp3`.
- Sound disabled still prevents audio playback.

Backend tests should cover:

- Legacy settings default to `default.mp3`.
- Valid bundled filenames pass validation.
- Invalid filenames are rejected.

Build verification should confirm the MP3 files are included in the frontend build output and the Tauri build still succeeds.
