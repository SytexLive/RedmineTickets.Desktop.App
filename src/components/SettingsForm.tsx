import { FormEvent, useState } from "react";
import type { MonitorInfo, RedmineSettings } from "../api/redmine";
import { createTranslator, type Language } from "../i18n";
import {
  DEFAULT_TICKET_NOTIFICATION_SOUND,
  TICKET_NOTIFICATION_SOUNDS
} from "../notifications/soundOptions";

type SettingsFormProps = {
  initialSettings: RedmineSettings | null;
  monitors: MonitorInfo[];
  saving: boolean;
  onSave: (settings: RedmineSettings) => void;
  onPreviewTicketNotificationSound?: (sound: string, volume: number) => void;
};

export function SettingsForm({
  initialSettings,
  monitors,
  saving,
  onSave,
  onPreviewTicketNotificationSound
}: SettingsFormProps) {
  const [baseUrl, setBaseUrl] = useState(initialSettings?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(initialSettings?.apiKey ?? "");
  const [monitorIndex, setMonitorIndex] = useState(
    String(initialSettings?.monitorIndex ?? 0)
  );
  const [dockSide, setDockSide] = useState<"left" | "right">(
    initialSettings?.dockSide ?? "right"
  );
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(
    String(initialSettings?.refreshIntervalSeconds ?? 60)
  );
  const [language, setLanguage] = useState<Language>(initialSettings?.language ?? "de");
  const [ticketNotificationsEnabled, setTicketNotificationsEnabled] = useState(
    initialSettings?.ticketNotificationsEnabled ?? true
  );
  const [ticketNotificationVolume, setTicketNotificationVolume] = useState(
    String(initialSettings?.ticketNotificationVolume ?? 0.35)
  );
  const [ticketNotificationSound, setTicketNotificationSound] = useState(
    initialSettings?.ticketNotificationSound ?? DEFAULT_TICKET_NOTIFICATION_SOUND
  );
  const t = createTranslator(language);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      monitorIndex: Number(monitorIndex),
      dockSide,
      refreshIntervalSeconds: Number(refreshIntervalSeconds),
      language,
      ticketNotificationsEnabled,
      ticketNotificationVolume: Number(ticketNotificationVolume),
      ticketNotificationSound
    });
  }

  function previewTicketNotificationSound() {
    onPreviewTicketNotificationSound?.(
      ticketNotificationSound,
      Number(ticketNotificationVolume)
    );
  }

  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        <span>{t("redmineUrl")}</span>
        <input
          autoComplete="url"
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://redmine.example.com"
          type="url"
          value={baseUrl}
        />
      </label>
      <label>
        <span>{t("apiKey")}</span>
        <input
          autoComplete="off"
          onChange={(event) => setApiKey(event.target.value)}
          type="password"
          value={apiKey}
        />
      </label>
      <label>
        <span>{t("monitor")}</span>
        <select
          aria-label={t("monitor")}
          onChange={(event) => setMonitorIndex(event.target.value)}
          value={monitorIndex}
        >
          {monitors.length > 0 ? (
            monitors.map((monitor) => (
              <option key={monitor.index} value={monitor.index}>
                {monitor.label}
              </option>
            ))
          ) : (
            <option value="0">Monitor 1</option>
          )}
        </select>
      </label>
      <label>
        <span>{t("side")}</span>
        <select
          aria-label={t("side")}
          onChange={(event) => setDockSide(event.target.value as "left" | "right")}
          value={dockSide}
        >
          <option value="right">{t("sideRight")}</option>
          <option value="left">{t("sideLeft")}</option>
        </select>
      </label>
      <label>
        <span>{t("refreshInterval")}</span>
        <input
          aria-label={t("refreshInterval")}
          min="15"
          onChange={(event) => setRefreshIntervalSeconds(event.target.value)}
          step="5"
          type="number"
          value={refreshIntervalSeconds}
        />
      </label>
      <label>
        <span>{t("language")}</span>
        <select
          aria-label={t("language")}
          onChange={(event) => setLanguage(event.target.value as Language)}
          value={language}
        >
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="settings-checkbox">
        <input
          checked={ticketNotificationsEnabled}
          onChange={(event) => setTicketNotificationsEnabled(event.target.checked)}
          type="checkbox"
        />
        <span>{t("ticketNotifications")}</span>
      </label>
      <label>
        <span>{t("ticketNotificationSound")}</span>
        <div className="settings-inline-control">
          <select
            aria-label={t("ticketNotificationSound")}
            onChange={(event) => setTicketNotificationSound(event.target.value)}
            value={ticketNotificationSound}
          >
            {TICKET_NOTIFICATION_SOUNDS.map((sound) => (
              <option key={sound.filename} value={sound.filename}>
                {sound.label}
              </option>
            ))}
          </select>
          <button
            aria-label={t("testTicketNotificationSound")}
            className="secondary-action"
            onClick={previewTicketNotificationSound}
            type="button"
          >
            {t("test")}
          </button>
        </div>
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
      <button className="primary-action" disabled={saving} type="submit">
        {saving ? t("saving") : t("save")}
      </button>
    </form>
  );
}
