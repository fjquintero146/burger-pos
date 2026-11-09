// historial.js
// Búsqueda de pedidos ya hechos (historial) con filtros. Sin dependencias, para poder
// probarlo solo. Todas las fechas y horas se interpretan en la hora LOCAL del
// restaurante: los pedidos se guardan en UTC, así que se les aplica el mismo
// desplazamiento horario que usan los reportes (ver fecha.js).

const LIMITE_POR_DEFECTO = 100;
const LIMITE_MAXIMO = 300;

// Grupos de estado que el cajero entiende; "terminados" es lo que pidió: listos + entregados.
const GRUPOS_ESTADO = {
  terminados: ['listo', 'entregado'],
  listo: ['listo'],
  entregado: ['entregado'],
  anulado: ['anulado'],
  proceso: ['pendiente', 'preparando'],
  cobrar: ['esperando_pago'],
  todos: null
};

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function fechaValida(s) {
  if (typeof s !== 'string' || !RE_FECHA.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s; // rechaza 2026-02-31
}

// Escapa % y _ para que el texto buscado se tome literal en un LIKE.
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, c => '\\' + c);
}

// Devuelve { sql, args, sqlResumen, argsResumen, filtros } a partir de lo que mande el cliente.
// Nunca concatena datos del cliente en el SQL: solo van como parámetros.
function construirConsultaHistorial(q = {}, { mod, hoy }) {
  let desde = fechaValida(q.desde) ? q.desde : hoy;
  let hasta = fechaValida(q.hasta) ? q.hasta : desde;
  if (desde > hasta) [desde, hasta] = [hasta, desde];

  const condiciones = [];
  const args = [];

  condiciones.push(`date(created_at, '${mod}') BETWEEN ? AND ?`);
  args.push(desde, hasta);

  // Franja de horas (HH:MM). Si "desde" es mayor que "hasta" cruza la medianoche
  // (por ejemplo 22:00 a 02:00): se aceptan las horas >= desde O <= hasta.
  const horaDesde = RE_HORA.test(q.horaDesde || '') ? q.horaDesde : null;
  const horaHasta = RE_HORA.test(q.horaHasta || '') ? q.horaHasta : null;
  const hora = `strftime('%H:%M', created_at, '${mod}')`;
  if (horaDesde && horaHasta) {
    if (horaDesde <= horaHasta) {
      condiciones.push(`${hora} BETWEEN ? AND ?`);
    } else {
      condiciones.push(`(${hora} >= ? OR ${hora} <= ?)`);
    }
    args.push(horaDesde, horaHasta);
  } else if (horaDesde) {
    condiciones.push(`${hora} >= ?`);
    args.push(horaDesde);
  } else if (horaHasta) {
    condiciones.push(`${hora} <= ?`);
    args.push(horaHasta);
  }

  const estado = Object.prototype.hasOwnProperty.call(GRUPOS_ESTADO, q.estado) ? q.estado : 'terminados';
  const estados = GRUPOS_ESTADO[estado];
  if (estados) {
    condiciones.push(`status IN (${estados.map(() => '?').join(', ')})`);
    args.push(...estados);
  }

  const metodo = typeof q.metodo === 'string' ? q.metodo.trim().slice(0, 30) : '';
  if (metodo === 'sin_especificar') {
    condiciones.push('payment_method IS NULL');
  } else if (metodo) {
    condiciones.push('payment_method = ?');
    args.push(metodo);
  }

  const buscar = typeof q.buscar === 'string' ? q.buscar.trim().slice(0, 40) : '';
  if (buscar) {
    if (/^\d{1,9}$/.test(buscar)) {
      condiciones.push('order_number = ?');
      args.push(Number(buscar));
    } else {
      condiciones.push("(customer_name LIKE ? ESCAPE '\\' OR table_number LIKE ? ESCAPE '\\')");
      const patron = `%${escaparLike(buscar)}%`;
      args.push(patron, patron);
    }
  }

  const donde = condiciones.join(' AND ');

  let limite = parseInt(q.limite, 10);
  if (!(limite > 0)) limite = LIMITE_POR_DEFECTO;
  limite = Math.min(limite, LIMITE_MAXIMO);
  let desplazamiento = parseInt(q.desplazamiento, 10);
  if (!(desplazamiento >= 0)) desplazamiento = 0;

  const sql = `
    SELECT id, order_number AS orderNumber, status, total, created_at AS createdAt,
           customer_name AS customerName, table_number AS tableNumber,
           order_type AS orderType, payment_method AS paymentMethod,
           created_by AS createdBy, discount_amount AS discountAmount,
           ready_at AS readyAt, delivered_at AS deliveredAt,
           (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_items.order_id = orders.id) AS unidades
    FROM orders
    WHERE ${donde}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`;

  // Resumen de TODO lo que cumple el filtro (no solo la página). Lo anulado y lo
  // que espera pago no cuenta como venta.
  const sqlResumen = `
    SELECT COUNT(*) AS pedidos,
           COALESCE(SUM(CASE WHEN status NOT IN ('anulado', 'esperando_pago') THEN total ELSE 0 END), 0) AS ingresos
    FROM orders
    WHERE ${donde}`;

  return {
    sql,
    args: [...args, limite + 1, desplazamiento], // se pide uno de más para saber si hay otra página
    sqlResumen,
    argsResumen: args,
    limite,
    filtros: { desde, hasta, horaDesde, horaHasta, estado, metodo, buscar }
  };
}

// Ejecuta la consulta con un "db" que tenga execute({ sql, args }) -> { rows }.
async function consultarHistorial(db, q, opciones) {
  const c = construirConsultaHistorial(q, opciones);
  const [lista, resumen] = await Promise.all([
    db.execute({ sql: c.sql, args: c.args }),
    db.execute({ sql: c.sqlResumen, args: c.argsResumen })
  ]);
  const filas = lista.rows.map(f => ({ ...f }));
  const hayMas = filas.length > c.limite;
  return {
    pedidos: hayMas ? filas.slice(0, c.limite) : filas,
    hayMas,
    resumen: { pedidos: Number(resumen.rows[0].pedidos), ingresos: Number(resumen.rows[0].ingresos) },
    filtros: c.filtros
  };
}

module.exports = { construirConsultaHistorial, consultarHistorial, GRUPOS_ESTADO, fechaValida };
