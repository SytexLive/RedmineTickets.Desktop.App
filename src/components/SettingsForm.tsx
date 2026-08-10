import { FormEvent, useState } from "react";
import type { MonitorInfo, RedmineSettings } from "../api/redmine";

type SettingsFormProps = {
  initialSettings: RedmineSettings | null;
  monitors: MonitorInfo[];
  saving: boolean;
  onSave: (settings: RedmineSettings) => void;
};

export function SettingsForm({
  initialSettings,
  monitors,
  saving,
  onSave
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      monitorIndex: Number(monitorIndex),
      dockSide,
      refreshIntervalSeconds: Number(refreshIntervalSeconds)
    });
  }

  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        <span>Redmine URL</span>
        <input
          autoComplete="url"
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://redmine.example.com"
          type="url"
          value={baseUrl}
        />
      </label>
      <label>
        <span>API key</span>
        <input
          autoComplete="off"
          onChange={(event) => setApiKey(event.target.value)}
          type="password"
          value={apiKey}
        />
      </label>
      <label>
        <span>Monitor</span>
        <select
          aria-label="Monitor"
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
        <span>Side</span>
        <select
          aria-label="Side"
          onChange={(event) => setDockSide(event.target.value as "left" | "right")}
          value={dockSide}
        >
          <option value="right">Right</option>
          <option value="left">Left</option>
        </select>
      </label>
      <label>
        <span>Refresh interval</span>
        <input
          aria-label="Refresh interval"
          min="15"
          onChange={(event) => setRefreshIntervalSeconds(event.target.value)}
          step="5"
          type="number"
          value={refreshIntervalSeconds}
        />
      </label>
      <button className="primary-action" disabled={saving} type="submit">
        {saving ? "Saving" : "Save"}
      </button>
    </form>
  );
}
