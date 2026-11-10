// usuarios-logica.js
// Reglas al cambiar cuentas. Son funciones puras: reciben la lista actual de usuarios y
// devuelven un error (texto) o null si el cambio se puede hacer.

const { filtrarPermisos } = require('./permisos');

const MENSAJE_SIN_ADMIN =
  'Debe quedar al menos una cuenta activa con el permiso "Usuarios y permisos". ' +
  'Dale ese permiso a otra cuenta antes de quitárselo a esta.';

// usuarios: [{ id, active, permisos: [] }] con TODAS las cuentas actuales.
function hayAdminTrasCambio(usuarios) {
  return usuarios.some(u => u.active && u.permisos.includes('usuarios'));
}

// Cambio de permisos o de estado de una cuenta existente.
function validarCambio({ usuarios, objetivoId, permisos, activo }) {
  const despues = usuarios.map(u => (u.id === objetivoId
    ? {
        ...u,
        permisos: permisos !== undefined ? permisos : u.permisos,
        active: activo !== undefined ? (activo ? 1 : 0) : u.active
      }
    : u));
  return hayAdminTrasCambio(despues) ? null : MENSAJE_SIN_ADMIN;
}

// Eliminar una cuenta.
function validarEliminacion({ usuarios, objetivoId }) {
  const despues = usuarios.filter(u => u.id !== objetivoId);
  return hayAdminTrasCambio(despues) ? null : MENSAJE_SIN_ADMIN;
}

// Convierte la lista que manda el navegador en una lista válida, o devuelve un error.
function leerPermisosEntrada(lista) {
  const limpia = filtrarPermisos(lista);
  if (!limpia) return { error: 'Indica las pantallas que puede ver la cuenta' };
  return { permisos: limpia };
}

module.exports = { validarCambio, validarEliminacion, leerPermisosEntrada, MENSAJE_SIN_ADMIN };
