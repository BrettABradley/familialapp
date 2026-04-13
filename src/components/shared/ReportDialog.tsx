import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const REASONS = [
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "harassment", label: "Harassment or Bullying" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId?: string;
  commentId?: string;
  reportedUserId?: string;
}

export const ReportDialog = ({ open, onOpenChange, postId, commentId, reportedUserId }: ReportDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setSubmitting(true);

    const { data: insertedReport, error } = await supabase.from("content_reports" as any).insert({
      reporter_id: user.id,
      post_id: postId || null,
      comment_id: commentId || null,
      reported_user_id: reportedUserId || null,
      reason,
      details: details.trim() || null,
    }).select("id").single();

    if (error) {
      toast({ title: "Error", description: "Failed to submit report.", variant: "destructive" });
    } else {
      // Hide the reported content immediately
      if (postId) {
        await supabase.from("posts").update({ is_hidden: true } as any).eq("id", postId);
      }
      if (commentId) {
        await supabase.from("comments").update({ is_hidden: true } as any).eq("id", commentId);
      }

      toast({ title: "Report submitted", description: "Thank you. The content has been hidden pending review." });

      // Fire-and-forget: notify support via email
      supabase.functions.invoke("notify-content-report", {
        body: {
          reportId: (insertedReport as any)?.id,
          reason,
          details: details.trim() || null,
          postId: postId || null,
          commentId: commentId || null,
          reportedUserId: reportedUserId || null,
          reporterId: user.id,
        },
      }).catch(() => {});

      onOpenChange(false);
      setReason("");
      setDetails("");
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report Content</DialogTitle>
          <DialogDescription>
            Help us keep Familial safe. Select a reason for your report.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={setReason} className="space-y-3">
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-3">
              <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
              <Label htmlFor={`reason-${r.value}`} className="cursor-pointer">{r.label}</Label>
            </div>
          ))}
        </RadioGroup>

        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Additional details (optional)..."
          className="resize-none"
          rows={3}
          maxLength={1000}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!reason || submitting}>
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
