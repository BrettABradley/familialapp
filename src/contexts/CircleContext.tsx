import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Circle {
  id: string;
  name: string;
  owner_id: string;
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

  const fetchCircles = async () => {
    if (!user) {
      setCircles([]);
      setSelectedCircle("");
      return;
    }

    const { data: ownedCircles } = await supabase
      .from("circles")
      .select("id, name, owner_id")
      .eq("owner_id", user.id);

    const { data: memberCircles } = await supabase
      .from("circle_memberships")
      .select("circle_id, circles(id, name, owner_id)")
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
