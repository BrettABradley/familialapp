import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useBlockedUsers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchBlocked = async () => {
      const { data } = await supabase
        .from("blocked_users" as any)
        .select("blocked_id")
        .eq("blocker_id", user.id);

      if (data) {
        setBlockedIds(new Set((data as any[]).map((d) => d.blocked_id)));
      }
      setLoaded(true);
    };

    fetchBlocked();
  }, [user]);

  const blockUser = useCallback(async (blockedId: string) => {
    if (!user) return;

    // Optimistic
    setBlockedIds((prev) => new Set(prev).add(blockedId));

    const { error } = await supabase.from("blocked_users" as any).insert({
      blocker_id: user.id,
      blocked_id: blockedId,
    });

    if (error) {
      setBlockedIds((prev) => {
        const next = new Set(prev);
        next.delete(blockedId);
        return next;
      });
      toast({ title: "Error", description: "Failed to block user.", variant: "destructive" });
      return;
    }

    // Also create a content report to notify the developer
    await supabase.from("content_reports" as any).insert({
      reporter_id: user.id,
      reported_user_id: blockedId,
      reason: "blocked_user",
      details: "User was blocked. Content from this user has been hidden from the reporter's feed.",
    });

    // Notify via edge function (fire and forget)
    supabase.functions.invoke("handle-block", {
      body: { blocked_id: blockedId },
    }).catch(() => {});

    toast({ title: "User blocked", description: "You won't see their content anymore." });
  }, [user, toast]);

  const unblockUser = useCallback(async (blockedId: string) => {
    if (!user) return;

    setBlockedIds((prev) => {
      const next = new Set(prev);
      next.delete(blockedId);
      return next;
    });

    const { error } = await supabase
      .from("blocked_users" as any)
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", blockedId);

    if (error) {
      setBlockedIds((prev) => new Set(prev).add(blockedId));
      toast({ title: "Error", description: "Failed to unblock user.", variant: "destructive" });
      return;
    }

    toast({ title: "User unblocked" });
  }, [user, toast]);

  const isBlocked = useCallback((userId: string) => blockedIds.has(userId), [blockedIds]);

  return { blockedIds, loaded, blockUser, unblockUser, isBlocked };
};
