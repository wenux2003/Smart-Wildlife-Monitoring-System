import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api/alerts/pings";

// Simulated collar data
const collars = [
  { id: "c1111111-1111-1111-1111-111111111111", lat: 6.37, lng: 81.33, speed: 1.5, battery: 95 },
  { id: "c2222222-2222-2222-2222-222222222222", lat: 6.40, lng: 81.35, speed: 0.0, battery: 15 },
];

async function simulatePings() {
  console.log("Starting collar simulator...");
  
  setInterval(async () => {
    for (const collar of collars) {
      // Simulate slight movement
      collar.lat += (Math.random() - 0.5) * 0.001;
      collar.lng += (Math.random() - 0.5) * 0.001;
      
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
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
