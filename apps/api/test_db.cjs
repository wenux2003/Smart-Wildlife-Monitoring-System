/* global require, console, process */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = require('postgres');
async function test() {
  const users = ['postgres', 'root', 'admin'];
  const passwords = ['postgres', 'admin', 'root', 'password', ''];
  for (const user of users) {
    for (const pass of passwords) {
      try {
        const sql = postgres({ host: 'localhost', port: 5432, user, pass, database: 'postgres', max: 1, connect_timeout: 2 });
        await sql`SELECT 1`;
        console.log(`SUCCESS: user=${user} pass=${pass}`);
        process.exit(0);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // ignore
      }
    }
  }
  console.log('FAIL');
}
test();
