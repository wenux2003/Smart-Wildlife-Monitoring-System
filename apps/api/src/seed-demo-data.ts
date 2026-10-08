/**
 * Sample (synthetic) demo data for every business table.
 *
 *   corepack pnpm db:seed:demo            add the sample data (safe to repeat)
 *   corepack pnpm db:seed:demo --remove   delete exactly the rows this script added
 *
 * Every row gets a deterministic UUID derived from a fixed key, and all random
 * choices come from a seeded generator. Re-running therefore inserts nothing new
 * (ON CONFLICT DO NOTHING), and --remove can recompute and delete the same IDs.
 * Times are anchored to ANCHOR so the six-month history is stable between runs.
 *
 * Accounts, sessions and the account audit log are not touched: the seeded demo
 * accounts from `db:seed` are looked up by email and reused.
 */
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import postgres from "postgres";

const ANCHOR = Date.parse("2026-10-08T06:30:00Z"); // 8 Oct 2026, 12:00 Asia/Colombo
const HISTORY_DAYS = 180;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MINUTE = 60_000;
const COLOMBO_OFFSET = 5.5 * HOUR;
const DEMO = "[Demo data]";

type LonLat = [number, number];
type Row = Record<string, unknown>;

// ---------------------------------------------------------------- helpers

/** Deterministic RFC 4122 version-5-style UUID from a key. */
function demoId(key: string): string {
  const h = createHash("sha1").update(`wana-rakshaka-demo-v1:${key}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/** mulberry32: small, fast, deterministic PRNG. */
function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (min: number, max: number) => min + next() * (max - min);
  const int = (min: number, max: number) => Math.floor(between(min, max + 1));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  const chance = (p: number) => next() < p;
  const gaussian = () => {
    const u = Math.max(next(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  const weighted = <T>(entries: readonly (readonly [T, number])[]): T => {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = next() * total;
    for (const [value, w] of entries) if ((r -= w) <= 0) return value;
    return entries[entries.length - 1]![0];
  };
  return { next, between, int, pick, chance, gaussian, weighted };
}
type Random = ReturnType<typeof createRandom>;

const iso = (ms: number) => new Date(ms).toISOString();

/** A moment `daysAgo` days before the anchor day, at a Colombo wall-clock time. */
function colomboTime(daysAgo: number, hour: number, minute = 0): number {
  const anchorDayStartUtc = Math.floor((ANCHOR + COLOMBO_OFFSET) / DAY) * DAY - COLOMBO_OFFSET;
  return anchorDayStartUtc - daysAgo * DAY + hour * HOUR + minute * MINUTE;
}

/** Move a point by metres east/north. */
function offset([lon, lat]: LonLat, eastM: number, northM: number): LonLat {
  const dLat = northM / 111_320;
  const dLon = eastM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [round6(lon + dLon), round6(lat + dLat)];
}
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function distanceM([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const r = 6_371_000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

const pathLength = (path: LonLat[]) =>
  path.slice(1).reduce((sum, p, i) => sum + distanceM(path[i]!, p), 0);

/** Point at `fraction` (0..1) of the way along a polyline. */
function along(path: LonLat[], fraction: number): LonLat {
  const target = pathLength(path) * Math.min(Math.max(fraction, 0), 1);
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = distanceM(path[i - 1]!, path[i]!);
    if (walked + seg >= target) {
      const t = seg === 0 ? 0 : (target - walked) / seg;
      const [x1, y1] = path[i - 1]!;
      const [x2, y2] = path[i]!;
      return [round6(x1 + (x2 - x1) * t), round6(y1 + (y2 - y1) * t)];
    }
    walked += seg;
  }
  return path[path.length - 1]!;
}

const lineWkt = (path: LonLat[]) => `LINESTRING(${path.map(([x, y]) => `${x} ${y}`).join(",")})`;
function boxWkt([lon, lat]: LonLat, halfWidthM: number, halfHeightM: number): string {
  const sw = offset([lon, lat], -halfWidthM, -halfHeightM);
  const ne = offset([lon, lat], halfWidthM, halfHeightM);
  return `POLYGON((${sw[0]} ${sw[1]},${ne[0]} ${sw[1]},${ne[0]} ${ne[1]},${sw[0]} ${ne[1]},${sw[0]} ${sw[1]}))`;
}
function boxRing([lon, lat]: LonLat, halfWidthM: number, halfHeightM: number): LonLat[] {
  const sw = offset([lon, lat], -halfWidthM, -halfHeightM);
  const ne = offset([lon, lat], halfWidthM, halfHeightM);
  return [[sw[0], sw[1]], [ne[0], sw[1]], [ne[0], ne[1]], [sw[0], ne[1]], [sw[0], sw[1]]];
}

// ---------------------------------------------------------------- PNG images

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Small RGB PNG as a data URL, drawn pixel by pixel by `paint`. Passes ImageDataSchema. */
function pngDataUrl(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): string {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      raw.set([r, g, b], row + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit, truecolour
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** Field photo placeholder: landscape gradient with a coloured subject block per category. */
function fieldPhoto(rng: Random, subject: [number, number, number]): string {
  const cx = rng.int(30, 66), cy = rng.int(34, 50), rx = rng.int(10, 20), ry = rng.int(6, 12);
  return pngDataUrl(96, 72, (x, y) => {
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) return subject;
    return y < 26 ? [196 - y, 222 - y, 236] : [70 + (y % 7), 110 + ((x + y) % 11), 60];
  });
}

/** Camera-trap night frame: green-tinted noise with a dark silhouette. */
function trapFrame(rng: Random, kind: "animal" | "person" | "empty"): string {
  const cx = rng.int(28, 68);
  return pngDataUrl(96, 72, (x, y) => {
    const noise = Math.floor(rng.next() * 30);
    const animal = kind === "animal" && ((x - cx) / 18) ** 2 + ((y - 46) / 10) ** 2 <= 1;
    const person = kind === "person" && Math.abs(x - cx) <= 4 && y >= 24 && y <= 62;
    if (animal || person) return [12, 30 + noise / 3, 14];
    return [30 + noise, 90 + noise * 2, 40 + noise];
  });
}

// ---------------------------------------------------------------- park profiles

type Hotspot = { name: string; centre: LonLat; spreadM: number; types: readonly (readonly [string, number])[]; trend: "rising" | "steady" | "harvest" };
type RouteSpec = { code: string; name: string; sector: string; path: LonLat[]; weight: number; onlyOlderThanDays?: number };
type ParkProfile = {
  code: "YALA" | "WILPATTU" | "SINHARAJA";
  seed: number;
  incidents: number;
  sessionsPerRanger: number;
  landmarks: { name: string; at: LonLat }[];
  unknownPlaces: string[];
  settlements: { name: string; at: LonLat }[];
  traps: { name: string; at: LonLat }[];
  hotspots: Hotspot[];
  routes: RouteSpec[];
  existingRouteCodes: { code: string; weight: number; onlyOlderThanDays?: number }[];
  collars: { name: string; species: string; home: LonLat; battery: number }[];
  geofences: { name: string; centre: LonLat; halfW: number; halfH: number; severity: "HIGH" | "CRITICAL" }[];
  alerts: number;
  cameraImages: number;
};

const ELEPHANT = "Sri Lankan elephant (Elephas maximus maximus)";
const LEOPARD = "Sri Lankan leopard (Panthera pardus kotiya)";

const PROFILES: ParkProfile[] = [
  {
    code: "YALA",
    seed: 37,
    incidents: 150,
    sessionsPerRanger: 12,
    landmarks: [
      { name: "Palatupana entrance", at: [81.412, 6.336] },
      { name: "Katagamuwa entrance", at: [81.364, 6.43] },
      { name: "Menik Ganga bridge", at: [81.49, 6.41] },
      { name: "Buttala road junction", at: [81.38, 6.5] },
    ],
    unknownPlaces: ["behind the old school in the village", "near Sunil's chena plot", "the tank bund past the temple", "close to the broken culvert"],
    settlements: [
      { name: "Kataragama", at: [81.333, 6.413] },
      { name: "Katagamuwa", at: [81.345, 6.435] },
      { name: "Palatupana", at: [81.39, 6.33] },
      { name: "Galge", at: [81.42, 6.54] },
      { name: "Yudaganawa", at: [81.36, 6.52] },
      { name: "Thissamaharama", at: [81.29, 6.28] },
    ],
    traps: [
      { name: "CT-01 Menik Ganga ford", at: [81.495, 6.405] },
      { name: "CT-02 Southern Ridge salt lick", at: [81.52, 6.37] },
      { name: "CT-03 Palatupana track", at: [81.43, 6.35] },
      { name: "CT-04 Patanangala dunes", at: [81.55, 6.352] },
      { name: "CT-05 Katagamuwa tank", at: [81.38, 6.425] },
    ],
    hotspots: [
      { name: "Southern Ridge", centre: [81.522, 6.368], spreadM: 700, trend: "rising", types: [["SNARE_FOUND", 5], ["POACHING", 4], ["INJURED_ANIMAL", 1]] },
      { name: "Menik Ganga", centre: [81.49, 6.405], spreadM: 900, trend: "steady", types: [["SNARE_FOUND", 4], ["POACHING", 2], ["INJURED_ANIMAL", 2], ["OTHER", 1]] },
      { name: "Katagamuwa Fringe", centre: [81.372, 6.432], spreadM: 900, trend: "harvest", types: [["HUMAN_WILDLIFE_CONFLICT", 4], ["CROP_DAMAGE", 4], ["FENCE_DAMAGE", 2]] },
      { name: "Galge Fringe", centre: [81.415, 6.525], spreadM: 1000, trend: "harvest", types: [["HUMAN_WILDLIFE_CONFLICT", 3], ["CROP_DAMAGE", 3], ["FENCE_DAMAGE", 3]] },
    ],
    routes: [
      { code: "YALA_MENIK_LOOP", name: "Menik Ganga Loop", sector: "Menik Ganga", weight: 30, path: [[81.478, 6.398], [81.486, 6.404], [81.494, 6.409], [81.5, 6.415], [81.492, 6.42]] },
      { code: "YALA_KATAGAMUWA", name: "Katagamuwa Fringe Patrol", sector: "Katagamuwa Fringe", weight: 30, path: [[81.36, 6.425], [81.367, 6.43], [81.375, 6.434], [81.384, 6.438], [81.39, 6.444]] },
      { code: "YALA_PATANANGALA", name: "Patanangala Coast Walk", sector: "Patanangala Coast", weight: 20, path: [[81.535, 6.348], [81.543, 6.351], [81.551, 6.353], [81.559, 6.357]] },
    ],
    existingRouteCodes: [
      { code: "YALA_TRAIL_3A", weight: 15 },
      // Southern Ridge is deliberately under-patrolled recently: it is the demo's "priority" hotspot.
      { code: "YALA_TRAIL_4B", weight: 5, onlyOlderThanDays: 60 },
    ],
    collars: [
      { name: "Gemunu", species: ELEPHANT, home: [81.37, 6.44], battery: 64 },
      { name: "Kandula", species: ELEPHANT, home: [81.41, 6.52], battery: 41 },
      { name: "Sakura", species: ELEPHANT, home: [81.49, 6.41], battery: 88 },
      { name: "Raja", species: ELEPHANT, home: [81.45, 6.47], battery: 17 },
      { name: "Leela", species: LEOPARD, home: [81.52, 6.375], battery: 72 },
    ],
    geofences: [
      { name: "Katagamuwa village farmland", centre: [81.347, 6.437], halfW: 1300, halfH: 900, severity: "HIGH" },
      { name: "Galge paddy fields", centre: [81.418, 6.545], halfW: 1500, halfH: 800, severity: "HIGH" },
      { name: "Kataragama road corridor", centre: [81.34, 6.4], halfW: 2500, halfH: 250, severity: "CRITICAL" },
    ],
    alerts: 45,
    cameraImages: 24,
  },
  {
    code: "WILPATTU",
    seed: 38,
    incidents: 30,
    sessionsPerRanger: 5,
    landmarks: [
      { name: "Hunuwilagama entrance", at: [80.07, 8.36] },
      { name: "Kala Oya bridge", at: [79.95, 8.29] },
    ],
    unknownPlaces: ["near the abandoned well", "past the coconut estate gate"],
    settlements: [
      { name: "Pomparippu", at: [79.88, 8.27] },
      { name: "Hunuwilagama", at: [80.09, 8.36] },
      { name: "Eluwankulama", at: [79.86, 8.28] },
    ],
    traps: [
      { name: "CT-W1 Kokmote villu", at: [79.98, 8.48] },
      { name: "CT-W2 Maradanmaduwa", at: [80.02, 8.4] },
    ],
    hotspots: [
      { name: "Kala Oya Basin", centre: [79.96, 8.3], spreadM: 900, trend: "steady", types: [["SNARE_FOUND", 4], ["POACHING", 3]] },
      { name: "Kokmote Villu", centre: [79.98, 8.48], spreadM: 900, trend: "rising", types: [["POACHING", 3], ["SNARE_FOUND", 2]] },
      { name: "Eluwankulama Border", centre: [79.88, 8.29], spreadM: 800, trend: "harvest", types: [["HUMAN_WILDLIFE_CONFLICT", 3], ["FENCE_DAMAGE", 2]] },
    ],
    routes: [
      { code: "WIL_KALA_OYA", name: "Kala Oya Basin Sweep", sector: "Kala Oya Basin", weight: 50, path: [[79.94, 8.295], [79.952, 8.3], [79.965, 8.304], [79.976, 8.31]] },
      { code: "WIL_MARADAN", name: "Maradanmaduwa Track", sector: "Maradanmaduwa", weight: 50, path: [[80.01, 8.39], [80.017, 8.397], [80.025, 8.405], [80.03, 8.414]] },
    ],
    existingRouteCodes: [],
    collars: [
      { name: "Wiraya", species: ELEPHANT, home: [79.9, 8.3], battery: 58 },
      { name: "Kali", species: LEOPARD, home: [80.0, 8.43], battery: 81 },
    ],
    geofences: [{ name: "Eluwankulama farmland", centre: [79.865, 8.285], halfW: 1200, halfH: 900, severity: "HIGH" }],
    alerts: 10,
    cameraImages: 6,
  },
  {
    code: "SINHARAJA",
    seed: 39,
    incidents: 30,
    sessionsPerRanger: 5,
    landmarks: [
      { name: "Kudawa entrance", at: [80.418, 6.433] },
      { name: "Pitadeniya entrance", at: [80.52, 6.385] },
    ],
    unknownPlaces: ["near the tea smallholding above the stream", "by the old logging road"],
    settlements: [
      { name: "Kudawa", at: [80.415, 6.44] },
      { name: "Weddagala", at: [80.43, 6.455] },
      { name: "Deniyaya", at: [80.56, 6.345] },
    ],
    traps: [
      { name: "CT-S1 Sinhagala trail", at: [80.47, 6.41] },
      { name: "CT-S2 Moulawella ridge", at: [80.43, 6.418] },
      { name: "CT-S3 Pitadeniya stream", at: [80.51, 6.39] },
    ],
    hotspots: [
      { name: "Kudawa Edge", centre: [80.425, 6.428], spreadM: 600, trend: "steady", types: [["OTHER", 3], ["POACHING", 2], ["FENCE_DAMAGE", 1]] },
      { name: "Pitadeniya Stream", centre: [80.508, 6.392], spreadM: 600, trend: "rising", types: [["SNARE_FOUND", 3], ["INJURED_ANIMAL", 2], ["OTHER", 2]] },
    ],
    routes: [
      { code: "SIN_MOULAWELLA", name: "Moulawella Ridge Trail", sector: "Moulawella Ridge", weight: 50, path: [[80.42, 6.43], [80.426, 6.425], [80.432, 6.419], [80.438, 6.414]] },
      { code: "SIN_PITADENIYA", name: "Pitadeniya Stream Walk", sector: "Pitadeniya Stream", weight: 50, path: [[80.52, 6.386], [80.513, 6.389], [80.506, 6.393], [80.5, 6.398]] },
    ],
    existingRouteCodes: [],
    collars: [],
    geofences: [],
    alerts: 0,
    cameraImages: 6,
  },
];

const DESCRIPTIONS: Record<string, string[]> = {
  POACHING: ["Fresh poacher camp with fire remains and spent cartridges.", "Gunshot heard at dusk; tracks of two people heading to the boundary.", "Hide made of branches overlooking the water hole."],
  SNARE_FOUND: ["Wire snare set on a game trail; removed and photographed.", "Cluster of three cable snares near the salt lick.", "Snare line along the stream bank, two snares removed."],
  INJURED_ANIMAL: ["Spotted deer limping with a wire wound on the foreleg.", "Young elephant with a swollen leg near the tank.", "Sambar with a snare wound; vet team informed."],
  FENCE_DAMAGE: ["Electric fence post broken, wires on the ground for 30 m.", "Fence shorted by fallen branches after rain.", "Section of fence pushed down by elephants overnight."],
  HUMAN_WILDLIFE_CONFLICT: ["Elephant herd entered the village after dark; residents scared.", "Lone tusker near houses, firecrackers used to move it away.", "Elephants crossing the road at night near the tank."],
  CROP_DAMAGE: ["Paddy field trampled by elephants overnight.", "Banana and maize plots raided by a herd of five.", "Chena cultivation damaged; villagers request a patrol."],
  OTHER: ["Illegal timber stack found off the trail.", "Plastic waste dumped near the visitor track.", "Unregistered vehicle seen on the service road."],
};
/**
 * Community report text exactly as M1 would have received it (incidents/service.ts `community`).
 * SMS uses `KEYWORD description @ landmark`, and its keywords can only produce human–wildlife
 * conflict, poaching or injured animal. Crop and fence damage can only come from the basic public
 * form, which stores the description as the raw text and is never NEEDS_INFO.
 */
function communityMessage(type: string, incident: Row, place: string, drawnState: "RECEIVED" | "NEEDS_INFO" | "FOLLOW_UP_SENT") {
  const text = String(incident.description).replace(`${DEMO} `, "");
  if (type !== "HUMAN_WILDLIFE_CONFLICT")
    return { viaSms: false, rawText: text, locationText: place, state: drawnState === "NEEDS_INFO" ? "RECEIVED" : drawnState };
  if (drawnState === "NEEDS_INFO") {
    // The villager left out "@ place", so M1 stores no location text and asks for more details.
    incident.location_text = "";
    return { viaSms: true, rawText: `ELEPHANT ${text}`, locationText: "", state: drawnState };
  }
  return { viaSms: true, rawText: `ELEPHANT ${text} @ ${place}`, locationText: place, state: drawnState };
}

/** Fresh SMS sent through the real API, so the automated intake path is visible in the inbox. */
const LIVE_SMS = [
  { id: "01", text: "ELEPHANT herd crossing into the paddy fields @ Galge entrance" },
  { id: "02", text: "ELEPHANT tusker standing near the houses @ Katagamuwa entrance" },
  { id: "03", text: "POACHING gunshots heard after dark @ Menik Ganga bridge" },
  { id: "04", text: "INJURED spotted deer with wire on its leg @ Palatupana entrance" },
  { id: "05", text: "ELEPHANT fence pushed down by elephants @ behind the old school" },
  { id: "06", text: "elephants ate my maize near the tank last night" },
];
const OUTCOMES: Record<string, string[]> = {
  POACHING: ["Camp dismantled; evidence handed to the station.", "Area searched with two units; no suspects found, patrols increased."],
  SNARE_FOUND: ["All snares removed and logged; area added to weekly sweep.", "Snares removed; nearby trails checked, no more found."],
  INJURED_ANIMAL: ["Vet team treated the animal on site.", "Animal monitored; wound healing, no intervention needed."],
  FENCE_DAMAGE: ["Fence repaired by the maintenance crew.", "Damaged section rebuilt and tested."],
  HUMAN_WILDLIFE_CONFLICT: ["Herd driven back to the forest; no injuries.", "Team stayed overnight; elephants moved away before dawn."],
  CROP_DAMAGE: ["Damage recorded for compensation; elephants moved back to the park.", "Liaison officer visited; compensation form submitted."],
  OTHER: ["Item removed and reported.", "Logged and passed to the park office."],
};
const WAYPOINT_NOTES: Record<string, string[]> = {
  WILDLIFE_SIGN: ["Leopard pugmarks on the sand track.", "Fresh elephant dung and footprints.", "Sloth bear claw marks on a tree."],
  HAZARD_SNARE: ["Old snare wire found and removed.", "Suspicious cut branches near the trail."],
  TRAIL_MARKER: ["Trail marker post replaced.", "Water hole level low."],
  OTHER: ["Visitor vehicle off the track; advised.", "Fallen tree blocking the trail."],
};

// ---------------------------------------------------------------- data building

type Ctx = {
  parkId: string;
  manager: string;
  verifier: string; // liaison officer if the park has one, otherwise the manager
  liaison: string | null;
  rangers: string[];
  existingRoutes: Map<string, { id: string; version: number; path: LonLat[] }>;
};

type Dataset = {
  landmarks: Row[]; settlements: Row[]; traps: Row[]; rangerLocations: Row[];
  routes: Row[]; assignments: Row[]; sessions: Row[]; gpsPoints: Row[]; waypoints: Row[];
  collars: Row[]; pings: Row[]; alerts: Row[]; dispatches: Row[];
  incidents: Row[]; events: Row[]; reviews: Row[]; media: Row[];
  messages: Row[]; followUps: Row[]; cameraImages: Row[];
  geofenceConfig: unknown | null;
};

function emptyDataset(): Dataset {
  return {
    landmarks: [], settlements: [], traps: [], rangerLocations: [], routes: [], assignments: [],
    sessions: [], gpsPoints: [], waypoints: [], collars: [], pings: [], alerts: [], dispatches: [],
    incidents: [], events: [], reviews: [], media: [], messages: [], followUps: [], cameraImages: [],
    geofenceConfig: null,
  };
}

/** Month weight so trends have a shape: rising, steady, or a harvest-season (Aug–Sep) peak. */
function trendWeight(trend: Hotspot["trend"], daysAgo: number): number {
  if (trend === "rising") return 0.4 + 1.6 * (1 - daysAgo / HISTORY_DAYS);
  if (trend === "harvest") {
    const month = new Date(ANCHOR - daysAgo * DAY).getUTCMonth(); // 0 = Jan
    return month === 7 || month === 8 ? 2.6 : month === 6 || month === 9 ? 1.3 : 0.6;
  }
  return 1;
}

function pickDaysAgo(rng: Random, trend: Hotspot["trend"]): number {
  for (;;) {
    const d = rng.between(0.05, HISTORY_DAYS);
    if (rng.next() * 2.6 <= trendWeight(trend, d)) return d;
  }
}

function buildPark(profile: ParkProfile, ctx: Ctx, out: Dataset) {
  const rng = createRandom(profile.seed);
  const k = (key: string) => demoId(`${profile.code}:${key}`);

  // Reference points ---------------------------------------------------
  for (const l of profile.landmarks)
    out.landmarks.push({ id: k(`landmark:${l.name}`), park_id: ctx.parkId, name: l.name, lat: l.at[1], lon: l.at[0] });
  for (const s of profile.settlements)
    out.settlements.push({ id: k(`settlement:${s.name}`), park_id: ctx.parkId, name: s.name, lon: s.at[0], lat: s.at[1] });
  for (const t of profile.traps)
    out.traps.push({ id: k(`trap:${t.name}`), park_id: ctx.parkId, name: t.name, lon: t.at[0], lat: t.at[1] });

  // Patrols -------------------------------------------------------------
  type RouteChoice = { id: string; version: number; path: LonLat[]; weight: number; onlyOlderThanDays?: number };
  const choices: RouteChoice[] = [];
  for (const r of profile.routes) {
    const id = k(`route:${r.code}`);
    const mid = along(r.path, 0.5);
    const len = pathLength(r.path);
    out.routes.push({
      id, park_id: ctx.parkId, code: r.code, name: r.name, sector: r.sector,
      description: `${DEMO} ${r.name} through the ${r.sector} sector.`,
      route_wkt: lineWkt(r.path), target_wkt: boxWkt(mid, len / 2 + 400, 700),
      estimated_distance_m: Math.round(len),
    });
    choices.push({ id, version: 1, path: r.path, weight: r.weight });
  }
  for (const e of profile.existingRouteCodes) {
    const existing = ctx.existingRoutes.get(e.code);
    if (existing) choices.push({ ...existing, weight: e.weight, onlyOlderThanDays: e.onlyOlderThanDays });
  }

  ctx.rangers.forEach((rangerId, rangerIndex) => {
    for (let n = 0; n < profile.sessionsPerRanger; n++) {
      const daysAgo = Math.max(1, Math.round(((n + rng.next()) / profile.sessionsPerRanger) * (HISTORY_DAYS - 2)) + 1);
      const eligible = choices.filter((c) => !c.onlyOlderThanDays || daysAgo > c.onlyOlderThanDays);
      const route = rng.weighted(eligible.map((c) => [c, c.weight] as const));
      const key = `patrol:${rangerIndex}:${n}`;
      const start = colomboTime(daysAgo, rng.int(6, 14), rng.int(0, 59));
      const partial = rng.chance(0.15);
      const reach = partial ? rng.between(0.4, 0.7) : 1;
      const minutes = Math.round(rng.between(90, 220) * reach);
      const end = start + minutes * MINUTE;
      const reverse = rng.chance(0.5);
      const path = reverse ? [...route.path].reverse() : route.path;

      const assignmentId = k(`${key}:assignment`);
      const sessionId = k(`${key}:session`);
      out.assignments.push({
        id: assignmentId, route_id: route.id, route_version: route.version, ranger_id: rangerId,
        assigned_by: ctx.manager, status: partial ? "PARTIAL" : "COMPLETED", revision: 3,
        assigned_at: iso(start - rng.int(4, 40) * HOUR),
      });

      let distance = 0;
      let previous: LonLat | null = null;
      const stepMinutes = 3;
      const steps = Math.max(2, Math.floor(minutes / stepMinutes));
      for (let s = 0; s <= steps; s++) {
        const base = along(path, (s / steps) * reach);
        const point = offset(base, rng.gaussian() * 12, rng.gaussian() * 12);
        if (previous) distance += distanceM(previous, point);
        previous = point;
        out.gpsPoints.push({
          client_record_id: k(`${key}:gps:${s}`), session_id: sessionId, lon: point[0], lat: point[1],
          // An occasional poor fix, so analytics can show dropped points.
          accuracy_m: rng.chance(0.04) ? Math.round(rng.between(120, 300)) : Math.round(rng.between(4, 28)),
          recorded_at: iso(start + s * stepMinutes * MINUTE),
        });
      }
      out.sessions.push({
        id: sessionId, assignment_id: assignmentId, status: partial ? "PARTIAL" : "COMPLETED", revision: 3,
        started_at: iso(start), ended_at: iso(end),
        termination_reason: partial ? rng.pick(["LOW_BATTERY", "WEATHER", "ELEPHANT_HERD_ON_TRAIL"]) : null,
        distance_m: Math.round(distance), coverage_percent: partial ? Math.round(reach * 90) : rng.int(82, 98),
      });

      const waypointCount = rng.int(0, 3);
      for (let w = 0; w < waypointCount; w++) {
        const category = rng.weighted([["WILDLIFE_SIGN", 5], ["HAZARD_SNARE", 2], ["TRAIL_MARKER", 2], ["OTHER", 1]] as const);
        const at = offset(along(path, rng.between(0.1, 0.9) * reach), rng.gaussian() * 20, rng.gaussian() * 20);
        out.waypoints.push({
          client_record_id: k(`${key}:waypoint:${w}`), session_id: sessionId, category,
          note: `${DEMO} ${rng.pick(WAYPOINT_NOTES[category]!)}`, lon: at[0], lat: at[1],
          accuracy_m: rng.int(5, 25), observed_at: iso(start + rng.between(0.1, 0.9) * minutes * MINUTE),
        });
      }
    }

    // One upcoming assignment per ranger, so the Ranger app home has something to start.
    const upcoming = rangerIndex === 0 && profile.code === "YALA"
      ? choices.find((c) => c.onlyOlderThanDays) ?? choices[0]!
      : choices[rangerIndex % choices.length]!;
    out.assignments.push({
      id: k(`patrol:${rangerIndex}:upcoming`), route_id: upcoming.id, route_version: upcoming.version,
      ranger_id: rangerId, assigned_by: ctx.manager, status: "ASSIGNED", revision: 1,
      assigned_at: iso(ANCHOR - rng.int(1, 5) * HOUR),
    });

    // Last known position (used by "nearest available ranger" in alerts).
    const lastAt = along(choices[rangerIndex % choices.length]!.path, rng.next());
    out.rangerLocations.push({ ranger_id: rangerId, lon: lastAt[0], lat: lastAt[1], updated_at: iso(ANCHOR - rng.int(5, 90) * MINUTE) });
  });

  // Camera traps ----------------------------------------------------------
  const cameraIncidentSources: { imageKey: string; at: LonLat; capturedAt: number; reviewer: string; reviewedAt: number }[] = [];
  for (let i = 0; i < profile.cameraImages; i++) {
    const trap = profile.traps[i % profile.traps.length]!;
    const capturedAt = colomboTime(rng.between(0, 60), rng.pick([1, 2, 3, 4, 19, 21, 23]), rng.int(0, 59));
    const classification = i < Math.ceil(profile.cameraImages / 3)
      ? "PENDING"
      : rng.weighted([["WILDLIFE", 8], ["AUTHORIZED_PERSON", 3], ["SUSPICIOUS_ACTIVITY", 3], ["UNSURE", 2]] as const);
    const personFlag = classification === "AUTHORIZED_PERSON" || classification === "SUSPICIOUS_ACTIVITY" || (classification === "PENDING" && rng.chance(0.3));
    const kind = personFlag ? "person" : rng.chance(0.85) ? "animal" : "empty";
    const reviewed = classification !== "PENDING";
    const reviewer = ctx.verifier;
    const reviewedAt = Math.min(capturedAt + rng.int(2, 30) * HOUR, ANCHOR - HOUR);
    const imageKey = `camera:${i}`;
    out.cameraImages.push({
      id: k(imageKey), park_id: ctx.parkId, captured_at: iso(capturedAt), latitude: trap.at[1], longitude: trap.at[0],
      data_url: trapFrame(rng, kind), person_flag: personFlag, classification,
      reviewer_id: reviewed ? reviewer : null, reviewed_at: reviewed ? iso(reviewedAt) : null,
      resulting_incident_id: classification === "SUSPICIOUS_ACTIVITY" ? k(`${imageKey}:incident`) : null,
      revision: reviewed ? 2 : 1, creation_hash: createHash("sha256").update(k(imageKey)).digest("hex"),
    });
    if (classification === "SUSPICIOUS_ACTIVITY")
      cameraIncidentSources.push({ imageKey, at: trap.at, capturedAt, reviewer, reviewedAt });
  }

  // Incidents -------------------------------------------------------------
  const addIncident = (spec: {
    key: string; type: string; source: "RANGER" | "COMMUNITY" | "CAMERA_TRAP"; capturedAt: number; receivedAt: number;
    reporterId: string | null; reporterPhone: string | null; location: LonLat | null;
    locationStatus: "GPS" | "MANUAL" | "LANDMARK" | "UNRESOLVED"; locationText: string | null; accuracy: number | null;
    description: string; nearAt: LonLat;
  }) => {
    const id = k(spec.key);
    const events: Row[] = [];
    let revision = 1;
    let status = "NEW";
    let location = spec.location;
    let locationStatus = spec.locationStatus;
    let assignedTo: string | null = null, assignedAt: number | null = null;
    let firstResponseAt: number | null = null, resolvedAt: number | null = null, outcome: string | null = null;
    let t = spec.receivedAt;
    const event = (type: string, actor: string | null, from: string | null, to: string | null, notes: string | null) => {
      events.push({ id: k(`${spec.key}:event:${events.length}`), incident_id: id, actor_id: actor, event_type: type, old_status: from, new_status: to, notes, created_at: iso(t) });
    };
    const advance = (minH: number, maxH: number) => {
      t += rng.between(minH, maxH) * HOUR;
      return t < ANCHOR - 10 * MINUTE;
    };
    event("INCIDENT_CREATED", spec.reporterId, null, "NEW", null);

    const ageDays = (ANCHOR - spec.receivedAt) / DAY;
    const goal = ageDays < 2
      ? rng.weighted([["NEW", 6], ["VERIFIED", 2], ["REJECTED", 1]] as const)
      : ageDays < 14
        ? rng.weighted([["NEW", 2], ["VERIFIED", 2], ["ASSIGNED", 2], ["IN_PROGRESS", 2], ["RESOLVED", 3], ["REJECTED", 1]] as const)
        : rng.weighted([["NEW", 1], ["VERIFIED", 1], ["IN_PROGRESS", 1], ["RESOLVED", 12], ["REJECTED", 2]] as const);

    if (goal === "REJECTED") {
      if (advance(1, 20)) {
        event("INCIDENT_REJECTED", ctx.verifier, "NEW", "REJECTED", rng.pick(["Duplicate of an earlier report.", "Could not be confirmed on site.", "Outside the park's responsibility."]));
        status = "REJECTED"; revision++;
      }
    } else if (goal !== "NEW") {
      // A report without a location needs the liaison officer to confirm one before any response.
      if (!location) {
        if (rng.chance(0.65) && advance(1, 18)) {
          location = offset(spec.nearAt, rng.gaussian() * 400, rng.gaussian() * 400);
          locationStatus = "MANUAL";
          event("LOCATION_UPDATED", ctx.verifier, "NEW", "NEW", "Location confirmed by phone with the caller.");
          revision++;
        }
      }
      if (advance(0.5, 12)) {
        event("INCIDENT_VERIFIED", ctx.verifier, "NEW", "VERIFIED", rng.chance(0.5) ? "Verified with the reporter." : null);
        status = "VERIFIED"; revision++;
        if (goal !== "VERIFIED" && advance(0.3, 6)) {
          assignedTo = rng.pick(ctx.rangers); assignedAt = t;
          event("RESPONDER_ASSIGNED", ctx.verifier, "VERIFIED", "VERIFIED", assignedTo);
          revision++;
          if (goal !== "ASSIGNED" && location && advance(0.3, 8)) {
            firstResponseAt = t;
            event("RESPONSE_STARTED", assignedTo, "VERIFIED", "IN_PROGRESS", null);
            status = "IN_PROGRESS"; revision++;
            if (goal === "RESOLVED" && advance(1, 40)) {
              resolvedAt = t; outcome = `${DEMO} ${rng.pick(OUTCOMES[spec.type] ?? OUTCOMES.OTHER!)}`;
              event("INCIDENT_RESOLVED", assignedTo, "IN_PROGRESS", "RESOLVED", outcome);
              status = "RESOLVED"; revision++;
            }
          }
        }
      }
    }

    out.incidents.push({
      id, park_id: ctx.parkId, reporter_id: spec.reporterId, type: spec.type, status, description: `${DEMO} ${spec.description}`,
      lon: location?.[0] ?? null, lat: location?.[1] ?? null, photo_url: null,
      reported_at: iso(spec.receivedAt), created_at: iso(spec.receivedAt), updated_at: iso(t > ANCHOR ? spec.receivedAt : t),
      source: spec.source, location_status: locationStatus, location_text: spec.locationText, location_accuracy: spec.accuracy,
      captured_at: iso(spec.capturedAt), reporter_phone: spec.reporterPhone, revision,
      assigned_to: assignedTo, assigned_at: assignedAt ? iso(assignedAt) : null,
      first_response_at: firstResponseAt ? iso(firstResponseAt) : null, resolved_at: resolvedAt ? iso(resolvedAt) : null,
      outcome_notes: outcome, creation_hash: createHash("sha256").update(id).digest("hex"),
    });
    out.events.push(...events);
    if (status !== "NEW" && status !== "REJECTED" && rng.chance(0.25))
      out.reviews.push({ id: k(`${spec.key}:review`), incident_id: id, reviewer_id: ctx.manager, notes: `${DEMO} Reviewed at the weekly operations meeting.`, created_at: events[1]?.created_at ?? iso(spec.receivedAt) });
    return id;
  };

  const conflictTypes = new Set(["HUMAN_WILDLIFE_CONFLICT", "CROP_DAMAGE", "FENCE_DAMAGE"]);
  for (let i = 0; i < profile.incidents; i++) {
    const hotspot = rng.chance(0.85) ? rng.pick(profile.hotspots) : null;
    const trend = hotspot?.trend ?? "steady";
    const daysAgo = pickDaysAgo(rng, trend);
    const capturedAt = ANCHOR - daysAgo * DAY;
    const type = hotspot ? rng.weighted(hotspot.types) : rng.pick(Object.keys(DESCRIPTIONS));
    const centre = hotspot?.centre ?? rng.pick(profile.traps).at;
    const spread = hotspot?.spreadM ?? 2500;
    const nearAt = offset(centre, rng.gaussian() * spread, rng.gaussian() * spread);
    const fromCommunity = conflictTypes.has(type) && rng.chance(0.6) && ctx.liaison !== null;
    const key = `incident:${i}`;

    if (fromCommunity) {
      const known = rng.chance(0.7);
      const landmark = rng.pick(profile.landmarks);
      const place = known ? landmark.name : rng.pick(profile.unknownPlaces);
      const phone = `+94 70 000 ${String(1000 + rng.int(0, 8999)).padStart(4, "0")}`;
      rng.pick(["unused"]); // keeps the random sequence identical to earlier runs, so no other sample row changes
      const incidentId = addIncident({
        key, type, source: "COMMUNITY", capturedAt, receivedAt: capturedAt + rng.int(1, 20) * MINUTE,
        reporterId: null, reporterPhone: phone,
        location: known ? landmark.at : null, locationStatus: known ? "LANDMARK" : "UNRESOLVED", locationText: place,
        accuracy: null, description: rng.pick(DESCRIPTIONS[type]!), nearAt,
      });
      const drawnState = known ? "RECEIVED" : rng.weighted([["NEEDS_INFO", 1], ["FOLLOW_UP_SENT", 2]] as const);
      const message = communityMessage(type, out.incidents[out.incidents.length - 1]!, place, drawnState);
      const created = out.events.find((e) => e.incident_id === incidentId && e.event_type === "INCIDENT_CREATED");
      if (created) created.notes = message.viaSms ? "Mock SMS received" : "Public form received";
      const messageId = k(`${key}:sms`);
      out.messages.push({
        id: messageId, incident_id: incidentId,
        provider_message_id: message.viaSms ? `demo-sms-${profile.code.toLowerCase()}-${String(i).padStart(4, "0")}` : null,
        phone, raw_text: message.rawText, location_text: message.locationText, state: message.state,
        creation_hash: createHash("sha256").update(messageId).digest("hex"), created_at: iso(capturedAt + MINUTE),
      });
      const state = message.state;
      if (state === "FOLLOW_UP_SENT")
        out.followUps.push({ id: k(`${key}:followup`), message_id: messageId, actor_id: ctx.liaison, text: "Thank you. Please reply with the nearest village, temple or road name so a team can find the place.", sent_at: iso(capturedAt + rng.int(20, 180) * MINUTE), state: "SENT" });
    } else {
      const reporter = rng.pick(ctx.rangers);
      const offlineDelay = rng.chance(0.35) ? rng.between(2, 30) * HOUR : rng.between(1, 15) * MINUTE; // offline reports sync later
      const at = rng.chance(0.06) ? null : nearAt; // a few GPS failures fall back to manual entry
      const incidentId = addIncident({
        key, type, source: "RANGER", capturedAt, receivedAt: Math.min(capturedAt + offlineDelay, ANCHOR - 5 * MINUTE),
        reporterId: reporter, reporterPhone: null,
        location: at ?? offset(nearAt, rng.gaussian() * 150, rng.gaussian() * 150), locationStatus: at ? "GPS" : "MANUAL",
        locationText: at ? null : "Entered manually after GPS lost signal", accuracy: at ? rng.int(4, 30) : null,
        description: rng.pick(DESCRIPTIONS[type]!), nearAt,
      });
      if (rng.chance(0.35)) {
        const colour: Record<string, [number, number, number]> = {
          POACHING: [120, 40, 30], SNARE_FOUND: [150, 150, 160], INJURED_ANIMAL: [140, 100, 70],
          FENCE_DAMAGE: [90, 90, 90], HUMAN_WILDLIFE_CONFLICT: [60, 60, 65], CROP_DAMAGE: [170, 160, 60], OTHER: [110, 80, 50],
        };
        out.media.push({ id: k(`${key}:photo`), incident_id: incidentId, data_url: fieldPhoto(rng, colour[type] ?? [100, 100, 100]), created_at: iso(capturedAt + 2 * MINUTE) });
      }
    }
  }

  for (const c of cameraIncidentSources) {
    addIncident({
      key: `${c.imageKey}:incident`, type: rng.pick(["POACHING", "OTHER"]), source: "CAMERA_TRAP",
      capturedAt: c.capturedAt, receivedAt: c.reviewedAt, reporterId: c.reviewer, reporterPhone: null,
      location: c.at, locationStatus: "MANUAL", locationText: null, accuracy: null,
      description: "Camera trap shows a person carrying a rifle at night.", nearAt: c.at,
    });
  }

  // Collars, pings and alerts ----------------------------------------------
  const collarIds = profile.collars.map((c) => k(`collar:${c.name}`));
  profile.collars.forEach((c, ci) => {
    let at = c.home;
    let battery = Math.min(100, c.battery + 4);
    let last = 0;
    for (let p = 47; p >= 0; p--) {
      const recordedAt = ANCHOR - p * HOUR - rng.int(0, 10) * MINUTE;
      at = offset(at, rng.gaussian() * 250, rng.gaussian() * 250);
      at = offset(at, (c.home[0] - at[0]) * 111_000 * 0.15, (c.home[1] - at[1]) * 111_000 * 0.15); // stay near home range
      battery = Math.max(1, battery - rng.between(0.02, 0.15));
      out.pings.push({ id: k(`collar:${c.name}:ping:${p}`), collar_id: collarIds[ci], lon: at[0], lat: at[1], speed: Math.round(rng.between(0.15, 1.6) * 100) / 100, battery: Math.round(battery * 10) / 10, recorded_at: iso(recordedAt), received_at: iso(recordedAt + rng.int(5, 90) * 1000) });
      last = recordedAt;
    }
    out.collars.push({ id: collarIds[ci], park_id: ctx.parkId, animal_name: c.name, species: c.species, latest_battery: Math.round(battery * 10) / 10, status: "ACTIVE", last_ping_at: iso(last) });
  });

  if (profile.geofences.length) {
    out.geofenceConfig = {
      geofenceCenter: profile.hotspots[0]!.centre,
      geofenceRadiusKm: 20,
      geofenceZones: profile.geofences.map((g) => ({ name: g.name, polygon: boxRing(g.centre, g.halfW, g.halfH), alertOn: "enter", severity: g.severity })),
      immobilitySpeedThreshold: 0.1,
      lowBatteryThreshold: 20,
    };
  }

  const elephants = profile.collars.map((c, i) => ({ ...c, id: collarIds[i]! })).filter((c) => c.species === ELEPHANT);
  for (let i = 0; i < profile.alerts && profile.collars.length; i++) {
    const key = `alert:${i}`;
    const recent = i >= profile.alerts - 4; // the last four are today's live alerts
    const type = recent && i === profile.alerts - 1 ? "LOW_BATTERY" : recent ? "GEOFENCE_BREACH"
      : rng.weighted([["GEOFENCE_BREACH", 32], ["IMMOBILITY", 4], ["LOW_BATTERY", 6], ["SIGNAL_LOST", 3]] as const);
    const collar = type === "GEOFENCE_BREACH" && elephants.length ? rng.pick(elephants) : { ...profile.collars[i % profile.collars.length]!, id: collarIds[i % profile.collars.length]! };
    const zone = profile.geofences.length ? rng.pick(profile.geofences) : null;
    const where = type === "GEOFENCE_BREACH" && zone
      ? offset(zone.centre, rng.gaussian() * zone.halfW * 0.5, rng.gaussian() * zone.halfH * 0.5)
      : offset(collar.home, rng.gaussian() * 600, rng.gaussian() * 600);
    const createdAt = recent ? ANCHOR - rng.between(0.3, 5) * HOUR : ANCHOR - pickDaysAgo(rng, type === "GEOFENCE_BREACH" ? "harvest" : "steady") * DAY;
    const severity = type === "GEOFENCE_BREACH" ? zone?.severity ?? "HIGH" : type === "IMMOBILITY" ? "MEDIUM" : type === "SIGNAL_LOST" ? "MEDIUM" : "LOW";
    const alertId = k(key);
    let status: string;
    let resolvedAt: number | null = null;
    let reason: string | null = null;
    let broadcast = false;

    if (recent) {
      status = i === profile.alerts - 2 ? "ON_SCENE" : "NEW";
      if (status === "ON_SCENE") {
        const ranger = ctx.rangers[ctx.rangers.length - 1]!;
        const sent = createdAt + 4 * MINUTE;
        out.dispatches.push({ id: k(`${key}:dispatch:0`), alert_id: alertId, ranger_id: ranger, status: "ARRIVED", notes: null, revision: 3, sent_at: iso(sent), responded_at: iso(sent + 2 * MINUTE), arrived_at: iso(sent + 25 * MINUTE), completed_at: null });
      }
    } else {
      const outcome = type === "LOW_BATTERY" ? "RESOLVED" : rng.weighted([["RESOLVED", 6], ["AUTO_RESOLVED", 3], ["CANCELLED", 1]] as const);
      status = outcome;
      let t = createdAt + rng.int(2, 10) * MINUTE;
      if (outcome === "RESOLVED") {
        broadcast = type === "GEOFENCE_BREACH" && rng.chance(0.12);
        const tries = broadcast ? ctx.rangers.length : rng.chance(0.2) ? 2 : 1;
        const order = [...ctx.rangers].sort(() => rng.next() - 0.5);
        for (let d = 0; d < tries; d++) {
          const ranger = order[d % order.length]!;
          const last = d === tries - 1;
          const sent = t;
          const responded = sent + rng.int(1, 6) * MINUTE;
          const failed = rng.chance(0.5) ? "REJECTED" : "TIMED_OUT";
          out.dispatches.push({
            id: k(`${key}:dispatch:${d}`), alert_id: alertId, ranger_id: ranger, status: last ? "DONE" : failed,
            notes: last ? `${DEMO} ${rng.pick(["Herd moved back into the park.", "Collar battery replaced by vet team.", "Animal found grazing, no conflict."])}` : failed === "REJECTED" ? "Already responding to another call." : null,
            revision: last ? 4 : 2, sent_at: iso(sent), responded_at: iso(failed === "TIMED_OUT" && !last ? sent + 15 * MINUTE : responded),
            arrived_at: last ? iso(responded + rng.int(15, 60) * MINUTE) : null,
            completed_at: last ? iso(responded + rng.int(70, 180) * MINUTE) : null,
          });
          t = last ? responded + rng.int(70, 180) * MINUTE : responded + MINUTE;
        }
        resolvedAt = t;
        reason = "Resolved by ranger response.";
      } else if (outcome === "AUTO_RESOLVED") {
        resolvedAt = createdAt + rng.int(20, 120) * MINUTE;
        reason = "Collar returned to the safe zone.";
      } else {
        resolvedAt = createdAt + rng.int(10, 60) * MINUTE;
        reason = "False positive: GPS drift near the fence line.";
      }
    }
    out.alerts.push({
      id: alertId, park_id: ctx.parkId, collar_id: collar.id, type, severity, status, lon: where[0], lat: where[1],
      revision: status === "NEW" ? 1 : 3, created_at: iso(createdAt), resolved_at: resolvedAt ? iso(resolvedAt) : null,
      resolution_reason: reason, is_broadcast: broadcast,
    });
  }
}

// ---------------------------------------------------------------- database

async function loadContexts(sql: postgres.Sql): Promise<Map<string, Ctx>> {
  const parks = await sql<{ id: string; code: string }[]>`SELECT id, code FROM parks WHERE code IN ('YALA', 'WILPATTU', 'SINHARAJA')`;
  const users = await sql<{ id: string; email: string; role: string; park_id: string }[]>`
    SELECT id, email, role, park_id FROM auth_users
    WHERE email LIKE '%@example.org' AND disabled_at IS NULL AND role IN ('PARK_MANAGER', 'LIAISON_OFFICER', 'RANGER')
    ORDER BY email`;
  const routes = await sql<{ code: string; id: string; version: number; path: LonLat[] }[]>`
    SELECT code, id, version, (ST_AsGeoJSON(route_geometry)::jsonb -> 'coordinates') AS path
    FROM patrol_routes WHERE route_geometry IS NOT NULL`;
  const contexts = new Map<string, Ctx>();
  for (const park of parks) {
    const own = users.filter((u) => u.park_id === park.id);
    const manager = own.find((u) => u.role === "PARK_MANAGER")?.id;
    const liaison = own.find((u) => u.role === "LIAISON_OFFICER")?.id ?? null;
    const rangers = own.filter((u) => u.role === "RANGER" && /^ranger\d+\./.test(u.email)).map((u) => u.id);
    if (!manager || rangers.length === 0) continue;
    contexts.set(park.code, {
      parkId: park.id, manager, liaison, verifier: liaison ?? manager, rangers,
      existingRoutes: new Map(routes.map((r) => [r.code, { id: r.id, version: r.version, path: r.path }])),
    });
  }
  return contexts;
}

/** Insert JSON rows in batches through json_to_recordset, so geometry can be built in SQL. */
async function insertBatches(tx: postgres.TransactionSql, rows: Row[], insert: (json: string) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 500) await insert(JSON.stringify(rows.slice(i, i + 500)));
}

async function insertAll(tx: postgres.TransactionSql, d: Dataset) {
  await insertBatches(tx, d.landmarks, (j) => tx`
    INSERT INTO incident_landmarks (id, park_id, name, latitude, longitude)
    SELECT id, park_id, name, lat, lon FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, park_id uuid, name text, lat float8, lon float8)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.settlements, (j) => tx`
    INSERT INTO settlements (id, park_id, name, location)
    SELECT id, park_id, name, ST_SetSRID(ST_MakePoint(lon, lat), 4326) FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, park_id uuid, name text, lon float8, lat float8)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.traps, (j) => tx`
    INSERT INTO camera_traps (id, park_id, name, location)
    SELECT id, park_id, name, ST_SetSRID(ST_MakePoint(lon, lat), 4326) FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, park_id uuid, name text, lon float8, lat float8)
    ON CONFLICT DO NOTHING`);
  // Live positions written by the apps win; only fill rangers with no position yet.
  await insertBatches(tx, d.rangerLocations, (j) => tx`
    INSERT INTO ranger_locations (ranger_id, location, updated_at)
    SELECT ranger_id, ST_SetSRID(ST_MakePoint(lon, lat), 4326), updated_at FROM json_to_recordset(${j}::text::json)
      AS x(ranger_id uuid, lon float8, lat float8, updated_at timestamptz)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.routes, (j) => tx`
    INSERT INTO patrol_routes (id, park_id, code, name, sector, description, route_geometry, target_area, estimated_distance_m, version, active)
    SELECT id, park_id, code, name, sector, description, ST_GeomFromText(route_wkt, 4326), ST_GeomFromText(target_wkt, 4326), estimated_distance_m, 1, true
    FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, park_id uuid, code text, name text, sector text, description text, route_wkt text, target_wkt text, estimated_distance_m int)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.assignments, (j) => tx`
    INSERT INTO patrol_assignments (id, route_id, route_version, ranger_id, assigned_by, status, revision, assigned_at, created_at)
    SELECT id, route_id, route_version, ranger_id, assigned_by, status, revision, assigned_at, assigned_at FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, route_id uuid, route_version int, ranger_id uuid, assigned_by uuid, status text, revision int, assigned_at timestamptz)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.sessions, (j) => tx`
    INSERT INTO patrol_sessions (id, assignment_id, status, revision, started_at, ended_at, termination_reason, distance_m, coverage_percent, created_at)
    SELECT id, assignment_id, status, revision, started_at, ended_at, termination_reason, distance_m, coverage_percent, started_at FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, assignment_id uuid, status text, revision int, started_at timestamptz, ended_at timestamptz, termination_reason text, distance_m float8, coverage_percent float8)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.gpsPoints, (j) => tx`
    INSERT INTO patrol_gps_points (client_record_id, session_id, position, accuracy_m, recorded_at, created_at)
    SELECT client_record_id, session_id, ST_SetSRID(ST_MakePoint(lon, lat), 4326), accuracy_m, recorded_at, recorded_at FROM json_to_recordset(${j}::text::json)
      AS x(client_record_id uuid, session_id uuid, lon float8, lat float8, accuracy_m float8, recorded_at timestamptz)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.waypoints, (j) => tx`
    INSERT INTO patrol_waypoints (client_record_id, session_id, category, note, position, accuracy_m, observed_at, created_at)
    SELECT client_record_id, session_id, category, note, ST_SetSRID(ST_MakePoint(lon, lat), 4326), accuracy_m, observed_at, observed_at FROM json_to_recordset(${j}::text::json)
      AS x(client_record_id uuid, session_id uuid, category text, note text, lon float8, lat float8, accuracy_m float8, observed_at timestamptz)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.collars, (j) => tx`
    INSERT INTO collars (id, park_id, animal_name, species, latest_battery, status, last_ping_at)
    SELECT id, park_id, animal_name, species, latest_battery, status, last_ping_at FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, park_id uuid, animal_name text, species text, latest_battery float8, status text, last_ping_at timestamptz)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.pings, (j) => tx`
    INSERT INTO collar_pings (id, collar_id, location, speed, battery, recorded_at, received_at)
    SELECT id, collar_id, ST_SetSRID(ST_MakePoint(lon, lat), 4326), speed, battery, recorded_at, received_at FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, collar_id uuid, lon float8, lat float8, speed float8, battery float8, recorded_at timestamptz, received_at timestamptz)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.alerts, (j) => tx`
    INSERT INTO alerts (id, park_id, collar_id, type, severity, status, location, revision, created_at, resolved_at, resolution_reason, is_broadcast)
    SELECT id, park_id, collar_id, type, severity, status, ST_SetSRID(ST_MakePoint(lon, lat), 4326), revision, created_at, resolved_at, resolution_reason, is_broadcast
    FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, park_id uuid, collar_id uuid, type text, severity text, status text, lon float8, lat float8, revision int, created_at timestamptz, resolved_at timestamptz, resolution_reason text, is_broadcast boolean)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.dispatches, (j) => tx`
    INSERT INTO alert_dispatches (id, alert_id, ranger_id, status, notes, revision, sent_at, responded_at, arrived_at, completed_at)
    SELECT id, alert_id, ranger_id, status, notes, revision, sent_at, responded_at, arrived_at, completed_at FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, alert_id uuid, ranger_id uuid, status text, notes text, revision int, sent_at timestamptz, responded_at timestamptz, arrived_at timestamptz, completed_at timestamptz)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.incidents, (j) => tx`
    INSERT INTO incidents (id, park_id, reporter_id, type, status, description, location, photo_url, reported_at, created_at, updated_at,
      source, location_status, location_text, location_accuracy, captured_at, reporter_phone, revision,
      assigned_to, assigned_at, first_response_at, resolved_at, outcome_notes, creation_hash)
    SELECT id, park_id, reporter_id, type, status, description,
      CASE WHEN lon IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lon, lat), 4326) END,
      photo_url, reported_at, created_at, updated_at, source, location_status, location_text, location_accuracy, captured_at,
      reporter_phone, revision, assigned_to, assigned_at, first_response_at, resolved_at, outcome_notes, creation_hash
    FROM json_to_recordset(${j}::text::json) AS x(
      id uuid, park_id uuid, reporter_id uuid, type text, status text, description text, lon float8, lat float8, photo_url text,
      reported_at timestamptz, created_at timestamptz, updated_at timestamptz, source text, location_status text, location_text text,
      location_accuracy float8, captured_at timestamptz, reporter_phone text, revision int, assigned_to uuid, assigned_at timestamptz,
      first_response_at timestamptz, resolved_at timestamptz, outcome_notes text, creation_hash text)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.events, (j) => tx`
    INSERT INTO incident_events (id, incident_id, actor_id, event_type, old_status, new_status, notes, created_at)
    SELECT id, incident_id, actor_id, event_type, old_status, new_status, notes, created_at FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, incident_id uuid, actor_id uuid, event_type text, old_status text, new_status text, notes text, created_at timestamptz)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.reviews, (j) => tx`
    INSERT INTO incident_reviews (id, incident_id, reviewer_id, notes, created_at)
    SELECT id, incident_id, reviewer_id, notes, created_at FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, incident_id uuid, reviewer_id uuid, notes text, created_at timestamptz)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.media, (j) => tx`
    INSERT INTO incident_media (id, incident_id, data_url, created_at)
    SELECT id, incident_id, data_url, created_at FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, incident_id uuid, data_url text, created_at timestamptz)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.messages, (j) => tx`
    INSERT INTO community_messages (id, incident_id, provider_message_id, phone, raw_text, location_text, state, creation_hash, created_at)
    SELECT id, incident_id, provider_message_id, phone, raw_text, location_text, state, creation_hash, created_at FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, incident_id uuid, provider_message_id text, phone text, raw_text text, location_text text, state text, creation_hash text, created_at timestamptz)
    ON CONFLICT DO NOTHING`);
  // Rows from the first version of this script used a made-up SMS format. Bring their text in line
  // with M1's real format; a state someone changed in the app afterwards is kept.
  await insertBatches(tx, d.messages, (j) => tx`
    UPDATE community_messages m
    SET raw_text = x.raw_text, location_text = x.location_text, provider_message_id = x.provider_message_id,
        state = CASE WHEN m.state = 'NEEDS_INFO' THEN x.state ELSE m.state END
    FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, raw_text text, location_text text, provider_message_id text, state text)
    WHERE m.id = x.id AND m.raw_text IS DISTINCT FROM x.raw_text`);
  const community = d.incidents.filter((i) => i.source === "COMMUNITY");
  await insertBatches(tx, community, (j) => tx`
    UPDATE incidents i SET location_text = x.location_text
    FROM json_to_recordset(${j}::text::json) AS x(id uuid, location_text text)
    WHERE i.id = x.id AND i.location_text IS DISTINCT FROM x.location_text`);
  const createdNotes = d.events.filter((e) => e.event_type === "INCIDENT_CREATED" && e.notes);
  await insertBatches(tx, createdNotes, (j) => tx`
    UPDATE incident_events e SET notes = x.notes
    FROM json_to_recordset(${j}::text::json) AS x(id uuid, notes text)
    WHERE e.id = x.id AND e.notes IS NULL`);
  await insertBatches(tx, d.followUps, (j) => tx`
    INSERT INTO community_follow_ups (id, message_id, actor_id, text, sent_at, state)
    SELECT id, message_id, actor_id, text, sent_at, state FROM json_to_recordset(${j}::text::json)
      AS x(id uuid, message_id uuid, actor_id uuid, text text, sent_at timestamptz, state text)
    ON CONFLICT DO NOTHING`);
  await insertBatches(tx, d.cameraImages, (j) => tx`
    INSERT INTO camera_images (id, park_id, captured_at, latitude, longitude, data_url, person_flag, classification, reviewer_id, reviewed_at, resulting_incident_id, revision, creation_hash)
    SELECT id, park_id, captured_at, latitude, longitude, data_url, person_flag, classification, reviewer_id, reviewed_at, resulting_incident_id, revision, creation_hash
    FROM json_to_recordset(${j}::text::json) AS x(
      id uuid, park_id uuid, captured_at timestamptz, latitude float8, longitude float8, data_url text, person_flag boolean,
      classification text, reviewer_id uuid, reviewed_at timestamptz, resulting_incident_id uuid, revision int, creation_hash text)
    ON CONFLICT DO NOTHING`);
}

async function removeAll(tx: postgres.TransactionSql, d: Dataset) {
  const ids = (rows: Row[], field = "id") => rows.map((r) => r[field] as string);
  const collarIds = ids(d.collars);
  // SMS sent through the API get server-made IDs; find them by their provider message ID.
  await tx`DELETE FROM incidents WHERE id IN (
    SELECT incident_id FROM community_messages WHERE provider_message_id LIKE 'demo-sms-live-%')`;
  // Children first. Rows other people added to demo records (UI actions) cascade with them.
  await tx`DELETE FROM camera_images WHERE id = ANY(${ids(d.cameraImages)}::uuid[])`;
  await tx`DELETE FROM incidents WHERE id = ANY(${ids(d.incidents)}::uuid[])`;
  await tx`DELETE FROM alerts WHERE id = ANY(${ids(d.alerts)}::uuid[]) OR collar_id = ANY(${collarIds}::uuid[])`;
  await tx`DELETE FROM collars WHERE id = ANY(${collarIds}::uuid[])`;
  await tx`DELETE FROM patrol_sessions WHERE id = ANY(${ids(d.sessions)}::uuid[])`;
  await tx`DELETE FROM patrol_assignments WHERE id = ANY(${ids(d.assignments)}::uuid[])`;
  await tx`DELETE FROM patrol_routes WHERE id = ANY(${ids(d.routes)}::uuid[])`;
  await tx`DELETE FROM camera_traps WHERE id = ANY(${ids(d.traps)}::uuid[])`;
  await tx`DELETE FROM settlements WHERE id = ANY(${ids(d.settlements)}::uuid[])`;
  await tx`DELETE FROM incident_landmarks WHERE id = ANY(${ids(d.landmarks)}::uuid[])`;
}

/**
 * Sends LIVE_SMS to the running API exactly as an SMS gateway would (no sign-in, POST /api/community/sms).
 * Re-sending the same provider message ID returns the existing report, so this is safe to repeat.
 */
async function sendLiveSms(parkId: string) {
  const api = process.env.DEMO_API_URL ?? `http://localhost:${process.env.API_PORT ?? 3000}`;
  try {
    await fetch(`${api}/health`);
  } catch {
    console.log(`Live SMS skipped: the API isn't running at ${api}. Start it with \`corepack pnpm dev:api\` and run this again.`);
    return;
  }
  console.log("Live SMS sent through POST /api/community/sms:");
  for (const sms of LIVE_SMS) {
    const res = await fetch(`${api}/api/community/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerMessageId: `demo-sms-live-yala-${sms.id}`, parkId, phone: `+94 70 000 90${sms.id}`, rawText: sms.text }),
    });
    const body = (await res.json().catch(() => ({}))) as { status?: string; locationStatus?: string; message?: string };
    console.log(`  ${res.status} ${(body.locationStatus ?? body.message ?? "").padEnd(10)} ${sms.text}`);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to the root .env file.");
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to add demo data in production.");
  const remove = process.argv.includes("--remove");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const contexts = await loadContexts(sql);
    if (!contexts.has("YALA")) throw new Error("Yala demo accounts are missing. Run `corepack pnpm db:seed` first.");
    const data = emptyDataset();
    const configs: { parkId: string; config: unknown }[] = [];
    for (const profile of PROFILES) {
      const ctx = contexts.get(profile.code);
      if (!ctx) {
        console.log(`Skipping ${profile.code}: its demo manager or rangers are missing.`);
        continue;
      }
      const before = data.geofenceConfig;
      data.geofenceConfig = null;
      buildPark(profile, ctx, data);
      if (data.geofenceConfig) configs.push({ parkId: ctx.parkId, config: data.geofenceConfig });
      data.geofenceConfig = before;
    }

    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(37010)`;
      if (remove) {
        await removeAll(tx, data);
        return;
      }
      await insertAll(tx, data);
      // Alert zones only for parks that have none yet; a manager's own settings are never overwritten.
      for (const c of configs)
        await tx`UPDATE parks SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('alerts', ${JSON.stringify(c.config)}::jsonb)
          WHERE id = ${c.parkId} AND NOT (COALESCE(config, '{}'::jsonb) ? 'alerts')`;
    });

    if (remove) {
      console.log("Removed the sample demo data.");
      return;
    }
    const counts: Record<string, number> = {
      incidents: data.incidents.length, incident_events: data.events.length, incident_media: data.media.length,
      incident_reviews: data.reviews.length, community_messages: data.messages.length, community_follow_ups: data.followUps.length,
      incident_landmarks: data.landmarks.length, camera_images: data.cameraImages.length, camera_traps: data.traps.length,
      patrol_routes: data.routes.length, patrol_assignments: data.assignments.length, patrol_sessions: data.sessions.length,
      patrol_gps_points: data.gpsPoints.length, patrol_waypoints: data.waypoints.length, collars: data.collars.length,
      collar_pings: data.pings.length, alerts: data.alerts.length, alert_dispatches: data.dispatches.length,
      settlements: data.settlements.length, ranger_locations: data.rangerLocations.length,
    };
    console.log("Sample demo data is in place (existing rows were left unchanged):");
    for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(22)} ${n}`);
    await sendLiveSms(contexts.get("YALA")!.parkId);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
