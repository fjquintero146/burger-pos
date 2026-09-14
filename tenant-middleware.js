// tenant-middleware.js
// En cada solicitud, mira el subdominio (ej. "burgerhouse" en
// burgerhouse.tuapp.com) y adjunta req.tenant (los datos del restaurante) y
// req.db (su conexión a base de datos) — así el resto del código solo tiene
// que usar req.db y nunca se puede mezclar accidentalmente con el de otro
// restaurante.

const { createClient } = require('@libsql/client');
const { buscarTenantPorSubdominio } = require('./central-db');

// Conexiones ya abiertas, para no reconectar en cada solicitud.
const cacheConexiones = new Map();

function obtenerConexionTenant(tenant) {
  if (cacheConexiones.has(tenant.id)) return cacheConexiones.get(tenant.id);
  const cliente = createClient({ url: tenant.turso_db_url, authToken: tenant.turso_db_token });
  cacheConexiones.set(tenant.id, cliente);
  return cliente;
}

// El dominio "raíz" (sin subdominio) es la página de mercadeo/registro, no un restaurante.
function extraerSubdominio(hostname) {
  const dominioApp = process.env.APP_DOMAIN;
  if (!dominioApp) return null; // sin dominio configurado, no hay forma de distinguir subdominios
  if (hostname === dominioApp || hostname === `www.${dominioApp}`) return null;
  if (!hostname.endsWith(`.${dominioApp}`)) return null;
  return hostname.slice(0, -(`.${dominioApp}`.length));
}

// Middleware: exige que la solicitud venga con un subdominio de un restaurante
// activo. Si no, responde con un error claro (se usa solo en rutas /api/*
// del propio restaurante, nunca en las de mercadeo/registro).
function requireTenant() {
  return async (req, res, next) => {
    const subdomain = extraerSubdominio(req.hostname);
    if (!subdomain) {
      return res.status(400).json({
        error: 'Esta dirección no corresponde a ningún restaurante. Entra por tu subdominio (ej. turestaurante.tuapp.com).'
      });
    }

    const tenant = await buscarTenantPorSubdominio(subdomain);
    if (!tenant) {
      return res.status(404).json({ error: 'No existe ningún restaurante con ese subdominio.' });
    }
    if (tenant.status !== 'activo' && tenant.status !== 'prueba') {
      return res.status(402).json({
        error: 'La suscripción de este restaurante no está activa. Contacta al administrador de la cuenta.'
      });
    }

    req.tenant = tenant;
    req.db = obtenerConexionTenant(tenant);
    next();
  };
}

module.exports = { requireTenant, extraerSubdominio, obtenerConexionTenant };
