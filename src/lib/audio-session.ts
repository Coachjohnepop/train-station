/**
 * Safari / iOS audio session.
 *
 * HTMLVideo and AudioContext default to `playback`, which **interrupts**
 * Podcasts, Music, and other apps when we come to the foreground — even
 * for a muted keep-awake loop or a silent rest-horn prime.
 *
 * Stay on `ambient` unless we are intentionally playing our own sound.
 * `transient` ducks other audio for a short horn / whistle, then they can
 * keep listening. `playback` is only Theme Song, intros, How it Works.
 *
 * Safari 16.4+ (`navigator.audioSession`). Older iOS is a no-op.
 * https://webkit.org/blog/14080/audio-session-web-api/
 */

export type AudioSessionType =
  | "auto"
  | "playback"
  | "transient"
  | "transient-solo"
  | "ambient"
  | "play-and-record";

type AudioSessionLike = { type: string };

function getAudioSession(): AudioSessionLike | null {
  if (typeof navigator === "undefined") return null;
  try {
    const session = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
    return session ?? null;
  } catch {
    return null;
  }
}

export function currentAudioSessionType(): string | null {
  try {
    return getAudioSession()?.type ?? null;
  } catch {
    return null;
  }
}

export function setAudioSession(type: AudioSessionType): boolean {
  const session = getAudioSession();
  if (!session) return false;
  try {
    if (session.type !== type) session.type = type;
    return true;
  } catch {
    return false;
  }
}

/** Mix with Podcasts / Music. Default for keep-awake, silent primes, tab return. */
export function preferAmbientAudioSession(): boolean {
  return setAudioSession("ambient");
}

/** Exclusive music / spoken video the user started. */
export function preferPlaybackAudioSession(): boolean {
  return setAudioSession("playback");
}

/** Short horn / whistle — duck other audio, do not kill it. */
export function preferTransientAudioSession(): boolean {
  return setAudioSession("transient");
}
