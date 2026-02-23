import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useCircleContext } from "@/contexts/CircleContext";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

interface ReadOnlyBannerProps {
  circleId?: string;
}

const ReadOnlyBanner = ({ circleId }: ReadOnlyBannerProps) => {
  const { user } = useAuth();
  const { isCircleReadOnly, circles } = useCircleContext();

  const targetCircleId = circleId;
  if (!targetCircleId) return null;
  if (!isCircleReadOnly(targetCircleId)) return null;

  const circle = circles.find(c => c.id === targetCircleId);
  const isOwner = circle?.owner_id === user?.id;

  return (
    <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertDescription className="text-sm">
        This circle is read-only. {isOwner ? (
          <>
            You've exceeded your plan's circle limit.{" "}
            <Link to="/#pricing" className="underline font-medium text-primary hover:text-primary/80">
              Upgrade your plan
            </Link>{" "}
            to restore full access.
          </>
        ) : (
          "The owner needs to upgrade, transfer ownership, or delete this circle to restore full access."
        )}
      </AlertDescription>
    </Alert>
  );
};

export default ReadOnlyBanner;
