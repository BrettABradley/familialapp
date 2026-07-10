
-- Tighten circle_rescue_offers UPDATE: add WITH CHECK + immutability trigger.
DROP POLICY IF EXISTS "Members can claim rescue offers" ON public.circle_rescue_offers;
CREATE POLICY "Members can claim rescue offers"
  ON public.circle_rescue_offers
  FOR UPDATE
  TO authenticated
  USING (
    status = 'open'
    AND (
      circle_id IN (SELECT cm.circle_id FROM public.circle_memberships cm WHERE cm.user_id = auth.uid())
      OR circle_id IN (SELECT c.id FROM public.circles c WHERE c.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    status = 'claimed'
    AND claimed_by = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.enforce_rescue_offer_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    -- service-role / cron: allow
    RETURN NEW;
  END IF;
  IF NEW.circle_id IS DISTINCT FROM OLD.circle_id
     OR NEW.current_owner IS DISTINCT FROM OLD.current_owner
     OR NEW.deadline IS DISTINCT FROM OLD.deadline
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'Cannot modify protected fields of a rescue offer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_rescue_offer_immutable ON public.circle_rescue_offers;
CREATE TRIGGER enforce_rescue_offer_immutable
  BEFORE UPDATE ON public.circle_rescue_offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rescue_offer_immutable_fields();


-- Tighten circle_transfer_requests UPDATE: add WITH CHECK + immutability trigger.
DROP POLICY IF EXISTS "Recipients can respond to transfer requests" ON public.circle_transfer_requests;
CREATE POLICY "Recipients can respond to transfer requests"
  ON public.circle_transfer_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = to_user_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = to_user_id
    AND status IN ('accepted', 'declined')
  );

CREATE OR REPLACE FUNCTION public.enforce_transfer_request_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.circle_id IS DISTINCT FROM OLD.circle_id
     OR NEW.from_user_id IS DISTINCT FROM OLD.from_user_id
     OR NEW.to_user_id IS DISTINCT FROM OLD.to_user_id
     OR NEW.leave_after_transfer IS DISTINCT FROM OLD.leave_after_transfer
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'Cannot modify protected fields of a transfer request';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_transfer_request_immutable ON public.circle_transfer_requests;
CREATE TRIGGER enforce_transfer_request_immutable
  BEFORE UPDATE ON public.circle_transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_transfer_request_immutable_fields();
