const PINGS_URL = "http://localhost:3000/api/pings";
const COLLARS_URL = "http://localhost:3000/api/collars";

const activeCollars: { id: string, lat: number, lng: number, speed: number, battery: number, heading: number }[] = [];

async function fetchCollars() {
  try {
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:5173" },
      body: JSON.stringify({ email: "manager.yala@example.org", password: "demopassword" })
    });
    const cookie = loginRes.headers.get("set-cookie");
    
    const headers: Record<string, string> = { "Origin": "http://localhost:5173" };
    if (cookie) {
      headers["Cookie"] = cookie.split(";")[0];
    }

    const res = await fetch(COLLARS_URL, { headers });
    if (!res.ok) throw new Error("Failed to fetch collars");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collars = await res.json() as any[];
    
    // Merge new collars into activeCollars
    for (const collar of collars) {
      if (!activeCollars.find(c => c.id === collar.id)) {
        // Use default coords if location missing (GeoJSON coordinates are [lng, lat])
        const location = collar.location || [81.33, 6.37];
        activeCollars.push({
          id: collar.id,
          lng: location[0],
          lat: location[1],
          speed: 1.5,
          battery: collar.latestBattery || 95,
          heading: Math.random() * Math.PI * 2
        });
      }
    }
  } catch (e) {
    console.error("Could not fetch collars:", e);
  }
}

async function simulatePings() {
  console.log("Starting collar simulator...");
  await fetchCollars(); // Initial fetch
  
  setInterval(async () => {
    // Refresh collars periodically (~every 100s)
    if (Math.random() < 0.1) await fetchCollars();
    
    for (const collar of activeCollars) {
      // Simulate continuous movement by maintaining a heading
      // Gradually change heading
      collar.heading += (Math.random() - 0.5) * 0.5; // Turn up to ~14 degrees
      
      // Move forward by 0.0005 degrees (~55 meters) per 10s ping (approx 5.5 m/s or 20 km/h for demo purposes)
      const step = 0.0005;
      collar.lat += Math.sin(collar.heading) * step;
      collar.lng += Math.cos(collar.heading) * step;
      
      // Simulate battery drain
      collar.battery = Math.max(0, collar.battery - 0.1);
      
      const payload = {
        collarId: collar.id,
        location: [collar.lng, collar.lat], // GeoJSON order
        speed: collar.speed,
        battery: collar.battery,
        recordedAt: new Date().toISOString(),
      };
      
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (process.env.PING_SECRET) {
          headers["x-ping-secret"] = process.env.PING_SECRET;
        }

        const response = await fetch(PINGS_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        
        if (response.ok) {
          console.log(`Successfully sent ping for collar ${collar.id}`);
        } else {
          console.error(`Failed to send ping for collar ${collar.id}: ${response.statusText}`);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.error(`Error sending ping for collar ${collar.id}: ${e.message}`);
      }
    }
  }, 10000); // Send ping every 10 seconds
}

simulatePings();
