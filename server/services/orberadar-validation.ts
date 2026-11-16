import type { compareRadarNotices } from "./orberadar-compare";
type Notice=Awaited<ReturnType<typeof compareRadarNotices>>[number];
export function assessRadarNotice(n:Notice, sourceAuthorized:boolean, now=new Date()){
 const reasons:string[]=[];
 if(!sourceAuthorized) reasons.push("Fonte ainda não autorizada para publicação automática");
 if(!n.object||!n.modality||!n.procurementNumber) reasons.push("Identificação incompleta");
 if(n.matches.length) reasons.push("Possível duplicidade");
 const evidence=n.deadlineEvidence??"";
 // Require explicit date, time and Brasília timezone; never infer session as deadline.
 const dates=[...evidence.matchAll(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/g)];
 const match=/\b(\d{2})\/(\d{2})\/(20\d{2})\s*(?:,|às|as|a?s)?\s*(\d{1,2})[:h](\d{2})\s*(?:h|horas)?\s*(?:\(?horário de Brasília\)?)/iu.exec(evidence);
 let deadline:Date|null=null;
 if(match&&dates.length===1){
 const d=new Date(match[3]+"-"+match[2]+"-"+match[1]+"T"+match[4].padStart(2,"0")+":"+match[5]+":00-03:00");
 if(Number.isFinite(+d)&&new Date(+d-10800000).toISOString().slice(0,16)===match[3]+"-"+match[2]+"-"+match[1]+"T"+match[4].padStart(2,"0")+":"+match[5])deadline=d;
 }
 if(!deadline||deadline<=now) reasons.push("Prazo futuro inequívoco não confirmado");
 // No-match is not proof of novelty; authoritative status and identity remain required.
 return {deadline:deadline?.toISOString()??null,reasons,eligibleForFurtherChecks:reasons.length===0,publishable:false as const};
}
