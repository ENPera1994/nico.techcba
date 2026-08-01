// ══════════════════════════════════════════════
//  SEGUIMIENTO DE ÓRDENES (lado cliente — solo lectura)
// ══════════════════════════════════════════════
// Cada orden se guarda en Firestore con su número (ej: "0001") como ID
// del documento, así el cliente puede consultarla con una lectura directa
// (permitida por las reglas de seguridad) sin poder listar el resto de
// las órdenes ni ver datos de otros clientes.

import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const ORDEN_PREFIX = 'NT-';
const ESTADOS = ['recibido', 'en-diagnostico', 'en-reparacion', 'reparado', 'entregado'];

function estadoLabel(estado) {
  const labels = {
    'recibido': '📥 Recibido',
    'en-diagnostico': '🔍 En diagnóstico',
    'en-reparacion': '🔧 En reparación',
    'reparado': '✅ Reparado',
    'entregado': '📦 Entregado'
  };
  return labels[estado] || estado;
}

function formatNumber(n) {
  return ORDEN_PREFIX + String(n).padStart(4, '0');
}

async function buscarOrden() {
  const inputEl = document.getElementById('trackInput');
  const btn = document.getElementById('btnBuscarOrden');
  const input = inputEl.value.trim().toUpperCase();
  const empty = document.getElementById('trackEmpty');
  const notFound = document.getElementById('trackNotFound');
  const found = document.getElementById('trackFound');
  const loading = document.getElementById('trackLoading');

  empty.style.display = 'none';
  notFound.style.display = 'none';
  found.style.display = 'none';

  if (!input) { empty.style.display = 'block'; return; }

  let num = input.replace(ORDEN_PREFIX, '');
  const numParsed = parseInt(num, 10);

  if (isNaN(numParsed) || numParsed <= 0) {
    notFound.style.display = 'block';
    return;
  }

  const docId = String(numParsed).padStart(4, '0');

  loading.style.display = 'block';
  btn.disabled = true;

  try {
    const snap = await getDoc(doc(db, 'ordenes', docId));
    loading.style.display = 'none';
    btn.disabled = false;

    if (!snap.exists()) {
      notFound.style.display = 'block';
      return;
    }

    const o = snap.data();
    mostrarOrden(o, numParsed, found);
    found.style.display = 'block';
  } catch (e) {
    console.error('Error buscando la orden:', e);
    loading.style.display = 'none';
    btn.disabled = false;
    notFound.style.display = 'block';
  }
}

function mostrarOrden(o, numero, found) {
  const idxActual = ESTADOS.indexOf(o.estado);

  const timelineHTML = `
    <div class="order-detail-header">
      <div>
        <div class="order-number">${formatNumber(numero)}</div>
        <div class="order-date">Ingresada el ${o.fechaCreado ? new Date(o.fechaCreado).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div>
      </div>
      <span class="status-badge ${o.estado}">${estadoLabel(o.estado)}</span>
    </div>

    <div class="order-timeline">
      ${ESTADOS.map((est, i) => {
        const cls = i < idxActual ? 'active' : (i === idxActual ? 'current' : '');
        const lineCls = i < idxActual ? 'active' : '';
        const isLast = i === ESTADOS.length - 1;
        return `
          <div class="timeline-step">
            <div class="timeline-dot ${cls}"></div>
            <div class="timeline-label ${cls}">${estadoLabel(est).replace(/^[^\s]+\s/, '')}</div>
          </div>
          ${!isLast ? `<div class="timeline-line ${lineCls}"></div>` : ''}
        `;
      }).join('')}
    </div>

    <div class="order-info-grid">
      <div class="order-info-card">
        <h4>Cliente</h4>
        <p>${escapeHTML(o.nombre || '—')}</p>
      </div>
      <div class="order-info-card">
        <h4>Equipo</h4>
        <p>${escapeHTML(o.marca || '')} ${escapeHTML(o.modelo || '')}${o.color ? ' · ' + escapeHTML(o.color) : ''}</p>
      </div>
      <div class="order-info-card full">
        <h4>Trabajo a realizar</h4>
        <p>${escapeHTML(o.trabajo || '—')}</p>
      </div>
      ${o.precio ? `
      <div class="order-info-card">
        <h4>Precio estimado</h4>
        <p style="color:var(--accent);font-family:'Syne',sans-serif;font-weight:600;">$ ${Number(o.precio).toLocaleString('es-AR')}</p>
      </div>` : ''}
      ${o.reparacionRealizada ? `
      <div class="order-info-card full">
        <h4>Reparación realizada</h4>
        <p>${escapeHTML(o.reparacionRealizada)}</p>
      </div>` : ''}
      ${(o.estado === 'reparado' || o.estado === 'entregado') && o.resultado ? `
      <div class="order-info-card">
        <h4>Resultado</h4>
        <p>${o.resultado === 'exito' ? '✅ Finalizado con éxito' : o.resultado === 'sin-exito' ? '❌ Finalizado sin éxito' : '⏳ Pendiente de revisión'}</p>
      </div>` : ''}
      ${o.notas ? `
      <div class="order-info-card full">
        <h4>Observaciones</h4>
        <p style="color:var(--muted);font-size:0.85rem;">${escapeHTML(o.notas)}</p>
      </div>` : ''}
    </div>

    <div style="margin-top:1.5rem;padding:1rem;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.12);border-radius:6px;font-size:0.82rem;color:var(--muted);line-height:1.6;">
      💡 Si tenés dudas sobre tu reparación, contactanos por <a href="https://wa.me/5493512836584" target="_blank" style="color:var(--accent);">WhatsApp</a> mencionando tu número de orden.
    </div>
  `;

  found.innerHTML = timelineHTML;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.buscarOrden = buscarOrden;
