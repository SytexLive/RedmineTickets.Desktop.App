# Notification Sound Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings control that plays the currently selected notification sound for preview.

**Architecture:** The settings form remains responsible for UI state and delegates playback to a callback. The app wires that callback to the existing notification sound helper, forcing playback enabled only for previews while preserving the selected sound and volume.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing Tauri/Vite asset imports.

## Global Constraints

- Preview playback uses the currently selected sound filename.
- Preview playback uses the current volume slider value.
- Preview playback works even when ticket notifications are disabled.
- Preview playback does not save settings.
- Audio failures remain non-blocking.
- No new persisted setting is added.

---

### Task 1: Settings Preview Interface

**Files:**
- Modify: `src/components/SettingsForm.tsx`
- Modify: `src/components/SettingsForm.test.tsx`

**Interfaces:**
- Consumes: `onPreviewTicketNotificationSound?: (sound: string, volume: number) => void`
- Produces: A preview button that invokes the callback with `ticketNotificationSound` and `Number(ticketNotificationVolume)`.

- [ ] **Step 1: Write the failing component test**

Add this assertion to `src/components/SettingsForm.test.tsx`:

```tsx
const onPreviewTicketNotificationSound = vi.fn();

render(
  <SettingsForm
    initialSettings={{
      baseUrl: "https://redmine.example.com",
      apiKey: "secret",
      monitorIndex: 1,
      dockSide: "left",
      refreshIntervalSeconds: 120,
      language: "de",
      ticketNotificationsEnabled: false,
      ticketNotificationVolume: 0.35,
      ticketNotificationSound: "default.mp3"
    }}
    monitors={[
      { index: 0, label: "Monitor 1", isPrimary: false },
      { index: 1, label: "Monitor 2", isPrimary: true }
    ]}
    saving={false}
    onSave={vi.fn()}
    onPreviewTicketNotificationSound={onPreviewTicketNotificationSound}
  />
);

fireEvent.change(screen.getByLabelText("Ticketton"), {
  target: { value: "ring.mp3" }
});
fireEvent.change(screen.getByLabelText("Ticketton Lautstärke"), {
  target: { value: "0.6" }
});
fireEvent.click(screen.getByRole("button", { name: "Ticketton testen" }));

expect(onPreviewTicketNotificationSound).toHaveBeenCalledWith("ring.mp3", 0.6);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- SettingsForm`

Expected: FAIL because `onPreviewTicketNotificationSound` and the preview button do not exist yet.

- [ ] **Step 3: Add the preview prop and button**

Update `SettingsFormProps` in `src/components/SettingsForm.tsx`:

```ts
onPreviewTicketNotificationSound?: (sound: string, volume: number) => void;
```

Add a `previewTicketNotificationSound` handler:

```ts
function previewTicketNotificationSound() {
  onPreviewTicketNotificationSound?.(
    ticketNotificationSound,
    Number(ticketNotificationVolume)
  );
}
```

Place a `type="button"` control next to the sound dropdown:

```tsx
<button
  aria-label={t("testTicketNotificationSound")}
  className="secondary-action"
  onClick={previewTicketNotificationSound}
  type="button"
>
  {t("test")}
</button>
```

- [ ] **Step 4: Add translation keys**

Modify `src/i18n.ts` with:

```ts
test: "Test",
testTicketNotificationSound: "Ticketton testen"
```

and English:

```ts
test: "Test",
testTicketNotificationSound: "Test ticket sound"
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `npm test -- SettingsForm`

Expected: PASS.

### Task 2: App Wiring

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `SettingsForm` prop `onPreviewTicketNotificationSound`.
- Produces: App-level callback that calls `playTicketNotificationSound({ enabled: true, volume, sound })`.

- [ ] **Step 1: Write or update the app test**

In the existing app sound behavior tests in `src/App.test.tsx`, trigger the settings preview button after selecting a sound and volume:

```tsx
fireEvent.change(await screen.findByLabelText("Ticketton"), {
  target: { value: "ring.mp3" }
});
fireEvent.change(screen.getByLabelText("Ticketton Lautstärke"), {
  target: { value: "0.6" }
});
fireEvent.click(screen.getByRole("button", { name: "Ticketton testen" }));
```

Assert that the audio mock receives the selected sound URL and volume.

- [ ] **Step 2: Run the focused app test to verify it fails**

Run: `npm test -- App`

Expected: FAIL because the app does not pass a preview callback yet.

- [ ] **Step 3: Wire the callback in `src/App.tsx`**

Add this prop to `SettingsForm`:

```tsx
onPreviewTicketNotificationSound={(sound, volume) =>
  playTicketNotificationSound({ enabled: true, volume, sound })
}
```

- [ ] **Step 4: Run the focused app test to verify it passes**

Run: `npm test -- App`

Expected: PASS.

### Task 3: Full Verification and Commit

**Files:**
- Modify: files changed in Tasks 1 and 2
- Modify: `docs/superpowers/plans/2026-08-11-notification-sound-preview.md`

**Interfaces:**
- Produces: Verified implementation committed to the current branch.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add docs/superpowers/plans/2026-08-11-notification-sound-preview.md src/components/SettingsForm.tsx src/components/SettingsForm.test.tsx src/App.tsx src/App.test.tsx src/i18n.ts
git commit -m "feat: preview notification sounds"
```
