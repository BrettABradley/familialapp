import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Circle {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
}

interface CircleContextType {
  circles: Circle[];
  selectedCircle: string;
  setSelectedCircle: (circleId: string) => void;
  profile: Profile | null;
  isLoading: boolean;
  refetchCircles: () => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const CircleContext = createContext<CircleContextType | undefined>(undefined);

export const CircleProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<string>("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const acceptPendingInvites = async () => {
    if (!user?.email) return;

    // Query pending invites for this user's email
    const { data: pendingInvites } = await supabase
      .from("circle_invites")
      .select("id, circle_id")
      .eq("email", user.email)
      .eq("status", "pending");

    if (!pendingInvites || pendingInvites.length === 0) return;

    // Join each circle and mark invite as accepted
    for (const invite of pendingInvites) {
      await supabase
        .from("circle_memberships")
        .insert({ circle_id: invite.circle_id, user_id: user.id, role: "member" })
        .select()
        .maybeSingle();

      await supabase
        .from("circle_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);
    }
  };

  const fetchCircles = async () => {
    if (!user) {
      setCircles([]);
      setSelectedCircle("");
      return;
    }

    // Accept any pending invites before fetching circles
    await acceptPendingInvites();

    const { data: ownedCircles } = await supabase
      .from("circles")
      .select("id, name, description, owner_id, created_at")
      .eq("owner_id", user.id);

    const { data: memberCircles } = await supabase
      .from("circle_memberships")
      .select("circle_id, circles(id, name, description, owner_id, created_at)")
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

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      await Promise.all([fetchCircles(), fetchProfile()]);
      setIsLoading(false);
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
        isLoading,
        refetchCircles: fetchCircles,
        refetchProfile: fetchProfile,
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
