const vistaLogo = document.getElementById('vistaLogo');
const inputLogo = document.getElementById('inputLogo');
const botonQuitarLogo = document.getElementById('botonQuitarLogo');
const nombreLocalEl = document.getElementById('nombreLocal');
const botonGuardar = document.getElementById('botonGuardar');
const mensajeForm = document.getElementById('mensajeForm');

let logoActual = '';

function mostrarMensaje(texto, tipo) {
  mensajeForm.textContent = texto;
  mensajeForm.className = 'mensaje ' + tipo;
  setTimeout(() => { mensajeForm.textContent = ''; mensajeForm.className = 'mensaje'; }, 3500);
}

function renderVistaLogo() {
  vistaLogo.innerHTML = logoActual ? `<img src="${logoActual}" alt="Logo">` : 'Sin logo';
}

async function cargarConfiguracion() {
  const res = await fetch('/api/settings');
  const settings = await res.json();

  logoActual = settings.logo || '';
  renderVistaLogo();
  nombreLocalEl.value = settings.restaurantName || '';

  const ancho = settings.receiptWidth || '80mm';
  document.querySelectorAll('input[name="papel"]').forEach(radio => {
    radio.checked = radio.value === ancho;
  });
}

inputLogo.addEventListener('change', async () => {
  const file = inputLogo.files[0];
  if (!file) return;
  try {
    logoActual = await redimensionarImagen(file, 300, 0.8);
    renderVistaLogo();
  } catch (e) {
    mostrarMensaje('No se pudo procesar la imagen', 'error');
  }
});

botonQuitarLogo.onclick = () => {
  logoActual = '';
  renderVistaLogo();
  inputLogo.value = '';
};

botonGuardar.onclick = async () => {
  const receiptWidth = document.querySelector('input[name="papel"]:checked')?.value || '80mm';

  botonGuardar.disabled = true;
  botonGuardar.textContent = 'Guardando...';

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logo: logoActual,
        restaurantName: nombreLocalEl.value.trim(),
        receiptWidth
      })
    });
    if (!res.ok) throw new Error('No se pudo guardar');
    mostrarMensaje('Configuración guardada', 'exito');
  } catch (e) {
    mostrarMensaje('Error al guardar. Intenta de nuevo.', 'error');
  } finally {
    botonGuardar.disabled = false;
    botonGuardar.textContent = 'Guardar Configuración';
  }
};

document.getElementById('botonSalir').onclick = async e => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html';
};

cargarConfiguracion();
