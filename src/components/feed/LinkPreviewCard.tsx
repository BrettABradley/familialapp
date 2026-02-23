import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";

interface LinkPreviewData {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  url?: string | null;
  domain?: string | null;
}

// Simple in-memory cache
const previewCache = new Map<string, LinkPreviewData | null>();

export const LinkPreviewCard = ({ url }: { url: string }) => {
  const [data, setData] = useState<LinkPreviewData | null>(previewCache.get(url) ?? null);
  const [loading, setLoading] = useState(!previewCache.has(url));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (previewCache.has(url)) {
      setData(previewCache.get(url)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: result, error: err } = await supabase.functions.invoke("fetch-link-preview", {
          body: { url },
        });
        if (cancelled) return;
        if (err || !result?.title) {
          previewCache.set(url, null);
          setError(true);
        } else {
          previewCache.set(url, result);
          setData(result);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (error || (!loading && !data?.title)) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-border overflow-hidden mb-4">
        <Skeleton className="w-full h-[180px]" />
        <div className="p-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <a
      href={data!.url || url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-border overflow-hidden mb-4 hover:bg-secondary/50 transition-colors"
    >
      {data!.image && (
        <div className="w-full h-[200px] bg-muted overflow-hidden">
          <img
            src={data!.image}
            alt={data!.title || ""}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="p-3">
        {data!.title && (
          <p className="font-medium text-foreground text-sm line-clamp-2">{data!.title}</p>
        )}
        {data!.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{data!.description}</p>
        )}
        {data!.domain && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <ExternalLink className="w-3 h-3" />
            <span>{data!.domain}</span>
          </div>
        )}
      </div>
    </a>
  );
};
