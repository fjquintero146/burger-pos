// db.js
// Base de datos usando libSQL (compatible con SQLite).
//
// - Si defines TURSO_DATABASE_URL (y TURSO_AUTH_TOKEN) en las variables de entorno,
//   se conecta a tu base de datos en Turso (gratis, permanente, ideal para producción
//   en internet, ya que el servidor puede reiniciarse sin perder los datos).
// - Si no las defines, usa un archivo local "burger-pos.db" en esta misma carpeta,
//   igual que antes — perfecto para probar en tu computador sin necesitar Turso.

const path = require('path');
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'burger-pos.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({ url, authToken });

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      ingredients TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER NOT NULL,
      status TEXT NOT NULL,
      total INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      customer_name TEXT,
      edited INTEGER NOT NULL DEFAULT 0,
      table_number TEXT,
      source TEXT NOT NULL DEFAULT 'caja'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Migración: agrega columnas nuevas a bases de datos creadas con una versión
  // anterior de la app, sin perder los datos que ya tengan.
  const columnasOrders = (await db.execute('PRAGMA table_info(orders)')).rows.map(c => c.name);
  if (!columnasOrders.includes('table_number')) {
    await db.execute('ALTER TABLE orders ADD COLUMN table_number TEXT');
  }
  if (!columnasOrders.includes('source')) {
    await db.execute("ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'caja'");
  }

  const columnasMenu = (await db.execute('PRAGMA table_info(menu_items)')).rows.map(c => c.name);
  if (!columnasMenu.includes('image')) {
    await db.execute('ALTER TABLE menu_items ADD COLUMN image TEXT');
  }

  // Semilla inicial del menú, solo si la tabla está vacía
  const totalItems = await db.execute('SELECT COUNT(*) AS n FROM menu_items');
  if (Number(totalItems.rows[0].n) === 0) {
    const seed = [
      ['h1', 'Hamburguesas', 'Clásica', 12000, 'Pan,Carne,Queso,Lechuga,Tomate,Cebolla,Salsa'],
      ['h2', 'Hamburguesas', 'Doble Queso', 16000, 'Pan,Carne,Carne,Queso,Queso,Lechuga,Tomate,Salsa'],
      ['h3', 'Hamburguesas', 'BBQ Bacon', 18000, 'Pan,Carne,Tocineta,Queso,Cebolla Caramelizada,Salsa BBQ'],
      ['h4', 'Hamburguesas', 'Vegetariana', 14000, 'Pan,Carne de Lenteja,Queso,Lechuga,Tomate,Cebolla,Salsa'],
      ['b1', 'Bebidas', 'Gaseosa', 4000, null],
      ['b2', 'Bebidas', 'Jugo Natural', 5000, null],
      ['b3', 'Bebidas', 'Agua', 3000, null],
      ['e1', 'Extras', 'Papas Fritas', 6000, null],
      ['e2', 'Extras', 'Aros de Cebolla', 7000, null],
      ['e3', 'Extras', 'Salsa Extra', 1500, null]
    ];
    for (const [id, category, name, price, ingredients] of seed) {
      await db.execute({
        sql: 'INSERT INTO menu_items (id, category, name, price, active, ingredients) VALUES (?, ?, ?, ?, 1, ?)',
        args: [id, category, name, price, ingredients]
      });
    }
  }

  const counter = await db.execute({
    sql: 'SELECT value FROM counters WHERE name = ?',
    args: ['order_number']
  });
  if (counter.rows.length === 0) {
    await db.execute({
      sql: 'INSERT INTO counters (name, value) VALUES (?, ?)',
      args: ['order_number', 1]
    });
  }

  // Configuración general (logo, nombre del local, tamaño de papel de factura)
  const defaultsSettings = {
    restaurantName: 'Local de Hamburguesas',
    logo: '',
    receiptWidth: '80mm'
  };
  for (const [key, value] of Object.entries(defaultsSettings)) {
    const existing = await db.execute({ sql: 'SELECT key FROM settings WHERE key = ?', args: [key] });
    if (existing.rows.length === 0) {
      await db.execute({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?)', args: [key, value] });
    }
  }

  // Si no hay ningún usuario todavía, crea un administrador inicial para
  // poder entrar por primera vez y crear las demás cuentas desde ahí.
  const totalUsuarios = await db.execute('SELECT COUNT(*) AS n FROM users');
  if (Number(totalUsuarios.rows[0].n) === 0) {
    const bcrypt = require('bcryptjs');
    const passwordInicial = process.env.ADMIN_PASSWORD || Math.random().toString(36).slice(-10);
    const hash = await bcrypt.hash(passwordInicial, 10);
    await db.execute({
      sql: 'INSERT INTO users (id, username, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      args: ['u' + Date.now(), 'admin', hash, 'administrador', new Date().toISOString()]
    });
    console.log('==========================================');
    console.log(' Usuario administrador creado por primera vez:');
    console.log(' Usuario:  admin');
    if (!process.env.ADMIN_PASSWORD) {
      console.log(` Clave:    ${passwordInicial}  (guárdala, no se vuelve a mostrar)`);
    } else {
      console.log(' Clave:    la que pusiste en ADMIN_PASSWORD');
    }
    console.log(' Entra y crea las demás cuentas desde /users.html');
    console.log('==========================================');
  }
}

// Reserva y devuelve el siguiente número de pedido, de forma segura ante
// dos cajas escribiendo al mismo tiempo.
async function nextOrderNumber() {
  const tx = await db.transaction('write');
  try {
    const row = await tx.execute({
      sql: 'SELECT value FROM counters WHERE name = ?',
      args: ['order_number']
    });
    const current = Number(row.rows[0].value);
    await tx.execute({
      sql: 'UPDATE counters SET value = ? WHERE name = ?',
      args: [current + 1, 'order_number']
    });
    await tx.commit();
    return current;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

module.exports = { db, initDb, nextOrderNumber };
