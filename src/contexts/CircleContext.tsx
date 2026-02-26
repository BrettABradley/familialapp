import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Circle {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  invite_code: string;
  transfer_block: boolean;
  avatar_url: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
}

interface UserPlan {
  plan: string;
  max_circles: number;
  max_members_per_circle: number;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  pending_plan: string | null;
}

interface CircleContextType {
  circles: Circle[];
  selectedCircle: string;
  setSelectedCircle: (circleId: string) => void;
  profile: Profile | null;
  userPlan: UserPlan | null;
  isLoading: boolean;
  refetchCircles: () => Promise<void>;
  refetchProfile: () => Promise<void>;
  isCircleReadOnly: (circleId: string) => boolean;
  isCircleAdmin: (circleId: string) => boolean;
}

const CircleContext = createContext<CircleContextType | undefined>(undefined);

export const CircleProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [adminCircleIds, setAdminCircleIds] = useState<Set<string>>(new Set());
  const [selectedCircle, setSelectedCircleState] = useState<string>(() => {
    return localStorage.getItem("selectedCircle") || "";
  });

  const setSelectedCircle = (circleId: string) => {
    setSelectedCircleState(circleId);
    if (circleId) {
      localStorage.setItem("selectedCircle", circleId);
    } else {
      localStorage.removeItem("selectedCircle");
    }
  };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCircles = async () => {
    if (!user) {
      setCircles([]);
      setSelectedCircle("");
      return;
    }


    const { data: ownedCircles } = await supabase
      .from("circles")
      .select("id, name, description, owner_id, created_at, invite_code, transfer_block, avatar_url")
      .eq("owner_id", user.id);

    const { data: memberCircles } = await supabase
      .from("circle_memberships")
      .select("circle_id, circles(id, name, description, owner_id, created_at, invite_code, transfer_block, avatar_url)")
      .eq("user_id", user.id);

    const allCircles: Circle[] = [];

    if (ownedCircles) {
      allCircles.push(...ownedCircles);
    }

    if (memberCircles) {
      memberCircles.forEach((m) => {
        if (m.circles && !allCircles.find((c) => c.id === (m.circles as Circle).id)) {
          allCircles.push(m.circles as Circle);
        }
      });
    }

    setCircles(allCircles);
    
    // Only set selectedCircle if not already set or if current selection is invalid
    if (allCircles.length > 0) {
      if (!selectedCircle || !allCircles.find((c) => c.id === selectedCircle)) {
        setSelectedCircle(allCircles[0].id);
      }
    } else {
      setSelectedCircle("");
    }
  };

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
    }
  };

  const fetchUserPlan = async () => {
    if (!user) {
      setUserPlan(null);
      return;
    }

    const { data, error } = await supabase
      .from("user_plans")
      .select("plan, max_circles, max_members_per_circle, cancel_at_period_end, current_period_end, pending_plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      setUserPlan(data as UserPlan);
    }
  };

  const fetchAdminRoles = async () => {
    if (!user) {
      setAdminCircleIds(new Set());
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("circle_id")
      .eq("user_id", user.id)
      .eq("role", "admin");

    const ids = new Set<string>(data?.map(r => r.circle_id) || []);
    setAdminCircleIds(ids);
  };

  const isCircleAdmin = (circleId: string): boolean => {
    if (!user || !circleId) return false;
    const circle = circles.find(c => c.id === circleId);
    if (circle && circle.owner_id === user.id) return true;
    return adminCircleIds.has(circleId);
  };

  // Determines if a circle is read-only due to plan overflow.
  // Owned circles sorted by created_at; oldest N (up to max_circles) are active, rest are overflow.
  const isCircleReadOnly = (circleId: string): boolean => {
    // Transfer block makes a circle read-only regardless of plan
    const circle = circles.find(c => c.id === circleId);
    if (circle && (circle as any).transfer_block) return true;

    if (!userPlan || !user) return false;

    // Get circles owned by this user, sorted by creation date (oldest first)
    const ownedCircles = circles
      .filter(c => c.owner_id === user.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (ownedCircles.length <= userPlan.max_circles) return false;

    // The circle must be owned by the user to be "overflow read-only"
    const ownedCircle = ownedCircles.find(c => c.id === circleId);
    if (!ownedCircle) return false;

    const activeIds = new Set(ownedCircles.slice(0, userPlan.max_circles).map(c => c.id));
    return !activeIds.has(circleId);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      await Promise.all([fetchCircles(), fetchProfile(), fetchUserPlan(), fetchAdminRoles()]);
      setIsLoading(false);

      // Safety net: sync subscription status with Stripe in the background
      try {
        const { data } = await supabase.functions.invoke("check-subscription");
        if (data?.synced) {
          // Plan was out of sync — refetch to pick up the corrected values
          await fetchUserPlan();
        }
      } catch {
        // Best-effort; don't block the UI
      }
    };

    loadData();
  }, [user]);

  return (
    <CircleContext.Provider
      value={{
        circles,
        selectedCircle,
        setSelectedCircle,
        profile,
        userPlan,
        isLoading,
        refetchCircles: fetchCircles,
        refetchProfile: fetchProfile,
        isCircleReadOnly,
        isCircleAdmin,
      }}
    >
      {children}
    </CircleContext.Provider>
  );
};

export const useCircleContext = () => {
  const context = useContext(CircleContext);
  if (context === undefined) {
    throw new Error("useCircleContext must be used within a CircleProvider");
  }
  return context;
};
