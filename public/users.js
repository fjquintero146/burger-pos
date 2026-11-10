const formNuevoUsuario = document.getElementById('formNuevoUsuario');
const mensajeForm = document.getElementById('mensajeForm');
const listaUsuariosEl = document.getElementById('listaUsuarios');

function mostrarMensaje(texto, tipo) {
  mensajeForm.textContent = texto;
  mensajeForm.className = 'mensaje ' + tipo;
  setTimeout(() => { mensajeForm.textContent = ''; mensajeForm.className = 'mensaje'; }, 3500);
}

async function cargarUsuarios() {
  const res = await fetch('/api/users');
  const usuarios = await res.json();
  listaUsuariosEl.innerHTML = '';
  usuarios.forEach(u => listaUsuariosEl.appendChild(crearFila(u)));
}

function crearFila(usuario) {
  const fila = document.createElement('div');
  fila.className = 'fila-usuario' + (usuario.active ? '' : ' inactivo');
  fila.innerHTML = `
    <span class="nombre-usuario">${usuario.username}</span>
    <span class="etiqueta-rol ${usuario.role}">${usuario.role}</span>
    <input type="text" class="input-nueva-clave" placeholder="Nueva clave (opcional)">
    <button class="btn-guardar">Cambiar clave</button>
    <button class="btn-toggle">${usuario.active ? 'Desactivar' : 'Activar'}</button>
    <button class="btn-eliminar">Eliminar</button>
  `;

  fila.querySelector('.btn-guardar').onclick = async () => {
    const password = fila.querySelector('.input-nueva-clave').value.trim();
    if (!password) {
      mostrarMensaje('Escribe la nueva clave primero', 'error');
      return;
    }
    const res = await fetch(`/api/users/${usuario.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje(`Clave de ${usuario.username} actualizada`, 'exito');
      cargarUsuarios();
    } else {
      mostrarMensaje(data.error || 'No se pudo cambiar la clave', 'error');
    }
  };

  fila.querySelector('.btn-toggle').onclick = async () => {
    await fetch(`/api/users/${usuario.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: usuario.active ? 0 : 1 })
    });
    cargarUsuarios();
  };

  fila.querySelector('.btn-eliminar').onclick = async () => {
    if (!confirm(`¿Eliminar la cuenta "${usuario.username}"?`)) return;
    const res = await fetch(`/api/users/${usuario.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje('Cuenta eliminada', 'exito');
      cargarUsuarios();
    } else {
      mostrarMensaje(data.error || 'No se pudo eliminar', 'error');
    }
  };

  return fila;
}

formNuevoUsuario.addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('nuevoUsuario').value.trim();
  const password = document.getElementById('nuevaClave').value.trim();
  const role = document.getElementById('nuevoRol').value;

  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role })
  });
  const data = await res.json();

  if (res.ok) {
    mostrarMensaje(`Cuenta "${username}" creada`, 'exito');
    formNuevoUsuario.reset();
    cargarUsuarios();
  } else {
    mostrarMensaje(data.error || 'No se pudo crear la cuenta', 'error');
  }
});

document.getElementById('botonSalir').onclick = async e => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html';
};

cargarUsuarios();
