import { useEffect, useState } from "react";
import { Browser } from "@capacitor/browser";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";

const DISMISS_KEY = "update_dismissed_for_version";

export function UpdateAvailableDialog() {
  const info = useAppUpdateCheck();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!info?.updateAvailable) return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === info.storeVersion) return;
    setOpen(true);
  }, [info]);

  if (!info?.updateAvailable) return null;

  const handleLater = () => {
    localStorage.setItem(DISMISS_KEY, info.storeVersion);
    setOpen(false);
  };

  const handleUpdate = async () => {
    try {
      await Browser.open({ url: info.storeUrl });
    } catch {
      // ignore
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif">
            Update available
          </AlertDialogTitle>
          <AlertDialogDescription>
            A new version of Familial is available (v{info.storeVersion}).
            Update now for the latest features and fixes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLater}>Later</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpdate}>Update</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
