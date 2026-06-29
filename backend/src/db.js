import pg from 'pg';
import 'dotenv/config';

const { Pool, types } = pg;
// Devolver las columnas DATE como 'YYYY-MM-DD' (string) y no como objeto Date,
// que es lo que asume el front para formatear y comparar semanas.
types.setTypeParser(1082, (v) => v);
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway interno no usa SSL. Si conectás a un Postgres externo con SSL, poné PGSSL=true.
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

export const q = (text, params) => pool.query(text, params);

// --- semana ISO ---
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7;            // lunes = 0
  d.setUTCDate(d.getUTCDate() - day);             // retrocede al lunes
  const monday = new Date(d);
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 3);
  const anio = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(anio, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  const week1Monday = new Date(firstThursday);
  week1Monday.setUTCDate(firstThursday.getUTCDate() - firstDay);
  const nro = 1 + Math.round((monday - week1Monday) / (7 * 24 * 3600 * 1000));
  const fin = new Date(monday);
  fin.setUTCDate(monday.getUTCDate() + 6);
  const iso = (x) => x.toISOString().slice(0, 10);
  return { anio, nro, inicio: iso(monday), fin: iso(fin) };
}

export async function ensureWeek(dateObj) {
  const { anio, nro, inicio, fin } = isoWeek(dateObj);
  await q(
    `insert into weeks(anio, nro, fecha_inicio, fecha_fin) values($1,$2,$3,$4)
     on conflict (anio, nro) do nothing`,
    [anio, nro, inicio, fin]
  );
  const { rows } = await q(`select * from weeks where anio=$1 and nro=$2`, [anio, nro]);
  return rows[0];
}

export const getCurrentWeek = () => ensureWeek(new Date());

export async function weekById(id) {
  const { rows } = await q(`select * from weeks where id=$1`, [id]);
  return rows[0] || null;
}
