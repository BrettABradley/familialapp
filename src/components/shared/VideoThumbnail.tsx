import { useEffect, useRef, useState } from "react";
import { Play, Video as VideoIcon } from "lucide-react";

// Module-level cache so we don't regenerate thumbs across re-renders / scrolls
const thumbCache = new Map<string, string>();

interface VideoThumbnailProps {
  src: string;
  className?: string;
}

/**
 * Renders a real still-frame thumbnail for a video URL.
 * Works around iOS WKWebView refusing to paint <video> previews as grey boxes.
 * Briefly mounts a hidden <video>, seeks to 0.1s, draws to canvas, then swaps to <img>.
 */
export const VideoThumbnail = ({ src, className = "" }: VideoThumbnailProps) => {
  const [poster, setPoster] = useState<string | null>(() => thumbCache.get(src) ?? null);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (poster || failed) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const capture = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) {
          setFailed(true);
          return;
        }
        // Cap size for memory — keep aspect ratio
        const max = 480;
        const scale = Math.min(1, max / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setFailed(true);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (cancelled) return;
            if (!blob) {
              setFailed(true);
              return;
            }
            const url = URL.createObjectURL(blob);
            thumbCache.set(src, url);
            setPoster(url);
          },
          "image/jpeg",
          0.75
        );
      } catch {
        setFailed(true);
      }
    };

    const onLoadedData = () => {
      try {
        video.currentTime = 0.1;
      } catch {
        capture();
      }
    };
    const onSeeked = () => capture();
    const onError = () => setFailed(true);

    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
  }, [src, poster, failed]);

  return (
    <div className={`relative w-full h-full bg-muted ${className}`}>
      {poster ? (
        <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : !failed ? (
        // Hidden video used only to grab a frame
        <video
          ref={videoRef}
          src={src}
          className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
          muted
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          webkit-playsinline="true"
          disableRemotePlayback
          tabIndex={-1}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <VideoIcon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <Play className="h-8 w-8 text-white fill-white" />
      </div>
    </div>
  );
};

export default VideoThumbnail;
