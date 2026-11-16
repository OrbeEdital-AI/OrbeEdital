import { getPool } from "../db";
import type { compareRadarNotices } from "./orberadar-compare";
type Notices = Awaited<ReturnType<typeof compareRadarNotices>>;
export async function persistRadarRun(source: "amm-mt"|"amm-mg", startedAt: Date, notices: Notices, failures: string[]) {
 if(notices.some(n=>n.source!==source)) throw new Error("Mixed radar sources");
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  const run=await client.query<{id:string}>(`insert into orberadar_private.runs(source, started_at, finished_at, status, candidate_count, failures) values ($1,$2,now(),$3,$4,$5::jsonb) returning id`,[source,startedAt,failures.length?(notices.length?"partial":"failed"):"completed",notices.length,JSON.stringify(failures)]);
  const runId=run.rows[0].id;
  for(const n of notices) {
   const candidate=await client.query<{id:string}>(`insert into orberadar_private.candidates(source,publication_id,source_url) values ($1,$2,$3) on conflict(source,publication_id) do update set last_seen_at=now(),source_url=excluded.source_url returning id`,[source,n.publicationId,n.url]);
   await client.query("insert into orberadar_private.observations(run_id,candidate_id,payload) values($1,$2,$3::jsonb)",[runId,candidate.rows[0].id,JSON.stringify(n)]);
  }
  await client.query("COMMIT");
  return {runId,count:notices.length};
 } catch(error) { await client.query("ROLLBACK"); throw error; }
 finally {client.release();}
}
