import { supabase } from "@/integrations/supabase/client";

export async function getCircleMemberCount(circleId: string): Promise<number> {
  const { count } = await supabase
    .from("circle_memberships")
    .select("id", { count: "exact", head: true })
    .eq("circle_id", circleId);
  return (count ?? 0) + 1; // +1 for owner
}

export async function getCircleMemberLimit(circleOwnerId: string): Promise<{ limit: number; plan: string; extraMembers: number; maxMembers: number }> {
  const { data } = await supabase
    .from("user_plans")
    .select("max_members_per_circle, extra_members, plan")
    .eq("user_id", circleOwnerId)
    .maybeSingle();
  
  const maxMembers = data?.max_members_per_circle ?? 8;
  const extraMembers = data?.extra_members ?? 0;
  const plan = data?.plan ?? "free";
  
  return {
    limit: maxMembers + extraMembers,
    plan,
    extraMembers,
    maxMembers,
  };
}

export async function checkCircleCapacity(circleId: string, circleOwnerId: string) {
  const [count, limitInfo] = await Promise.all([
    getCircleMemberCount(circleId),
    getCircleMemberLimit(circleOwnerId),
  ]);
  
  return {
    currentCount: count,
    ...limitInfo,
    isFull: count >= limitInfo.limit,
  };
}
