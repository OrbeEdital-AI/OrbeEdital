import { describe, expect, it } from "vitest";
import { buildAmmMtSearch, discoverRadarLinks } from "./orberadar";
describe("OrbeRadar pilot", () => {
 it("deduplicates and rejects off-origin links", () => {
  const html = '<a href="/publicacao/123/">Aviso</a><a href="/publicacao/123/">Repetido</a><a href="https://example.com/publicacao/99/">Falso</a>';
  expect(discoverRadarLinks(html, "amm-mt")).toEqual([{source:"amm-mt",url:"https://amm.diariomunicipal.org/publicacao/123/",title:"Aviso",publicationId:"123",state:"review"}]);
 });
 it("recognizes MG matter identifiers", () => {
  expect(discoverRadarLinks('<a href="/amm-mg/materia/36DC9E17">Aviso</a>', "amm-mg")[0]?.publicationId).toBe("36DC9E17");
 });
 it("uses supplied dates and bounds pagination", () => {
  const from = new Date("2026-11-10T00:00:00Z"), to = new Date("2026-11-16T00:00:00Z");
  expect(buildAmmMtSearch(from,to,2).searchParams.get("dates")).toBe("2026-11-10,2026-11-16");
  expect(() => buildAmmMtSearch(from,to,4)).toThrow();
 });
});
