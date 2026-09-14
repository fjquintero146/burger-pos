// db.js
// Contiene la lógica de "cómo se ve" la base de datos de UN restaurante (tablas,
// migraciones, semilla inicial). Esta lógica la usan dos cosas distintas:
//
//  1. El modo "un solo restaurante" (como funcionaba antes de ser SaaS): usa la
//     base de datos definida en TURSO_DATABASE_URL, o un archivo local si no la
//     configuraste. Sigue funcionando igual que siempre para quien quiera
//     instalar esto para su propio negocio, sin nada de SaaS.
//
//  2. El modo SaaS (tenant-provisioning.js): cuando un restaurante nuevo se
//     registra, se le crea su PROPIA base de datos en Turso, y se le aplica
//     este mismo esquema con initSchema().

const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');

// ---------- Conexión "single-tenant" (para cuando no se usa el modo SaaS) ----------

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'burger-pos.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const db = createClient({ url, authToken });

// ---------- Esquema reutilizable ----------

// Crea (o migra) todas las tablas de UN restaurante sobre el cliente db que le pases.
// options.crearAdminPorDefecto: si es true y no hay usuarios, crea un usuario
// "admin" con clave aleatoria (comportamiento de siempre en modo single-tenant).
// En modo SaaS se pasa false, porque el usuario admin se crea aparte con los
// datos que puso la persona al registrarse.
async function initSchema(dbClient, options = {}) {
  const { crearAdminPorDefecto = true } = options;

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      ingredients TEXT,
      combo_items TEXT,
      sold_out_date TEXT
    )
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER NOT NULL,
      status TEXT NOT NULL,
      total INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      customer_name TEXT,
      edited INTEGER NOT NULL DEFAULT 0,
      table_number TEXT,
      source TEXT NOT NULL DEFAULT 'caja',
      payment_method TEXT,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      discount_reason TEXT,
      shift_id TEXT,
      voided INTEGER NOT NULL DEFAULT 0,
      void_reason TEXT,
      voided_by TEXT,
      voided_at TEXT,
      created_by TEXT,
      prep_started_at TEXT,
      ready_at TEXT,
      delivered_at TEXT,
      order_type TEXT NOT NULL DEFAULT 'para_llevar'
    )
  `);

  await dbClient.execute(`
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

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      opened_by TEXT,
      opened_at TEXT NOT NULL,
      opening_cash INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'abierto',
      closed_by TEXT,
      closed_at TEXT,
      closing_cash_counted INTEGER,
      expected_cash INTEGER,
      difference INTEGER,
      notes TEXT
    )
  `);

  // Migración: agrega columnas nuevas a bases de datos creadas con una versión
  // anterior de la app, sin perder los datos que ya tengan.
  const columnasOrders = (await dbClient.execute('PRAGMA table_info(orders)')).rows.map(c => c.name);
  const migracionesOrders = {
    table_number: 'ALTER TABLE orders ADD COLUMN table_number TEXT',
    source: "ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'caja'",
    payment_method: 'ALTER TABLE orders ADD COLUMN payment_method TEXT',
    discount_amount: 'ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0',
    discount_reason: 'ALTER TABLE orders ADD COLUMN discount_reason TEXT',
    shift_id: 'ALTER TABLE orders ADD COLUMN shift_id TEXT',
    voided: 'ALTER TABLE orders ADD COLUMN voided INTEGER NOT NULL DEFAULT 0',
    void_reason: 'ALTER TABLE orders ADD COLUMN void_reason TEXT',
    voided_by: 'ALTER TABLE orders ADD COLUMN voided_by TEXT',
    voided_at: 'ALTER TABLE orders ADD COLUMN voided_at TEXT',
    created_by: 'ALTER TABLE orders ADD COLUMN created_by TEXT',
    prep_started_at: 'ALTER TABLE orders ADD COLUMN prep_started_at TEXT',
    ready_at: 'ALTER TABLE orders ADD COLUMN ready_at TEXT',
    delivered_at: 'ALTER TABLE orders ADD COLUMN delivered_at TEXT',
    order_type: "ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'para_llevar'"
  };
  for (const [columna, sql] of Object.entries(migracionesOrders)) {
    if (!columnasOrders.includes(columna)) await dbClient.execute(sql);
  }

  const columnasMenu = (await dbClient.execute('PRAGMA table_info(menu_items)')).rows.map(c => c.name);
  const migracionesMenu = {
    image: 'ALTER TABLE menu_items ADD COLUMN image TEXT',
    combo_items: 'ALTER TABLE menu_items ADD COLUMN combo_items TEXT',
    sold_out_date: 'ALTER TABLE menu_items ADD COLUMN sold_out_date TEXT'
  };
  for (const [columna, sql] of Object.entries(migracionesMenu)) {
    if (!columnasMenu.includes(columna)) await dbClient.execute(sql);
  }

  // Semilla inicial del menú, solo si la tabla está vacía
  const totalItems = await dbClient.execute('SELECT COUNT(*) AS n FROM menu_items');
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
      await dbClient.execute({
        sql: 'INSERT INTO menu_items (id, category, name, price, active, ingredients) VALUES (?, ?, ?, ?, 1, ?)',
        args: [id, category, name, price, ingredients]
      });
    }
  }

  const counter = await dbClient.execute({ sql: 'SELECT value FROM counters WHERE name = ?', args: ['order_number'] });
  if (counter.rows.length === 0) {
    await dbClient.execute({ sql: 'INSERT INTO counters (name, value) VALUES (?, ?)', args: ['order_number', 1] });
  }
  const counterFecha = await dbClient.execute({ sql: 'SELECT value FROM counters WHERE name = ?', args: ['order_number_date'] });
  if (counterFecha.rows.length === 0) {
    await dbClient.execute({
      sql: 'INSERT INTO counters (name, value) VALUES (?, ?)',
      args: ['order_number_date', new Date().toISOString().slice(0, 10)]
    });
  }

  // Configuración general (logo, nombre del local, tamaño de papel de factura)
  const defaultsSettings = {
    restaurantName: 'Mi Restaurante',
    logo: '',
    receiptWidth: '80mm',
    closeEmailTo: ''
  };
  for (const [key, value] of Object.entries(defaultsSettings)) {
    const existing = await dbClient.execute({ sql: 'SELECT key FROM settings WHERE key = ?', args: [key] });
    if (existing.rows.length === 0) {
      await dbClient.execute({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?)', args: [key, value] });
    }
  }

  // Si no hay ningún usuario todavía y se pidió crear uno por defecto (modo
  // single-tenant), crea un administrador inicial para poder entrar la primera vez.
  if (crearAdminPorDefecto) {
    const totalUsuarios = await dbClient.execute('SELECT COUNT(*) AS n FROM users');
    if (Number(totalUsuarios.rows[0].n) === 0) {
      const passwordInicial = process.env.ADMIN_PASSWORD || Math.random().toString(36).slice(-10);
      const hash = await bcrypt.hash(passwordInicial, 10);
      await dbClient.execute({
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
}

// Comportamiento de siempre: aplica el esquema sobre la base "single-tenant".
async function initDb() {
  await initSchema(db, { crearAdminPorDefecto: true });
}

// Reserva y devuelve el siguiente número de pedido para EL restaurante dueño de
// dbClient, de forma segura ante dos cajas escribiendo al mismo tiempo. Se
// reinicia a 1 cada día.
async function nextOrderNumber(dbClient) {
  const hoy = new Date().toISOString().slice(0, 10);
  const tx = await dbClient.transaction('write');
  try {
    const filaFecha = await tx.execute({ sql: 'SELECT value FROM counters WHERE name = ?', args: ['order_number_date'] });
    const fechaGuardada = filaFecha.rows[0] ? filaFecha.rows[0].value : null;

    if (fechaGuardada !== hoy) {
      await tx.execute({ sql: 'UPDATE counters SET value = ? WHERE name = ?', args: [hoy, 'order_number_date'] });
      await tx.execute({ sql: 'UPDATE counters SET value = ? WHERE name = ?', args: [2, 'order_number'] });
      await tx.commit();
      return 1;
    }

    const row = await tx.execute({ sql: 'SELECT value FROM counters WHERE name = ?', args: ['order_number'] });
    const current = Number(row.rows[0].value);
    await tx.execute({ sql: 'UPDATE counters SET value = ? WHERE name = ?', args: [current + 1, 'order_number'] });
    await tx.commit();
    return current;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

module.exports = { db, initDb, initSchema, nextOrderNumber };
