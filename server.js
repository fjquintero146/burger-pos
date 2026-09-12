// server.js
// Servidor para el POS + KDS + Administración de menú + Reporte de ventas.
// La base de datos vive en Turso (o en un archivo local si no hay Turso configurado) — ver db.js.

require('dotenv').config();

const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { Server } = require('socket.io');
const { db, initDb, nextOrderNumber } = require('./db');
const { generarPdfCierre } = require('./pdf-cierre');
const { enviarCorreoConPdf } = require('./mailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' })); // más grande de lo normal: acepta imágenes en base64 (logo, íconos de menú)

app.use(session({
  secret: process.env.SESSION_SECRET || 'cambia-esto-en-produccion-por-una-frase-larga-y-unica',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 12, // 12 horas
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// Northflank (y la mayoría de plataformas) usan esto para saber que el
// servidor sigue vivo. Va antes del login a propósito: no requiere sesión.
app.get('/health', (req, res) => res.status(200).send('ok'));

const TIPOS_PEDIDO_VALIDOS = ['mesa', 'para_llevar', 'domicilio'];

// Envuelve una ruta async para que los errores no tumben el servidor,
// sino que respondan con un JSON de error legible.
function ruta(fn) {
  return (req, res) => {
    fn(req, res).catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Error interno del servidor. Intenta de nuevo.' });
    });
  };
}

// ---------- AUTENTICACIÓN ----------

// Protege una API: si no hay sesión, o el rol no está en la lista, corta con 401/403.
function requireApi(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Debes iniciar sesión' });
    if (roles.length && !roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    next();
  };
}

// Protege una página HTML: si no hay sesión válida, redirige al login.
function requirePage(...roles) {
  return (req, res, next) => {
    if (!req.session.user || (roles.length && !roles.includes(req.session.user.role))) {
      return res.redirect('/login.html');
    }
    next();
  };
}

app.post('/api/login', ruta(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Ingresa usuario y clave' });
  }
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ? AND active = 1',
    args: [String(username).trim()]
  });
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Usuario o clave incorrectos' });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ ok: true, username: user.username, role: user.role });
}));

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

// ---------- USUARIOS (solo administrador) ----------

app.get('/api/users', requireApi('administrador'), ruta(async (req, res) => {
  const result = await db.execute('SELECT id, username, role, active, created_at FROM users ORDER BY created_at');
  res.json(result.rows);
}));

app.post('/api/users', requireApi('administrador'), ruta(async (req, res) => {
  const { username, password, role } = req.body;
  const rolesValidos = ['cajero', 'cocina', 'administrador'];
  if (!username || !password || !rolesValidos.includes(role)) {
    return res.status(400).json({ error: 'Completa usuario, clave y un rol válido' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'La clave debe tener al menos 4 caracteres' });
  }
  const existe = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [String(username).trim()] });
  if (existe.rows.length) {
    return res.status(400).json({ error: 'Ese usuario ya existe' });
  }
  const hash = await bcrypt.hash(password, 10);
  const id = 'u' + Date.now();
  await db.execute({
    sql: 'INSERT INTO users (id, username, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
    args: [id, String(username).trim(), hash, role, new Date().toISOString()]
  });
  res.json({ id, username: username.trim(), role, active: 1 });
}));

app.put('/api/users/:id', requireApi('administrador'), ruta(async (req, res) => {
  const existing = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.params.id] })).rows[0];
  if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : existing.active;

  if (req.body.password) {
    if (String(req.body.password).length < 4) {
      return res.status(400).json({ error: 'La clave debe tener al menos 4 caracteres' });
    }
    const hash = await bcrypt.hash(req.body.password, 10);
    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, active = ? WHERE id = ?',
      args: [hash, active, req.params.id]
    });
  } else {
    await db.execute({ sql: 'UPDATE users SET active = ? WHERE id = ?', args: [active, req.params.id] });
  }

  res.json({ ok: true });
}));

app.delete('/api/users/:id', requireApi('administrador'), ruta(async (req, res) => {
  if (req.session.user.id === req.params.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario mientras tienes la sesión abierta' });
  }
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
}));

// ---------- PÁGINAS PROTEGIDAS ----------
// login.html, kiosk.html y receipt.html (ver más abajo) quedan públicas.
// El resto exige haber iniciado sesión con el rol correcto.

app.get('/pos.html', requirePage('cajero', 'administrador'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'pos.html')));
app.get('/kds.html', requirePage('cocina', 'administrador'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'kds.html')));
app.get('/admin.html', requirePage('administrador'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/sales.html', requirePage('administrador'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'sales.html')));
app.get('/users.html', requirePage('administrador'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'users.html')));
app.get('/settings.html', requirePage('administrador'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'settings.html')));
app.get('/turnos.html', requirePage('administrador'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'turnos.html')));
app.get('/receipt.html', requirePage('cajero', 'administrador'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'receipt.html')));

app.use(express.static(path.join(__dirname, 'public')));

// ---------- CONFIGURACIÓN GENERAL (logo, nombre del local, tamaño de factura) ----------

app.get('/api/settings', ruta(async (req, res) => {
  const result = await db.execute('SELECT key, value FROM settings');
  const settings = {};
  result.rows.forEach(row => { settings[row.key] = row.value; });
  res.json(settings);
}));

app.put('/api/settings', requireApi('administrador'), ruta(async (req, res) => {
  const permitido = ['restaurantName', 'logo', 'receiptWidth', 'closeEmailTo'];
  for (const key of permitido) {
    if (req.body[key] !== undefined) {
      await db.execute({
        sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        args: [key, String(req.body[key])]
      });
    }
  }
  const result = await db.execute('SELECT key, value FROM settings');
  const settings = {};
  result.rows.forEach(row => { settings[row.key] = row.value; });
  io.emit('settings-updated');
  res.json(settings);
}));

// ---------- MENÚ (público: solo productos activos y no agotados hoy) ----------

app.get('/api/menu', ruta(async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const result = await db.execute({
    sql: `SELECT * FROM menu_items
          WHERE active = 1 AND (sold_out_date IS NULL OR sold_out_date != ?)
          ORDER BY category, name`,
    args: [hoy]
  });
  res.json(result.rows);
}));

// ---------- MENÚ: marcar/quitar "agotado hoy" (caja y administrador) ----------

app.get('/api/menu/estado', requireApi('cajero', 'cocina', 'administrador'), ruta(async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const result = await db.execute('SELECT * FROM menu_items WHERE active = 1 ORDER BY category, name');
  const items = result.rows.map(item => ({ ...item, soldOutToday: item.sold_out_date === hoy }));
  res.json(items);
}));

app.patch('/api/menu/:id/agotado-hoy', requireApi('cajero', 'administrador'), ruta(async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const existing = (await db.execute({ sql: 'SELECT * FROM menu_items WHERE id = ?', args: [req.params.id] })).rows[0];
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  const marcarAgotado = req.body.soldOut !== undefined ? !!req.body.soldOut : existing.sold_out_date !== hoy;
  await db.execute({
    sql: 'UPDATE menu_items SET sold_out_date = ? WHERE id = ?',
    args: [marcarAgotado ? hoy : null, req.params.id]
  });
  io.emit('menu-updated');
  res.json({ id: req.params.id, soldOutToday: marcarAgotado });
}));

// ---------- MENÚ (administración: todos los productos) ----------

app.get('/api/admin/menu', requireApi('administrador'), ruta(async (req, res) => {
  const result = await db.execute('SELECT * FROM menu_items ORDER BY category, name');
  res.json(result.rows);
}));

app.post('/api/admin/menu', requireApi('administrador'), ruta(async (req, res) => {
  const { category, name, price } = req.body;
  const ingredients = req.body.ingredients !== undefined ? String(req.body.ingredients).trim() : '';
  const image = req.body.image !== undefined ? String(req.body.image).trim() : '';
  const comboItems = req.body.comboItems !== undefined ? String(req.body.comboItems).trim() : '';
  if (!category || !name || price === undefined || price === null || isNaN(price)) {
    return res.status(400).json({ error: 'Completa categoría, nombre y precio' });
  }
  const id = 'p' + Date.now().toString();
  await db.execute({
    sql: 'INSERT INTO menu_items (id, category, name, price, active, ingredients, image, combo_items) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
    args: [id, category.trim(), name.trim(), Math.round(Number(price)), ingredients || null, image || null, comboItems || null]
  });
  const item = await db.execute({ sql: 'SELECT * FROM menu_items WHERE id = ?', args: [id] });
  io.emit('menu-updated');
  res.json(item.rows[0]);
}));

app.put('/api/admin/menu/:id', requireApi('administrador'), ruta(async (req, res) => {
  const existingResult = await db.execute({ sql: 'SELECT * FROM menu_items WHERE id = ?', args: [req.params.id] });
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  const category = req.body.category !== undefined ? req.body.category.trim() : existing.category;
  const name = req.body.name !== undefined ? req.body.name.trim() : existing.name;
  const price = req.body.price !== undefined ? Math.round(Number(req.body.price)) : existing.price;
  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : existing.active;
  const ingredients = req.body.ingredients !== undefined
    ? (String(req.body.ingredients).trim() || null)
    : existing.ingredients;
  const image = req.body.image !== undefined
    ? (String(req.body.image).trim() || null)
    : existing.image;
  const comboItems = req.body.comboItems !== undefined
    ? (String(req.body.comboItems).trim() || null)
    : existing.combo_items;

  if (!category || !name || isNaN(price)) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  await db.execute({
    sql: 'UPDATE menu_items SET category = ?, name = ?, price = ?, active = ?, ingredients = ?, image = ?, combo_items = ? WHERE id = ?',
    args: [category, name, price, active, ingredients, image, comboItems, req.params.id]
  });

  const updated = await db.execute({ sql: 'SELECT * FROM menu_items WHERE id = ?', args: [req.params.id] });
  io.emit('menu-updated');
  res.json(updated.rows[0]);
}));

app.delete('/api/admin/menu/:id', requireApi('administrador'), ruta(async (req, res) => {
  const usadoResult = await db.execute({
    sql: 'SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?',
    args: [req.params.id]
  });
  if (Number(usadoResult.rows[0].n) > 0) {
    return res.status(400).json({
      error: 'Este producto ya se usó en pedidos y no se puede eliminar. Puedes desactivarlo en su lugar.'
    });
  }
  const info = await db.execute({ sql: 'DELETE FROM menu_items WHERE id = ?', args: [req.params.id] });
  if (info.rowsAffected === 0) return res.status(404).json({ error: 'Producto no encontrado' });
  io.emit('menu-updated');
  res.json({ ok: true });
}));

// ---------- PEDIDOS ----------

// Devuelve el id del turno de caja abierto en este momento, o null si no hay ninguno.
async function obtenerTurnoAbiertoId() {
  const result = await db.execute("SELECT id FROM shifts WHERE status = 'abierto' LIMIT 1");
  return result.rows[0] ? result.rows[0].id : null;
}

async function cargarPedidoCompleto(orderId) {
  const orderResult = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [orderId] });
  const order = orderResult.rows[0];
  if (!order) return null;

  const itemsResult = await db.execute({
    sql: 'SELECT product_id AS productId, name, price, qty, notes FROM order_items WHERE order_id = ?',
    args: [orderId]
  });

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    total: order.total,
    createdAt: order.created_at,
    customerName: order.customer_name,
    edited: !!order.edited,
    tableNumber: order.table_number,
    source: order.source,
    paymentMethod: order.payment_method,
    discountAmount: order.discount_amount || 0,
    discountReason: order.discount_reason,
    voided: !!order.voided,
    voidReason: order.void_reason,
    voidedBy: order.voided_by,
    voidedAt: order.voided_at,
    createdBy: order.created_by,
    prepStartedAt: order.prep_started_at,
    readyAt: order.ready_at,
    deliveredAt: order.delivered_at,
    orderType: order.order_type,
    items: itemsResult.rows
  };
}

app.get('/api/orders', requireApi('cajero', 'cocina', 'administrador'), ruta(async (req, res) => {
  const idsResult = await db.execute('SELECT id FROM orders ORDER BY order_number DESC');
  const pedidos = [];
  for (const row of idsResult.rows) {
    pedidos.push(await cargarPedidoCompleto(row.id));
  }
  res.json(pedidos);
}));

app.get('/api/orders/:id', requireApi('cajero', 'cocina', 'administrador'), ruta(async (req, res) => {
  const pedido = await cargarPedidoCompleto(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(pedido);
}));

app.post('/api/orders', requireApi('cajero', 'administrador'), ruta(async (req, res) => {
  const { items } = req.body;
  const customerName = req.body.customerName ? String(req.body.customerName).trim() : null;
  const paymentMethod = req.body.paymentMethod ? String(req.body.paymentMethod).trim() : null;
  const discountReason = req.body.discountReason ? String(req.body.discountReason).trim() : null;
  const orderType = TIPOS_PEDIDO_VALIDOS.includes(req.body.orderType) ? req.body.orderType : 'para_llevar';

  if (!items || !items.length) {
    return res.status(400).json({ error: 'El pedido está vacío' });
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  let discountAmount = Math.max(0, Math.round(Number(req.body.discountAmount) || 0));
  if (discountAmount > subtotal) discountAmount = subtotal;
  const total = subtotal - discountAmount;

  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  const orderNumber = await nextOrderNumber();
  const shiftId = await obtenerTurnoAbiertoId();

  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `INSERT INTO orders
            (id, order_number, status, total, created_at, customer_name, edited, source, payment_method, discount_amount, discount_reason, shift_id, created_by, order_type)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'caja', ?, ?, ?, ?, ?, ?)`,
      args: [id, orderNumber, 'pendiente', total, createdAt, customerName || null, paymentMethod, discountAmount, discountReason, shiftId, req.session.user.username, orderType]
    });
    for (const i of items) {
      await tx.execute({
        sql: 'INSERT INTO order_items (order_id, product_id, name, price, qty, notes) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, i.productId || null, i.name, i.price, i.qty, i.note || null]
      });
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  const pedido = await cargarPedidoCompleto(id);
  io.emit('order-created', pedido);
  res.json(pedido);
}));

// Autopedido desde las tablets de mesa: NO requiere sesión (lo usan los clientes),
// pero el pedido queda "esperando_pago" — no aparece en cocina hasta que caja
// confirme el pago.
app.post('/api/kiosk/orders', ruta(async (req, res) => {
  const { items, tableNumber } = req.body;
  if (!tableNumber || !String(tableNumber).trim()) {
    return res.status(400).json({ error: 'Indica el número de mesa' });
  }
  if (!items || !items.length) {
    return res.status(400).json({ error: 'El pedido está vacío' });
  }
  const orderType = TIPOS_PEDIDO_VALIDOS.includes(req.body.orderType) ? req.body.orderType : 'mesa';

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  const orderNumber = await nextOrderNumber();

  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `INSERT INTO orders (id, order_number, status, total, created_at, table_number, edited, source, created_by, order_type)
            VALUES (?, ?, 'esperando_pago', ?, ?, ?, 0, 'autopedido', 'Autopedido', ?)`,
      args: [id, orderNumber, total, createdAt, String(tableNumber).trim(), orderType]
    });
    for (const i of items) {
      await tx.execute({
        sql: 'INSERT INTO order_items (order_id, product_id, name, price, qty, notes) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, i.productId || null, i.name, i.price, i.qty, i.note || null]
      });
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  const pedido = await cargarPedidoCompleto(id);
  io.emit('kiosk-order-created', pedido);
  res.json(pedido);
}));

// Caja confirma que la mesa ya pagó: el pedido pasa a "pendiente" y ahí sí
// aparece en cocina.
app.patch('/api/orders/:id/confirmar-pago', requireApi('cajero', 'administrador'), ruta(async (req, res) => {
  const existing = (await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] })).rows[0];
  if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (existing.status !== 'esperando_pago') {
    return res.status(400).json({ error: 'Este pedido no está esperando pago' });
  }

  const paymentMethod = req.body.paymentMethod ? String(req.body.paymentMethod).trim() : null;
  const shiftId = await obtenerTurnoAbiertoId();
  await db.execute({
    sql: "UPDATE orders SET status = 'pendiente', payment_method = ?, shift_id = ? WHERE id = ?",
    args: [paymentMethod, shiftId, req.params.id]
  });
  const pedido = await cargarPedidoCompleto(req.params.id);
  io.emit('order-created', pedido);
  res.json(pedido);
}));

// Edita un pedido que ya fue enviado a cocina: reemplaza sus productos
// (el cliente agregó o quitó algo) y opcionalmente el nombre del cliente.
// No se puede editar un pedido que ya fue marcado como "entregado" ni uno anulado.
app.put('/api/orders/:id', requireApi('cajero', 'administrador'), ruta(async (req, res) => {
  const existingResult = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] });
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (existing.status === 'entregado') {
    return res.status(400).json({ error: 'Este pedido ya fue entregado y no se puede editar' });
  }
  if (existing.voided) {
    return res.status(400).json({ error: 'Este pedido fue anulado y no se puede editar' });
  }

  const { items } = req.body;
  const customerName = req.body.customerName !== undefined
    ? (String(req.body.customerName).trim() || null)
    : existing.customer_name;
  const orderType = TIPOS_PEDIDO_VALIDOS.includes(req.body.orderType) ? req.body.orderType : existing.order_type;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'El pedido no puede quedar vacío' });
  }

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  const tx = await db.transaction('write');
  try {
    await tx.execute({ sql: 'DELETE FROM order_items WHERE order_id = ?', args: [req.params.id] });
    for (const i of items) {
      await tx.execute({
        sql: 'INSERT INTO order_items (order_id, product_id, name, price, qty, notes) VALUES (?, ?, ?, ?, ?, ?)',
        args: [req.params.id, i.productId || null, i.name, i.price, i.qty, i.note || null]
      });
    }
    await tx.execute({
      sql: 'UPDATE orders SET total = ?, customer_name = ?, edited = 1, order_type = ? WHERE id = ?',
      args: [total, customerName, orderType, req.params.id]
    });
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  const pedido = await cargarPedidoCompleto(req.params.id);
  io.emit('order-updated', pedido);
  res.json(pedido);
}));

// Anula un pedido con un motivo obligatorio. El pedido NO se borra: queda en
// el histórico marcado como "anulado", visible en el reporte de anulaciones,
// y deja de contar como venta (no aparece en cocina ni en el reporte de ventas).
app.patch('/api/orders/:id/anular', requireApi('cajero', 'administrador'), ruta(async (req, res) => {
  const existing = (await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] })).rows[0];
  if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (existing.voided) {
    return res.status(400).json({ error: 'Este pedido ya estaba anulado' });
  }

  const reason = req.body.reason ? String(req.body.reason).trim() : '';
  if (!reason) {
    return res.status(400).json({ error: 'Debes indicar el motivo de la anulación' });
  }

  await db.execute({
    sql: `UPDATE orders SET status = 'anulado', voided = 1, void_reason = ?, voided_by = ?, voided_at = ? WHERE id = ?`,
    args: [reason, req.session.user.username, new Date().toISOString(), req.params.id]
  });

  const pedido = await cargarPedidoCompleto(req.params.id);
  io.emit('order-voided', pedido);
  res.json(pedido);
}));

app.patch('/api/orders/:id/status', requireApi('cajero', 'cocina', 'administrador'), ruta(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pendiente', 'preparando', 'listo', 'entregado'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const existing = (await db.execute({ sql: 'SELECT voided FROM orders WHERE id = ?', args: [req.params.id] })).rows[0];
  if (existing && existing.voided) {
    return res.status(400).json({ error: 'Este pedido fue anulado' });
  }

  const ahora = new Date().toISOString();
  const columnaTiempo = { preparando: 'prep_started_at', listo: 'ready_at', entregado: 'delivered_at' }[status];

  const info = await db.execute({
    sql: columnaTiempo
      ? `UPDATE orders SET status = ?, ${columnaTiempo} = COALESCE(${columnaTiempo}, ?) WHERE id = ?`
      : 'UPDATE orders SET status = ? WHERE id = ?',
    args: columnaTiempo ? [status, ahora, req.params.id] : [status, req.params.id]
  });
  if (info.rowsAffected === 0) return res.status(404).json({ error: 'Pedido no encontrado' });

  const pedido = await cargarPedidoCompleto(req.params.id);
  io.emit('order-updated', pedido);
  res.json(pedido);
}));

// ---------- PANTALLA PÚBLICA "PEDIDO LISTO" (sin login, para un TV en el local) ----------

app.get('/api/pedidos-listos', ruta(async (req, res) => {
  const result = await db.execute(
    "SELECT order_number AS orderNumber, customer_name AS customerName, table_number AS tableNumber, order_type AS orderType, ready_at AS readyAt " +
    "FROM orders WHERE status = 'listo' ORDER BY ready_at ASC"
  );
  res.json(result.rows);
}));

// ---------- VENTAS (reporte por rango de fechas) ----------

app.get('/api/sales', requireApi('administrador'), ruta(async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const from = req.query.from || hoy;
  const to = req.query.to || hoy;

  const resumenResult = await db.execute({
    sql: `SELECT COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS ingresos
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status NOT IN ('esperando_pago', 'anulado')`,
    args: [from, to]
  });

  const porDiaResult = await db.execute({
    sql: `SELECT date(created_at) AS dia, COUNT(*) AS pedidos, SUM(total) AS ingresos
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status NOT IN ('esperando_pago', 'anulado')
          GROUP BY dia ORDER BY dia`,
    args: [from, to]
  });

  const porProductoResult = await db.execute({
    sql: `SELECT oi.name AS nombre, SUM(oi.qty) AS cantidad, SUM(oi.price * oi.qty) AS ingresos
          FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE date(o.created_at) BETWEEN date(?) AND date(?) AND o.status NOT IN ('esperando_pago', 'anulado')
          GROUP BY oi.name ORDER BY ingresos DESC`,
    args: [from, to]
  });

  const porMetodoPagoResult = await db.execute({
    sql: `SELECT COALESCE(payment_method, 'Sin especificar') AS metodo, COUNT(*) AS pedidos, SUM(total) AS ingresos
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status NOT IN ('esperando_pago', 'anulado')
          GROUP BY metodo ORDER BY ingresos DESC`,
    args: [from, to]
  });

  const anuladosResult = await db.execute({
    sql: `SELECT order_number AS orderNumber, total, void_reason AS voidReason, voided_by AS voidedBy, voided_at AS voidedAt
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND voided = 1
          ORDER BY voided_at DESC`,
    args: [from, to]
  });

  // Hora pico de ventas (ajustado a hora de Colombia, UTC-5) — útil para planear personal.
  const porHoraResult = await db.execute({
    sql: `SELECT strftime('%H', created_at, '-5 hours') AS hora, COUNT(*) AS pedidos, SUM(total) AS ingresos
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status NOT IN ('esperando_pago', 'anulado')
          GROUP BY hora ORDER BY hora`,
    args: [from, to]
  });

  const porCajeroResult = await db.execute({
    sql: `SELECT COALESCE(created_by, 'Sin especificar') AS cajero, COUNT(*) AS pedidos, SUM(total) AS ingresos
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status NOT IN ('esperando_pago', 'anulado')
          GROUP BY cajero ORDER BY ingresos DESC`,
    args: [from, to]
  });

  const tiempoPrepResult = await db.execute({
    sql: `SELECT AVG((julianday(ready_at) - julianday(created_at)) * 24 * 60) AS minutos
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?)
          AND ready_at IS NOT NULL AND status NOT IN ('esperando_pago', 'anulado')`,
    args: [from, to]
  });

  res.json({
    from,
    to,
    pedidos: resumenResult.rows[0].pedidos,
    ingresos: resumenResult.rows[0].ingresos,
    porDia: porDiaResult.rows,
    porProducto: porProductoResult.rows,
    porMetodoPago: porMetodoPagoResult.rows,
    anulados: anuladosResult.rows,
    porHora: porHoraResult.rows,
    porCajero: porCajeroResult.rows,
    tiempoPromedioPreparacion: tiempoPrepResult.rows[0].minutos
  });
}));

// ---------- ARQUEO DE CAJA (turnos) ----------

async function cargarTurnoCompleto(id) {
  const result = await db.execute({ sql: 'SELECT * FROM shifts WHERE id = ?', args: [id] });
  const t = result.rows[0];
  if (!t) return null;
  return {
    id: t.id,
    openedBy: t.opened_by,
    openedAt: t.opened_at,
    openingCash: t.opening_cash,
    status: t.status,
    closedBy: t.closed_by,
    closedAt: t.closed_at,
    closingCashCounted: t.closing_cash_counted,
    expectedCash: t.expected_cash,
    difference: t.difference,
    notes: t.notes
  };
}

// Calcula lo que debería haber en efectivo y el desglose por método de pago
// para un turno (abierto o ya cerrado), a partir de los pedidos vinculados a él.
async function calcularResumenTurno(turno) {
  const ventasResult = await db.execute({
    sql: `SELECT COALESCE(payment_method, 'Sin especificar') AS metodo, COUNT(*) AS pedidos, SUM(total) AS ingresos
          FROM orders WHERE shift_id = ? AND status NOT IN ('esperando_pago', 'anulado')
          GROUP BY metodo ORDER BY ingresos DESC`,
    args: [turno.id]
  });

  const ventasPorMetodo = ventasResult.rows;
  const ventasEfectivo = ventasPorMetodo.find(v => v.metodo === 'Efectivo');
  const totalEfectivoVendido = ventasEfectivo ? ventasEfectivo.ingresos : 0;
  const totalVentas = ventasPorMetodo.reduce((sum, v) => sum + v.ingresos, 0);
  const totalPedidos = ventasPorMetodo.reduce((sum, v) => sum + v.pedidos, 0);
  const expectedCash = turno.openingCash + totalEfectivoVendido;

  return { ventasPorMetodo, totalVentas, totalPedidos, totalEfectivoVendido, expectedCash };
}

app.get('/api/shifts/actual', requireApi('cajero', 'administrador'), ruta(async (req, res) => {
  const result = await db.execute("SELECT id FROM shifts WHERE status = 'abierto' LIMIT 1");
  if (!result.rows[0]) return res.json({ turno: null });
  const turno = await cargarTurnoCompleto(result.rows[0].id);
  const resumen = await calcularResumenTurno(turno);
  res.json({ turno, resumen });
}));

app.post('/api/shifts', requireApi('cajero', 'administrador'), ruta(async (req, res) => {
  const abierto = await db.execute("SELECT id FROM shifts WHERE status = 'abierto' LIMIT 1");
  if (abierto.rows[0]) {
    return res.status(400).json({ error: 'Ya hay un turno abierto. Ciérralo antes de abrir uno nuevo.' });
  }
  const openingCash = Math.max(0, Math.round(Number(req.body.openingCash) || 0));
  const id = 't' + Date.now();
  await db.execute({
    sql: `INSERT INTO shifts (id, opened_by, opened_at, opening_cash, status) VALUES (?, ?, ?, ?, 'abierto')`,
    args: [id, req.session.user.username, new Date().toISOString(), openingCash]
  });
  const turno = await cargarTurnoCompleto(id);
  io.emit('turno-actualizado');
  res.json(turno);
}));

app.post('/api/shifts/:id/cerrar', requireApi('cajero', 'administrador'), ruta(async (req, res) => {
  const turno = await cargarTurnoCompleto(req.params.id);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
  if (turno.status !== 'abierto') return res.status(400).json({ error: 'Este turno ya está cerrado' });

  const resumen = await calcularResumenTurno(turno);
  const closingCashCounted = Math.max(0, Math.round(Number(req.body.closingCashCounted) || 0));
  const difference = closingCashCounted - resumen.expectedCash;
  const notes = req.body.notes ? String(req.body.notes).trim() : null;

  await db.execute({
    sql: `UPDATE shifts SET status = 'cerrado', closed_by = ?, closed_at = ?, closing_cash_counted = ?,
          expected_cash = ?, difference = ?, notes = ? WHERE id = ?`,
    args: [req.session.user.username, new Date().toISOString(), closingCashCounted, resumen.expectedCash, difference, notes, req.params.id]
  });

  const turnoFinal = await cargarTurnoCompleto(req.params.id);
  io.emit('turno-actualizado');

  // Genera el PDF del cierre y lo envía por correo para validación, si está
  // configurado. Un problema de correo NUNCA debe hacer fallar el cierre del
  // turno — ya quedó cerrado en la base de datos pase lo que pase con el mail.
  let correo = { enviado: false, motivo: 'No se intentó enviar' };
  try {
    const settingsResult = await db.execute('SELECT key, value FROM settings');
    const settings = {};
    settingsResult.rows.forEach(row => { settings[row.key] = row.value; });

    const pdfBuffer = await generarPdfCierre(turnoFinal, resumen, settings.restaurantName);
    const fechaArchivo = new Date().toISOString().slice(0, 10);
    correo = await enviarCorreoConPdf({
      to: settings.closeEmailTo,
      subject: `Cierre de caja ${fechaArchivo} — ${settings.restaurantName || 'Local de Hamburguesas'}`,
      text: `Adjunto el cierre de caja del turno cerrado por ${turnoFinal.closedBy} el ${fechaArchivo}.\n\n` +
            `Efectivo esperado: $${resumen.expectedCash.toLocaleString('es-CO')}\n` +
            `Efectivo contado: $${turnoFinal.closingCashCounted.toLocaleString('es-CO')}\n` +
            `Diferencia: $${turnoFinal.difference.toLocaleString('es-CO')}`,
      pdfBuffer,
      pdfNombre: `cierre-caja-${fechaArchivo}.pdf`
    });
  } catch (err) {
    console.error('No se pudo generar/enviar el PDF de cierre:', err);
    correo = { enviado: false, motivo: 'Error generando el PDF' };
  }

  res.json({ turno: turnoFinal, resumen, correo });
}));

app.get('/api/shifts/:id/resumen', requireApi('cajero', 'administrador'), ruta(async (req, res) => {
  const turno = await cargarTurnoCompleto(req.params.id);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
  const resumen = await calcularResumenTurno(turno);
  res.json({ turno, resumen });
}));

app.get('/api/shifts', requireApi('administrador'), ruta(async (req, res) => {
  const result = await db.execute('SELECT id FROM shifts ORDER BY opened_at DESC LIMIT 60');
  const turnos = [];
  for (const row of result.rows) {
    turnos.push(await cargarTurnoCompleto(row.id));
  }
  res.json(turnos);
}));

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      const usandoTurso = !!process.env.TURSO_DATABASE_URL;
      const nets = os.networkInterfaces();
      const ips = [];
      Object.values(nets).forEach(list => {
        (list || []).forEach(net => {
          if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
        });
      });

      console.log('==========================================');
      console.log(' Servidor POS/KDS iniciado correctamente');
      console.log(` Base de datos: ${usandoTurso ? 'Turso (remota)' : 'archivo local'}`);
      console.log('==========================================');
      console.log(`Iniciar sesión:      http://localhost:${PORT}/login.html`);
      console.log(`Autopedido:          http://localhost:${PORT}/kiosk.html`);
      ips.forEach(ip => {
        console.log(`Cocina (misma WiFi): http://${ip}:${PORT}/kds.html`);
      });
      console.log('==========================================');
    });
  })
  .catch(err => {
    console.error('No se pudo inicializar la base de datos:', err);
    process.exit(1);
  });
