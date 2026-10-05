const fechaDesdeEl = document.getElementById('fechaDesde');
const fechaHastaEl = document.getElementById('fechaHasta');
const botonBuscar = document.getElementById('botonBuscar');
const botonHoy = document.getElementById('botonHoy');
const botonSemana = document.getElementById('botonSemana');
const botonMes = document.getElementById('botonMes');

const PALETA = ['#c1272d', '#e8a33d', '#4c8c3b', '#2b2118', '#7a7166', '#8f1c21', '#f6e3b4'];
const ETIQUETAS_TIPO = { mesa: '🍽️ Mesa', para_llevar: '🥡 Para Llevar', domicilio: '🛵 Domicilio' };

let graficos = {}; // guarda las instancias de Chart.js para poder destruirlas al recargar

function formatoDinero(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO');
}

function fechaLocalISO(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function formatoFechaCorta(fechaYMD) {
  const [y, m, d] = fechaYMD.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function destruirGrafico(id) {
  if (graficos[id]) {
    graficos[id].destroy();
    delete graficos[id];
  }
}

function opcionesBase(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { font: { size: 12 } } } },
    ...extra
  };
}

async function cargarDashboard() {
  const avisoEl = document.getElementById('avisoDashboard');
  avisoEl.style.display = 'none';

  if (typeof Chart === 'undefined') {
    avisoEl.textContent = '⚠️ No se pudo cargar la librería de gráficos (Chart.js) desde internet. ' +
      'Revisa tu conexión, o si hay un bloqueador de contenido/firewall filtrando cdnjs.cloudflare.com.';
    avisoEl.className = 'aviso-dashboard error';
    avisoEl.style.display = 'block';
    return;
  }

  const from = fechaDesdeEl.value;
  const to = fechaHastaEl.value;

  let datos;
  try {
    const res = await fetch(`/api/sales?from=${from}&to=${to}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `El servidor respondió con error ${res.status}`);
    }
    datos = await res.json();
  } catch (e) {
    avisoEl.textContent = '⚠️ No se pudo cargar el reporte: ' + e.message;
    avisoEl.className = 'aviso-dashboard error';
    avisoEl.style.display = 'block';
    return;
  }

  if (!datos.pedidos) {
    avisoEl.textContent = 'No hay ventas registradas en el rango de fechas elegido — prueba con "Últimos 7 días" o "Este mes", o cambia las fechas.';
    avisoEl.className = 'aviso-dashboard';
    avisoEl.style.display = 'block';
  }

  renderKpis(datos);
  renderGraficoDia(datos.porDia);
  renderGraficoHora(datos.porHora || []);
  renderGraficoTipo(datos.porTipoPedido || []);
  renderGraficoMetodoPago(datos.porMetodoPago || []);
  renderGraficoCajero(datos.porCajero || []);
  renderGraficoProductos(datos.porProducto || []);
}

function renderKpis(datos) {
  document.getElementById('kpiIngresos').textContent = formatoDinero(datos.ingresos);
  document.getElementById('kpiPedidos').textContent = datos.pedidos;

  const promedio = datos.pedidos > 0 ? datos.ingresos / datos.pedidos : 0;
  document.getElementById('kpiTicket').textContent = formatoDinero(Math.round(promedio));

  const minutos = datos.tiempoPromedioPreparacion;
  document.getElementById('kpiTiempo').textContent =
    minutos === null || minutos === undefined ? '—' : `${Math.round(minutos)} min`;

  const anulados = datos.anulados || [];
  document.getElementById('kpiAnulados').textContent = anulados.length;
  const montoAnulado = anulados.reduce((sum, a) => sum + a.total, 0);
  document.getElementById('kpiAnuladosMonto').textContent = anulados.length ? formatoDinero(montoAnulado) + ' en total' : '';

  renderComparativo('kpiIngresosComp', datos.ingresos, datos.periodoAnterior ? datos.periodoAnterior.ingresos : null);
  renderComparativo('kpiPedidosComp', datos.pedidos, datos.periodoAnterior ? datos.periodoAnterior.pedidos : null);
}

function renderComparativo(elId, actual, anterior) {
  const el = document.getElementById(elId);
  if (anterior === null || anterior === undefined || anterior === 0) {
    el.textContent = '';
    return;
  }
  const cambio = ((actual - anterior) / anterior) * 100;
  const signo = cambio > 0 ? '▲' : cambio < 0 ? '▼' : '•';
  el.textContent = `${signo} ${Math.abs(Math.round(cambio))}% vs. período anterior`;
  el.className = 'kpi-comparativo ' + (cambio > 0 ? 'sube' : cambio < 0 ? 'baja' : 'igual');
}

function renderGraficoDia(porDia) {
  destruirGrafico('dia');
  const ctx = document.getElementById('chartDia');
  graficos.dia = new Chart(ctx, {
    type: 'line',
    data: {
      labels: porDia.map(f => formatoFechaCorta(f.dia)),
      datasets: [{
        label: 'Ingresos',
        data: porDia.map(f => f.ingresos),
        borderColor: PALETA[0],
        backgroundColor: 'rgba(193, 39, 45, 0.12)',
        fill: true,
        tension: 0.25,
        pointRadius: 3
      }]
    },
    options: opcionesBase({
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => formatoDinero(v) } } }
    })
  });
}

function renderGraficoHora(porHora) {
  destruirGrafico('hora');
  const ctx = document.getElementById('chartHora');
  graficos.hora = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: porHora.map(f => `${f.hora}:00`),
      datasets: [{ label: 'Pedidos', data: porHora.map(f => f.pedidos), backgroundColor: PALETA[1] }]
    },
    options: opcionesBase({ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } })
  });
}

function renderGraficoTipo(porTipo) {
  destruirGrafico('tipo');
  const ctx = document.getElementById('chartTipo');
  if (!porTipo.length) return;
  graficos.tipo = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: porTipo.map(f => ETIQUETAS_TIPO[f.tipo] || f.tipo),
      datasets: [{ data: porTipo.map(f => f.ingresos), backgroundColor: PALETA }]
    },
    options: opcionesBase({ plugins: { legend: { position: 'bottom' } } })
  });
}

function renderGraficoMetodoPago(porMetodo) {
  destruirGrafico('metodo');
  const ctx = document.getElementById('chartMetodoPago');
  if (!porMetodo.length) return;
  graficos.metodo = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: porMetodo.map(f => f.metodo),
      datasets: [{ data: porMetodo.map(f => f.ingresos), backgroundColor: PALETA }]
    },
    options: opcionesBase({ plugins: { legend: { position: 'bottom' } } })
  });
}

function renderGraficoCajero(porCajero) {
  destruirGrafico('cajero');
  const ctx = document.getElementById('chartCajero');
  graficos.cajero = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: porCajero.map(f => f.cajero),
      datasets: [{ label: 'Ingresos', data: porCajero.map(f => f.ingresos), backgroundColor: PALETA[2] }]
    },
    options: opcionesBase({
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => formatoDinero(v) } } }
    })
  });
}

function renderGraficoProductos(porProducto) {
  destruirGrafico('productos');
  const ctx = document.getElementById('chartProductos');
  const top = porProducto.slice(0, 8);
  graficos.productos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(f => f.nombre),
      datasets: [{ label: 'Ingresos', data: top.map(f => f.ingresos), backgroundColor: PALETA[4] }]
    },
    options: opcionesBase({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { callback: v => formatoDinero(v) } } }
    })
  });
}

botonBuscar.onclick = cargarDashboard;

botonHoy.onclick = () => {
  const hoy = fechaLocalISO(new Date());
  fechaDesdeEl.value = hoy;
  fechaHastaEl.value = hoy;
  cargarDashboard();
};

botonSemana.onclick = () => {
  const hoy = new Date();
  const hace7 = new Date();
  hace7.setDate(hoy.getDate() - 6);
  fechaDesdeEl.value = fechaLocalISO(hace7);
  fechaHastaEl.value = fechaLocalISO(hoy);
  cargarDashboard();
};

botonMes.onclick = () => {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  fechaDesdeEl.value = fechaLocalISO(inicioMes);
  fechaHastaEl.value = fechaLocalISO(hoy);
  cargarDashboard();
};

document.getElementById('botonSalir').onclick = async e => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html';
};

const hoyISO = fechaLocalISO(new Date());
fechaDesdeEl.value = hoyISO;
fechaHastaEl.value = hoyISO;
cargarDashboard();
