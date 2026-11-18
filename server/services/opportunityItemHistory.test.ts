import { describe, expect, it } from "vitest";
import { compareOpportunityItems, summarizeOpportunityItemChanges, type OpportunityItemSnapshot } from "./opportunityItemHistory";

const item = (values: Partial<OpportunityItemSnapshot> = {}): OpportunityItemSnapshot => ({
  sourceItemKey: "1",
  itemNumber: "1",
  description: "Microfone sem fio",
  catalogCode: "123",
  catalogSystem: "CATMAT",
  quantity: "2",
  unit: "unidade",
  estimatedUnitValue: "150.00",
  estimatedTotalValue: "300.00",
  specifications: null,
  ...values,
});

describe("compareOpportunityItems", () => {
  it("detects changed fields, added items and removed items", () => {
    const changes = compareOpportunityItems(
      [item(), item({ sourceItemKey: "2", itemNumber: "2", description: "Caixa de som", catalogCode: "456" })],
      [item({ quantity: "4", estimatedTotalValue: "600.00" }), item({ sourceItemKey: "3", itemNumber: "3", description: "Pedestal", catalogCode: "789" })],
    );

    expect(changes.altered).toEqual([{
      itemNumber: "1",
      description: "Microfone sem fio",
      changes: {
        quantity: { previous: "2", next: "4" },
        estimatedTotalValue: { previous: "300.00", next: "600.00" },
      },
    }]);
    expect(changes.added.map(value => value.itemNumber)).toEqual(["3"]);
    expect(changes.removed.map(value => value.itemNumber)).toEqual(["2"]);
    expect(summarizeOpportunityItemChanges(changes)).toBe("A fonte oficial atualizou itens do edital: 1 alterado(s), 1 incluído(s), 1 removido(s).");
  });

  it("treats identical source snapshots as unchanged", () => {
    expect(compareOpportunityItems([item()], [item()])).toEqual({ altered: [], added: [], removed: [] });
    expect(summarizeOpportunityItemChanges({ altered: [], added: [], removed: [] })).toBeNull();
  });

  it("matches items by their official number even when their description changes", () => {
    const changes = compareOpportunityItems([item()], [item({ description: "Microfone sem fio digital" })]);
    expect(changes.altered).toHaveLength(1);
    expect(changes.altered[0].changes.description).toEqual({ previous: "Microfone sem fio", next: "Microfone sem fio digital" });
    expect(changes.added).toHaveLength(0);
    expect(changes.removed).toHaveLength(0);
  });
});
