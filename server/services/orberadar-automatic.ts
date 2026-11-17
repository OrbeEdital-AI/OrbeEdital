import { assessRadarNotice } from "./orberadar-validation";
import { getPool } from "../db";
import { runAmmMtPilot, runAmmMgDiscovery } from "../connectors/orberadar-fetch";
import { compareRadarNotices } from "./orberadar-compare";
import { persistRadarRun } from "./orberadar-staging";

export async function runRadarAutomatic(source: "amm-mt" | "amm-mg" = "amm-mt") {
 const lock=await getPool().connect();
 try {
  await lock.query("BEGIN");
  const result=await lock.query<{locked:boolean}>("select pg_try_advisory_xact_lock(481229,$1) as locked", [source === "amm-mt" ? 6 : 7]);
  if(!result.rows[0].locked) return {status:"busy" as const};
  const startedAt=new Date();
  try {
   const extracted=source === "amm-mt" ? await runAmmMtPilot(startedAt) : await runAmmMgDiscovery(startedAt);
   const notices=await compareRadarNotices(extracted.notices);
   const assessed=notices.map(n=>({...n,automaticAssessment:assessRadarNotice(n,false,startedAt)}));
   const saved=await persistRadarRun(source,startedAt,assessed,extracted.failures);
   return {status:"collected" as const,...saved};
  } catch(error) {
   await persistRadarRun("amm-mt",startedAt,[],["Falha na extração ou comparação automática"]);
   throw error;
  }
 } finally {
  try { await lock.query("ROLLBACK"); lock.release(); }
  catch { lock.release(true); }
 }
}
