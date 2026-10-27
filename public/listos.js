const socket = io();
const tableroListos = document.getElementById('tableroListos');
const sinPedidosListos = document.getElementById('sinPedidosListos');

const iconosTipo = { mesa: '🍽️', para_llevar: '🥡', domicilio: '🛵' };

let pedidosListos = {}; // id-lógico -> { orderNumber, nombre, tipo }

function renderTablero() {
  const claves = Object.keys(pedidosListos);
  tableroListos.innerHTML = '';

  if (!claves.length) {
    tableroListos.appendChild(sinPedidosListos);
    return;
  }

  claves
    .sort((a, b) => pedidosListos[a].orderNumber - pedidosListos[b].orderNumber)
    .forEach(clave => {
      const p = pedidosListos[clave];
      const tarjeta = document.createElement('div');
      tarjeta.className = 'tarjeta-listo';
      tarjeta.innerHTML = `
        <div class="numero-listo">#${p.orderNumber}</div>
        <div class="icono-tipo-listo">${iconosTipo[p.tipo] || ''}</div>
        ${p.nombre ? `<div class="nombre-listo">${p.nombre}</div>` : ''}
      `;
      tableroListos.appendChild(tarjeta);
    });
}

async function cargarPedidosListos() {
  const res = await fetch('/api/pedidos-listos');
  const lista = await res.json();
  pedidosListos = {};
  lista.forEach(p => {
    pedidosListos[p.orderNumber] = {
      orderNumber: p.orderNumber,
      nombre: p.tableNumber || p.customerName || '',
      tipo: p.orderType
    };
  });
  renderTablero();
}

// Cuando un pedido pasa a "listo" aparece; si cambia a otra cosa (lo entregan) o
// se anula, desaparece del tablero.
socket.on('order-updated', pedido => {
  if (pedido.status === 'listo') {
    pedidosListos[pedido.orderNumber] = {
      orderNumber: pedido.orderNumber,
      nombre: pedido.tableNumber || pedido.customerName || '',
      tipo: pedido.orderType
    };
  } else {
    delete pedidosListos[pedido.orderNumber];
  }
  renderTablero();
});

socket.on('order-voided', pedido => {
  delete pedidosListos[pedido.orderNumber];
  renderTablero();
});

async function cargarMarca() {
  const res = await fetch('/api/settings');
  const settings = await res.json();
  if (settings.logo) {
    const logo = document.getElementById('logoHeader');
    logo.src = settings.logo;
    logo.style.display = 'block';
  }
}

function actualizarReloj() {
  document.getElementById('reloj').textContent = new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit'
  });
}

setInterval(actualizarReloj, 15000);
actualizarReloj();
cargarMarca();
cargarPedidosListos();
