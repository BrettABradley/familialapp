import { useEffect, useRef, useState } from "react";
import { Play, Video as VideoIcon } from "lucide-react";

// ---- Persistent thumbnail cache --------------------------------------------
// In-memory (instant) + sessionStorage (survives client-side nav) so jumping
// between Feed → Albums → Profile doesn't re-download every video just to
// repaint the same frame.
const memCache = new Map<string, string>();
const STORAGE_PREFIX = "vthumb:";

const readPersisted = (src: string): string | null => {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + src);
  } catch {
    return null;
  }
};
const writePersisted = (src: string, dataUrl: string) => {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + src, dataUrl);
  } catch {
    // Quota — silently drop oldest by clearing if needed.
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
      }
      // Drop oldest ~10
      keys.slice(0, 10).forEach((k) => sessionStorage.removeItem(k));
      sessionStorage.setItem(STORAGE_PREFIX + src, dataUrl);
    } catch {
      /* ignore */
    }
  }
};

// ---- Global concurrency limiter --------------------------------------------
// iOS WKWebView chokes when several <video> elements buffer simultaneously.
// Limit to 2 captures at a time; everything else waits its turn.
const MAX_CONCURRENT = 2;
let active = 0;
const queue: Array<() => void> = [];
const acquire = (): Promise<() => void> =>
  new Promise((resolve) => {
    const release = () => {
      active--;
      const next = queue.shift();
      if (next) next();
    };
    const run = () => {
      active++;
      resolve(release);
    };
    if (active < MAX_CONCURRENT) run();
    else queue.push(run);
  });

interface VideoThumbnailProps {
  src: string;
  className?: string;
  cacheKey?: string;
}

/**
 * Renders a real still-frame thumbnail for a video URL.
 * Works around iOS WKWebView refusing to paint <video> previews as grey boxes.
 *
 * Performance:
 *  - Skips fetch entirely until the element is near-viewport (IntersectionObserver)
 *  - Limits to 2 concurrent video captures globally
 *  - Persists the generated JPEG in sessionStorage so navigation reuses it
 */
export const VideoThumbnail = ({ src, className = "", cacheKey = src }: VideoThumbnailProps) => {
  const initial = memCache.get(cacheKey) ?? readPersisted(cacheKey) ?? null;
  const [poster, setPoster] = useState<string | null>(initial);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(!!initial);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Defer any work until the thumbnail is actually near the viewport.
  useEffect(() => {
    if (poster || failed || inView) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [poster, failed, inView]);

  useEffect(() => {
    if (poster || failed || !inView) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let release: (() => void) | null = null;

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
        // Use dataURL so it can be persisted in sessionStorage across nav.
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        if (cancelled) return;
        memCache.set(cacheKey, dataUrl);
        writePersisted(cacheKey, dataUrl);
        setPoster(dataUrl);
        // Free the underlying <video> immediately so iOS stops buffering.
        try {
          video.removeAttribute("src");
          video.load();
        } catch {
          /* ignore */
        }
      } catch {
        setFailed(true);
      } finally {
        if (release) release();
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
    const onError = () => {
      setFailed(true);
      if (release) release();
    };

    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    // Acquire a slot, then kick off the load.
    acquire().then((rel) => {
      if (cancelled) {
        rel();
        return;
      }
      release = rel;
      // Setting src here (vs. as a JSX attribute) ensures iOS doesn't begin
      // downloading until we're inside the concurrency window.
      try {
        video.src = src;
        video.load();
      } catch {
        setFailed(true);
        rel();
      }
    });

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      if (release) release();
    };
  }, [src, cacheKey, poster, failed, inView]);

  return (
    <div ref={containerRef} className={`relative w-full h-full bg-muted ${className}`}>
      {poster ? (
        <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
      ) : !failed && inView ? (
        // Hidden video used only to grab a frame. src is attached imperatively
        // once a concurrency slot is acquired (see effect above).
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
          muted
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          webkit-playsinline="true"
          disableRemotePlayback
          tabIndex={-1}
        />
      ) : failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <VideoIcon className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : null}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <Play className="h-8 w-8 text-white fill-white" />
      </div>
    </div>
  );
};

export default VideoThumbnail;
