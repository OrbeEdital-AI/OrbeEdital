import { getPool } from "../db";
export async function listRadarReview() {
 const pool=getPool();
 const runs=await pool.query("select id,source,started_at,finished_at,status,candidate_count,failures from orberadar_private.runs order by started_at desc limit 30");
 const candidates=await pool.query(`select c.id,c.source,c.publication_id,c.source_url,c.first_seen_at,c.last_seen_at,c.review_status,o.payload from orberadar_private.candidates c left join lateral (select payload from orberadar_private.observations where candidate_id=c.id order by extracted_at desc limit 1) o on true order by c.last_seen_at desc limit 100`);
 return {runs:runs.rows,candidates:candidates.rows};
}
