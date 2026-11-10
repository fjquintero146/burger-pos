// users.js — cuentas del personal y las pantallas que puede ver cada una.

let modulos = [];
let plantillas = {};

const $ = id => document.getElementById(id);
const mensajeForm = $('mensajeForm');
const listaUsuariosEl = $('listaUsuarios');

// Lo que escribe el administrador (usuarios, etiquetas) se escapa antes de mostrarlo.
function esc(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mostrarMensaje(texto, tipo) {
  mensajeForm.textContent = texto;
  mensajeForm.className = 'mensaje ' + tipo;
  setTimeout(() => { mensajeForm.textContent = ''; mensajeForm.className = 'mensaje'; }, 4000);
}

// Dibuja una casilla por pantalla dentro de un contenedor, marcando las que correspondan.
function dibujarCasillas(contenedor, marcados, prefijo) {
  contenedor.innerHTML = '';
  modulos.forEach(m => {
    const id = `${prefijo}-${m.id}`;
    const label = document.createElement('label');
    label.className = 'pantalla-opcion';
    label.innerHTML = `<input type="checkbox" id="${esc(id)}" value="${esc(m.id)}" ${marcados.includes(m.id) ? 'checked' : ''}>
      <span>${esc(m.nombre)}<small>${esc(m.descripcion)}</small></span>`;
    contenedor.appendChild(label);
  });
}

function leerCasillas(contenedor) {
  return [...contenedor.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.value);
}

// ---------- Crear cuenta ----------

function aplicarPlantilla() {
  const clave = $('plantilla').value;
  const marcados = clave ? (plantillas[clave] || []) : [];
  dibujarCasillas($('casillasNuevo'), marcados, 'nuevo');
}
$('plantilla').addEventListener('change', aplicarPlantilla);

$('formNuevoUsuario').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('nuevoUsuario').value.trim();
  const password = $('nuevaClave').value;
  const permisos = leerCasillas($('casillasNuevo'));
  if (!permisos.length) {
    mostrarMensaje('Marca al menos una pantalla para esta cuenta', 'error');
    return;
  }
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, permisos })
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    mostrarMensaje(`Cuenta "${username}" creada`, 'exito');
    e.target.reset();
    $('plantilla').value = '';
    aplicarPlantilla();
    cargarUsuarios();
  } else {
    mostrarMensaje(data.error || 'No se pudo crear la cuenta', 'error');
  }
});

// ---------- Cuentas existentes ----------

async function cargarUsuarios() {
  const res = await fetch('/api/users');
  if (!res.ok) {
    const texto = res.status === 403
      ? 'Tu cuenta ya no puede administrar usuarios. Pídele a otra cuenta con ese permiso que te lo devuelva.'
      : 'No se pudieron cargar las cuentas. Intenta de nuevo.';
    listaUsuariosEl.innerHTML = `<p class="mensaje error">${esc(texto)}</p>`;
    return;
  }
  const usuarios = await res.json();
  listaUsuariosEl.innerHTML = '';
  usuarios.forEach(u => listaUsuariosEl.appendChild(crearFila(u)));
}

function crearFila(usuario) {
  const fila = document.createElement('div');
  fila.className = 'fila-usuario' + (usuario.active ? '' : ' inactivo');
  fila.innerHTML = `
    <span class="nombre-usuario">${esc(usuario.username)}</span>
    <span class="etiqueta-permisos ${esc(usuario.etiqueta)}">${esc(usuario.etiqueta)}</span>
    <span class="bloque-permisos">
      <fieldset class="pantallas"><legend>Pantallas que puede ver</legend></fieldset>
    </span>
    <div class="acciones-usuario">
      <button type="button" class="btn-guardar btn-pantallas">Guardar pantallas</button>
      <input type="text" class="input-nueva-clave" placeholder="Nueva clave (opcional)" autocomplete="off">
      <button type="button" class="btn-guardar btn-clave">Cambiar clave</button>
      <button type="button" class="btn-toggle">${usuario.active ? 'Desactivar' : 'Activar'}</button>
      <button type="button" class="btn-eliminar">Eliminar</button>
    </div>`;

  const cajaCasillas = fila.querySelector('.pantallas');
  dibujarCasillas(cajaCasillas, usuario.permisos, 'u' + usuario.id);

  fila.querySelector('.btn-pantallas').onclick = async () => {
    const permisos = leerCasillas(cajaCasillas);
    const res = await fetch(`/api/users/${encodeURIComponent(usuario.id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permisos })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      mostrarMensaje(`Pantallas de ${usuario.username} guardadas`, 'exito');
      cargarUsuarios();
    } else {
      mostrarMensaje(data.error || 'No se pudieron guardar las pantallas', 'error');
    }
  };

  fila.querySelector('.btn-clave').onclick = async () => {
    const password = fila.querySelector('.input-nueva-clave').value;
    if (!password) { mostrarMensaje('Escribe la nueva clave primero', 'error'); return; }
    const res = await fetch(`/api/users/${encodeURIComponent(usuario.id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { mostrarMensaje(`Clave de ${usuario.username} actualizada`, 'exito'); cargarUsuarios(); }
    else mostrarMensaje(data.error || 'No se pudo cambiar la clave', 'error');
  };

  fila.querySelector('.btn-toggle').onclick = async () => {
    const res = await fetch(`/api/users/${encodeURIComponent(usuario.id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !usuario.active })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) cargarUsuarios();
    else mostrarMensaje(data.error || 'No se pudo cambiar el estado', 'error');
  };

  fila.querySelector('.btn-eliminar').onclick = async () => {
    if (!confirm(`¿Eliminar la cuenta "${usuario.username}"?`)) return;
    const res = await fetch(`/api/users/${encodeURIComponent(usuario.id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { mostrarMensaje('Cuenta eliminada', 'exito'); cargarUsuarios(); }
    else mostrarMensaje(data.error || 'No se pudo eliminar', 'error');
  };

  return fila;
}

// ---------- Inicio ----------

$('botonSalir').onclick = async e => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html';
};

async function iniciar() {
  const res = await fetch('/api/permisos');
  if (!res.ok) {
    listaUsuariosEl.innerHTML = '<p class="mensaje error">Tu cuenta no tiene acceso a esta pantalla</p>';
    return;
  }
  const datos = await res.json();
  modulos = datos.modulos;
  plantillas = datos.presets;
  aplicarPlantilla();
  cargarUsuarios();
}
iniciar();
