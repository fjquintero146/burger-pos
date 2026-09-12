const params = new URLSearchParams(window.location.search);
const orderId = params.get('id');
const facturaEl = document.getElementById('factura');

let settings = { restaurantName: 'Local de Hamburguesas', logo: '', receiptWidth: '80mm' };

function formatoDinero(valor) {
  return '$' + Number(valor).toLocaleString('es-CO');
}

function formatoFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function aplicarTamañoPapel() {
  const ancho = settings.receiptWidth === '58mm' ? '58mm' : '80mm';
  facturaEl.style.width = ancho;

  let estiloImpresion = document.getElementById('estiloImpresionPapel');
  if (!estiloImpresion) {
    estiloImpresion = document.createElement('style');
    estiloImpresion.id = 'estiloImpresionPapel';
    document.head.appendChild(estiloImpresion);
  }
  estiloImpresion.textContent = `
    @media print {
      .factura { width: ${ancho} !important; }
      @page { size: ${ancho} auto; margin: 0; }
    }
  `;
}

async function cargarConfiguracion() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    settings = { ...settings, ...data };
  } catch (e) { /* usa los valores por defecto */ }
  aplicarTamañoPapel();
}

async function cargarFactura() {
  if (!orderId) {
    facturaEl.innerHTML = '<p class="cargando">Falta el número de pedido.</p>';
    return;
  }

  await cargarConfiguracion();

  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    if (!res.ok) throw new Error('No encontrado');
    const pedido = await res.json();
    renderFactura(pedido);

    // Da tiempo a que el navegador termine de dibujar antes de abrir el diálogo de impresión.
    setTimeout(() => window.print(), 400);
  } catch (e) {
    facturaEl.innerHTML = '<p class="cargando">No se pudo cargar el pedido.</p>';
  }
}

function renderFactura(pedido) {
  const filasItems = pedido.items.map(item => `
    <tr>
      <td class="cant">${item.qty}x</td>
      <td>
        ${item.name}
        ${item.notes ? `<span class="f-nota">${item.notes}</span>` : ''}
      </td>
      <td class="precio">${formatoDinero(item.price * item.qty)}</td>
    </tr>
  `).join('');

  facturaEl.innerHTML = `
    <div class="f-centro">
      ${settings.logo ? `<img src="${settings.logo}" class="f-logo" alt="Logo">` : ''}
      <p class="f-titulo">${settings.restaurantName || 'Local de Hamburguesas'}</p>
      <p class="f-subtitulo">Pedido #${pedido.orderNumber}</p>
    </div>
    <div class="f-linea"></div>
    <div class="f-datos">
      <p>Fecha: ${formatoFecha(pedido.createdAt)}</p>
      ${pedido.customerName ? `<p>Cliente: ${pedido.customerName}</p>` : ''}
      ${pedido.tableNumber ? `<p>Pedido a nombre de: ${pedido.tableNumber}</p>` : ''}
      <p>Tipo: ${{ mesa: 'Para comer en el local', para_llevar: 'Para llevar', domicilio: 'Domicilio' }[pedido.orderType] || 'Para llevar'}</p>
    </div>
    <div class="f-linea"></div>
    <table class="f-items">
      <thead><tr><th></th><th>Producto</th><th class="precio">Subtotal</th></tr></thead>
      <tbody>${filasItems}</tbody>
    </table>
    <div class="f-linea"></div>
    ${pedido.discountAmount > 0 ? `
      <div class="f-datos">
        <p>Subtotal: ${formatoDinero(pedido.total + pedido.discountAmount)}</p>
        <p>Descuento${pedido.discountReason ? ' (' + pedido.discountReason + ')' : ''}: -${formatoDinero(pedido.discountAmount)}</p>
      </div>
    ` : ''}
    <div class="f-total">
      <span>TOTAL</span>
      <span>${formatoDinero(pedido.total)}</span>
    </div>
    ${pedido.paymentMethod ? `<p class="f-metodo-pago">Pago: ${pedido.paymentMethod}</p>` : ''}
    <div class="f-footer">
      <p>¡Gracias por su compra!</p>
    </div>
  `;
}

document.getElementById('btnImprimir').onclick = () => window.print();
document.getElementById('btnCerrar').onclick = () => window.close();

cargarFactura();
