import 'dotenv/config';
import { pool, q } from './db.js';
import { hashPassword } from './auth.js';

const AREAS = [
  ['Finanzas', '#42B3FF', 1],
  ['Comercial', '#FF6428', 2],
  ['Producto', '#9B00AF', 3],
  ['RRHH', '#FFB800', 4],
  ['Operaciones', '#2A205E', 5],
  ['Legales', '#1F86D6', 6],
];

const TAGS = [
  '#odoo', '#multiempresa', '#licitaciones', '#pipeline', '#deploy', '#auth',
  '#ux', '#rrhh', '#seleccion', '#contratos', '#normativa', '#logistica',
];
const POOL = ['#42B3FF', '#FF6428', '#9B00AF', '#FFB800', '#1F86D6', '#A23B72', '#2A205E', '#8E8E9A'];

for (const [nombre, color, orden] of AREAS) {
  await q(
    `insert into areas(nombre,color,orden) values($1,$2,$3)
     on conflict (nombre) do nothing`,
    [nombre, color, orden]
  );
}

for (let i = 0; i < TAGS.length; i++) {
  await q(`insert into tags(name,color) values($1,$2) on conflict (name) do nothing`, [
    TAGS[i],
    POOL[i % POOL.length],
  ]);
}

// admin inicial opcional
const adminEmail = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
if (adminEmail) {
  const fin = (await q(`select id from areas order by orden limit 1`)).rows[0];
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'cambiar123';
  const ph = await hashPassword(adminPass);
  // Solo setea la contraseña en la creación inicial; en corridas siguientes
  // NO la pisa (para no resetear la que el admin haya cambiado).
  await q(
    `insert into users(email,nombre,ini,area_id,rol,activo,password_hash) values($1,$2,$3,$4,'admin',true,$5)
     on conflict (email) do update set rol='admin'`,
    [adminEmail, adminEmail.split('@')[0], adminEmail.slice(0, 2).toUpperCase(), fin?.id || null, ph]
  );
  console.log(`Admin asegurado: ${adminEmail} (contraseña inicial solo en la primera creación)`);
}

console.log('Seed listo: áreas y etiquetas base cargadas.');
await pool.end();
