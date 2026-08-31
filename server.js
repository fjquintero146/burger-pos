// server.js
// Servidor para el POS + KDS + Administración de menú + Reporte de ventas.
// La base de datos vive en Turso (o en un archivo local si no hay Turso configurado) — ver db.js.

require('dotenv').config();

const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const { Server } = require('socket.io');
const { db, initDb, nextOrderNumber } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Northflank (y la mayoría de plataformas) usan esto para saber que el
// servidor sigue vivo.
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

// ---------- MENÚ (público: solo productos activos) ----------

app.get('/api/menu', ruta(async (req, res) => {
  const result = await db.execute('SELECT * FROM menu_items WHERE active = 1 ORDER BY category, name');
  res.json(result.rows);
}));

// ---------- MENÚ (administración: todos los productos) ----------

app.get('/api/admin/menu', ruta(async (req, res) => {
  const result = await db.execute('SELECT * FROM menu_items ORDER BY category, name');
  res.json(result.rows);
}));

app.post('/api/admin/menu', ruta(async (req, res) => {
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

app.put('/api/admin/menu/:id', ruta(async (req, res) => {
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

app.delete('/api/admin/menu/:id', ruta(async (req, res) => {
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
    items: itemsResult.rows
  };
}

app.get('/api/orders', ruta(async (req, res) => {
  const idsResult = await db.execute('SELECT id FROM orders ORDER BY order_number DESC');
  const pedidos = [];
  for (const row of idsResult.rows) {
    pedidos.push(await cargarPedidoCompleto(row.id));
  }
  res.json(pedidos);
}));

app.get('/api/orders/:id', ruta(async (req, res) => {
  const pedido = await cargarPedidoCompleto(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(pedido);
}));

app.post('/api/orders', ruta(async (req, res) => {
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
      sql: 'INSERT INTO orders (id, order_number, status, total, created_at, customer_name, edited) VALUES (?, ?, ?, ?, ?, ?, 0)',
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

// Edita un pedido que ya fue enviado a cocina: reemplaza sus productos
// (el cliente agregó o quitó algo) y opcionalmente el nombre del cliente.
// No se puede editar un pedido que ya fue marcado como "entregado".
app.put('/api/orders/:id', ruta(async (req, res) => {
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

app.patch('/api/orders/:id/status', ruta(async (req, res) => {
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

app.get('/api/sales', ruta(async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const from = req.query.from || hoy;
  const to = req.query.to || hoy;

  const resumenResult = await db.execute({
    sql: `SELECT COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS ingresos
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?)`,
    args: [from, to]
  });

  const porDiaResult = await db.execute({
    sql: `SELECT date(created_at) AS dia, COUNT(*) AS pedidos, SUM(total) AS ingresos
          FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?)
          GROUP BY dia ORDER BY dia`,
    args: [from, to]
  });

  const porProductoResult = await db.execute({
    sql: `SELECT oi.name AS nombre, SUM(oi.qty) AS cantidad, SUM(oi.price * oi.qty) AS ingresos
          FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE date(o.created_at) BETWEEN date(?) AND date(?)
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
      console.log(`Caja:              http://localhost:${PORT}/pos.html`);
      console.log(`Administrar menú:  http://localhost:${PORT}/admin.html`);
      console.log(`Ver ventas:        http://localhost:${PORT}/sales.html`);
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
