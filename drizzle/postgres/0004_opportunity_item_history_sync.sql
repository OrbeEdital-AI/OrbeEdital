ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS items_synced_at timestamp with time zone;

-- The current item snapshots are treated as the baseline; only later official
-- source revisions should trigger comparisons and public history events.
UPDATE public.opportunities AS opportunity
SET items_synced_at = now()
WHERE opportunity.items_synced_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.opportunity_items AS item
    WHERE item.opportunity_id = opportunity.id
  );
