// tenant-provisioning.js
// Cuando un restaurante nuevo se registra, esto crea SU PROPIA base de datos
// en Turso (aislada por completo de las de los demás restaurantes), le aplica
// el esquema de tablas, y le crea su primer usuario administrador.
//
// Necesita un token de la "Platform API" de Turso (distinto del token de una
// sola base de datos) y el nombre de tu organización en Turso. Se consiguen
// en https://app.turso.tech → tu organización → Settings → API Tokens.

const { createClient: createPlatformClient } = require('@tursodatabase/api');
const { createClient: createDbClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const { initSchema } = require('./db');

function plataformaConfigurada() {
  return !!(process.env.TURSO_PLATFORM_TOKEN && process.env.TURSO_ORG);
}

function clientePlataforma() {
  return createPlatformClient({
    org: process.env.TURSO_ORG,
    token: process.env.TURSO_PLATFORM_TOKEN
  });
}

// Crea la base de datos de un restaurante nuevo, le aplica el esquema, y le
// crea su primer usuario administrador. Devuelve los datos de conexión para
// guardarlos en el registro central de restaurantes (tenants).
async function aprovisionarRestaurante({ subdomain, restaurantName, adminEmail, adminPasswordHash }) {
  if (!plataformaConfigurada()) {
    throw new Error(
      'El servidor no tiene configurado TURSO_PLATFORM_TOKEN / TURSO_ORG, ' +
      'así que no puede crear bases de datos nuevas automáticamente.'
    );
  }

  const turso = clientePlataforma();
  const nombreDb = `burgerpos-${subdomain}`;

  // 1. Crear la base de datos en Turso (vacía)
  await turso.databases.create(nombreDb, {
    group: process.env.TURSO_GROUP || 'default'
  });

  // 2. Generar un token de acceso solo para esa base de datos
  const tokenInfo = await turso.databases.createToken(nombreDb, { expiration: 'never' });
  const dbToken = tokenInfo.jwt;

  // 3. Averiguar la URL de conexión de esa base
  const detalle = await turso.databases.get(nombreDb);
  const dbUrl = `libsql://${detalle.hostname}`;

  // 4. Conectarse a la base recién creada y aplicarle todas las tablas
  const dbClient = createDbClient({ url: dbUrl, authToken: dbToken });
  await initSchema(dbClient, { crearAdminPorDefecto: false });

  // 5. Crear el primer usuario (administrador) con los datos del registro
  await dbClient.execute({
    sql: 'INSERT INTO users (id, username, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
    args: ['u' + Date.now(), adminEmail, adminPasswordHash, 'administrador', new Date().toISOString()]
  });

  // 6. Dejar el nombre del restaurante ya configurado en Configuración
  await dbClient.execute({
    sql: 'UPDATE settings SET value = ? WHERE key = ?',
    args: [restaurantName, 'restaurantName']
  });

  return { tursoDbName: nombreDb, tursoDbUrl: dbUrl, tursoDbToken: dbToken };
}

// Elimina la base de datos de un restaurante (por ejemplo, si cancela su
// suscripción y pasa un tiempo, o si se registró por error).
async function eliminarBaseDeRestaurante(tursoDbName) {
  if (!plataformaConfigurada()) return;
  const turso = clientePlataforma();
  await turso.databases.delete(tursoDbName);
}

module.exports = { aprovisionarRestaurante, eliminarBaseDeRestaurante, plataformaConfigurada };
