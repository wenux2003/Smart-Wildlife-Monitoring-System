import fs from "fs";

const API_URL = process.env.API_URL || "http://localhost:3000/api/pings";
const PING_SECRET = process.env.PING_SECRET;

async function run() {
  const dataFile = process.argv[2];
  if (!dataFile) {
    console.error("Usage: node index.mjs <data.json>");
    process.exit(1);
  }

  const raw = fs.readFileSync(dataFile, "utf-8");
  const pings = JSON.parse(raw);

  console.log(`Sending ${pings.length} pings...`);

  // Include the device secret header when configured (required in production)
  const headers = { "Content-Type": "application/json" };
  if (PING_SECRET) {
    headers["x-ping-secret"] = PING_SECRET;
  }

  for (const ping of pings) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(ping),
      });

      if (res.ok) {
        console.log(`Sent ping for collar ${ping.collarId} at ${ping.recordedAt}`);
      } else {
        console.error(`Failed to send ping: ${res.statusText}`);
        const body = await res.text();
        console.error(body);
      }
    } catch (e) {
      console.error(`Error sending ping:`, e);
    }
    // Simulate delay between pings
    await new Promise(r => setTimeout(r, 1000));
  }
}

run();
