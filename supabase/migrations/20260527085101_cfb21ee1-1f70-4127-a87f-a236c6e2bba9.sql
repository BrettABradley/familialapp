DO $$
DECLARE
  v_user_id uuid := '041580e8-1a39-47ee-90e0-b99e74e88106';
  v_email text := 'babradl3@asu.edu';
  v_circles_to_delete uuid[];
  v_circles_to_block uuid[];
  v_post_ids uuid[];
  v_pin_ids uuid[];
  v_gc_ids uuid[];
BEGIN
  -- Determine owned circles to delete vs transfer-block
  SELECT array_agg(c.id) INTO v_circles_to_delete
  FROM circles c
  WHERE c.owner_id = v_user_id
    AND NOT EXISTS (SELECT 1 FROM circle_memberships m WHERE m.circle_id = c.id AND m.user_id <> v_user_id);

  SELECT array_agg(c.id) INTO v_circles_to_block
  FROM circles c
  WHERE c.owner_id = v_user_id
    AND EXISTS (SELECT 1 FROM circle_memberships m WHERE m.circle_id = c.id AND m.user_id <> v_user_id);

  IF v_circles_to_block IS NOT NULL THEN
    UPDATE circles SET transfer_block = true WHERE id = ANY(v_circles_to_block);
    DELETE FROM circle_memberships WHERE circle_id = ANY(v_circles_to_block) AND user_id = v_user_id;
    DELETE FROM circle_invites WHERE circle_id = ANY(v_circles_to_block) AND invited_by = v_user_id;
    DELETE FROM circle_rescue_offers WHERE circle_id = ANY(v_circles_to_block) AND current_owner = v_user_id;
    DELETE FROM circle_transfer_requests WHERE circle_id = ANY(v_circles_to_block) AND from_user_id = v_user_id;
    DELETE FROM user_roles WHERE circle_id = ANY(v_circles_to_block) AND user_id = v_user_id;
  END IF;

  IF v_circles_to_delete IS NOT NULL THEN
    DELETE FROM circle_invites WHERE circle_id = ANY(v_circles_to_delete);
    DELETE FROM circle_rescue_offers WHERE circle_id = ANY(v_circles_to_delete);
    DELETE FROM circle_transfer_requests WHERE circle_id = ANY(v_circles_to_delete);
    DELETE FROM campfire_stories WHERE fridge_pin_id IN (SELECT id FROM fridge_pins WHERE circle_id = ANY(v_circles_to_delete));
    DELETE FROM fridge_pins WHERE circle_id = ANY(v_circles_to_delete);
    DELETE FROM family_tree_members WHERE circle_id = ANY(v_circles_to_delete);
    DELETE FROM event_rsvps WHERE event_id IN (SELECT id FROM events WHERE circle_id = ANY(v_circles_to_delete));
    DELETE FROM events WHERE circle_id = ANY(v_circles_to_delete);
    DELETE FROM album_photos WHERE album_id IN (SELECT id FROM photo_albums WHERE circle_id = ANY(v_circles_to_delete));
    DELETE FROM photo_albums WHERE circle_id = ANY(v_circles_to_delete);
    DELETE FROM user_roles WHERE circle_id = ANY(v_circles_to_delete);
    DELETE FROM member_aliases WHERE circle_id = ANY(v_circles_to_delete);

    SELECT array_agg(id) INTO v_post_ids FROM posts WHERE circle_id = ANY(v_circles_to_delete);
    IF v_post_ids IS NOT NULL THEN
      DELETE FROM comments WHERE post_id = ANY(v_post_ids);
      DELETE FROM reactions WHERE post_id = ANY(v_post_ids);
      DELETE FROM photo_permissions WHERE post_id = ANY(v_post_ids);
      DELETE FROM posts WHERE id = ANY(v_post_ids);
    END IF;

    SELECT array_agg(id) INTO v_gc_ids FROM group_chats WHERE circle_id = ANY(v_circles_to_delete);
    IF v_gc_ids IS NOT NULL THEN
      DELETE FROM group_chat_messages WHERE group_chat_id = ANY(v_gc_ids);
      DELETE FROM group_chat_members WHERE group_chat_id = ANY(v_gc_ids);
      DELETE FROM group_chats WHERE id = ANY(v_gc_ids);
    END IF;

    DELETE FROM circle_memberships WHERE circle_id = ANY(v_circles_to_delete);
    DELETE FROM circles WHERE id = ANY(v_circles_to_delete);
  END IF;

  -- User-authored content
  SELECT array_agg(id) INTO v_post_ids FROM posts WHERE author_id = v_user_id;
  IF v_post_ids IS NOT NULL THEN
    DELETE FROM comments WHERE post_id = ANY(v_post_ids);
    DELETE FROM reactions WHERE post_id = ANY(v_post_ids);
    DELETE FROM photo_permissions WHERE post_id = ANY(v_post_ids);
    DELETE FROM posts WHERE id = ANY(v_post_ids);
  END IF;
  DELETE FROM comments WHERE author_id = v_user_id;
  DELETE FROM reactions WHERE user_id = v_user_id;

  SELECT array_agg(id) INTO v_pin_ids FROM fridge_pins WHERE pinned_by = v_user_id;
  IF v_pin_ids IS NOT NULL THEN
    DELETE FROM campfire_stories WHERE fridge_pin_id = ANY(v_pin_ids);
    DELETE FROM fridge_pins WHERE id = ANY(v_pin_ids);
  END IF;
  DELETE FROM campfire_stories WHERE author_id = v_user_id;
  DELETE FROM event_rsvps WHERE user_id = v_user_id;
  DELETE FROM album_photos WHERE uploaded_by = v_user_id;

  DELETE FROM circle_memberships WHERE user_id = v_user_id;
  DELETE FROM group_chat_members WHERE user_id = v_user_id;

  DELETE FROM notifications WHERE user_id = v_user_id;
  DELETE FROM push_tokens WHERE user_id = v_user_id;
  DELETE FROM profile_images WHERE user_id = v_user_id;
  DELETE FROM user_plans WHERE user_id = v_user_id;
  DELETE FROM member_aliases WHERE user_id = v_user_id OR target_user_id = v_user_id;
  DELETE FROM store_offers WHERE submitted_by = v_user_id;
  DELETE FROM user_roles WHERE user_id = v_user_id;
  DELETE FROM user_private WHERE user_id = v_user_id;
  DELETE FROM profiles WHERE user_id = v_user_id;
  DELETE FROM circle_invites WHERE email = v_email;

  DELETE FROM auth.users WHERE id = v_user_id;
END $$;