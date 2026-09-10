/** In-browser voice capture for How it Works overdubs (no phone-call processing). */

const MIME_PREF = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
];

const CLEAN_AUDIO: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
};

export function pickCoachVoiceMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_PREF.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export async function openCoachVoiceStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { ...CLEAN_AUDIO, sampleRate: 48000 },
      video: false,
    });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: CLEAN_AUDIO, video: false });
    } catch {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
  }
}

export function createCoachVoiceRecorder(stream: MediaStream): MediaRecorder {
  const mime = pickCoachVoiceMime();
  const opts: MediaRecorderOptions = { audioBitsPerSecond: 192_000 };
  if (mime) opts.mimeType = mime;
  try {
    return new MediaRecorder(stream, opts);
  } catch {
    return mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  }
}

export function coachVoiceFileExt(mimeType: string): "webm" | "m4a" | "ogg" {
  const t = (mimeType || "").toLowerCase();
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg")) return "ogg";
  return "m4a";
}
