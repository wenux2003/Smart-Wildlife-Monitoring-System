import postgres from "postgres";

async function run() {
  const sql = postgres("postgres://wildlife:wildlife@127.0.0.1:5433/wildlife");
  const parks = await sql`SELECT id FROM parks WHERE name = 'Yala National Park'`;
  if (!parks.length) throw new Error("Yala park not found");
  const parkId = parks[0].id;
  
  await sql`
    INSERT INTO collars (park_id, animal_name, species, status, latest_battery) VALUES
    (${parkId}, 'Elephant 1', 'Elephas maximus', 'ACTIVE', 100),
    (${parkId}, 'Elephant 2', 'Elephas maximus', 'ACTIVE', 95),
    (${parkId}, 'Elephant 3', 'Elephas maximus', 'ACTIVE', 80)
  `;
  
  console.log("Inserted 3 elephants!");
  await sql.end();
}

run().catch(console.error);
