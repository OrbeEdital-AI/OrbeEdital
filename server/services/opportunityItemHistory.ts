export type OpportunityItemSnapshot = {
  sourceItemKey: string | null;
  itemNumber: string | null;
  description: string;
  catalogCode: string | null;
  catalogSystem: string | null;
  quantity: string | null;
  unit: string | null;
  estimatedUnitValue: string | null;
  estimatedTotalValue: string | null;
  specifications: string | null;
};

const ITEM_FIELDS = [
  "description",
  "catalogCode",
  "catalogSystem",
  "quantity",
  "unit",
  "estimatedUnitValue",
  "estimatedTotalValue",
  "specifications",
] as const;

function itemKey(item: OpportunityItemSnapshot) {
  return item.itemNumber?.trim() || item.sourceItemKey?.trim() || `${item.catalogCode ?? ""}:${item.description.trim()}`;
}

export function compareOpportunityItems(
  previous: OpportunityItemSnapshot[],
  next: OpportunityItemSnapshot[],
) {
  const oldByKey = new Map(previous.map(item => [itemKey(item), item]));
  const newByKey = new Map(next.map(item => [itemKey(item), item]));
  const altered: Array<{ itemNumber: string | null; description: string; changes: Record<string, { previous: unknown; next: unknown }> }> = [];
  const added: OpportunityItemSnapshot[] = [];
  const removed: OpportunityItemSnapshot[] = [];

  for (const [key, current] of newByKey) {
    const old = oldByKey.get(key);
    if (!old) {
      added.push(current);
      continue;
    }
    const changes: Record<string, { previous: unknown; next: unknown }> = {};
    for (const field of ITEM_FIELDS) {
      if ((old[field] ?? null) !== (current[field] ?? null)) {
        changes[field] = { previous: old[field] ?? null, next: current[field] ?? null };
      }
    }
    if (Object.keys(changes).length) {
      altered.push({ itemNumber: current.itemNumber, description: current.description, changes });
    }
  }

  for (const [key, old] of oldByKey) {
    if (!newByKey.has(key)) removed.push(old);
  }

  return { altered, added, removed };
}

export function summarizeOpportunityItemChanges(changes: ReturnType<typeof compareOpportunityItems>) {
  const parts = [
    changes.altered.length ? `${changes.altered.length} alterado(s)` : "",
    changes.added.length ? `${changes.added.length} incluído(s)` : "",
    changes.removed.length ? `${changes.removed.length} removido(s)` : "",
  ].filter(Boolean);
  return parts.length ? `A fonte oficial atualizou itens do edital: ${parts.join(", ")}.` : null;
}
