import { describe, expect, it, vi } from "vitest";
import { playTicketNotificationSound } from "./sound";

describe("playTicketNotificationSound", () => {
  it("does nothing when disabled", () => {
    const AudioContextMock = vi.fn();
    vi.stubGlobal("AudioContext", AudioContextMock);

    playTicketNotificationSound({ enabled: false, volume: 0.5 });

    expect(AudioContextMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("uses the configured volume when enabled", () => {
    const gain = { gain: { value: 0 }, connect: vi.fn() };
    const oscillator = {
      frequency: { value: 0 },
      type: "",
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
    const context = {
      currentTime: 10,
      destination: {},
      createGain: vi.fn(() => gain),
      createOscillator: vi.fn(() => oscillator),
      close: vi.fn()
    };
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function AudioContextMock() {
        return context;
      })
    );

    playTicketNotificationSound({ enabled: true, volume: 0.25 });

    expect(gain.gain.value).toBe(0.25);
    expect(oscillator.start).toHaveBeenCalledWith(10);
    expect(oscillator.stop).toHaveBeenCalledWith(10.18);
    vi.unstubAllGlobals();
  });

  it.each([
    { volume: -0.25, expected: 0 },
    { volume: 1.25, expected: 1 }
  ])("clamps volume $volume to $expected", ({ volume, expected }) => {
    const gain = { gain: { value: 0 }, connect: vi.fn() };
    const oscillator = {
      frequency: { value: 0 },
      type: "",
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function AudioContextMock() {
        return {
          currentTime: 0,
          destination: {},
          createGain: vi.fn(() => gain),
          createOscillator: vi.fn(() => oscillator),
          close: vi.fn()
        };
      })
    );

    playTicketNotificationSound({ enabled: true, volume });

    expect(gain.gain.value).toBe(expected);
    vi.unstubAllGlobals();
  });

  it("does not throw when audio initialization fails", () => {
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function AudioContextMock() {
        throw new Error("Audio is unavailable");
      })
    );

    expect(() =>
      playTicketNotificationSound({ enabled: true, volume: 0.5 })
    ).not.toThrow();
    vi.unstubAllGlobals();
  });
});
