/* global require, console, process */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = require('postgres');
async function setup() {
  const sql = postgres({ host: 'localhost', port: 5432, user: 'postgres', pass: 'postgres', database: 'postgres', max: 1 });
  try {
    await sql`CREATE DATABASE wildlife`;
    console.log('Database wildlife created');
  } catch(e) {
    console.log('Database wildlife might exist', e.message);
  }
  process.exit(0);
}
setup();
