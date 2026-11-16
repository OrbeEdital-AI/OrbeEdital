import { getPool } from "../db";
import { runAmmMtPilot } from "../connectors/orberadar-fetch";
import { compareRadarNotices } from "./orberadar-compare";
import { persistRadarRun } from "./orberadar-staging";

export async function runRadarAutomatic() {
 const lock=await getPool().connect();
 try {
  const result=await lock.query<{locked:boolean}>("select pg_try_advisory_lock(481229,6) as locked");
  if(!result.rows[0].locked) return {status:"busy" as const};
  const startedAt=new Date();
  try {
   const extracted=await runAmmMtPilot(startedAt);
   const notices=await compareRadarNotices(extracted.notices);
   const saved=await persistRadarRun("amm-mt",startedAt,notices,extracted.failures);
   return {status:"collected" as const,...saved};
  } catch(error) {
   await persistRadarRun("amm-mt",startedAt,[],["Falha na extração ou comparação automática"]);
   throw error;
  } finally {await lock.query("select pg_advisory_unlock(481229,6)");}
 } finally {lock.release();}
}
