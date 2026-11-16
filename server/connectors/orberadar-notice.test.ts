import { describe,it,expect } from "vitest";
import { parseRadarNotice } from "./orberadar-notice";
const candidate = { source:"amm-mt" as const,url:"https://amm.diariomunicipal.org/publicacao/123/",title:"Aviso de licitação",publicationId:"123",state:"review" as const };
describe("Radar notice parser",()=>{
 it("recognizes concorrência and process",()=>{
 const n=parseRadarNotice({...candidate,title:"CONCORRÊNCIA ELETRÔNICA Nº 006/2026"},"Processo administrativo nº 95/2026");
 expect(n.procurementNumber).toBe("006/2026");expect(n.processNumber).toBe("95/2026");
 });
 it("does not treat the session as a proposal deadline",()=>{
 const n=parseRadarNotice(candidate,"Pregão eletrônico SRP nº 30/2026. Início da sessão: 30/11/2026 às 09h.");
 expect(n.procurementNumber).toBe("30/2026");expect(n.deadlineEvidence).toBeNull();expect(n.sessionEvidence).toContain("30/11/2026");
 });
 it("retains explicit deadline evidence",()=>{
 expect(parseRadarNotice(candidate,"Recebimento das propostas até 24/11/2026 às 08:20").deadlineEvidence).toContain("24/11/2026");
 });
 it("requires review for conflicting numbers",()=>{
 expect(parseRadarNotice(candidate,"Pregão eletrônico 1/2026 e Pregão eletrônico 2/2026").procurementNumber).toBeNull();
 });
});
