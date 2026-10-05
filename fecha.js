// fecha.js
// Los pedidos se guardan con hora UTC, pero los reportes, el contador diario de
// pedidos y el "agotado hoy" deben usar el día LOCAL del restaurante. Si no, un
// pedido hecho a las 8 PM en Colombia (UTC-5) quedaría guardado como del día
// siguiente y no aparecería en "Hoy".
//
// Por defecto usa Colombia (UTC-5, sin horario de verano). Para otro país,
// define TZ_OFFSET_HOURS (ej. -6 para México, -3 para Argentina).

const OFFSET_HORAS = Number(process.env.TZ_OFFSET_HOURS !== undefined && process.env.TZ_OFFSET_HOURS !== ''
  ? process.env.TZ_OFFSET_HOURS
  : -5);

// Modificador para usar dentro de SQL: date(created_at, '-5 hours')
const MODIFICADOR_SQL = `${OFFSET_HORAS >= 0 ? '+' : ''}${OFFSET_HORAS} hours`;

// Fecha de hoy (YYYY-MM-DD) según la hora local del restaurante.
function fechaLocalHoy() {
  return new Date(Date.now() + OFFSET_HORAS * 3600000).toISOString().slice(0, 10);
}

module.exports = { OFFSET_HORAS, MODIFICADOR_SQL, fechaLocalHoy };
