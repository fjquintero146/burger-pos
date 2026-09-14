const dominioBase = window.location.hostname.replace(/^www\./, '');
document.getElementById('dominioSufijo').textContent = `.${dominioBase}`;
document.getElementById('ejemploUrl').textContent = `turestaurante.${dominioBase}`;

const subdomainEl = document.getElementById('subdomain');
const disponibilidadEl = document.getElementById('disponibilidad');
const formRegistro = document.getElementById('formRegistro');
const registroError = document.getElementById('registroError');
const botonRegistrar = document.getElementById('botonRegistrar');

let subdominioValidado = false;
let temporizadorCheck = null;

subdomainEl.addEventListener('input', () => {
  subdomainEl.value = subdomainEl.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  subdominioValidado = false;
  disponibilidadEl.textContent = '';
  disponibilidadEl.className = 'disponibilidad';

  clearTimeout(temporizadorCheck);
  const valor = subdomainEl.value.trim();
  if (valor.length < 3) return;

  temporizadorCheck = setTimeout(async () => {
    const res = await fetch(`/api/check-subdomain?value=${encodeURIComponent(valor)}`);
    const data = await res.json();
    subdominioValidado = data.disponible;
    disponibilidadEl.textContent = data.disponible ? '✓ Disponible' : (data.motivo || 'No disponible');
    disponibilidadEl.className = 'disponibilidad ' + (data.disponible ? 'ok' : 'no');
  }, 400);
});

formRegistro.addEventListener('submit', async e => {
  e.preventDefault();
  registroError.textContent = '';

  if (!subdominioValidado) {
    registroError.textContent = 'Elige un nombre de dirección disponible antes de continuar';
    return;
  }

  botonRegistrar.disabled = true;
  botonRegistrar.textContent = 'Creando tu cuenta...';

  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantName: document.getElementById('restaurantName').value.trim(),
        subdomain: subdomainEl.value.trim(),
        adminEmail: document.getElementById('adminEmail').value.trim(),
        adminPassword: document.getElementById('adminPassword').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo crear la cuenta');

    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl; // va a la página de pago de Stripe
    } else if (data.redirectUrl) {
      window.location.href = data.redirectUrl; // sin Stripe configurado: entra directo
    }
  } catch (err) {
    registroError.textContent = err.message;
    botonRegistrar.disabled = false;
    botonRegistrar.textContent = 'Crear mi cuenta';
  }
});
