const socket = io();

let pedidos = {}; // id -> pedido

const siguienteEstado = {
  pendiente: 'preparando',
  preparando: 'listo',
  listo: 'entregado'
};

const textoBoton = {
  pendiente: 'Iniciar preparación',
  preparando: 'Marcar como listo',
  listo: 'Entregado'
};

function tiempoTranscurrido(fechaISO) {
  const minutos = Math.floor((Date.now() - new Date(fechaISO).getTime()) / 60000);
  if (minutos < 1) return 'recién llegó';
  return `hace ${minutos} min`;
}

function crearTarjeta(pedido) {
  const div = document.createElement('div');
  div.className = `tarjeta ${pedido.status}`;
  div.dataset.id = pedido.id;

  const itemsHtml = pedido.items
    .map(i => `<li><span class="cant">${i.qty}x</span>${i.name}${i.notes ? `<span class="nota-kds">${i.notes}</span>` : ''}</li>`)
    .join('');

  div.innerHTML = `
    <div class="cabecera">
      <span class="numero">
        Pedido #${pedido.orderNumber}
        ${pedido.edited ? '<span class="marca-editado">✎ Editado</span>' : ''}
        ${pedido.customerName ? `<span class="cliente-kds">${pedido.customerName}</span>` : ''}
      </span>
      <span class="tiempo">${tiempoTranscurrido(pedido.createdAt)}</span>
    </div>
    <ul>${itemsHtml}</ul>
    <button>${textoBoton[pedido.status]}</button>
  `;

  div.querySelector('button').onclick = () => avanzarEstado(pedido);
  return div;
}

async function avanzarEstado(pedido) {
  const nuevoEstado = siguienteEstado[pedido.status];
  if (!nuevoEstado) return;
  await fetch(`/api/orders/${pedido.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: nuevoEstado })
  });
}

function renderTablero() {
  ['pendiente', 'preparando', 'listo'].forEach(estado => {
    const columna = document.getElementById(`col-${estado}`);
    columna.innerHTML = '';
    const delEstado = Object.values(pedidos)
      .filter(p => p.status === estado)
      .sort((a, b) => a.orderNumber - b.orderNumber);

    if (delEstado.length === 0) {
      const vacio = document.createElement('div');
      vacio.className = 'vacio-columna';
      vacio.textContent = 'Sin pedidos';
      columna.appendChild(vacio);
    } else {
      delEstado.forEach(p => columna.appendChild(crearTarjeta(p)));
    }
  });
}

async function cargarPedidos() {
  const res = await fetch('/api/orders');
  const lista = await res.json();
  pedidos = {};
  lista
    .filter(p => p.status !== 'entregado')
    .forEach(p => { pedidos[p.id] = p; });
  renderTablero();
}

socket.on('order-created', pedido => {
  pedidos[pedido.id] = pedido;
  renderTablero();
});

socket.on('order-updated', pedido => {
  if (pedido.status === 'entregado') {
    delete pedidos[pedido.id];
  } else {
    pedidos[pedido.id] = pedido;
  }
  renderTablero();
});

function actualizarReloj() {
  document.getElementById('reloj').textContent = new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit'
  });
}

setInterval(() => {
  actualizarReloj();
  renderTablero(); // refresca los "hace X min"
}, 15000);

actualizarReloj();
cargarPedidos();
