import { createHash } from "node:crypto";
import postgres from "postgres";
import { ParkAnalyticsConfigSchema } from "@wr/shared";
import { buildGrid } from "./grid/build-grid.js";
const NS = "03700000-0000-5000-8000-000000000004";
export function seedId(key: string): string {
  const hash = createHash("sha1")
    .update(Buffer.from(NS.replaceAll("-", ""), "hex"))
    .update(key)
    .digest();
  hash[6] = (hash[6] & 15) | 80;
  hash[8] = (hash[8] & 63) | 128;
  const s = hash.subarray(0, 16).toString("hex");
  return [
    s.slice(0, 8),
    s.slice(8, 12),
    s.slice(12, 16),
    s.slice(16, 20),
    s.slice(20),
  ].join("-");
}
export function checkSeedTarget(
  url: string,
  production: boolean,
  confirmed: boolean,
): void {
  if (production)
    throw new Error("Analytics demo seeding is disabled in production.");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) &&
    !confirmed
  )
    throw new Error(
      "Remote demo seeding requires --confirm-shared-db and team agreement.",
    );
}
const profiles = [
  {
    code: "YALA",
    lon: 81.42,
    lat: 6.4,
    incidents: 180,
    patrols: 60,
    alerts: 40,
    size: 1000,
  },
  {
    code: "WILPATTU",
    lon: 80.03,
    lat: 8.4,
    incidents: 45,
    patrols: 15,
    alerts: 10,
    size: 1000,
  },
  {
    code: "SINHARAJA",
    lon: 80.46,
    lat: 6.42,
    incidents: 45,
    patrols: 15,
    alerts: 10,
    size: 500,
  },
];
const DAY = 86400000;
const anchor = Date.parse("2026-10-08T06:30:00Z");
const categories = [
  "POACHING",
  "SNARE_FOUND",
  "HUMAN_WILDLIFE_CONFLICT",
  "CROP_DAMAGE",
  "FENCE_DAMAGE",
  "INJURED_ANIMAL",
  "OTHER",
];
const sectorNames = [
  "Southern Ridge",
  "Palatupana Corridor",
  "Menik Ganga",
  "Patanangala Coast",
  "Kumana Edge",
];
export async function seedAnalytics(url: string, remove = false) {
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(37014)`;
      const results = [];
      for (const p of profiles) {
        const [park] = await tx<
          { id: string; boundary: unknown }[]
        >`SELECT id,boundary FROM parks WHERE code=${p.code}`;
        if (!park)
          throw new Error("Run the account/park seed first: missing " + p.code);
        const accounts = await tx<
          { id: string; role: string }[]
        >`SELECT id,role FROM auth_users WHERE park_id=${park.id} AND disabled_at IS NULL ORDER BY id`;
        const manager = accounts.find((a) => a.role === "PARK_MANAGER");
        const ranger = accounts.find((a) => a.role === "RANGER");
        if (!manager || !ranger)
          throw new Error("Demo manager/ranger missing for " + p.code);
        const id = (kind: string, n = 0) =>
          seedId(p.code + ":" + kind + ":" + n);
        if (remove) {
          await tx`DELETE FROM incident_events WHERE id=ANY(${Array.from({ length: p.incidents }, (_, i) => id("event", i))}::uuid[])`;
          await tx`DELETE FROM incidents WHERE id=ANY(${Array.from({ length: p.incidents }, (_, i) => id("incident", i))}::uuid[])`;
          await tx`DELETE FROM alerts WHERE id=ANY(${Array.from({ length: p.alerts + 2 }, (_, i) => id("alert", i))}::uuid[])`;
          await tx`DELETE FROM collars WHERE id=ANY(${Array.from({ length: 4 }, (_, i) => id("collar", i))}::uuid[])`;
          await tx`DELETE FROM patrol_sessions WHERE id=ANY(${Array.from({ length: p.patrols }, (_, i) => id("session", i))}::uuid[])`;
          await tx`DELETE FROM patrol_assignments WHERE id=ANY(${Array.from({ length: p.patrols }, (_, i) => id("assignment", i))}::uuid[])`;
          await tx`DELETE FROM patrol_routes WHERE id=${id("route")}`;
          await tx`DELETE FROM settlements WHERE id=ANY(${Array.from({ length: 6 }, (_, i) => id("settlement", i))}::uuid[])`;
          // Reference configuration is retained: it may already underpin saved report snapshots.
          results.push({ park: p.code, removed: true });
          continue;
        }
        await tx`UPDATE parks SET boundary=COALESCE(boundary,ST_Multi(ST_MakeEnvelope(${p.lon - 0.06},${p.lat - 0.05},${p.lon + 0.06},${p.lat + 0.05},4326))),
    config=COALESCE(config,'{}'::jsonb) || jsonb_build_object('analytics',COALESCE(config->'analytics',${JSON.stringify({ gridCellMeters: p.size, trackBufferMeters: p.code === "YALA" ? 75 : p.code === "SINHARAJA" ? 25 : 50, gapNeglectDays: p.code === "SINHARAJA" ? 21 : 14 })}::text::jsonb), 'analyticsDemo',jsonb_build_object('since','2026-04-11','boundaryLabel','Approximate synthetic demo boundary')) WHERE id=${park.id}`;
        for (let i = 0; i < 5; i++)
          await tx`INSERT INTO analysis_sectors(id,park_id,code,name,kind,area) VALUES(${id("sector", i)},${park.id},${"M4_DEMO_" + i},${p.code === "YALA" ? sectorNames[i] : p.code + " sector " + (i + 1)},'SECTOR',ST_Multi(ST_MakeEnvelope(${p.lon - 0.06 + i * 0.024},${p.lat - 0.05},${p.lon - 0.036 + i * 0.024},${p.lat + 0.05},4326))) ON CONFLICT DO NOTHING`;
        const stretchNames = [
          "Galge Stretch",
          "Palatupana Gate Stretch",
          "Kataragama Fringe",
          "Buttala Fringe",
        ];
        for (let i = 0; i < 4; i++)
          await tx`INSERT INTO analysis_sectors(id,park_id,code,name,kind,area) VALUES(${id("stretch", i)},${park.id},${"M4_EDGE_" + i},${p.code === "YALA" ? stretchNames[i] : p.code + " boundary " + (i + 1)},'BOUNDARY_STRETCH',ST_Multi(ST_MakeEnvelope(${p.lon - 0.06 + i * 0.03},${p.lat - 0.06},${p.lon - 0.03 + i * 0.03},${p.lat - 0.035},4326))) ON CONFLICT DO NOTHING`;
        const [settings] = await tx<
          { config: { analytics?: unknown } }[]
        >`SELECT config FROM parks WHERE id=${park.id}`;
        const config = ParkAnalyticsConfigSchema.parse(
          settings.config.analytics ?? {},
        );
        const cells = await buildGrid(tx, park.id, config.gridCellMeters);
        for (let i = 0; i < p.incidents; i++) {
          const type = categories[i % 7];
          const community = i % 3 === 0;
          const unresolved = community && i % 12 === 0;
          const rejected = i % 20 === 0;
          const time = new Date(anchor - (1 + ((i * 17) % 179)) * DAY);
          const x = p.lon - 0.05 + (i % 4) * 0.025 + (i % 5) * 0.001;
          const y = p.lat - 0.04 + (i % 9) * 0.006;
          await tx`INSERT INTO incidents(id,park_id,reporter_id,type,status,description,location,source,location_status,captured_at,reported_at)
      VALUES(${id("incident", i)},${park.id},${community ? null : ranger.id},${type},${rejected ? "REJECTED" : "NEW"},${"[Demo data] M4 synthetic observation " + i},
      ${unresolved ? tx`NULL` : tx`ST_SetSRID(ST_MakePoint(${x},${y}),4326)`},${community ? "COMMUNITY" : i % 3 === 1 ? "RANGER" : "CAMERA_TRAP"},${unresolved ? "UNRESOLVED" : "MANUAL"},${time},${time}) ON CONFLICT DO NOTHING`;
          await tx`INSERT INTO incident_events(id,incident_id,actor_id,event_type,new_status,notes,created_at) VALUES(${id("event", i)},${id("incident", i)},${manager.id},${rejected ? "INCIDENT_REJECTED" : "INCIDENT_CREATED"},${rejected ? "REJECTED" : "NEW"},'[Demo data] Synthetic fixture',${time}) ON CONFLICT DO NOTHING`;
        }
        await tx`INSERT INTO patrol_routes(id,park_id,code,name,sector,estimated_distance_m,route_geometry) VALUES(${id("route")},${park.id},'M4_DEMO_ROUTE','[Demo data] Analytics patrol','Palatupana Corridor',1500,ST_GeomFromText(${"LINESTRING(" + (p.lon - 0.025) + " " + p.lat + "," + (p.lon - 0.015) + " " + p.lat + ")"},4326)) ON CONFLICT DO NOTHING`;
        for (let i = 0; i < p.patrols; i++) {
          const start = new Date(anchor - (1 + i * 3) * DAY),
            end = new Date(start.getTime() + 300000);
          await tx`INSERT INTO patrol_assignments(id,route_id,route_version,ranger_id,assigned_by,status,assigned_at) VALUES(${id("assignment", i)},${id("route")},1,${ranger.id},${manager.id},'COMPLETED',${start}) ON CONFLICT DO NOTHING`;
          await tx`INSERT INTO patrol_sessions(id,assignment_id,status,started_at,ended_at,distance_m) VALUES(${id("session", i)},${id("assignment", i)},'COMPLETED',${start},${end},1100) ON CONFLICT DO NOTHING`;
          for (let j = 0; j < 6; j++)
            await tx`INSERT INTO patrol_gps_points(client_record_id,session_id,position,accuracy_m,recorded_at) VALUES(${id("gps", i * 6 + j)},${id("session", i)},ST_SetSRID(ST_MakePoint(${p.lon - 0.025 + j * 0.002},${p.lat + (i % 4) * 0.001}),4326),10,${new Date(start.getTime() + j * 60000)}) ON CONFLICT DO NOTHING`;
        }
        for (let i = 0; i < 4; i++)
          await tx`INSERT INTO collars(id,park_id,animal_name,species,status) VALUES(${id("collar", i)},${park.id},${"[Demo data] Elephant " + i},'Elephant','ACTIVE') ON CONFLICT DO NOTHING`;
        for (let i = 0; i < p.alerts + 2; i++)
          await tx`INSERT INTO alerts(id,park_id,collar_id,type,severity,status,location,created_at) VALUES(${id("alert", i)},${park.id},${id("collar", i % 4)},${i < p.alerts ? "GEOFENCE_BREACH" : i === p.alerts ? "LOW_BATTERY" : "SIGNAL_LOST"},'HIGH','NEW',ST_SetSRID(ST_MakePoint(${p.lon - 0.055 + (i % 4) * 0.03},${p.lat - 0.045}),4326),${new Date(anchor - (10 + ((i * 3) % 70)) * DAY)}) ON CONFLICT DO NOTHING`;
        for (let i = 0; i < 6; i++)
          await tx`INSERT INTO settlements(id,park_id,name,location) VALUES(${id("settlement", i)},${park.id},${"[Demo data] Village " + i},ST_SetSRID(ST_MakePoint(${p.lon - 0.05 + i * 0.02},${p.lat - 0.052}),4326)) ON CONFLICT DO NOTHING`;
        results.push({
          park: p.code,
          cells,
          incidents: p.incidents,
          patrols: p.patrols,
          breaches: p.alerts,
        });
      }
      return results;
    });
  } finally {
    await sql.end();
  }
}
