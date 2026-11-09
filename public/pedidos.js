// pedidos.js — Historial de pedidos: buscar por día / mes / hora, revisar un pedido,
// reimprimir su recibo o enviarlo por correo.

const ESTADOS = {
  esperando_pago: 'Por cobrar', pendiente: 'Pendiente', preparando: 'Preparando',
  listo: 'Listo', entregado: 'Entregado', anulado: 'Anulado'
};
const TIPOS = { mesa: '🍽️ Mesa', para_llevar: '🥡 Para llevar', domicilio: '🛵 Domicilio' };
const POR_PAGINA = 100;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const $ = id => document.getElementById(id);
const fDesde = $('fDesde'), fHasta = $('fHasta'), fMes = $('fMes');
const fHoraDesde = $('fHoraDesde'), fHoraHasta = $('fHoraHasta');
const fEstado = $('fEstado'), fMetodo = $('fMetodo'), fBuscar = $('fBuscar');
const resumenEl = $('resumen'), listaEl = $('lista'), vacioEl = $('vacio'), botonMas = $('botonMas');
const modal = $('modalDetalle'), detalleTitulo = $('detalleTitulo'), detalleCuerpo = $('detalleCuerpo');
const botonReimprimir = $('botonReimprimir'), botonEmail = $('botonEmail');
const filaEmail = $('filaEmail'), campoEmail = $('campoEmail'), botonEnviarEmail = $('botonEnviarEmail');
const mensajeEmail = $('mensajeEmail');

// El texto que escriben las personas (nombres, notas, motivos) SIEMPRE se escapa antes
// de ponerlo en la página: si no, un nombre con etiquetas se ejecutaría aquí.
function esc(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const dinero = v => '$' + Number(v || 0).toLocaleString('es-CO');

function fechaLocalISO(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const hora = iso => iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';
const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-CO', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// ---------- Filtros ----------

function rangoAtajo(atajo) {
  const hoy = new Date();
  const dia = (y, m, d) => fechaLocalISO(new Date(y, m, d));
  switch (atajo) {
    case 'hoy': return [fechaLocalISO(hoy), fechaLocalISO(hoy)];
    case 'ayer': { const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1); return [fechaLocalISO(a), fechaLocalISO(a)]; }
    case 'semana': return [dia(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6), fechaLocalISO(hoy)];
    case 'mes': return [dia(hoy.getFullYear(), hoy.getMonth(), 1), fechaLocalISO(hoy)];
    case 'mespasado': return [dia(hoy.getFullYear(), hoy.getMonth() - 1, 1), dia(hoy.getFullYear(), hoy.getMonth(), 0)];
  }
  return null;
}

function rangoMes(valor) { // "2026-10" -> [primer día, último día]
  const [y, m] = valor.split('-').map(Number);
  return [fechaLocalISO(new Date(y, m - 1, 1)), fechaLocalISO(new Date(y, m, 0))];
}

function marcarChips() {
  document.querySelectorAll('#atajosFecha .chip').forEach(c => {
    const r = rangoAtajo(c.dataset.atajo);
    c.classList.toggle('activo', !fMes.value && !!r && r[0] === fDesde.value && r[1] === fHasta.value);
  });
  document.querySelectorAll('#atajosHora .chip').forEach(c => {
    const [d, h] = (c.dataset.franja || '-').split('-');
    c.classList.toggle('activo', (d || '') === fHoraDesde.value && (h || '') === fHoraHasta.value);
  });
}

function leerFiltros() {
  const q = new URLSearchParams();
  q.set('desde', fDesde.value);
  q.set('hasta', fHasta.value || fDesde.value);
  if (fHoraDesde.value) q.set('horaDesde', fHoraDesde.value);
  if (fHoraHasta.value) q.set('horaHasta', fHoraHasta.value);
  q.set('estado', fEstado.value);
  if (fMetodo.value) q.set('metodo', fMetodo.value);
  if (fBuscar.value.trim()) q.set('buscar', fBuscar.value.trim());
  return q;
}

// ---------- Carga y lista ----------

let pedidos = [];
let hayMas = false;
let ultimaCarga = 0; // ignora respuestas viejas si el usuario cambia filtros rápido

async function cargar(reiniciar = true) {
  const mia = ++ultimaCarga;
  const q = leerFiltros();
  q.set('limite', POR_PAGINA);
  q.set('desplazamiento', reiniciar ? 0 : pedidos.length);
  marcarChips();

  let res;
  try {
    res = await fetch('/api/orders/historial?' + q.toString());
  } catch (e) {
    resumenEl.innerHTML = '<span class="nota">Sin conexión. Revisa internet e intenta de nuevo.</span>';
    return;
  }
  if (res.status === 401) { window.location.href = 'login.html'; return; }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    resumenEl.innerHTML = `<span class="nota">${esc(err.error || 'No se pudo cargar el historial')}</span>`;
    return;
  }
  const datos = await res.json();
  if (mia !== ultimaCarga) return;

  pedidos = reiniciar ? datos.pedidos : pedidos.concat(datos.pedidos);
  hayMas = datos.hayMas;
  render(datos.resumen);
}

function render(resumen) {
  const rango = fDesde.value === (fHasta.value || fDesde.value) ? 'ese día' : 'ese período';
  resumenEl.innerHTML = `
    <span>${resumen.pedidos} pedido${resumen.pedidos === 1 ? '' : 's'}</span>
    <span class="total">${dinero(resumen.ingresos)} en ventas</span>
    <span class="nota">Las ventas no incluyen pedidos anulados ni por cobrar. Resumen de todo ${rango}, no solo de lo que se ve en pantalla.</span>`;

  listaEl.innerHTML = '';
  vacioEl.style.display = pedidos.length ? 'none' : 'block';
  botonMas.style.display = hayMas ? 'block' : 'none';

  // Agrupa por día (hora del dispositivo)
  const grupos = [];
  pedidos.forEach(p => {
    const clave = fechaLocalISO(new Date(p.createdAt));
    let g = grupos[grupos.length - 1];
    if (!g || g.clave !== clave) { g = { clave, filas: [] }; grupos.push(g); }
    g.filas.push(p);
  });

  grupos.forEach((g, idx) => {
    const [y, m, d] = g.clave.split('-').map(Number);
    const titulo = new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    const vendidos = g.filas.filter(p => p.status !== 'anulado' && p.status !== 'esperando_pago');
    const total = vendidos.reduce((s, p) => s + p.total, 0);
    // el último día puede estar incompleto si hay más páginas: no se muestra un total engañoso
    const incompleto = hayMas && idx === grupos.length - 1;

    const cab = document.createElement('div');
    cab.className = 'dia-cabecera';
    cab.innerHTML = `<span>${esc(titulo)}</span>
      <span class="dia-total">${incompleto ? `${g.filas.length}+ pedidos` : `${g.filas.length} pedido${g.filas.length === 1 ? '' : 's'} · ${dinero(total)}`}</span>`;
    listaEl.appendChild(cab);

    g.filas.forEach(p => listaEl.appendChild(filaPedido(p)));
  });
}

function filaPedido(p) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pedido-fila';
  const nombre = p.customerName || p.tableNumber || 'Sin nombre';
  b.innerHTML = `
    <span class="pedido-num">#${esc(p.orderNumber)}</span>
    <span class="pedido-linea1">${esc(nombre)}</span>
    <span class="pedido-total">${esc(dinero(p.total))}</span>
    <span class="pedido-linea2">${esc(hora(p.createdAt))} · ${esc(TIPOS[p.orderType] || '')} · ${esc(p.paymentMethod || 'Sin pago')} · ${esc(p.unidades)} prod.</span>
    <span class="estado ${esc(p.status)}">${esc(ESTADOS[p.status] || p.status)}</span>`;
  b.onclick = () => abrirDetalle(p.id);
  return b;
}

// ---------- Detalle ----------

let pedidoAbierto = null;

async function abrirDetalle(id) {
  pedidoAbierto = null;
  detalleTitulo.textContent = 'Cargando…';
  detalleCuerpo.innerHTML = '';
  filaEmail.style.display = 'none';
  mensajeEmail.textContent = ''; mensajeEmail.className = 'mensaje-email';
  botonReimprimir.disabled = botonEmail.disabled = true;
  modal.classList.add('visible');

  let res;
  try { res = await fetch('/api/orders/' + encodeURIComponent(id)); } catch (e) { res = null; }
  if (!res || !res.ok) {
    detalleTitulo.textContent = 'No se pudo cargar';
    detalleCuerpo.innerHTML = '<p>Intenta de nuevo.</p>';
    return;
  }
  pedidoAbierto = await res.json();
  pintarDetalle(pedidoAbierto);
}

function pintarDetalle(p) {
  const anulado = p.status === 'anulado';
  const sinPagar = p.status === 'esperando_pago';
  detalleTitulo.innerHTML = `Pedido #${esc(p.orderNumber)} <span class="estado ${esc(p.status)}">${esc(ESTADOS[p.status] || p.status)}</span>`;

  const items = p.items || [];
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const descuento = Number(p.discountAmount) || 0;
  const nombre = p.customerName || p.tableNumber || '—';
  const atendio = p.source === 'autopedido' ? 'Autopedido (kiosco)' : (p.createdBy || '—');

  const filasDatos = [
    ['Fecha', fechaHora(p.createdAt)],
    ['A nombre de', nombre],
    ['Tipo', TIPOS[p.orderType] || '—'],
    ['Pago', p.paymentMethod || 'Sin especificar'],
    ['Atendió', atendio],
    ['Listo a las', p.readyAt ? hora(p.readyAt) : '—'],
    ['Entregado a las', p.deliveredAt ? hora(p.deliveredAt) : '—']
  ];
  if (p.edited) filasDatos.push(['Editado', 'Sí, se modificó después de enviarlo']);

  detalleCuerpo.innerHTML = `
    ${anulado ? `<div class="aviso-anulado">PEDIDO ANULADO — Motivo: ${esc(p.voidReason || 'no indicado')}${p.voidedBy ? ` · por ${esc(p.voidedBy)}` : ''}${p.voidedAt ? ` · ${esc(fechaHora(p.voidedAt))}` : ''}</div>` : ''}
    <dl class="datos-pedido">${filasDatos.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="items-detalle">
      ${items.map(i => `
        <div class="item-detalle">
          <span><span class="cant">${esc(i.qty)}×</span>${esc(i.name)}${i.notes ? `<span class="nota">${esc(i.notes)}</span>` : ''}</span>
          <span class="sub">${esc(dinero(i.price * i.qty))}</span>
        </div>`).join('') || '<p>Sin productos</p>'}
    </div>
    <div class="totales-detalle">
      ${descuento > 0 ? `
        <div class="fila"><span>Subtotal</span><span>${esc(dinero(subtotal))}</span></div>
        <div class="fila"><span>Descuento${p.discountReason ? ` (${esc(p.discountReason)})` : ''}</span><span>-${esc(dinero(descuento))}</span></div>` : ''}
      <div class="fila total"><span>Total</span><span>${esc(dinero(p.total))}</span></div>
    </div>`;

  botonReimprimir.disabled = anulado || sinPagar;
  botonEmail.disabled = anulado || sinPagar;
  const motivo = anulado ? 'Pedido anulado: no tiene recibo' : (sinPagar ? 'Todavía no está pagado: no tiene recibo' : '');
  botonReimprimir.title = botonEmail.title = motivo;
  if (motivo) { mensajeEmail.textContent = motivo; mensajeEmail.className = 'mensaje-email'; }
}

function cerrarDetalle() { modal.classList.remove('visible'); pedidoAbierto = null; }
$('cerrarDetalle').onclick = cerrarDetalle;
modal.addEventListener('click', e => { if (e.target === modal) cerrarDetalle(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarDetalle(); });

botonReimprimir.onclick = () => {
  if (pedidoAbierto) window.open(`receipt.html?id=${encodeURIComponent(pedidoAbierto.id)}`, '_blank', 'width=380,height=640');
};

botonEmail.onclick = () => {
  if (!pedidoAbierto) return;
  const visible = filaEmail.style.display !== 'none';
  filaEmail.style.display = visible ? 'none' : 'flex';
  if (!visible) campoEmail.focus();
};

async function enviarRecibo() {
  if (!pedidoAbierto) return;
  const email = campoEmail.value.trim();
  if (!RE_EMAIL.test(email)) {
    mensajeEmail.textContent = 'Escribe un correo válido, por ejemplo cliente@correo.com';
    mensajeEmail.className = 'mensaje-email error';
    return;
  }
  botonEnviarEmail.disabled = true;
  botonEnviarEmail.textContent = 'Enviando…';
  mensajeEmail.textContent = ''; mensajeEmail.className = 'mensaje-email';
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(pedidoAbierto.id)}/enviar-recibo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
    });
    const datos = await res.json().catch(() => ({}));
    if (res.ok) {
      mensajeEmail.textContent = `✓ Recibo enviado a ${datos.enviadoA || email}`;
      mensajeEmail.className = 'mensaje-email ok';
    } else {
      mensajeEmail.textContent = datos.error || 'No se pudo enviar el recibo';
      mensajeEmail.className = 'mensaje-email error';
    }
  } catch (e) {
    mensajeEmail.textContent = 'Sin conexión. Revisa internet e intenta de nuevo.';
    mensajeEmail.className = 'mensaje-email error';
  }
  botonEnviarEmail.disabled = false;
  botonEnviarEmail.textContent = 'Enviar';
}
botonEnviarEmail.onclick = enviarRecibo;
campoEmail.addEventListener('keydown', e => { if (e.key === 'Enter') enviarRecibo(); });

// ---------- Eventos de los filtros ----------

document.querySelectorAll('#atajosFecha .chip').forEach(c => {
  c.onclick = () => {
    const [d, h] = rangoAtajo(c.dataset.atajo);
    fDesde.value = d; fHasta.value = h; fMes.value = '';
    cargar();
  };
});

document.querySelectorAll('#atajosHora .chip').forEach(c => {
  c.onclick = () => {
    const [d, h] = (c.dataset.franja || '-').split('-');
    fHoraDesde.value = d || ''; fHoraHasta.value = h || '';
    cargar();
  };
});

fMes.addEventListener('change', () => {
  if (!fMes.value) return;
  [fDesde.value, fHasta.value] = rangoMes(fMes.value);
  cargar();
});

[fDesde, fHasta].forEach(el => el.addEventListener('change', () => {
  fMes.value = '';
  if (!fDesde.value) fDesde.value = fHasta.value || fechaLocalISO(new Date());
  if (!fHasta.value) fHasta.value = fDesde.value;
  cargar();
}));

[fHoraDesde, fHoraHasta, fEstado, fMetodo].forEach(el => el.addEventListener('change', () => cargar()));

let temporizador = null;
fBuscar.addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(() => cargar(), 300); });
fBuscar.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(temporizador); cargar(); } });

$('botonLimpiar').onclick = () => {
  const [d, h] = rangoAtajo('hoy');
  fDesde.value = d; fHasta.value = h; fMes.value = '';
  fHoraDesde.value = fHoraHasta.value = '';
  fEstado.value = 'terminados'; fMetodo.value = ''; fBuscar.value = '';
  cargar();
};

botonMas.onclick = () => cargar(false);

// Al entrar: pedidos de hoy que ya quedaron listos o entregados
$('botonLimpiar').click();
