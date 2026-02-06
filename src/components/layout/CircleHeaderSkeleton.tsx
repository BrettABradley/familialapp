import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

export function CircleHeaderSkeleton() {
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo and circle selector skeleton */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-4 w-2" />
          <Skeleton className="h-8 w-28" />
        </div>

        {/* Navigation skeleton */}
        {isMobile ? (
          <Skeleton className="h-10 w-10 rounded-lg" />
        ) : (
          <div className="hidden md:flex items-center gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-lg" />
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
