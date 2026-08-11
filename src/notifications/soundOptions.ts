import alertSoundUrl from "../assets/sounds/alert.mp3";
import amongusSoundUrl from "../assets/sounds/amongus.mp3";
import defaultSoundUrl from "../assets/sounds/default.mp3";
import drageSoundUrl from "../assets/sounds/drage.mp3";
import pacmanSoundUrl from "../assets/sounds/pacman.mp3";
import phoningSoundUrl from "../assets/sounds/phoning.mp3";
import ringSoundUrl from "../assets/sounds/ring.mp3";
import swiggleSoundUrl from "../assets/sounds/swiggle.mp3";

export const DEFAULT_TICKET_NOTIFICATION_SOUND = "default.mp3";

export const TICKET_NOTIFICATION_SOUNDS = [
  { filename: "default.mp3", label: "Default", url: defaultSoundUrl },
  { filename: "alert.mp3", label: "Alert", url: alertSoundUrl },
  { filename: "amongus.mp3", label: "Amongus", url: amongusSoundUrl },
  { filename: "drage.mp3", label: "Drage", url: drageSoundUrl },
  { filename: "pacman.mp3", label: "Pacman", url: pacmanSoundUrl },
  { filename: "phoning.mp3", label: "Phoning", url: phoningSoundUrl },
  { filename: "ring.mp3", label: "Ring", url: ringSoundUrl },
  { filename: "swiggle.mp3", label: "Swiggle", url: swiggleSoundUrl }
] as const;

export type TicketNotificationSound =
  (typeof TICKET_NOTIFICATION_SOUNDS)[number]["filename"];

export function resolveTicketNotificationSoundUrl(filename?: string) {
  return (
    TICKET_NOTIFICATION_SOUNDS.find((sound) => sound.filename === filename)?.url ??
    TICKET_NOTIFICATION_SOUNDS.find(
      (sound) => sound.filename === DEFAULT_TICKET_NOTIFICATION_SOUND
    )?.url ??
    defaultSoundUrl
  );
}
