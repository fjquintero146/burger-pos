function formatoDinero(valor) {
  return valor === null || valor === undefined ? '—' : '$' + Number(valor).toLocaleString('es-CO');
}

function formatoFecha(fechaISO) {
  return new Date(fechaISO).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function claseDiferencia(diferencia) {
  if (diferencia === null || diferencia === undefined) return '';
  if (diferencia === 0) return 'dif-exacta';
  return diferencia > 0 ? 'dif-positiva' : 'dif-negativa';
}

function textoDiferencia(diferencia) {
  if (diferencia === null || diferencia === undefined) return '—';
  if (diferencia === 0) return 'Exacta';
  return diferencia > 0 ? `+${formatoDinero(diferencia)}` : `-${formatoDinero(Math.abs(diferencia))}`;
}

async function cargarTurnos() {
  const res = await fetch('/api/shifts');
  const turnos = await res.json();
  const tbody = document.querySelector('#tablaTurnos tbody');
  const sinTurnos = document.getElementById('sinTurnos');
  tbody.innerHTML = '';

  if (!turnos.length) {
    sinTurnos.style.display = 'block';
    return;
  }
  sinTurnos.style.display = 'none';

  turnos.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatoFecha(t.openedAt)}</td>
      <td>${t.openedBy}${t.status === 'abierto' ? '<span class="estado-turno-abierto">Abierto</span>' : ''}</td>
      <td>${formatoDinero(t.openingCash)}</td>
      <td>${t.closedBy || '—'}</td>
      <td>${formatoDinero(t.expectedCash)}</td>
      <td>${formatoDinero(t.closingCashCounted)}</td>
      <td class="${claseDiferencia(t.difference)}">${textoDiferencia(t.difference)}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('botonSalir').onclick = async e => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html';
};

cargarTurnos();
