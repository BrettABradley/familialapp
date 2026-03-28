import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;

    // Use service role for deletion operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Cancel any active Stripe subscription
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      try {
        // Find Stripe customer by email
        const customerSearch = await fetch(
          `https://api.stripe.com/v1/customers/search?query=email:'${encodeURIComponent(userEmail)}'`,
          { headers: { Authorization: `Bearer ${stripeKey}` } }
        );
        const customerData = await customerSearch.json();

        if (customerData.data?.length > 0) {
          const customerId = customerData.data[0].id;

          // Cancel all active subscriptions
          const subsRes = await fetch(
            `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active`,
            { headers: { Authorization: `Bearer ${stripeKey}` } }
          );
          const subsData = await subsRes.json();

          for (const sub of subsData.data || []) {
            await fetch(`https://api.stripe.com/v1/subscriptions/${sub.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${stripeKey}` },
            });
          }
        }
      } catch (stripeErr) {
        console.error("Stripe cleanup error (non-fatal):", stripeErr);
      }
    }

    // 2. Delete user's data (cascade through foreign keys where possible)
    // Delete owned circles (this will cascade to memberships, posts, etc. via FK)
    const { data: ownedCircles } = await adminClient
      .from("circles")
      .select("id")
      .eq("owner_id", userId);

    if (ownedCircles?.length) {
      const circleIds = ownedCircles.map((c: any) => c.id);

      // Delete circle-related data
      await adminClient.from("circle_invites").delete().in("circle_id", circleIds);
      await adminClient.from("circle_rescue_offers").delete().in("circle_id", circleIds);
      await adminClient.from("circle_transfer_requests").delete().in("circle_id", circleIds);
      await adminClient.from("fridge_pins").delete().in("circle_id", circleIds);
      await adminClient.from("family_tree_members").delete().in("circle_id", circleIds);
      await adminClient.from("events").delete().in("circle_id", circleIds);
      await adminClient.from("photo_albums").delete().in("circle_id", circleIds);
      await adminClient.from("user_roles").delete().in("circle_id", circleIds);
      await adminClient.from("member_aliases").delete().in("circle_id", circleIds);

      // Delete posts and their related data
      const { data: posts } = await adminClient
        .from("posts")
        .select("id")
        .in("circle_id", circleIds);

      if (posts?.length) {
        const postIds = posts.map((p: any) => p.id);
        await adminClient.from("comments").delete().in("post_id", postIds);
        await adminClient.from("reactions").delete().in("post_id", postIds);
        await adminClient.from("photo_permissions").delete().in("post_id", postIds);
        await adminClient.from("posts").delete().in("id", postIds);
      }

      // Delete group chats
      const { data: groupChats } = await adminClient
        .from("group_chats")
        .select("id")
        .in("circle_id", circleIds);

      if (groupChats?.length) {
        const gcIds = groupChats.map((g: any) => g.id);
        await adminClient.from("group_chat_messages").delete().in("group_chat_id", gcIds);
        await adminClient.from("group_chat_members").delete().in("group_chat_id", gcIds);
        await adminClient.from("group_chats").delete().in("id", gcIds);
      }

      // Remove other members from these circles
      await adminClient.from("circle_memberships").delete().in("circle_id", circleIds);

      // Delete the circles themselves
      await adminClient.from("circles").delete().in("id", circleIds);
    }

    // 3. Remove user's memberships in other circles
    await adminClient.from("circle_memberships").delete().eq("user_id", userId);

    // 4. Delete user-specific data
    await adminClient.from("notifications").delete().eq("user_id", userId);
    await adminClient.from("private_messages").delete().eq("sender_id", userId);
    await adminClient.from("private_messages").delete().eq("recipient_id", userId);
    await adminClient.from("push_tokens").delete().eq("user_id", userId);
    await adminClient.from("profile_images").delete().eq("user_id", userId);
    await adminClient.from("user_plans").delete().eq("user_id", userId);
    await adminClient.from("member_aliases").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);

    // 5. Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete account. Please contact support." }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      { status: 500, headers: corsHeaders }
    );
  }
});
