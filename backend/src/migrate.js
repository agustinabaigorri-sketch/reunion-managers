import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'migrations');

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  process.stdout.write(`· aplicando ${f} ... `);
  await pool.query(sql);
  console.log('ok');
}
console.log('Migraciones aplicadas.');
await pool.end();
