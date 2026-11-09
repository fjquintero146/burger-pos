// recibo-email.js
// Arma el correo con el recibo de un pedido. Sin dependencias, para poder probarlo solo.
// El recibo va en el cuerpo del correo (se lee directo en el celular, sin abrir adjuntos).

// Todo texto que escribieron personas (nombre del cliente, productos, notas) se escapa:
// si no, alguien podría meter HTML o enlaces dentro del correo.
function esc(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function dinero(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO');
}

// Fecha y hora en la hora LOCAL del restaurante (los pedidos se guardan en UTC).
function fechaLocal(iso, offsetHoras) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (isNaN(t)) return '';
  return new Date(t + offsetHoras * 3600000).toLocaleString('es-CO', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

const TIPOS = { mesa: 'Para comer en el local', para_llevar: 'Para llevar', domicilio: 'Domicilio' };

function construirReciboEmail(pedido, { nombreLocal, offsetHoras = -5 }) {
  const local = nombreLocal || 'Recibo de compra';
  const nombre = pedido.customerName || pedido.tableNumber || '';
  const items = pedido.items || [];
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const descuento = Number(pedido.discountAmount) || 0;
  const tipo = TIPOS[pedido.orderType] || '';

  const asunto = `Tu recibo de ${local} — Pedido #${pedido.orderNumber}`;

  // ---- Texto plano (para correos que no muestran HTML) ----
  const lineasTxt = [
    local,
    `Pedido #${pedido.orderNumber}`,
    `Fecha: ${fechaLocal(pedido.createdAt, offsetHoras)}`,
    nombre ? `A nombre de: ${nombre}` : null,
    tipo ? `Tipo: ${tipo}` : null,
    '',
    ...items.map(i => `${i.qty} x ${i.name}${i.notes ? ` (${i.notes})` : ''} — ${dinero(i.price * i.qty)}`),
    '',
    descuento > 0 ? `Subtotal: ${dinero(subtotal)}` : null,
    descuento > 0 ? `Descuento${pedido.discountReason ? ` (${pedido.discountReason})` : ''}: -${dinero(descuento)}` : null,
    `TOTAL: ${dinero(pedido.total)}`,
    pedido.paymentMethod ? `Pago: ${pedido.paymentMethod}` : null,
    '',
    '¡Gracias por tu compra!'
  ].filter(l => l !== null);
  const text = lineasTxt.join('\n');

  // ---- HTML (estilos en línea: los clientes de correo ignoran las hojas de estilo) ----
  const filas = items.map(i => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;vertical-align:top;">
            <div style="font-weight:600;">${esc(i.qty)} × ${esc(i.name)}</div>
            ${i.notes ? `<div style="font-size:12px;color:#8f1c21;">${esc(i.notes)}</div>` : ''}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;vertical-align:top;">${esc(dinero(i.price * i.qty))}</td>
        </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:16px;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#2b2118;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#c1272d;color:#ffffff;padding:18px 20px;">
      <div style="font-size:20px;font-weight:700;">${esc(local)}</div>
      <div style="font-size:14px;opacity:.9;">Recibo — Pedido #${esc(pedido.orderNumber)}</div>
    </td></tr>
    <tr><td style="padding:16px 20px;font-size:14px;line-height:1.6;">
      <div><strong>Fecha:</strong> ${esc(fechaLocal(pedido.createdAt, offsetHoras))}</div>
      ${nombre ? `<div><strong>A nombre de:</strong> ${esc(nombre)}</div>` : ''}
      ${tipo ? `<div><strong>Tipo:</strong> ${esc(tipo)}</div>` : ''}
      ${pedido.paymentMethod ? `<div><strong>Pago:</strong> ${esc(pedido.paymentMethod)}</div>` : ''}
    </td></tr>
    <tr><td style="padding:0 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${filas}
      </table>
    </td></tr>
    <tr><td style="padding:12px 20px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        ${descuento > 0 ? `
        <tr><td style="padding:3px 0;">Subtotal</td><td style="text-align:right;">${esc(dinero(subtotal))}</td></tr>
        <tr><td style="padding:3px 0;">Descuento${pedido.discountReason ? ` (${esc(pedido.discountReason)})` : ''}</td><td style="text-align:right;">-${esc(dinero(descuento))}</td></tr>` : ''}
        <tr><td style="padding-top:8px;font-size:18px;font-weight:700;">TOTAL</td><td style="padding-top:8px;text-align:right;font-size:18px;font-weight:700;">${esc(dinero(pedido.total))}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:14px 20px;background:#faf7f0;text-align:center;font-size:13px;color:#7a7166;">¡Gracias por tu compra!</td></tr>
  </table>
</body></html>`;

  return { asunto, text, html };
}

module.exports = { construirReciboEmail, fechaLocal, esc };
