const fechaDesdeEl = document.getElementById('fechaDesde');
const fechaHastaEl = document.getElementById('fechaHasta');
const botonBuscar = document.getElementById('botonBuscar');
const botonHoy = document.getElementById('botonHoy');
const botonSemana = document.getElementById('botonSemana');
const botonMes = document.getElementById('botonMes');

function formatoDinero(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO');
}

function fechaLocalISO(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function formatoFechaLarga(fechaYMD) {
  const [y, m, d] = fechaYMD.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });
}

async function cargarReporte() {
  const from = fechaDesdeEl.value;
  const to = fechaHastaEl.value;
  const res = await fetch(`/api/sales?from=${from}&to=${to}`);
  const datos = await res.json();
  renderResumen(datos);
  renderTablaDias(datos.porDia);
  renderTablaProductos(datos.porProducto);
  renderTablaMetodoPago(datos.porMetodoPago || []);
}

function renderResumen(datos) {
  document.getElementById('resumenIngresos').textContent = formatoDinero(datos.ingresos);
  document.getElementById('resumenPedidos').textContent = datos.pedidos;
  const promedio = datos.pedidos > 0 ? datos.ingresos / datos.pedidos : 0;
  document.getElementById('resumenPromedio').textContent = formatoDinero(Math.round(promedio));
}

function renderTablaDias(porDia) {
  const tbody = document.querySelector('#tablaPorDia tbody');
  const sinDatos = document.getElementById('sinDatosDia');
  tbody.innerHTML = '';

  if (!porDia.length) {
    sinDatos.style.display = 'block';
    return;
  }
  sinDatos.style.display = 'none';

  [...porDia].reverse().forEach(fila => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatoFechaLarga(fila.dia)}</td>
      <td>${fila.pedidos}</td>
      <td>${formatoDinero(fila.ingresos)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTablaProductos(porProducto) {
  const tbody = document.querySelector('#tablaPorProducto tbody');
  const sinDatos = document.getElementById('sinDatosProducto');
  tbody.innerHTML = '';

  if (!porProducto.length) {
    sinDatos.style.display = 'block';
    return;
  }
  sinDatos.style.display = 'none';

  porProducto.forEach(fila => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fila.nombre}</td>
      <td>${fila.cantidad}</td>
      <td>${formatoDinero(fila.ingresos)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTablaMetodoPago(porMetodoPago) {
  const tbody = document.querySelector('#tablaPorMetodoPago tbody');
  const sinDatos = document.getElementById('sinDatosMetodoPago');
  tbody.innerHTML = '';

  if (!porMetodoPago.length) {
    sinDatos.style.display = 'block';
    return;
  }
  sinDatos.style.display = 'none';

  porMetodoPago.forEach(fila => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fila.metodo}</td>
      <td>${fila.pedidos}</td>
      <td>${formatoDinero(fila.ingresos)}</td>
    `;
    tbody.appendChild(tr);
  });
}

botonBuscar.onclick = cargarReporte;

botonHoy.onclick = () => {
  const hoy = fechaLocalISO(new Date());
  fechaDesdeEl.value = hoy;
  fechaHastaEl.value = hoy;
  cargarReporte();
};

botonSemana.onclick = () => {
  const hoy = new Date();
  const hace7 = new Date();
  hace7.setDate(hoy.getDate() - 6);
  fechaDesdeEl.value = fechaLocalISO(hace7);
  fechaHastaEl.value = fechaLocalISO(hoy);
  cargarReporte();
};

botonMes.onclick = () => {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  fechaDesdeEl.value = fechaLocalISO(inicioMes);
  fechaHastaEl.value = fechaLocalISO(hoy);
  cargarReporte();
};

// Por defecto, mostrar el día de hoy al entrar a la página.
const hoyISO = fechaLocalISO(new Date());
fechaDesdeEl.value = hoyISO;
fechaHastaEl.value = hoyISO;
cargarReporte();

document.getElementById('botonSalir').onclick = async e => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html';
};
