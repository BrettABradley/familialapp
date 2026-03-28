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

    // ──────────────────────────────────────────────
    // 1. Cancel any active Stripe subscriptions (active, trialing, past_due)
    // ──────────────────────────────────────────────
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      try {
        const customerSearch = await fetch(
          `https://api.stripe.com/v1/customers/search?query=email:'${encodeURIComponent(userEmail)}'`,
          { headers: { Authorization: `Bearer ${stripeKey}` } }
        );
        const customerData = await customerSearch.json();

        if (customerData.data?.length > 0) {
          const customerId = customerData.data[0].id;

          // Cancel active, trialing, and past_due subscriptions
          for (const status of ["active", "trialing", "past_due"]) {
            const subsRes = await fetch(
              `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=${status}`,
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
        }
      } catch (stripeErr) {
        console.error("Stripe cleanup error (non-fatal):", stripeErr);
      }
    }

    // ──────────────────────────────────────────────
    // 2. Handle owned circles: transfer-block or delete
    // ──────────────────────────────────────────────
    const { data: ownedCircles } = await adminClient
      .from("circles")
      .select("id")
      .eq("owner_id", userId);

    const circlesToDelete: string[] = [];
    const circlesToTransferBlock: string[] = [];

    if (ownedCircles?.length) {
      for (const circle of ownedCircles) {
        // Count other members (not the owner)
        const { count } = await adminClient
          .from("circle_memberships")
          .select("id", { count: "exact", head: true })
          .eq("circle_id", circle.id)
          .neq("user_id", userId);

        if ((count ?? 0) > 0) {
          circlesToTransferBlock.push(circle.id);
        } else {
          circlesToDelete.push(circle.id);
        }
      }

      // Set transfer_block on circles with remaining members
      if (circlesToTransferBlock.length) {
        await adminClient
          .from("circles")
          .update({ transfer_block: true })
          .in("id", circlesToTransferBlock);

        // Remove owner's own membership from these circles
        await adminClient
          .from("circle_memberships")
          .delete()
          .in("circle_id", circlesToTransferBlock)
          .eq("user_id", userId);

        // Clean up owner-specific records in transfer-blocked circles
        await adminClient.from("circle_invites").delete().in("circle_id", circlesToTransferBlock).eq("invited_by", userId);
        await adminClient.from("circle_rescue_offers").delete().in("circle_id", circlesToTransferBlock).eq("current_owner", userId);
        await adminClient.from("circle_transfer_requests").delete().in("circle_id", circlesToTransferBlock).eq("from_user_id", userId);
        await adminClient.from("user_roles").delete().in("circle_id", circlesToTransferBlock).eq("user_id", userId);
      }

      // Delete empty circles and all their data
      if (circlesToDelete.length) {
        await adminClient.from("circle_invites").delete().in("circle_id", circlesToDelete);
        await adminClient.from("circle_rescue_offers").delete().in("circle_id", circlesToDelete);
        await adminClient.from("circle_transfer_requests").delete().in("circle_id", circlesToDelete);
        await adminClient.from("fridge_pins").delete().in("circle_id", circlesToDelete);
        await adminClient.from("family_tree_members").delete().in("circle_id", circlesToDelete);
        await adminClient.from("events").delete().in("circle_id", circlesToDelete);
        await adminClient.from("photo_albums").delete().in("circle_id", circlesToDelete);
        await adminClient.from("user_roles").delete().in("circle_id", circlesToDelete);
        await adminClient.from("member_aliases").delete().in("circle_id", circlesToDelete);

        // Delete posts and their related data in empty circles
        const { data: posts } = await adminClient
          .from("posts")
          .select("id")
          .in("circle_id", circlesToDelete);

        if (posts?.length) {
          const postIds = posts.map((p: any) => p.id);
          await adminClient.from("comments").delete().in("post_id", postIds);
          await adminClient.from("reactions").delete().in("post_id", postIds);
          await adminClient.from("photo_permissions").delete().in("post_id", postIds);
          await adminClient.from("posts").delete().in("id", postIds);
        }

        // Delete group chats in empty circles
        const { data: groupChats } = await adminClient
          .from("group_chats")
          .select("id")
          .in("circle_id", circlesToDelete);

        if (groupChats?.length) {
          const gcIds = groupChats.map((g: any) => g.id);
          await adminClient.from("group_chat_messages").delete().in("group_chat_id", gcIds);
          await adminClient.from("group_chat_members").delete().in("group_chat_id", gcIds);
          await adminClient.from("group_chats").delete().in("id", gcIds);
        }

        await adminClient.from("circle_memberships").delete().in("circle_id", circlesToDelete);
        await adminClient.from("circles").delete().in("id", circlesToDelete);
      }
    }

    // ──────────────────────────────────────────────
    // 3. Delete user-authored content globally (across ALL circles)
    // ──────────────────────────────────────────────

    // Delete user's posts and cascade their comments/reactions
    const { data: userPosts } = await adminClient
      .from("posts")
      .select("id")
      .eq("author_id", userId);

    if (userPosts?.length) {
      const postIds = userPosts.map((p: any) => p.id);
      await adminClient.from("comments").delete().in("post_id", postIds);
      await adminClient.from("reactions").delete().in("post_id", postIds);
      await adminClient.from("photo_permissions").delete().in("post_id", postIds);
      await adminClient.from("posts").delete().in("id", postIds);
    }

    // Delete user's comments in other people's posts
    await adminClient.from("comments").delete().eq("author_id", userId);

    // Delete user's reactions
    await adminClient.from("reactions").delete().eq("user_id", userId);

    // Delete user's fridge pins (and their campfire stories)
    const { data: userPins } = await adminClient
      .from("fridge_pins")
      .select("id")
      .eq("pinned_by", userId);

    if (userPins?.length) {
      const pinIds = userPins.map((p: any) => p.id);
      await adminClient.from("campfire_stories").delete().in("fridge_pin_id", pinIds);
      await adminClient.from("fridge_pins").delete().in("id", pinIds);
    }

    // Delete user's campfire stories on other people's pins
    await adminClient.from("campfire_stories").delete().eq("author_id", userId);

    // Delete user's event RSVPs
    await adminClient.from("event_rsvps").delete().eq("user_id", userId);

    // Delete user's album photos
    await adminClient.from("album_photos").delete().eq("uploaded_by", userId);

    // Delete user's group chat messages
    await adminClient.from("group_chat_messages").delete().eq("sender_id", userId);

    // ──────────────────────────────────────────────
    // 4. Remove circle memberships
    // ──────────────────────────────────────────────
    await adminClient.from("circle_memberships").delete().eq("user_id", userId);
    await adminClient.from("group_chat_members").delete().eq("user_id", userId);

    // ──────────────────────────────────────────────
    // 5. Delete user-specific records
    // ──────────────────────────────────────────────
    await adminClient.from("notifications").delete().eq("user_id", userId);
    await adminClient.from("private_messages").delete().eq("sender_id", userId);
    await adminClient.from("private_messages").delete().eq("recipient_id", userId);
    await adminClient.from("push_tokens").delete().eq("user_id", userId);
    await adminClient.from("profile_images").delete().eq("user_id", userId);
    await adminClient.from("user_plans").delete().eq("user_id", userId);
    await adminClient.from("member_aliases").delete().eq("user_id", userId);
    await adminClient.from("member_aliases").delete().eq("target_user_id", userId);
    await adminClient.from("store_offers").delete().eq("submitted_by", userId);
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);

    // ──────────────────────────────────────────────
    // 6. Clean up storage files
    // ──────────────────────────────────────────────
    try {
      const { data: avatarFiles } = await adminClient.storage
        .from("avatars")
        .list(userId);

      if (avatarFiles?.length) {
        const paths = avatarFiles.map((f: any) => `${userId}/${f.name}`);
        await adminClient.storage.from("avatars").remove(paths);
      }
    } catch (storageErr) {
      console.error("Storage cleanup error (non-fatal):", storageErr);
    }

    // ──────────────────────────────────────────────
    // 7. Delete the auth user
    // ──────────────────────────────────────────────
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
