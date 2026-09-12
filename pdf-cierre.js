// pdf-cierre.js
// Genera un PDF con el resumen de cierre de un turno de caja (arqueo),
// para enviarlo por correo y guardarlo como respaldo.

const PDFDocument = require('pdfkit');

function formatoDinero(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO');
}

function formatoFecha(fechaISO) {
  if (!fechaISO) return '—';
  return new Date(fechaISO).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// Devuelve una Promise que resuelve con un Buffer con el PDF ya armado.
function generarPdfCierre(turno, resumen, nombreLocal) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const partes = [];
      doc.on('data', chunk => partes.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);

      doc.fontSize(18).font('Helvetica-Bold').text(nombreLocal || 'Local de Hamburguesas');
      doc.fontSize(14).font('Helvetica').text('Cierre de caja (arqueo)');
      doc.moveDown();

      doc.fontSize(11).font('Helvetica-Bold').text('Datos del turno');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Abierto por: ${turno.openedBy || '—'}    Apertura: ${formatoFecha(turno.openedAt)}`);
      doc.text(`Cerrado por: ${turno.closedBy || '—'}    Cierre: ${formatoFecha(turno.closedAt)}`);
      doc.moveDown();

      doc.fontSize(11).font('Helvetica-Bold').text('Resumen de efectivo');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Base inicial: ${formatoDinero(turno.openingCash)}`);
      doc.text(`Efectivo esperado (base + ventas en efectivo): ${formatoDinero(resumen.expectedCash)}`);
      doc.text(`Efectivo contado físicamente: ${formatoDinero(turno.closingCashCounted)}`);
      doc.font('Helvetica-Bold');
      const diferencia = turno.difference || 0;
      const textoDiferencia = diferencia === 0
        ? 'Cuadra exacto'
        : diferencia > 0
          ? `Sobran ${formatoDinero(diferencia)}`
          : `Faltan ${formatoDinero(Math.abs(diferencia))}`;
      doc.text(`Diferencia: ${textoDiferencia}`);
      doc.font('Helvetica');
      if (turno.notes) doc.text(`Notas: ${turno.notes}`);
      doc.moveDown();

      doc.fontSize(11).font('Helvetica-Bold').text('Ventas del turno por método de pago');
      doc.font('Helvetica').fontSize(10);
      if (!resumen.ventasPorMetodo.length) {
        doc.text('Sin ventas registradas en este turno.');
      } else {
        resumen.ventasPorMetodo.forEach(v => {
          doc.text(`${v.metodo}: ${v.pedidos} pedido(s) — ${formatoDinero(v.ingresos)}`);
        });
      }
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text(`Total del turno: ${resumen.totalPedidos} pedido(s) — ${formatoDinero(resumen.totalVentas)}`);

      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica').fillColor('#888888')
        .text(`Generado automáticamente el ${formatoFecha(new Date().toISOString())}`);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generarPdfCierre };
