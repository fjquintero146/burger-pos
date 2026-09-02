const socket = io();

let menu = [];
let categorias = [];
let categoriaActiva = '';
let carrito = {}; // { claveCarrito: { id, name, price, qty, note } }
let productoEnModal = null;
let pedidoEnEdicionId = null;
let pedidoEnEdicionNumero = null;

const tabsEl = document.getElementById('tabs');
const gridEl = document.getElementById('grid');
const itemsCarritoEl = document.getElementById('itemsCarrito');
const mensajeVacio = document.getElementById('mensajeVacio');
const totalEl = document.getElementById('total');
const botonEnviar = document.getElementById('botonEnviar');
const botonCancelar = document.getElementById('botonCancelar');
const ultimoPedidoEl = document.getElementById('ultimoPedido');
const toastEl = document.getElementById('toast');
const tituloCarritoEl = document.getElementById('tituloCarrito');
const campoClienteEl = document.getElementById('campoCliente');

const modalFondo = document.getElementById('modalFondo');
const modalTitulo = document.getElementById('modalTitulo');
const modalIngredientes = document.getElementById('modalIngredientes');
const modalNota = document.getElementById('modalNota');
const modalCancelar = document.getElementById('modalCancelar');
const modalConfirmar = document.getElementById('modalConfirmar');

const botonPedidosActivos = document.getElementById('botonPedidosActivos');
const modalPedidosFondo = document.getElementById('modalPedidosFondo');
const listaPedidosActivosEl = document.getElementById('listaPedidosActivos');
const botonCerrarPedidosActivos = document.getElementById('botonCerrarPedidosActivos');

const botonPorCobrar = document.getElementById('botonPorCobrar');
const badgeCobrar = document.getElementById('badgeCobrar');
const modalCobrarFondo = document.getElementById('modalCobrarFondo');
const listaPorCobrarEl = document.getElementById('listaPorCobrar');
const botonCerrarPorCobrar = document.getElementById('botonCerrarPorCobrar');

function formatoDinero(valor) {
  return '$' + valor.toLocaleString('es-CO');
}

function mostrarToast(mensaje) {
  toastEl.textContent = mensaje;
  toastEl.classList.add('mostrar');
  setTimeout(() => toastEl.classList.remove('mostrar'), 2500);
}

async function cargarMenu() {
  const res = await fetch('/api/menu');
  menu = await res.json();
  categorias = [...new Set(menu.map(p => p.category))];
  if (!categoriaActiva || !categorias.includes(categoriaActiva)) {
    categoriaActiva = categorias[0];
  }
  renderTabs();
  renderGrid();
}

function renderTabs() {
  tabsEl.innerHTML = '';
  categorias.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tab-boton' + (cat === categoriaActiva ? ' activo' : '');
    btn.textContent = cat;
    btn.onclick = () => {
      categoriaActiva = cat;
      renderTabs();
      renderGrid();
    };
    tabsEl.appendChild(btn);
  });
}

function renderGrid() {
  gridEl.innerHTML = '';
  menu.filter(p => p.category === categoriaActiva).forEach(producto => {
    const div = document.createElement('div');
    div.className = 'producto';
    div.innerHTML = `<div class="nombre">${producto.name}</div><div class="precio">${formatoDinero(producto.price)}</div>`;
    div.onclick = () => manejarClickProducto(producto);
    gridEl.appendChild(div);
  });
}

function manejarClickProducto(producto) {
  if (producto.ingredients && producto.ingredients.trim() !== '') {
    abrirModal(producto);
  } else {
    agregarAlCarrito(producto.id, { id: producto.id, name: producto.name, price: producto.price, note: '' });
  }
}

// ---------- Modal de personalización ----------

function abrirModal(producto) {
  productoEnModal = producto;
  modalTitulo.textContent = `Personalizar: ${producto.name}`;
  modalNota.value = '';

  const ingredientesUnicos = [...new Set(
    producto.ingredients.split(',').map(i => i.trim()).filter(Boolean)
  )];

  modalIngredientes.innerHTML = '';
  ingredientesUnicos.forEach(ingrediente => {
    const label = document.createElement('label');
    label.className = 'modal-ingrediente';
    label.innerHTML = `<input type="checkbox" checked data-ingrediente="${ingrediente}"> <span>${ingrediente}</span>`;
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', () => {
      label.classList.toggle('desmarcado', !checkbox.checked);
    });
    modalIngredientes.appendChild(label);
  });

  modalFondo.classList.add('visible');
}

function cerrarModal() {
  modalFondo.classList.remove('visible');
  productoEnModal = null;
}

modalCancelar.onclick = cerrarModal;
modalFondo.onclick = e => { if (e.target === modalFondo) cerrarModal(); };

modalConfirmar.onclick = () => {
  if (!productoEnModal) return;

  const quitados = [...modalIngredientes.querySelectorAll('input[type="checkbox"]')]
    .filter(chk => !chk.checked)
    .map(chk => chk.dataset.ingrediente);

  const notaLibre = modalNota.value.trim();
  const partes = [];
  if (quitados.length) partes.push('Sin ' + quitados.join(', '));
  if (notaLibre) partes.push(notaLibre);
  const note = partes.join(' — ');

  const clave = note ? `${productoEnModal.id}|${note}` : productoEnModal.id;
  agregarAlCarrito(clave, {
    id: productoEnModal.id,
    name: productoEnModal.name,
    price: productoEnModal.price,
    note
  });

  cerrarModal();
};

// ---------- Carrito ----------

function agregarAlCarrito(clave, datos) {
  if (!carrito[clave]) {
    carrito[clave] = { ...datos, qty: 0 };
  }
  carrito[clave].qty += 1;
  renderCarrito();
}

function cambiarCantidad(clave, delta) {
  if (!carrito[clave]) return;
  carrito[clave].qty += delta;
  if (carrito[clave].qty <= 0) delete carrito[clave];
  renderCarrito();
}

function renderCarrito() {
  const claves = Object.keys(carrito);
  itemsCarritoEl.innerHTML = '';

  if (claves.length === 0) {
    itemsCarritoEl.appendChild(mensajeVacio);
  } else {
    claves.forEach(clave => {
      const item = carrito[clave];
      const linea = document.createElement('div');
      linea.className = 'linea-item';
      linea.innerHTML = `
        <span class="nombre-item">
          ${item.name}
          ${item.note ? `<span class="nota-item">${item.note}</span>` : ''}
        </span>
        <div class="cantidad-control">
          <button class="menos">−</button>
          <span class="cantidad">${item.qty}</span>
          <button class="mas">+</button>
        </div>
        <span class="subtotal">${formatoDinero(item.price * item.qty)}</span>
      `;
      linea.querySelector('.menos').onclick = () => cambiarCantidad(clave, -1);
      linea.querySelector('.mas').onclick = () => cambiarCantidad(clave, 1);
      itemsCarritoEl.appendChild(linea);
    });
  }

  const total = Object.values(carrito).reduce((sum, i) => sum + i.price * i.qty, 0);
  totalEl.textContent = formatoDinero(total);
  botonEnviar.disabled = claves.length === 0;
}

// ---------- Enviar pedido / Guardar cambios ----------

async function enviarPedido() {
  const items = Object.values(carrito).map(i => ({
    productId: i.id,
    name: i.name,
    price: i.price,
    qty: i.qty,
    note: i.note || ''
  }));
  if (!items.length) return;

  const customerName = campoClienteEl.value.trim();
  const editando = !!pedidoEnEdicionId;

  botonEnviar.disabled = true;
  botonEnviar.textContent = editando ? 'GUARDANDO...' : 'ENVIANDO...';

  try {
    const url = editando ? `/api/orders/${pedidoEnEdicionId}` : '/api/orders';
    const method = editando ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, customerName })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Error del servidor');
    }
    const pedido = await res.json();

    ultimoPedidoEl.innerHTML = `Último pedido: #${pedido.orderNumber}
      <a href="receipt.html?id=${pedido.id}" target="_blank" class="link-reimprimir">🖨 Reimprimir</a>`;
    mostrarToast(editando
      ? `Pedido #${pedido.orderNumber} actualizado`
      : `Pedido #${pedido.orderNumber} enviado a cocina`);

    // Abre la factura en una ventana aparte y lanza la impresión automáticamente.
    window.open(`receipt.html?id=${pedido.id}`, '_blank', 'width=380,height=640');

    salirModoEdicion();
    carrito = {};
    campoClienteEl.value = '';
    renderCarrito();
  } catch (e) {
    mostrarToast(e.message || 'Error al enviar el pedido. Intenta de nuevo.');
  } finally {
    botonEnviar.textContent = pedidoEnEdicionId ? 'GUARDAR CAMBIOS' : 'ENVIAR A COCINA';
  }
}

function salirModoEdicion() {
  pedidoEnEdicionId = null;
  pedidoEnEdicionNumero = null;
  tituloCarritoEl.textContent = 'Pedido Actual';
  botonEnviar.textContent = 'ENVIAR A COCINA';
  const aviso = document.querySelector('.aviso-edicion');
  if (aviso) aviso.remove();
}

botonEnviar.onclick = enviarPedido;
botonCancelar.onclick = () => {
  carrito = {};
  campoClienteEl.value = '';
  salirModoEdicion();
  renderCarrito();
};

// ---------- Pedidos activos (editar un pedido ya enviado a cocina) ----------

async function abrirPedidosActivos() {
  modalPedidosFondo.classList.add('visible');
  listaPedidosActivosEl.innerHTML = '<p class="sin-pedidos-activos">Cargando...</p>';

  const res = await fetch('/api/orders');
  const pedidos = (await res.json()).filter(p => ['pendiente', 'preparando', 'listo'].includes(p.status));

  if (!pedidos.length) {
    listaPedidosActivosEl.innerHTML = '<p class="sin-pedidos-activos">No hay pedidos activos en este momento</p>';
    return;
  }

  const textoEstado = { pendiente: 'Pendiente', preparando: 'Preparando', listo: 'Listo' };

  listaPedidosActivosEl.innerHTML = '';
  pedidos.forEach(pedido => {
    const fila = document.createElement('div');
    fila.className = 'fila-pedido-activo';
    const resumenItems = pedido.items.map(i => `${i.qty}x ${i.name}`).join(', ');
    fila.innerHTML = `
      <div class="info-pedido">
        <div class="numero-pedido">
          <span class="estado-pedido">${textoEstado[pedido.status] || pedido.status}</span>
          Pedido #${pedido.orderNumber} ${pedido.customerName ? '— ' + pedido.customerName : ''}
        </div>
        <div class="detalle-pedido">${resumenItems} · ${formatoDinero(pedido.total)}</div>
      </div>
      <button>Editar</button>
    `;
    fila.querySelector('button').onclick = () => cargarPedidoParaEditar(pedido);
    listaPedidosActivosEl.appendChild(fila);
  });
}

function cargarPedidoParaEditar(pedido) {
  carrito = {};
  pedido.items.forEach(item => {
    const clave = item.notes ? `${item.productId}|${item.notes}` : (item.productId || item.name);
    carrito[clave] = {
      id: item.productId,
      name: item.name,
      price: item.price,
      note: item.notes || '',
      qty: item.qty
    };
  });

  campoClienteEl.value = pedido.customerName || '';
  pedidoEnEdicionId = pedido.id;
  pedidoEnEdicionNumero = pedido.orderNumber;
  tituloCarritoEl.textContent = `Editando Pedido #${pedido.orderNumber}`;
  botonEnviar.textContent = 'GUARDAR CAMBIOS';

  if (!document.querySelector('.aviso-edicion')) {
    const aviso = document.createElement('p');
    aviso.className = 'aviso-edicion';
    aviso.textContent = '✎ Editando pedido ya enviado — agrega o quita productos y guarda los cambios';
    campoClienteEl.after(aviso);
  }

  modalPedidosFondo.classList.remove('visible');
  renderCarrito();
}

botonPedidosActivos.onclick = abrirPedidosActivos;
botonCerrarPedidosActivos.onclick = () => modalPedidosFondo.classList.remove('visible');
modalPedidosFondo.onclick = e => { if (e.target === modalPedidosFondo) modalPedidosFondo.classList.remove('visible'); };

// ---------- Pedidos por cobrar (autopedidos de mesa esperando pago) ----------

async function actualizarBadgeCobrar() {
  const res = await fetch('/api/orders');
  const pedidos = await res.json();
  const enEspera = pedidos.filter(p => p.status === 'esperando_pago');
  if (enEspera.length > 0) {
    badgeCobrar.textContent = enEspera.length;
    badgeCobrar.style.display = 'flex';
  } else {
    badgeCobrar.style.display = 'none';
  }
  return enEspera;
}

async function abrirPorCobrar() {
  modalCobrarFondo.classList.add('visible');
  listaPorCobrarEl.innerHTML = '<p class="sin-pedidos-activos">Cargando...</p>';

  const enEspera = await actualizarBadgeCobrar();

  if (!enEspera.length) {
    listaPorCobrarEl.innerHTML = '<p class="sin-pedidos-activos">No hay pedidos esperando pago</p>';
    return;
  }

  listaPorCobrarEl.innerHTML = '';
  enEspera.forEach(pedido => {
    const fila = document.createElement('div');
    fila.className = 'fila-pedido-activo';
    const resumenItems = pedido.items.map(i => `${i.qty}x ${i.name}`).join(', ');
    fila.innerHTML = `
      <div class="info-pedido">
        <div class="numero-pedido">
          <span class="mesa-pedido">Mesa ${pedido.tableNumber || '?'}</span>
          Pedido #${pedido.orderNumber}
        </div>
        <div class="detalle-pedido">${resumenItems} · ${formatoDinero(pedido.total)}</div>
      </div>
      <button class="btn-cobrar">Confirmar Pago</button>
    `;
    fila.querySelector('button').onclick = () => confirmarPago(pedido);
    listaPorCobrarEl.appendChild(fila);
  });
}

async function confirmarPago(pedido) {
  try {
    const res = await fetch(`/api/orders/${pedido.id}/confirmar-pago`, { method: 'PATCH' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo confirmar el pago');
    }
    mostrarToast(`Pago confirmado — Pedido #${pedido.orderNumber} pasó a cocina`);
    window.open(`receipt.html?id=${pedido.id}`, '_blank', 'width=380,height=640');
    abrirPorCobrar();
  } catch (e) {
    mostrarToast(e.message || 'Error al confirmar el pago');
  }
}

botonPorCobrar.onclick = abrirPorCobrar;
botonCerrarPorCobrar.onclick = () => modalCobrarFondo.classList.remove('visible');
modalCobrarFondo.onclick = e => { if (e.target === modalCobrarFondo) modalCobrarFondo.classList.remove('visible'); };

// Cuando llega un autopedido nuevo desde una tablet de mesa, avisa y actualiza el contador.
socket.on('kiosk-order-created', pedido => {
  mostrarToast(`Nuevo autopedido — Mesa ${pedido.tableNumber || '?'} — Pedido #${pedido.orderNumber}`);
  actualizarBadgeCobrar();
});
socket.on('order-created', actualizarBadgeCobrar);

// ---------- Sesión ----------

async function cargarSesion() {
  const res = await fetch('/api/me');
  const data = await res.json();
  if (data.user && data.user.role === 'administrador') {
    document.getElementById('linkAdmin').style.display = 'flex';
    document.getElementById('linkVentas').style.display = 'flex';
  }
}

document.getElementById('botonSalir').onclick = async e => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html';
};

// El menú se refresca al instante si alguien lo edita desde Administrar Menú.
socket.on('menu-updated', cargarMenu);

cargarSesion();
actualizarBadgeCobrar();
cargarMenu();
renderCarrito();
