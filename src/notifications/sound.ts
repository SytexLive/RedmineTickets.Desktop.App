type TicketSoundOptions = {
  enabled: boolean;
  volume: number;
};

export function playTicketNotificationSound({ enabled, volume }: TicketSoundOptions) {
  if (!enabled) {
    return;
  }

  try {
    const AudioContextCtor = window.AudioContext;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 740;
    gain.gain.value = Math.max(0, Math.min(volume, 1));

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.18);
    window.setTimeout(() => {
      void context.close();
    }, 240);
  } catch {
    // Audio playback must not break ticket refresh.
  }
}
