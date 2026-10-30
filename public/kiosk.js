// kiosk.js — autopedido por pasos:
//   1) ¿aquí o para llevar?  2) elegir productos  3) revisar, poner nombre y enviar

let menu = [];
let categorias = [];
let categoriaActiva = '';
let carrito = {}; // { clave: { id, name, price, qty, note, comboItems } }
let productoEnModal = null;
let tipoPedidoSeleccionado = null;

const ETIQUETAS_TIPO = { mesa: '🍽️ Aquí en el local', para_llevar: '🥡 Para llevar' };

const pantallaInicio = document.getElementById('pantallaInicio');
const pantallaMenu = document.getElementById('pantallaMenu');
const botonCambiarTipo = document.getElementById('botonCambiarTipo');

const tabsEl = document.getElementById('tabs');
const gridEl = document.getElementById('grid');

const barraEl = document.getElementById('barraTotal');
const barraCantidad = document.getElementById('barraCantidad');
const barraValor = document.getElementById('barraValor');
const botonVerPedido = document.getElementById('botonVerPedido');

const hojaPedidoFondo = document.getElementById('hojaPedidoFondo');
const botonCerrarHoja = document.getElementById('botonCerrarHoja');
const itemsCarritoEl = document.getElementById('itemsCarrito');
const mensajeVacio = document.getElementById('mensajeVacio');
const totalEl = document.getElementById('total');
const campoMesaEl = document.getElementById('campoMesa');
const errorNombreEl = document.getElementById('errorNombre');
const botonEnviar = document.getElementById('botonEnviar');
const botonSeguir = document.getElementById('botonSeguir');
const botonCancelar = document.getElementById('botonCancelar');

const toastEl = document.getElementById('toast');

const modalFondo = document.getElementById('modalFondo');
const modalTitulo = document.getElementById('modalTitulo');
const modalIngredientes = document.getElementById('modalIngredientes');
const modalNota = document.getElementById('modalNota');
const modalCancelar = document.getElementById('modalCancelar');
const modalConfirmar = document.getElementById('modalConfirmar');

const modalConfirmacionFondo = document.getElementById('modalConfirmacionFondo');
const confirmacionTexto = document.getElementById('confirmacionTexto');
const botonNuevoPedido = document.getElementById('botonNuevoPedido');

// Si la tablet queda fija con un nombre, se puede abrir con ?nombre=Camilo y queda
// precargado (también acepta ?mesa= por compatibilidad con enlaces anteriores).
const params = new URLSearchParams(window.location.search);
const nombreDesdeUrl = params.get('nombre') || params.get('mesa') || '';
campoMesaEl.value = nombreDesdeUrl;

function formatoDinero(valor) {
  return '$' + valor.toLocaleString('es-CO');
}

function mostrarToast(mensaje) {
  toastEl.textContent = mensaje;
  toastEl.classList.add('mostrar');
  setTimeout(() => toastEl.classList.remove('mostrar'), 2500);
}

// ---------- Pasos ----------

function mostrarPantalla(cual) {
  pantallaInicio.style.display = cual === 'inicio' ? 'flex' : 'none';
  pantallaMenu.style.display = cual === 'menu' ? 'flex' : 'none';
}

function elegirTipo(tipo) {
  tipoPedidoSeleccionado = tipo;
  botonCambiarTipo.textContent = `${ETIQUETAS_TIPO[tipo]} · Cambiar`;
  mostrarPantalla('menu');
}

document.querySelectorAll('.inicio-opcion').forEach(btn => {
  btn.onclick = () => elegirTipo(btn.dataset.tipo);
});
botonCambiarTipo.onclick = () => mostrarPantalla('inicio');

// ---------- Menú ----------

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

function iconoGenerico(categoria) {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('hamburgu')) return '🍔';
  if (cat.includes('bebida')) return '🥤';
  if (cat.includes('postre') || cat.includes('dulce')) return '🍰';
  if (cat.includes('perro')) return '🌭';
  if (cat.includes('combo')) return '🎁';
  if (cat.includes('extra') || cat.includes('papa') || cat.includes('acompañ')) return '🍟';
  return '🍽️';
}

function renderTabs() {
  tabsEl.innerHTML = '';
  categorias.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab-boton' + (cat === categoriaActiva ? ' activo' : '');
    btn.innerHTML = `<span class="tab-icono">${iconoGenerico(cat)}</span><span class="tab-texto">${cat}</span>`;
    btn.onclick = () => {
      categoriaActiva = cat;
      renderTabs();
      renderGrid();
      gridEl.scrollTop = 0;
    };
    tabsEl.appendChild(btn);
  });
}

function renderGrid() {
  gridEl.innerHTML = '';
  menu.filter(p => p.category === categoriaActiva).forEach(producto => {
    const div = document.createElement('div');
    div.className = 'producto';
    div.dataset.id = producto.id;
    div.innerHTML = `
      <div class="producto-foto">
        ${producto.image
          ? `<img class="producto-img" src="${producto.image}" alt="${producto.name}">`
          : `<div class="producto-img-generica">${iconoGenerico(producto.category)}</div>`}
        <div class="producto-controles">
          <span class="producto-cantidad" hidden></span>
          <button type="button" class="producto-menos" hidden aria-label="Quitar uno">−</button>
        </div>
        <div class="producto-boton-mas">+</div>
      </div>
      <div class="producto-info">
        <div class="nombre">${producto.name}</div>
        ${producto.combo_items ? `<div class="combo-item">Incluye: ${producto.combo_items}</div>` : ''}
        ${producto.ingredients ? `<div class="producto-descripcion">${producto.ingredients}</div>` : ''}
        <div class="precio">${formatoDinero(producto.price)}</div>
      </div>
    `;
    div.onclick = () => manejarClickProducto(producto);
    div.querySelector('.producto-menos').onclick = e => {
      e.stopPropagation();
      quitarUnoDeProducto(producto.id);
    };
    gridEl.appendChild(div);
  });
  // las tarjetas se dibujan de cero: hay que volver a pintar los contadores del carrito
  actualizarContadoresProductos();
}

function manejarClickProducto(producto) {
  if (producto.ingredients && producto.ingredients.trim() !== '') {
    abrirModal(producto);
  } else {
    agregarAlCarrito(producto.id, {
      id: producto.id, name: producto.name, price: producto.price, note: '',
      comboItems: producto.combo_items || ''
    });
  }
}

// ---------- Personalizar (quitar ingredientes) ----------

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
  agregarAlCarrito(clave, {
    id: productoEnModal.id,
    name: productoEnModal.name,
    price: productoEnModal.price,
    note,
    comboItems: productoEnModal.combo_items || ''
  });
  cerrarModal();
};

// ---------- Carrito ----------

function agregarAlCarrito(clave, datos) {
  if (!carrito[clave]) carrito[clave] = { ...datos, qty: 0 };
  carrito[clave].qty += 1;
  renderCarrito();

  // pequeño "latido" en la barra inferior para confirmar que se agregó
  barraEl.classList.remove('pulso');
  void barraEl.offsetWidth;
  barraEl.classList.add('pulso');
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
          ${item.comboItems ? `<span class="combo-item">Incluye: ${item.comboItems}</span>` : ''}
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

  const items = Object.values(carrito);
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cantidad = items.reduce((sum, i) => sum + i.qty, 0);

  totalEl.textContent = formatoDinero(total);
  barraValor.textContent = formatoDinero(total);
  barraCantidad.textContent = cantidad === 0
    ? 'Tu pedido está vacío'
    : `${cantidad} producto${cantidad > 1 ? 's' : ''}`;
  botonVerPedido.disabled = cantidad === 0;
  actualizarContadoresProductos();
  botonEnviar.disabled = cantidad === 0;

  // si se quitó todo mientras la hoja estaba abierta, se cierra sola
  if (cantidad === 0) cerrarHoja();
}

// ---------- Hoja "Tu pedido" ----------

function abrirHoja() {
  hojaPedidoFondo.classList.add('visible');
}

function cerrarHoja() {
  hojaPedidoFondo.classList.remove('visible');
}

botonVerPedido.onclick = abrirHoja;
botonCerrarHoja.onclick = cerrarHoja;
botonSeguir.onclick = cerrarHoja;
hojaPedidoFondo.onclick = e => { if (e.target === hojaPedidoFondo) cerrarHoja(); };
botonCancelar.onclick = () => { carrito = {}; renderCarrito(); };

campoMesaEl.addEventListener('input', () => {
  campoMesaEl.classList.remove('error');
  errorNombreEl.textContent = '';
});

// ---------- Enviar ----------

async function enviarPedido() {
  const nombre = campoMesaEl.value.trim();
  if (!nombre) {
    campoMesaEl.classList.add('error');
    errorNombreEl.textContent = 'Escribe tu nombre para llamarte cuando esté listo';
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
      body: JSON.stringify({ items, tableNumber: nombre, orderType: tipoPedidoSeleccionado || 'mesa' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');

    confirmacionTexto.textContent = `Pedido #${data.orderNumber} — ${nombre}`;
    modalConfirmacionFondo.classList.add('visible');

    carrito = {};
    renderCarrito();
  } catch (e) {
    mostrarToast(e.message || 'Error al enviar el pedido. Intenta de nuevo.');
  } finally {
    botonEnviar.textContent = 'ENVIAR PEDIDO';
    botonEnviar.disabled = Object.keys(carrito).length === 0;
  }
}

botonEnviar.onclick = enviarPedido;

// Para la siguiente persona: vuelve al primer paso con todo limpio.
botonNuevoPedido.onclick = () => {
  modalConfirmacionFondo.classList.remove('visible');
  cerrarHoja();
  campoMesaEl.value = nombreDesdeUrl;
  tipoPedidoSeleccionado = null;
  categoriaActiva = categorias[0];
  renderTabs();
  renderGrid();
  gridEl.scrollTop = 0;
  mostrarPantalla('inicio');
};

// ---------- Marca (logo y nombre del local) ----------

async function cargarMarca() {
  const res = await fetch('/api/settings');
  const settings = await res.json();
  if (settings.logo) {
    ['logoHeader', 'logoInicio'].forEach(id => {
      const logo = document.getElementById(id);
      logo.src = settings.logo;
      logo.style.display = 'block';
    });
  }
  if (settings.restaurantName) {
    document.getElementById('tituloHeader').textContent = settings.restaurantName;
    document.getElementById('tituloInicio').textContent = settings.restaurantName;
  }
}

mostrarPantalla('inicio');
cargarMenu();
renderCarrito();
cargarMarca();

// Si el administrador cambia el menú o la marca mientras hay tablets activas,
// se refresca solo (usa el mismo canal de tiempo real que caja y cocina).
if (window.io) {
  const socket = io({ query: { publico: "1" } }); // kiosco: sin login, solo menu y marca
  socket.on('menu-updated', cargarMenu);
  socket.on('settings-updated', cargarMarca);
}

// Muestra en cada producto cuántas unidades hay en el carrito (suma todas sus variantes,
// por ejemplo la misma hamburguesa con y sin cebolla).
function actualizarContadoresProductos() {
  const cantidades = {};
  Object.values(carrito).forEach(i => { cantidades[i.id] = (cantidades[i.id] || 0) + i.qty; });
  document.querySelectorAll('.producto[data-id]').forEach(el => {
    const n = cantidades[el.dataset.id] || 0;
    const badge = el.querySelector('.producto-cantidad');
    if (badge) {
      badge.textContent = n;
      badge.hidden = n === 0;
    }
    const menos = el.querySelector('.producto-menos');
    if (menos) menos.hidden = n === 0;
    el.classList.toggle('en-carrito', n > 0);
  });
}

// Quita una unidad de un producto desde su tarjeta. Si el producto está en el carrito
// con varias variantes (por ejemplo con y sin cebolla), quita de la última agregada.
function quitarUnoDeProducto(productoId) {
  const claves = Object.keys(carrito).filter(k => carrito[k].id === productoId);
  if (!claves.length) return;
  cambiarCantidad(claves[claves.length - 1], -1);
}
