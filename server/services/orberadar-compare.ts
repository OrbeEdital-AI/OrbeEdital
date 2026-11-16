import { eq } from "drizzle-orm";
import { opportunities } from "../../drizzle/schema";
import { getDb } from "../db";
import type { RadarNotice } from "../connectors/orberadar-notice";
const normalize = (s: string | null) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const number = (s: string | null) => { const m = /^(\d+)\s*\/\s*(20\d{2})$/.exec(s?.trim() ?? ""); return m ? Number(m[1])+"/"+m[2] : ""; };
const tokens = (s: string | null) => new Set(normalize(s).split(" ").filter(w=>w.length>3 && !["para","pela","pelo","eventual","futura","registro","precos","aquisicao","contratacao"].includes(w)));
function similarity(a: string | null,b: string | null) { const x=tokens(a),y=tokens(b); if(x.size<4||y.size<4)return 0; return [...x].filter(w=>y.has(w)).length/new Set([...x,...y]).size; }
export async function compareRadarNotices(notices: RadarNotice[]) {
 if (!notices.length) return [];
 const rows=await getDb().select({id:opportunities.id,title:opportunities.title,municipality:opportunities.municipality,procurementNumber:opportunities.procurementNumber,processNumber:opportunities.processNumber,sourceUrl:opportunities.sourceUrl}).from(opportunities).where(eq(opportunities.state,notices[0].source==="amm-mg"?"MG":"MT"));
 return notices.map(n=>{
 const context=normalize(n.title+" "+(n.object??""));
 const matches=rows.flatMap(row=>{
 const city=normalize(row.municipality);
 const sameCity=city.length>=4 && (" "+context+" ").includes(" "+city+" ");
 const sameNumber=Boolean(number(n.procurementNumber)&&number(n.procurementNumber)===number(row.procurementNumber));
 const sameProcess=Boolean(number(n.processNumber)&&number(n.processNumber)===number(row.processNumber));
 const score=similarity(n.object??n.title,row.title);
 const exactUrl=row.sourceUrl===n.url;
 if(!exactUrl && !(sameCity&&(sameNumber||sameProcess||score>=0.65)) && score<0.85)return [];
 return [{id:row.id,title:row.title,reason:exactUrl?"URL coincidente":sameCity&&(sameNumber||sameProcess)?"Município e numeração coincidentes":"Objeto semelhante",score:exactUrl?2:sameCity&&(sameNumber||sameProcess)?1+score:score}];
 }).sort((a,b)=>b.score-a.score).slice(0,5);
 return {...n,comparison:matches.length?"possible_duplicate" as const:"no_match_found" as const,matches};
 });
}
