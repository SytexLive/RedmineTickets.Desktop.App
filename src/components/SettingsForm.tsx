import { FormEvent, useState } from "react";
import type { RedmineSettings } from "../api/redmine";

type SettingsFormProps = {
  initialSettings: RedmineSettings | null;
  saving: boolean;
  onSave: (settings: RedmineSettings) => void;
};

export function SettingsForm({
  initialSettings,
  saving,
  onSave
}: SettingsFormProps) {
  const [baseUrl, setBaseUrl] = useState(initialSettings?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(initialSettings?.apiKey ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
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
      <button className="primary-action" disabled={saving} type="submit">
        {saving ? "Saving" : "Save"}
      </button>
    </form>
  );
}
