// auth.js
// Control de acceso por módulo. No depende de express: recibe req, res y next como
// cualquier middleware, así se puede probar sin levantar el servidor.

const { permisosDeUsuario } = require('./permisos');

const PAGINA_SIN_ACCESO = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sin acceso</title>
<style>body{font-family:Arial,sans-serif;background:#fdf8ec;color:#2b2118;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.caja{text-align:center;padding:24px;max-width:360px}a{color:#c1272d;font-weight:700}</style></head>
<body><div class="caja"><h2>No tienes acceso a esta pantalla</h2>
<p>Si la necesitas, pídele a un administrador que la active en tu cuenta.</p>
<p><a href="/">Volver</a></p></div></body></html>`;

function crearControlAcceso({ saasMode }) {
  // En SaaS una sesión solo vale en el restaurante donde se creó.
  function mismaTienda(req) {
    if (!saasMode) return true;
    return !!req.session.user && req.session.user.tenantId === (req.tenant ? req.tenant.id : null);
  }

  // Basta con UNO de los permisos pedidos. Sin permisos pedidos, cualquier sesión entra.
  function tienePermiso(usuario, permisos) {
    if (!permisos.length) return true;
    const lista = (usuario && usuario.permisos) || [];
    return permisos.some(p => lista.includes(p));
  }

  function requireApi(...permisos) {
    return (req, res, next) => {
      const usuario = req.session.user;
      if (!usuario || !mismaTienda(req)) return res.status(401).json({ error: 'Debes iniciar sesión' });
      if (!tienePermiso(usuario, permisos)) return res.status(403).json({ error: 'No tienes permiso para esta función' });
      next();
    };
  }

  function requirePage(...permisos) {
    return (req, res, next) => {
      const usuario = req.session.user;
      if (!usuario || !mismaTienda(req)) return res.redirect('/login.html');
      if (!tienePermiso(usuario, permisos)) return res.status(403).send(PAGINA_SIN_ACCESO);
      next();
    };
  }

  // Antes de cada llamada a la API vuelve a leer la cuenta de la base. Así, si el
  // administrador quita una pantalla o desactiva la cuenta, el cambio aplica en la
  // siguiente acción, sin esperar a que el usuario cierre sesión.
  async function refrescarPermisos(req, res, next) {
    const usuario = req.session.user;
    if (!usuario || !req.db) return next();
    try {
      const r = await req.db.execute({
        sql: 'SELECT username, role, permisos, active FROM users WHERE id = ?',
        args: [usuario.id]
      });
      const fila = r.rows[0];
      if (!fila || !fila.active) {
        delete req.session.user; // cuenta borrada o desactivada: la sesión deja de valer
        return next();
      }
      req.session.user = {
        ...usuario,
        username: fila.username,
        role: fila.role,
        permisos: permisosDeUsuario(fila)
      };
    } catch (err) {
      return res.status(500).json({ error: 'No se pudieron verificar tus permisos. Intenta de nuevo.' });
    }
    next();
  }

  return { requireApi, requirePage, refrescarPermisos, tienePermiso };
}

module.exports = { crearControlAcceso, PAGINA_SIN_ACCESO };
