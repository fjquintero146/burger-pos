const formNuevo = document.getElementById('formNuevo');
const mensajeForm = document.getElementById('mensajeForm');
const listaProductosEl = document.getElementById('listaProductos');
const listaCategorias = document.getElementById('listaCategorias');

function mostrarMensaje(texto, tipo) {
  mensajeForm.textContent = texto;
  mensajeForm.className = 'mensaje ' + tipo;
  setTimeout(() => { mensajeForm.textContent = ''; mensajeForm.className = 'mensaje'; }, 3500);
}

async function cargarProductos() {
  const res = await fetch('/api/admin/menu');
  const productos = await res.json();
  renderCategorias(productos);
  renderLista(productos);
}

function renderCategorias(productos) {
  const categorias = [...new Set(productos.map(p => p.category))];
  listaCategorias.innerHTML = categorias.map(c => `<option value="${c}">`).join('');
}

function renderLista(productos) {
  listaProductosEl.innerHTML = '';
  const categorias = [...new Set(productos.map(p => p.category))];

  categorias.forEach(cat => {
    const encabezado = document.createElement('div');
    encabezado.className = 'categoria-encabezado';
    encabezado.textContent = cat;
    listaProductosEl.appendChild(encabezado);

    productos.filter(p => p.category === cat).forEach(producto => {
      listaProductosEl.appendChild(crearFila(producto));
    });
  });
}

function crearFila(producto) {
  const fila = document.createElement('div');
  fila.className = 'fila-producto' + (producto.active ? '' : ' inactivo');
  fila.innerHTML = `
    <input type="text" class="input-nombre" value="${producto.name}">
    <input type="number" class="input-precio" value="${producto.price}" min="0" step="500">
    <input type="text" class="input-ingredientes" value="${producto.ingredients || ''}" placeholder="Ingredientes separados por coma">
    <span class="etiqueta-estado ${producto.active ? 'activo' : ''}">${producto.active ? 'Visible en caja' : 'Oculto'}</span>
    <button class="btn-guardar">Guardar</button>
    <button class="btn-toggle">${producto.active ? 'Ocultar' : 'Mostrar'}</button>
    <button class="btn-eliminar">Eliminar</button>
  `;

  fila.querySelector('.btn-guardar').onclick = () => guardarProducto(producto, fila);
  fila.querySelector('.btn-toggle').onclick = () => toggleActivo(producto);
  fila.querySelector('.btn-eliminar').onclick = () => eliminarProducto(producto);

  return fila;
}

async function guardarProducto(producto, fila) {
  const name = fila.querySelector('.input-nombre').value.trim();
  const price = fila.querySelector('.input-precio').value;
  const ingredients = fila.querySelector('.input-ingredientes').value.trim();

  if (!name || price === '' || isNaN(price)) {
    mostrarMensaje('Nombre y precio son obligatorios', 'error');
    return;
  }

  const res = await fetch(`/api/admin/menu/${producto.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, price: Number(price), ingredients })
  });

  if (res.ok) {
    mostrarMensaje('Producto actualizado', 'exito');
    cargarProductos();
  } else {
    const data = await res.json();
    mostrarMensaje(data.error || 'No se pudo guardar', 'error');
  }
}

async function toggleActivo(producto) {
  await fetch(`/api/admin/menu/${producto.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: producto.active ? 0 : 1 })
  });
  cargarProductos();
}

async function eliminarProducto(producto) {
  if (!confirm(`¿Eliminar "${producto.name}"? Esta acción no se puede deshacer.`)) return;

  const res = await fetch(`/api/admin/menu/${producto.id}`, { method: 'DELETE' });
  if (res.ok) {
    mostrarMensaje('Producto eliminado', 'exito');
    cargarProductos();
  } else {
    const data = await res.json();
    mostrarMensaje(data.error || 'No se pudo eliminar', 'error');
  }
}

formNuevo.addEventListener('submit', async e => {
  e.preventDefault();
  const category = document.getElementById('nuevaCategoria').value.trim();
  const name = document.getElementById('nuevoNombre').value.trim();
  const price = document.getElementById('nuevoPrecio').value;
  const ingredients = document.getElementById('nuevosIngredientes').value.trim();

  const res = await fetch('/api/admin/menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, name, price: Number(price), ingredients })
  });

  if (res.ok) {
    mostrarMensaje('Producto agregado correctamente', 'exito');
    formNuevo.reset();
    cargarProductos();
  } else {
    const data = await res.json();
    mostrarMensaje(data.error || 'No se pudo agregar', 'error');
  }
});

cargarProductos();
