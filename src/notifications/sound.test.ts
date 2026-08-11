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
});
