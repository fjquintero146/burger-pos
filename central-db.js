// central-db.js
// Base de datos "central" del SaaS: guarda la lista de restaurantes registrados,
// su subdominio, el estado de su suscripción de Stripe, y cómo conectarse a la
// base de datos PROPIA de cada restaurante (que vive en su propia base de Turso).
//
// Esta base es distinta de la de cada restaurante — aquí NO se guardan pedidos,
// menús ni usuarios de ningún restaurante, solo el "directorio" de cuáles existen.

const path = require('path');
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_CENTRAL_DATABASE_URL || `file:${path.join(__dirname, 'central.db')}`;
const authToken = process.env.TURSO_CENTRAL_AUTH_TOKEN || undefined;

const centralDb = createClient({ url, authToken });

async function initCentralDb() {
  await centralDb.execute(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subdomain TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pendiente',
      admin_email TEXT,
      turso_db_name TEXT,
      turso_db_url TEXT,
      turso_db_token TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      trial_ends_at TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await centralDb.execute(`
    CREATE TABLE IF NOT EXISTS pending_signups (
      id TEXT PRIMARY KEY,
      subdomain TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      admin_password_hash TEXT NOT NULL,
      stripe_checkout_session_id TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await centralDb.execute(`
    CREATE TABLE IF NOT EXISTS superadmins (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

async function buscarTenantPorSubdominio(subdomain) {
  const result = await centralDb.execute({
    sql: 'SELECT * FROM tenants WHERE subdomain = ?',
    args: [subdomain]
  });
  return result.rows[0] || null;
}

async function subdominioDisponible(subdomain) {
  const existente = await buscarTenantPorSubdominio(subdomain);
  return !existente;
}

module.exports = { centralDb, initCentralDb, buscarTenantPorSubdominio, subdominioDisponible };
