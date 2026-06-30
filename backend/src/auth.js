import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { q } from './db.js';

export function initials(n) {
  return (n || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'NN';
}

export const hashPassword = (p) => bcrypt.hash(p, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain || '', hash || '');

// No oculta el hash, eso lo hace sanitize() en las respuestas.
export function sanitize(u) {
  if (!u) return u;
  const { password_hash, ...rest } = u;
  return rest;
}

export async function login(email, password) {
  const { rows } = await q(`select * from users where email=$1 and activo=true`, [String(email || '').toLowerCase().trim()]);
  const u = rows[0];
  if (!u || !u.password_hash || !(await bcrypt.compare(password || '', u.password_hash))) {
    const e = new Error('Email o contraseña incorrectos');
    e.status = 401;
    throw e;
  }
  return u;
}

export function signJwt(user) {
  return jwt.sign({ uid: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

export async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'no autenticado' });
    const { uid } = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await q(`select * from users where id=$1 and activo=true`, [uid]);
    if (!rows[0]) return res.status(401).json({ error: 'sesión inválida' });
    req.user = rows[0];
    next();
  } catch (e) {
    res.status(401).json({ error: 'sesión inválida' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'requiere admin' });
  next();
}
