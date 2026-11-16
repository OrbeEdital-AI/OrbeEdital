import { describe,it,expect } from "vitest";
import { assessRadarNotice } from "./orberadar-validation";
type Notice = Parameters<typeof assessRadarNotice>[0];
const now = new Date("2026-11-16T12:00:00Z");
const notice = (deadlineEvidence:string, overrides:Partial<Notice>={}) => ({source:"amm-mt",url:"https://amm.diariomunicipal.org/publicacao/1/",title:"Aviso",publicationId:"1",state:"review",object:"Aquisição de materiais",modality:"Pregão eletrônico",procurementNumber:"01/2026",processNumber:null,sessionEvidence:null,deadlineEvidence,reviewReasons:[],comparison:"no_match_found",matches:[],...overrides} as Notice);
describe("automatic radar validation",()=>{
 it("recognizes explicit future Brasília deadline but does not publish",()=>{const r=assessRadarNotice(notice("Recebimento de propostas até 20/11/2026 às 09:00 horário de Brasília"),true,now);expect(r.deadline).toBe("2026-11-20T12:00:00.000Z");expect(r.eligibleForFurtherChecks).toBe(true);expect(r.publishable).toBe(false);});
 it.each(["31/11/2026 às 09:00 horário de Brasília","15/11/2026 às 09:00 horário de Brasília","20/11/2026 às 09:00","20/11/2026 às 09:00 horário de Brasília ou 21/11/2026"] )("blocks uncertain or past deadline: %s",(s)=>expect(assessRadarNotice(notice(s),true,now).eligibleForFurtherChecks).toBe(false));
 it("blocks unauthorized sources",()=>expect(assessRadarNotice(notice("20/11/2026 às 09:00 horário de Brasília"),false,now).eligibleForFurtherChecks).toBe(false));
});
