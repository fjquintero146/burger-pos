// Oculta de la barra de navegación las pantallas que la cuenta no puede ver.
// Es solo para que la navegación sea clara: la protección real está en el servidor.
fetch('/api/me')
  .then(r => r.json())
  .then(d => {
    const permisos = (d.user && d.user.permisos) || [];
    document.querySelectorAll('[data-permiso]').forEach(el => {
      if (!permisos.includes(el.dataset.permiso)) el.style.display = 'none';
    });
  })
  .catch(() => { /* sin conexión: se deja la barra como está */ });
