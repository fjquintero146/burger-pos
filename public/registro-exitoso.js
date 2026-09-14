const params = new URLSearchParams(window.location.search);
const subdomain = params.get('subdomain');
const dominioBase = window.location.hostname.replace(/^www\./, '');
const mensajeEstado = document.getElementById('mensajeEstado');
const linkEntrar = document.getElementById('linkEntrar');
const enlaceEntrar = document.getElementById('enlaceEntrar');

let intentos = 0;

async function verificar() {
  intentos++;
  if (!subdomain) {
    mensajeEstado.textContent = 'Ya puedes buscar la dirección de tu restaurante e iniciar sesión.';
    return;
  }

  const res = await fetch(`/api/check-subdomain?value=${encodeURIComponent(subdomain)}`);
  const data = await res.json();

  // Si el subdominio ya "no está disponible", quiere decir que ya se creó (el
  // webhook de Stripe terminó de aprovisionar el restaurante).
  if (!data.disponible) {
    const url = `${window.location.protocol}//${subdomain}.${dominioBase}/login.html`;
    mensajeEstado.textContent = '¡Tu restaurante ya está listo!';
    enlaceEntrar.href = url;
    linkEntrar.style.display = 'block';
    setTimeout(() => { window.location.href = url; }, 1500);
    return;
  }

  if (intentos < 30) {
    setTimeout(verificar, 2000);
  } else {
    mensajeEstado.textContent = 'Esto está tardando más de lo normal. Si el pago se completó, ' +
      'intenta entrar directamente a tu dirección en unos minutos.';
  }
}

verificar();
