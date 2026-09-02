const formLogin = document.getElementById('formLogin');
const loginError = document.getElementById('loginError');
const botonEntrar = document.getElementById('botonEntrar');

const destinoPorRol = {
  cajero: 'pos.html',
  cocina: 'kds.html',
  administrador: 'admin.html'
};

async function redirigirSiYaHaySesion() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (data.user) {
      window.location.href = destinoPorRol[data.user.role] || 'pos.html';
    }
  } catch (e) { /* sin conexión aún, se queda en el login */ }
}

formLogin.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.textContent = '';
  botonEntrar.disabled = true;
  botonEntrar.textContent = 'Entrando...';

  const username = document.getElementById('usuario').value.trim();
  const password = document.getElementById('clave').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      loginError.textContent = data.error || 'No se pudo iniciar sesión';
      return;
    }
    window.location.href = destinoPorRol[data.role] || 'pos.html';
  } catch (e) {
    loginError.textContent = 'Error de conexión. Intenta de nuevo.';
  } finally {
    botonEntrar.disabled = false;
    botonEntrar.textContent = 'Entrar';
  }
});

redirigirSiYaHaySesion();
