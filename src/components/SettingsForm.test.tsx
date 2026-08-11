import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./SettingsForm";

describe("SettingsForm", () => {
  it("saves monitor, dock side, and refresh interval settings", () => {
    const onSave = vi.fn();

    render(
      <SettingsForm
        initialSettings={{
          baseUrl: "https://redmine.example.com",
          apiKey: "secret",
          monitorIndex: 1,
          dockSide: "left",
          refreshIntervalSeconds: 120,
          language: "de",
          ticketNotificationsEnabled: true,
          ticketNotificationVolume: 0.35,
          ticketNotificationSound: "default.mp3"
        }}
        monitors={[
          { index: 0, label: "Monitor 1", isPrimary: false },
          { index: 1, label: "Monitor 2", isPrimary: true }
        ]}
        saving={false}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText("Monitor"), {
      target: { value: "0" }
    });
    fireEvent.change(screen.getByLabelText("Seite"), {
      target: { value: "right" }
    });
    fireEvent.change(screen.getByLabelText("Aktualisierungsintervall"), {
      target: { value: "45" }
    });
    fireEvent.click(screen.getByLabelText("Ticketton aktiv"));
    fireEvent.change(screen.getByLabelText("Ticketton Lautstärke"), {
      target: { value: "0.6" }
    });
    fireEvent.change(screen.getByLabelText("Ticketton"), {
      target: { value: "ring.mp3" }
    });
    fireEvent.change(screen.getByLabelText("Sprache"), {
      target: { value: "en" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      baseUrl: "https://redmine.example.com",
      apiKey: "secret",
      monitorIndex: 0,
      dockSide: "right",
      refreshIntervalSeconds: 45,
      language: "en",
      ticketNotificationsEnabled: false,
      ticketNotificationVolume: 0.6,
      ticketNotificationSound: "ring.mp3"
    });
  });
});
