import { supabase } from "@/integrations/supabase/client";

export async function getCircleMemberCount(circleId: string): Promise<number> {
  // Get circle owner
  const { data: circleData } = await supabase
    .from("circles")
    .select("owner_id")
    .eq("id", circleId)
    .maybeSingle();

  const { count } = await supabase
    .from("circle_memberships")
    .select("id", { count: "exact", head: true })
    .eq("circle_id", circleId);

  const memberCount = count ?? 0;

  if (!circleData?.owner_id) return memberCount;

  // Check if owner is already in circle_memberships
  const { data: ownerMembership } = await supabase
    .from("circle_memberships")
    .select("id")
    .eq("circle_id", circleId)
    .eq("user_id", circleData.owner_id)
    .maybeSingle();

  // Only add +1 for owner if they're NOT in circle_memberships
  return ownerMembership ? memberCount : memberCount + 1;
}

export async function getCircleMemberLimit(circleOwnerId: string, circleId?: string): Promise<{ limit: number; plan: string; extraMembers: number; maxMembers: number }> {
  // For the circle owner's plan, prefer the SECURITY DEFINER RPC which returns
  // only the safe columns (plan + max_members_per_circle) — direct table SELECT
  // of another user's billing row is no longer permitted by RLS.
  const planPromise = circleId
    ? supabase.rpc("get_circle_owner_limits", { _circle_id: circleId })
    : supabase
        .from("user_plans")
        .select("max_members_per_circle, plan")
        .eq("user_id", circleOwnerId)
        .maybeSingle();

  const circlePromise = circleId
    ? supabase.from("circles").select("extra_members").eq("id", circleId).maybeSingle()
    : Promise.resolve({ data: null });

  const [planRes, { data: circleData }] = await Promise.all([planPromise, circlePromise]);

  let maxMembers = 8;
  let plan = "free";
  if (circleId) {
    const row = Array.isArray((planRes as any).data) ? (planRes as any).data[0] : null;
    if (row) {
      maxMembers = row.max_members_per_circle ?? 8;
      plan = row.plan ?? "free";
    }
  } else {
    const row = (planRes as any).data;
    if (row) {
      maxMembers = row.max_members_per_circle ?? 8;
      plan = row.plan ?? "free";
    }
  }
  const circleExtra = (circleData as any)?.extra_members ?? 0;

  return {
    limit: maxMembers + circleExtra,
    plan,
    extraMembers: circleExtra,
    maxMembers,
  };
}

export async function checkCircleCapacity(circleId: string, circleOwnerId: string) {
  const [count, limitInfo] = await Promise.all([
    getCircleMemberCount(circleId),
    getCircleMemberLimit(circleOwnerId, circleId),
  ]);
  
  return {
    currentCount: count,
    ...limitInfo,
    isFull: count >= limitInfo.limit,
  };
}
