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

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1);
app.use(express.json());

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
app.get('/receipt.html', requirePage('cajero', 'administrador'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'receipt.html')));

app.use(express.static(path.join(__dirname, 'public')));

// ---------- MENÚ (público: solo productos activos — lo usa también el kiosco de autopedido) ----------

app.get('/api/menu', ruta(async (req, res) => {
  const result = await db.execute('SELECT * FROM menu_items WHERE active = 1 ORDER BY category, name');
  res.json(result.rows);
}));

// ---------- MENÚ (administración: todos los productos) ----------

app.get('/api/admin/menu', requireApi('administrador'), ruta(async (req, res) => {
  const result = await db.execute('SELECT * FROM menu_items ORDER BY category, name');
  res.json(result.rows);
}));

app.post('/api/admin/menu', requireApi('administrador'), ruta(async (req, res) => {
  const { category, name, price } = req.body;
  const ingredients = req.body.ingredients !== undefined ? String(req.body.ingredients).trim() : '';
  if (!category || !name || price === undefined || price === null || isNaN(price)) {
    return res.status(400).json({ error: 'Completa categoría, nombre y precio' });
  }
  const id = 'p' + Date.now().toString();
  await db.execute({
    sql: 'INSERT INTO menu_items (id, category, name, price, active, ingredients) VALUES (?, ?, ?, ?, 1, ?)',
    args: [id, category.trim(), name.trim(), Math.round(Number(price)), ingredients || null]
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

  if (!category || !name || isNaN(price)) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  await db.execute({
    sql: 'UPDATE menu_items SET category = ?, name = ?, price = ?, active = ?, ingredients = ? WHERE id = ?',
    args: [category, name, price, active, ingredients, req.params.id]
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
  if (!items || !items.length) {
    return res.status(400).json({ error: 'El pedido está vacío' });
  }

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  const orderNumber = await nextOrderNumber();

  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `INSERT INTO orders (id, order_number, status, total, created_at, customer_name, edited, source)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'caja')`,
      args: [id, orderNumber, 'pendiente', total, createdAt, customerName || null]
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

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  const orderNumber = await nextOrderNumber();

  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `INSERT INTO orders (id, order_number, status, total, created_at, table_number, edited, source)
            VALUES (?, ?, 'esperando_pago', ?, ?, ?, 0, 'autopedido')`,
      args: [id, orderNumber, total, createdAt, String(tableNumber).trim()]
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

  await db.execute({ sql: "UPDATE orders SET status = 'pendiente' WHERE id = ?", args: [req.params.id] });
  const pedido = await cargarPedidoCompleto(req.params.id);
  io.emit('order-created', pedido);
  res.json(pedido);
}));

// Edita un pedido que ya fue enviado a cocina: reemplaza sus productos
// (el cliente agregó o quitó algo) y opcionalmente el nombre del cliente.
// No se puede editar un pedido que ya fue marcado como "entregado".
app.put('/api/orders/:id', requireApi('cajero', 'administrador'), ruta(async (req, res) => {
  const existingResult = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] });
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (existing.status === 'entregado') {
    return res.status(400).json({ error: 'Este pedido ya fue entregado y no se puede editar' });
  }

  const { items } = req.body;
  const customerName = req.body.customerName !== undefined
    ? (String(req.body.customerName).trim() || null)
    : existing.customer_name;

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
      sql: 'UPDATE orders SET total = ?, customer_name = ?, edited = 1 WHERE id = ?',
      args: [total, customerName, req.params.id]
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

app.patch('/api/orders/:id/status', requireApi('cajero', 'cocina', 'administrador'), ruta(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pendiente', 'preparando', 'listo', 'entregado'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const info = await db.execute({
    sql: 'UPDATE orders SET status = ? WHERE id = ?',
    args: [status, req.params.id]
  });
  if (info.rowsAffected === 0) return res.status(404).json({ error: 'Pedido no encontrado' });

  const pedido = await cargarPedidoCompleto(req.params.id);
  io.emit('order-updated', pedido);
  res.json(pedido);
}));

// ---------- VENTAS (reporte por rango de fechas) ----------

app.get('/api/sales', requireApi('administrador'), ruta(async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const from = req.query.from || hoy;
  const to = req.query.to || hoy;

  const resumenResult = await db.execute({
    sql: `SELECT COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS ingresos
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status != 'esperando_pago'`,
    args: [from, to]
  });

  const porDiaResult = await db.execute({
    sql: `SELECT date(created_at) AS dia, COUNT(*) AS pedidos, SUM(total) AS ingresos
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status != 'esperando_pago'
          GROUP BY dia ORDER BY dia`,
    args: [from, to]
  });

  const porProductoResult = await db.execute({
    sql: `SELECT oi.name AS nombre, SUM(oi.qty) AS cantidad, SUM(oi.price * oi.qty) AS ingresos
          FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE date(o.created_at) BETWEEN date(?) AND date(?) AND o.status != 'esperando_pago'
          GROUP BY oi.name ORDER BY ingresos DESC`,
    args: [from, to]
  });

  res.json({
    from,
    to,
    pedidos: resumenResult.rows[0].pedidos,
    ingresos: resumenResult.rows[0].ingresos,
    porDia: porDiaResult.rows,
    porProducto: porProductoResult.rows
  });
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
      console.log(`Autopedido (mesas):  http://localhost:${PORT}/kiosk.html`);
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
