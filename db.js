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
      edited INTEGER NOT NULL DEFAULT 0
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
