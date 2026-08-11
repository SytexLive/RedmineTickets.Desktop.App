import { describe, expect, it, vi } from "vitest";
import { playTicketNotificationSound } from "./sound";

function installAudioMock() {
  const playMock = vi.fn(() => Promise.resolve());
  const AudioMock = vi.fn(function AudioMock(this: HTMLAudioElement, src: string) {
    this.src = src;
    this.volume = 0;
    this.play = playMock as HTMLAudioElement["play"];
  });
  vi.stubGlobal("Audio", AudioMock);

  return { AudioMock, playMock };
}

describe("playTicketNotificationSound", () => {
  it("does nothing when disabled", () => {
    const AudioMock = vi.fn();
    vi.stubGlobal("Audio", AudioMock);

    playTicketNotificationSound({ enabled: false, volume: 0.5 });

    expect(AudioMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("uses the configured volume and selected sound when enabled", () => {
    const { AudioMock, playMock } = installAudioMock();

    playTicketNotificationSound({
      enabled: true,
      volume: 0.25,
      sound: "ring.mp3"
    });

    expect(AudioMock).toHaveBeenCalledWith(expect.stringContaining("ring.mp3"));
    expect(AudioMock.mock.instances[0].volume).toBe(0.25);
    expect(playMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("falls back to the default sound for an unknown sound", () => {
    const { AudioMock } = installAudioMock();

    playTicketNotificationSound({
      enabled: true,
      volume: 0.25,
      sound: "missing.mp3"
    });

    expect(AudioMock).toHaveBeenCalledWith(expect.stringContaining("default.mp3"));
    vi.unstubAllGlobals();
  });

  it.each([
    { volume: -0.25, expected: 0 },
    { volume: 1.25, expected: 1 }
  ])("clamps volume $volume to $expected", ({ volume, expected }) => {
    const { AudioMock } = installAudioMock();

    playTicketNotificationSound({ enabled: true, volume });

    expect(AudioMock.mock.instances[0].volume).toBe(expected);
    vi.unstubAllGlobals();
  });

  it("does not throw when audio initialization fails", () => {
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock() {
        throw new Error("Audio is unavailable");
      })
    );

    expect(() =>
      playTicketNotificationSound({ enabled: true, volume: 0.5 })
    ).not.toThrow();
    vi.unstubAllGlobals();
  });
});
