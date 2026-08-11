# Notification Sound Preview Design

## Goal

Users can preview the currently selected ticket notification sound from the settings screen before saving or waiting for a new ticket.

## User Experience

- The settings form shows a small test control next to the notification sound dropdown.
- Activating the control plays the currently selected sound once.
- Preview playback uses the current volume slider value.
- Preview playback works even when ticket notifications are disabled, so users can choose a sound before enabling notifications.
- The preview action does not save settings and does not change the selected sound.

## Implementation

- Reuse the existing notification sound playback helper.
- Add a settings-form callback for preview playback instead of creating new audio behavior in the component.
- Pass the selected sound filename and current volume to the helper.
- Keep playback failure non-blocking; if the browser or system refuses playback, the settings form stays usable.

## Tests

- Update settings form tests to verify the preview control is rendered.
- Verify the preview action calls the provided callback with the selected sound and current volume.
- Keep existing save behavior unchanged.
