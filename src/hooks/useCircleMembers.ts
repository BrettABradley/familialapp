import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCircleContext } from "@/contexts/CircleContext";
import { supabase } from "@/integrations/supabase/client";

export interface CircleMember {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * Fetches all members (including owner) of the currently selected circle,
 * excluding the current user. Useful for @mention autocomplete.
 */
export const useCircleMembers = () => {
  const { user } = useAuth();
  const { circles, selectedCircle } = useCircleContext();
  const [members, setMembers] = useState<CircleMember[]>([]);

  useEffect(() => {
    if (!user || !selectedCircle) {
      setMembers([]);
      return;
    }

    const fetchMembers = async () => {
      const { data: memberships } = await supabase
        .from("circle_memberships")
        .select("user_id")
        .eq("circle_id", selectedCircle);

      const circle = circles.find((c) => c.id === selectedCircle);
      const userIds = new Set<string>();
      memberships?.forEach((m) => userIds.add(m.user_id));
      if (circle) userIds.add(circle.owner_id);
      // Include self so mentions work for all members
      // but we'll filter self out in notification creation

      if (userIds.size === 0) {
        setMembers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", Array.from(userIds));

      setMembers(profiles || []);
    };

    fetchMembers();
  }, [user, selectedCircle, circles]);

  return members;
};
