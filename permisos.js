// permisos.js
// Catálogo de pantallas (módulos) y permisos por usuario. Cada cuenta tiene su propia
// lista de módulos. Los roles de antes (administrador, cajero, cocina) quedan como
// listas predefinidas para llenar la casilla al crear una cuenta, y para las cuentas
// que ya existían antes de este cambio.

const MODULOS = [
  { id: 'caja', nombre: 'Caja', descripcion: 'Tomar pedidos, cobrar, abrir y cerrar turno' },
  { id: 'cocina', nombre: 'Cocina', descripcion: 'Ver y avanzar pedidos en el tablero de cocina' },
  { id: 'historial', nombre: 'Historial de pedidos', descripcion: 'Buscar pedidos, reimprimir y enviar recibos' },
  { id: 'reportes', nombre: 'Reportes y dashboard', descripcion: 'Ventas, horas pico y gráficos' },
  { id: 'turnos', nombre: 'Historial de turnos', descripcion: 'Ver los cierres de caja' },
  { id: 'menu', nombre: 'Administrar menú', descripcion: 'Productos, precios, ingredientes e imágenes' },
  { id: 'config', nombre: 'Configuración', descripcion: 'Logo, nombre del local, papel y correo de cierre' },
  { id: 'usuarios', nombre: 'Usuarios y permisos', descripcion: 'Crear cuentas y elegir las pantallas de cada una' }
];

const IDS = MODULOS.map(m => m.id);

// Listas predefinidas: solo sirven como punto de partida. Lo que manda es la lista guardada
// en cada cuenta.
const PRESETS = {
  administrador: [...IDS],
  cajero: ['caja', 'historial'],
  cocina: ['cocina']
};

// Deja solo módulos que existen, sin repetidos. Devuelve null si no es una lista.
function filtrarPermisos(lista) {
  if (!Array.isArray(lista)) return null;
  return [...new Set(lista.filter(p => IDS.includes(p)))];
}

// Permisos efectivos de una cuenta (fila de la base o usuario de sesión).
// Si la cuenta tiene lista guardada, esa manda. Si no (cuentas antiguas), se usa su rol.
function permisosDeUsuario(usuario) {
  if (usuario && typeof usuario.permisos === 'string') {
    try {
      const lista = filtrarPermisos(JSON.parse(usuario.permisos));
      if (lista) return lista;
    } catch (e) { /* JSON dañado: se cae al rol */ }
  }
  return [...(PRESETS[usuario && usuario.role] || [])];
}

// Nombre corto del conjunto de pantallas, para mostrarlo en la lista de cuentas.
function etiquetaRol(permisos) {
  const conjunto = [...new Set(permisos)].sort().join(',');
  const igual = lista => [...lista].sort().join(',') === conjunto;
  if (igual(PRESETS.administrador)) return 'administrador';
  if (igual(PRESETS.cajero)) return 'cajero';
  if (igual(PRESETS.cocina)) return 'cocina';
  return 'personalizado';
}

module.exports = { MODULOS, IDS, PRESETS, filtrarPermisos, permisosDeUsuario, etiquetaRol };
