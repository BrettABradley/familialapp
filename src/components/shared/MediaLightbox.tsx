import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/shared/SmartImage";
import { ZoomableImage } from "@/components/shared/ZoomableImage";
import { getMediaType } from "@/lib/mediaUtils";
import { presetImage } from "@/lib/imageUrl";
import { useSwipeDownClose } from "@/hooks/useSwipeDownClose";

interface MediaLightboxProps {
  items: string[];
  startIndex: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onDownload: (url: string) => void;
}

/**
 * Embla-powered lightbox with true finger-following swipe between media.
 * Shared by Feed posts and the Messages chat views so the in-app image
 * viewing experience is identical across surfaces.
 */
export const MediaLightbox = ({
  items,
  startIndex,
  onIndexChange,
  onClose,
  onDownload,
}: MediaLightboxProps) => {
  const zoomedRef = useRef(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "center",
    duration: 28,
    dragThreshold: 6,
    containScroll: "trimSnaps",
    startIndex,
    watchDrag: () => !zoomedRef.current,
  });
  const [selected, setSelected] = useState(startIndex);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const i = emblaApi.selectedScrollSnap();
      setSelected(i);
      onIndexChange(i);
      zoomedRef.current = false;
    };
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onIndexChange]);

  useEffect(() => {
    [selected - 1, selected + 1].forEach((i) => {
      const u = items[i];
      if (u && getMediaType(u) === "image") {
        const img = new Image();
        img.src = presetImage(u, "full");
      }
    });
  }, [selected, items]);

  const currentUrl = items[selected];
  const isImage = currentUrl && getMediaType(currentUrl) === "image";
  const swipeDown = useSwipeDownClose(onClose);

  return (
    <>
      <div className="pointer-events-auto absolute top-0 left-0 right-0 z-50 flex items-center justify-end gap-2 pl-[max(env(safe-area-inset-left,0px),1rem)] pr-[max(env(safe-area-inset-right,0px),1rem)] pt-[max(env(safe-area-inset-top,0px),3.25rem)] sm:pt-3">
        {isImage && (
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 backdrop-blur-sm text-white hover:text-white hover:bg-black/60"
            onClick={() => onDownload(currentUrl)}
            aria-label="Download"
          >
            <Download className="h-5 w-5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 backdrop-blur-sm text-white hover:text-white hover:bg-black/60"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="w-screen sm:w-[90vw] h-[100dvh] sm:h-[90vh] overflow-hidden" ref={emblaRef} {...swipeDown}>
        <div className="flex h-full touch-pan-y will-change-transform">
          {items.map((url, i) => {
            const type = getMediaType(url);
            const isCurrent = i === selected;
            return (
              <div key={i} className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center px-2">
                {type === "video" ? (
                  <video
                    controls
                    autoPlay={isCurrent}
                    playsInline
                    className="max-h-full max-w-full object-contain select-none"
                  >
                    <source src={url} type="video/mp4" />
                    <source src={url} type="video/quicktime" />
                    <source src={url} />
                  </video>
                ) : type === "audio" ? (
                  <div className="w-full max-w-md px-6">
                    <audio
                      controls
                      autoPlay={isCurrent}
                      preload="metadata"
                      className="w-full"
                    >
                      <source src={url} />
                    </audio>
                  </div>
                ) : (
                  <ZoomableImage
                    className="w-full h-full flex items-center justify-center"
                    onScaleChange={(s) => { if (isCurrent) zoomedRef.current = s > 1.05; }}
                  >
                    <SmartImage
                      src={url}
                      preset="full"
                      priority={Math.abs(i - selected) <= 1}
                      alt={`Media ${i + 1}`}
                      className="max-h-full max-w-full object-contain select-none bg-transparent"
                    />
                  </ZoomableImage>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {items.length > 1 && (
        <>
          {selected > 0 && (
            <button
              className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
              onClick={() => emblaApi?.scrollPrev()}
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {selected < items.length - 1 && (
            <button
              className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
              onClick={() => emblaApi?.scrollNext()}
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-30 bg-black/50 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full"
            style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 1rem)" }}
          >
            {selected + 1} / {items.length}
          </div>
        </>
      )}
    </>
  );
};
