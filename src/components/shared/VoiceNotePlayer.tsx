import { cn } from "@/lib/utils";

interface VoiceNotePlayerProps {
  /** Already-resolved (signed or public) audio URL. */
  src: string;
  className?: string;
}

function mimeForUrl(url: string): string {
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  const ext = clean.split(".").pop();
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "webm":
      return "audio/webm";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "aac":
      return "audio/aac";
    case "m4a":
    case "mp4":
    default:
      return "audio/mp4";
  }
}

/**
 * Voice-note <audio> player tuned for iOS WKWebView.
 *
 * Why a wrapper:
 *  - `<source>` is parsed once at mount; if the signed URL resolves *after*
 *    first render, the player sits stuck on "loading". We force a remount
 *    via `key={src}`.
 *  - iOS won't pick a codec from a signed Supabase URL because the JWT
 *    `?token=...` hides the `.m4a` extension from its sniffer. We pass an
 *    explicit `type` derived from the path before the query string.
 *  - `playsInline` keeps playback inside the page on iOS Safari.
 */
export const VoiceNotePlayer = ({ src, className }: VoiceNotePlayerProps) => {
  if (!src) {
    return (
      <div
        className={cn(
          "h-10 w-full max-w-[280px] rounded-md bg-secondary animate-pulse",
          className,
        )}
      />
    );
  }

  return (
    <audio
      key={src}
      controls
      preload="metadata"
      playsInline
      className={cn("w-full max-w-[280px]", className)}
    >
      <source src={src} type={mimeForUrl(src)} />
    </audio>
  );
};
