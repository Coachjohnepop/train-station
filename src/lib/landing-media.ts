/** Swap via Vercel env when Jeremy's real welcome / chastise clips are ready. */
export const WELCOME_VIDEO_YOUTUBE_ID =
  process.env.NEXT_PUBLIC_WELCOME_VIDEO_YT || "3JZ_9j6z8fQ";

export const FREE_CHASTISE_VIDEO_YOUTUBE_ID =
  process.env.NEXT_PUBLIC_FREE_CHASTISE_VIDEO_YT || "dQw4w9WgXcQ";

export function youtubeEmbedUrl(videoId: string, autoplay = false) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (autoplay) params.set("autoplay", "1");
  return `https://www.youtube.com/embed/${videoId}?${params}`;
}