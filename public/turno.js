const socketTurno = io();

const botonTurno = document.getElementById('botonTurno');
const modalTurnoFondo = document.getElementById('modalTurnoFondo');
const contenidoTurno = document.getElementById('contenidoTurno');
const botonCerrarModalTurno = document.getElementById('botonCerrarModalTurno');

const modalCerrarTurnoFondo = document.getElementById('modalCerrarTurnoFondo');
const resumenCierreTurno = document.getElementById('resumenCierreTurno');
const efectivoContadoEl = document.getElementById('efectivoContado');
const notasCierreEl = document.getElementById('notasCierre');
const modalCerrarTurnoCancelar = document.getElementById('modalCerrarTurnoCancelar');
const modalCerrarTurnoConfirmar = document.getElementById('modalCerrarTurnoConfirmar');

let turnoActual = null;

function formatoDineroTurno(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO');
}

function formatoHora(fechaISO) {
  return new Date(fechaISO).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

async function actualizarEstadoTurno() {
  const res = await fetch('/api/shifts/actual');
  const data = await res.json();
  turnoActual = data.turno;
  botonTurno.textContent = turnoActual ? '🧾 Turno abierto' : '🧾 Abrir Turno';
  botonTurno.classList.toggle('turno-abierto', !!turnoActual);
}

function abrirModalTurno() {
  modalTurnoFondo.classList.add('visible');
  renderModalTurno();
}

async function renderModalTurno() {
  if (!turnoActual) {
    contenidoTurno.innerHTML = `
      <p class="modal-sub">No hay ningún turno abierto en este momento.</p>
      <label class="modal-nota-label" for="baseInicial">Base inicial en efectivo</label>
      <input type="number" id="baseInicial" class="modal-nota" placeholder="Ej: 50000" min="0">
      <button id="botonAbrirTurno" class="modal-btn-confirmar" style="width:100%;">Abrir Turno</button>
    `;
    document.getElementById('botonAbrirTurno').onclick = async () => {
      const openingCash = Number(document.getElementById('baseInicial').value) || 0;
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingCash })
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast(data.error || 'No se pudo abrir el turno');
        return;
      }
      mostrarToast('Turno abierto');
      modalTurnoFondo.classList.remove('visible');
      actualizarEstadoTurno();
    };
    return;
  }

  const res = await fetch(`/api/shifts/${turnoActual.id}/resumen`);
  const { resumen } = await res.json();

  const filasMetodo = resumen.ventasPorMetodo.map(v =>
    `<div class="linea-resumen-turno"><span>${v.metodo} (${v.pedidos})</span><span>${formatoDineroTurno(v.ingresos)}</span></div>`
  ).join('');

  contenidoTurno.innerHTML = `
    <p class="modal-sub">Abierto por <b>${turnoActual.openedBy}</b> desde ${formatoHora(turnoActual.openedAt)}</p>
    <div class="linea-resumen-turno"><span>Base inicial</span><span>${formatoDineroTurno(turnoActual.openingCash)}</span></div>
    <div class="linea-resumen-turno"><span>Pedidos en este turno</span><span>${resumen.totalPedidos}</span></div>
    ${filasMetodo}
    <div class="linea-resumen-turno linea-resumen-total">
      <span>Efectivo esperado en caja</span><span>${formatoDineroTurno(resumen.expectedCash)}</span>
    </div>
    <button id="botonIrACerrar" class="modal-btn-confirmar" style="width:100%; margin-top:14px;">Cerrar Turno</button>
  `;
  document.getElementById('botonIrACerrar').onclick = () => {
    modalTurnoFondo.classList.remove('visible');
    abrirModalCerrarTurno(resumen);
  };
}

function abrirModalCerrarTurno(resumen) {
  const filasMetodo = resumen.ventasPorMetodo.map(v =>
    `<div class="linea-resumen-turno"><span>${v.metodo} (${v.pedidos})</span><span>${formatoDineroTurno(v.ingresos)}</span></div>`
  ).join('');

  resumenCierreTurno.innerHTML = `
    <div class="linea-resumen-turno"><span>Base inicial</span><span>${formatoDineroTurno(turnoActual.openingCash)}</span></div>
    ${filasMetodo}
    <div class="linea-resumen-turno linea-resumen-total">
      <span>Efectivo esperado</span><span>${formatoDineroTurno(resumen.expectedCash)}</span>
    </div>
  `;
  efectivoContadoEl.value = '';
  notasCierreEl.value = '';
  modalCerrarTurnoFondo.classList.add('visible');
}

modalCerrarTurnoConfirmar.onclick = async () => {
  const closingCashCounted = Number(efectivoContadoEl.value);
  if (efectivoContadoEl.value === '' || isNaN(closingCashCounted)) {
    mostrarToast('Ingresa el efectivo contado en caja');
    return;
  }

  const res = await fetch(`/api/shifts/${turnoActual.id}/cerrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closingCashCounted, notes: notasCierreEl.value.trim() })
  });
  const data = await res.json();
  if (!res.ok) {
    mostrarToast(data.error || 'No se pudo cerrar el turno');
    return;
  }

  const diferencia = data.turno.difference;
  const textoDiferencia = diferencia === 0
    ? '✅ La caja cuadra exacta'
    : diferencia > 0
      ? `Sobran ${formatoDineroTurno(diferencia)}`
      : `Faltan ${formatoDineroTurno(Math.abs(diferencia))}`;

  const textoCorreo = data.correo && data.correo.enviado
    ? ' — correo de cierre enviado ✉️'
    : ` — ⚠️ no se pudo enviar el correo (${data.correo ? data.correo.motivo : 'error desconocido'})`;

  mostrarToast(`Turno cerrado — ${textoDiferencia}${textoCorreo}`);
  modalCerrarTurnoFondo.classList.remove('visible');
  actualizarEstadoTurno();
};

modalCerrarTurnoCancelar.onclick = () => modalCerrarTurnoFondo.classList.remove('visible');
modalCerrarTurnoFondo.onclick = e => { if (e.target === modalCerrarTurnoFondo) modalCerrarTurnoFondo.classList.remove('visible'); };

botonTurno.onclick = abrirModalTurno;
botonCerrarModalTurno.onclick = () => modalTurnoFondo.classList.remove('visible');
modalTurnoFondo.onclick = e => { if (e.target === modalTurnoFondo) modalTurnoFondo.classList.remove('visible'); };

socketTurno.on('turno-actualizado', actualizarEstadoTurno);

actualizarEstadoTurno();
