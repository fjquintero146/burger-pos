let menu = [];
let categorias = [];
let categoriaActiva = '';
let carrito = {};
let productoEnModal = null;

const tabsEl = document.getElementById('tabs');
const gridEl = document.getElementById('grid');
const itemsCarritoEl = document.getElementById('itemsCarrito');
const mensajeVacio = document.getElementById('mensajeVacio');
const totalEl = document.getElementById('total');
const botonEnviar = document.getElementById('botonEnviar');
const botonCancelar = document.getElementById('botonCancelar');
const toastEl = document.getElementById('toast');
const campoMesaEl = document.getElementById('campoMesa');

const modalFondo = document.getElementById('modalFondo');
const modalTitulo = document.getElementById('modalTitulo');
const modalIngredientes = document.getElementById('modalIngredientes');
const modalNota = document.getElementById('modalNota');
const modalCancelar = document.getElementById('modalCancelar');
const modalConfirmar = document.getElementById('modalConfirmar');

const modalConfirmacionFondo = document.getElementById('modalConfirmacionFondo');
const confirmacionTexto = document.getElementById('confirmacionTexto');
const botonNuevoPedido = document.getElementById('botonNuevoPedido');

// Si la tablet queda fija en un punto, se puede abrir con ?nombre=Camilo y queda precargado
// (compatibilidad: también acepta ?mesa= por si ya guardaste ese enlace).
const nombreDesdeUrl = new URLSearchParams(window.location.search).get('nombre')
  || new URLSearchParams(window.location.search).get('mesa');
if (nombreDesdeUrl) campoMesaEl.value = nombreDesdeUrl;

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
    btn.onclick = () => { categoriaActiva = cat; renderTabs(); renderGrid(); };
    tabsEl.appendChild(btn);
  });
}

function iconoGenerico(categoria) {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('hamburgu')) return '🍔';
  if (cat.includes('bebida')) return '🥤';
  if (cat.includes('postre') || cat.includes('dulce')) return '🍰';
  if (cat.includes('extra') || cat.includes('papa') || cat.includes('acompañ')) return '🍟';
  return '🍽️';
}

function renderGrid() {
  gridEl.innerHTML = '';
  menu.filter(p => p.category === categoriaActiva).forEach(producto => {
    const div = document.createElement('div');
    div.className = 'producto';
    div.innerHTML = `
      <div class="producto-foto">
        ${producto.image
          ? `<img class="producto-img" src="${producto.image}" alt="${producto.name}">`
          : `<div class="producto-img-generica">${iconoGenerico(producto.category)}</div>`}
        <div class="producto-boton-mas">+</div>
      </div>
      <div class="producto-info">
        <div class="nombre">${producto.name}</div>
        <div class="precio">${formatoDinero(producto.price)}</div>
      </div>
    `;
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

function abrirModal(producto) {
  productoEnModal = producto;
  modalTitulo.textContent = `Personalizar: ${producto.name}`;
  modalNota.value = '';

  const ingredientesUnicos = [...new Set(producto.ingredients.split(',').map(i => i.trim()).filter(Boolean))];
  modalIngredientes.innerHTML = '';
  ingredientesUnicos.forEach(ingrediente => {
    const label = document.createElement('label');
    label.className = 'modal-ingrediente';
    label.innerHTML = `<input type="checkbox" checked data-ingrediente="${ingrediente}"> <span>${ingrediente}</span>`;
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', () => label.classList.toggle('desmarcado', !checkbox.checked));
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
  agregarAlCarrito(clave, { id: productoEnModal.id, name: productoEnModal.name, price: productoEnModal.price, note });
  cerrarModal();
};

function agregarAlCarrito(clave, datos) {
  if (!carrito[clave]) carrito[clave] = { ...datos, qty: 0 };
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
        <span class="nombre-item">${item.name}${item.note ? `<span class="nota-item">${item.note}</span>` : ''}</span>
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

async function enviarPedido() {
  const mesa = campoMesaEl.value.trim();
  if (!mesa) {
    mostrarToast('Escribe tu nombre antes de enviar');
    campoMesaEl.focus();
    return;
  }

  const items = Object.values(carrito).map(i => ({
    productId: i.id, name: i.name, price: i.price, qty: i.qty, note: i.note || ''
  }));
  if (!items.length) return;

  botonEnviar.disabled = true;
  botonEnviar.textContent = 'ENVIANDO...';

  try {
    const res = await fetch('/api/kiosk/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, tableNumber: mesa })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');

    confirmacionTexto.textContent = `Pedido #${data.orderNumber} — ${mesa}`;
    modalConfirmacionFondo.classList.add('visible');

    carrito = {};
    renderCarrito();
  } catch (e) {
    mostrarToast(e.message || 'Error al enviar el pedido. Intenta de nuevo.');
  } finally {
    botonEnviar.textContent = 'ENVIAR PEDIDO';
  }
}

botonEnviar.onclick = enviarPedido;
botonCancelar.onclick = () => { carrito = {}; renderCarrito(); };
botonNuevoPedido.onclick = () => { modalConfirmacionFondo.classList.remove('visible'); };

async function cargarMarca() {
  const res = await fetch('/api/settings');
  const settings = await res.json();
  if (settings.logo) {
    const logo = document.getElementById('logoHeader');
    logo.src = settings.logo;
    logo.style.display = 'block';
  }
  if (settings.restaurantName) {
    document.getElementById('tituloHeader').textContent = settings.restaurantName;
  }
}

cargarMenu();
renderCarrito();
cargarMarca();

// Si el administrador cambia el menú mientras hay tablets activas,
// se refresca solo (usa el mismo canal de tiempo real que caja y cocina).
if (window.io) {
  const socket = io();
  socket.on('menu-updated', cargarMenu);
  socket.on('settings-updated', cargarMarca);
}
