import { resolveTicketNotificationSoundUrl } from "./soundOptions";

type TicketSoundOptions = {
  enabled: boolean;
  volume: number;
  sound?: string;
};

export function playTicketNotificationSound({ enabled, volume, sound }: TicketSoundOptions) {
  if (!enabled) {
    return;
  }

  try {
    const audio = new Audio(resolveTicketNotificationSoundUrl(sound));
    audio.volume = Math.max(0, Math.min(volume, 1));
    void audio.play();
  } catch {
    // Audio playback must not break ticket refresh.
  }
}
