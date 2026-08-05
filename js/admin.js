// ══════════════════════════════════════════════
//  PANEL DE ADMINISTRACIÓN — NicoTech CBA
// ══════════════════════════════════════════════
import { db, auth, ADMIN_EMAIL } from './firebase-config.js';
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection, doc, setDoc, deleteDoc, updateDoc, getDocs,
  query, orderBy, limit, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { TIPOS, calcularPrecio, margenLabel } from './precios.js';

const ESTADOS = ['recibido', 'en-diagnostico', 'en-reparacion', 'reparado', 'entregado'];
const RESULTADOS = ['pendiente', 'exito', 'sin-exito'];
const ORDEN_PREFIX = 'NT-';
const ACCESORIOS_DISPONIBLES = ['SIM', 'Memoria', 'Batería', 'Bandeja SIM'];

let ordenes = [];
let catalogo = [];
let marcas = [];
let modelos = [];
let sortCol = 'fechaCreado';
let sortDir = 'desc';
let unsubOrdenes = null;
let unsubCatalogo = null;
let unsubMarcas = null;
let unsubModelos = null;

// ── AUTH ──
function doLogin() {
  const pass = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');
  err.style.display = 'none';
  if (!pass) return;
  btn.disabled = true;
  btn.textContent = 'Ingresando…';
  signInWithEmailAndPassword(auth, ADMIN_EMAIL, pass)
    .catch(() => {
      err.textContent = 'Contraseña incorrecta. Intentá de nuevo.';
      err.style.display = 'block';
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = 'Ingresar al panel →';
    });
}

function doLogout() {
  signOut(auth);
}

onAuthStateChanged(auth, user => {
  const loginScreen = document.getElementById('loginScreen');
  const dashboard = document.getElementById('dashboard');
  if (user) {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'flex';
    iniciarListeners();
  } else {
    loginScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    if (unsubOrdenes) unsubOrdenes();
    if (unsubCatalogo) unsubCatalogo();
    if (unsubMarcas) unsubMarcas();
    if (unsubModelos) unsubModelos();
  }
});

function iniciarListeners() {
  unsubOrdenes = onSnapshot(collection(db, 'ordenes'), snap => {
    ordenes = [];
    snap.forEach(d => ordenes.push({ id: d.id, ...d.data() }));
    renderStats();
    renderTabla();
  }, err => console.error('Error leyendo órdenes:', err));

  unsubCatalogo = onSnapshot(collection(db, 'catalogo'), snap => {
    catalogo = [];
    snap.forEach(d => catalogo.push({ id: d.id, ...d.data() }));
    renderCatalogo();
  }, err => console.error('Error leyendo catálogo:', err));

  unsubMarcas = onSnapshot(collection(db, 'marcas'), snap => {
    marcas = [];
    snap.forEach(d => marcas.push({ id: d.id, ...d.data() }));
    marcas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    renderMarcas();
  }, err => console.error('Error leyendo marcas:', err));

  unsubModelos = onSnapshot(collection(db, 'modelos'), snap => {
    modelos = [];
    snap.forEach(d => modelos.push({ id: d.id, ...d.data() }));
    modelos.sort((a, b) => a.modelo.localeCompare(b.modelo));
    renderModelosManage();
    renderCatModelosCheckboxes();
  }, err => console.error('Error leyendo modelos:', err));
}

// ── TABS ──
function cambiarTab(tab) {
  document.querySelectorAll('.dash-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
}

// ── HELPERS ──
function formatNumber(n) { return ORDEN_PREFIX + String(n).padStart(4, '0'); }
function padId(n) { return String(n).padStart(4, '0'); }

function estadoLabel(estado) {
  const labels = {
    'recibido': '📥 Recibido',
    'en-diagnostico': '🔍 Diagnóstico',
    'en-reparacion': '🔧 Reparación',
    'reparado': '✅ Reparado',
    'entregado': '📦 Entregado'
  };
  return labels[estado] || estado;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ── STATS ──
function renderStats() {
  document.getElementById('sTotal').textContent = ordenes.length;
  document.getElementById('sRecibido').textContent = ordenes.filter(o => o.estado === 'recibido').length;
  document.getElementById('sDiag').textContent = ordenes.filter(o => o.estado === 'en-diagnostico').length;
  document.getElementById('sRep').textContent = ordenes.filter(o => o.estado === 'en-reparacion').length;
  document.getElementById('sReparado').textContent = ordenes.filter(o => o.estado === 'reparado').length;
  document.getElementById('sEntregado').textContent = ordenes.filter(o => o.estado === 'entregado').length;
}

// ── TABLA DE ÓRDENES ──
function setSortCol(col) {
  if (sortCol === col) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
  else { sortCol = col; sortDir = 'desc'; }
  renderTabla();
}

function renderTabla() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase();
  const filtroEstado = document.getElementById('filterEstado').value;
  const tbody = document.getElementById('tableBody');
  const tabla = document.getElementById('adminTable');
  const empty = document.getElementById('tableEmpty');

  let filtradas = ordenes.filter(o => {
    if (filtroEstado && o.estado !== filtroEstado) return false;
    if (!search) return true;
    const blob = `${o.nombre || ''} ${o.telefono || ''} ${o.marca || ''} ${o.modelo || ''} ${o.trabajo || ''}`.toLowerCase();
    return blob.includes(search);
  });

  filtradas.sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (sortCol === 'estado') { va = ESTADOS.indexOf(a.estado); vb = ESTADOS.indexOf(b.estado); }
    if (va == null) va = 0;
    if (vb == null) vb = 0;
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  document.querySelectorAll('.admin-table th[id^="th-"]').forEach(th => {
    th.classList.toggle('sorted', th.id === 'th-' + sortCol);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = th.id === 'th-' + sortCol ? (sortDir === 'asc' ? '↑' : '↓') : '↕';
  });

  if (filtradas.length === 0) {
    tabla.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  tabla.style.display = 'table';
  empty.style.display = 'none';

  tbody.innerHTML = filtradas.map(o => `
    <tr>
      <td><span class="col-id" onclick="abrirDetalle('${o.id}')">${formatNumber(o.numero)}</span></td>
      <td class="col-fecha">${formatDate(o.fechaCreado)}</td>
      <td class="col-cliente"><strong>${escapeHTML(o.nombre)}</strong><span>${escapeHTML(o.telefono || '')}</span></td>
      <td class="col-equipo">${escapeHTML(o.marca)} ${escapeHTML(o.modelo)}</td>
      <td class="col-trabajo" title="${escapeHTML(o.trabajo)}">${escapeHTML(o.trabajo)}</td>
      <td class="col-precio">${o.precio ? '$ ' + Number(o.precio).toLocaleString('es-AR') : '—'}</td>
      <td><span class="status-badge ${o.estado}">${estadoLabel(o.estado)}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn-sm" onclick="editarOrden('${o.id}')" title="Editar">✏️</button>
          <button class="btn-sm" onclick="cambiarEstado('${o.id}')" title="Avanzar estado">🔄</button>
          <button class="btn-sm danger" onclick="eliminarOrden('${o.id}')" title="Eliminar">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── DETALLE (panel lateral) ──
function abrirDetalle(id) {
  const o = ordenes.find(x => x.id === id);
  if (!o) return;
  document.getElementById('detailTitle').textContent = formatNumber(o.numero);
  const resultadoLabels = { pendiente: '⏳ Pendiente de revisión', exito: '✅ Finalizado con éxito', 'sin-exito': '❌ Finalizado sin éxito' };
  document.getElementById('detailBody').innerHTML = `
    <div class="order-info-card"><h4>Cliente</h4><p>${escapeHTML(o.nombre)}${o.dni ? ' · DNI ' + escapeHTML(o.dni) : ''}</p></div>
    <div class="order-info-card"><h4>Teléfono</h4><p>${escapeHTML(o.telefono || '—')}</p></div>
    <div class="order-info-card"><h4>Email</h4><p>${escapeHTML(o.email || '—')}</p></div>
    <div class="order-info-card"><h4>Equipo</h4><p>${escapeHTML(o.marca)} ${escapeHTML(o.modelo)}${o.color ? ' · ' + escapeHTML(o.color) : ''}</p></div>
    <div class="order-info-card"><h4>Código de seguridad</h4><p>${escapeHTML(o.codigoSeguridad || '—')}</p></div>
    <div class="order-info-card"><h4>Mojado / Golpeado</h4><p>${o.mojado ? 'Mojado' : 'No mojado'} · ${o.golpeado ? 'Golpeado' : 'No golpeado'}</p></div>
    <div class="order-info-card"><h4>Accesorios</h4><p>${(o.accesorios && o.accesorios.length) ? o.accesorios.map(escapeHTML).join(', ') : '—'}</p></div>
    <div class="order-info-card full"><h4>Falla / Pedido de reparación</h4><p>${escapeHTML(o.trabajo)}</p></div>
    <div class="order-info-card"><h4>Presupuesto</h4><p>${o.precio ? '$ ' + Number(o.precio).toLocaleString('es-AR') : '—'}</p></div>
    <div class="order-info-card"><h4>Estado</h4><p><span class="status-badge ${o.estado}">${estadoLabel(o.estado)}</span></p></div>
    ${o.notas ? `<div class="order-info-card full"><h4>Observaciones (cliente)</h4><p>${escapeHTML(o.notas)}</p></div>` : ''}
    <div class="order-info-card"><h4>Costo repuesto</h4><p>${o.costoRepuesto ? '$ ' + Number(o.costoRepuesto).toLocaleString('es-AR') : '—'}</p></div>
    <div class="order-info-card"><h4>Proveedor</h4><p>${escapeHTML(o.proveedor || '—')}</p></div>
    <div class="order-info-card"><h4>Técnico</h4><p>${escapeHTML(o.tecnico || '—')}</p></div>
    <div class="order-info-card"><h4>Resultado</h4><p>${resultadoLabels[o.resultado] || resultadoLabels.pendiente}</p></div>
    ${o.reparacionRealizada ? `<div class="order-info-card full"><h4>Reparación realizada</h4><p>${escapeHTML(o.reparacionRealizada)}</p></div>` : ''}
    ${o.comentarioTecnico ? `<div class="order-info-card full"><h4>Comentario del técnico (interno)</h4><p>${escapeHTML(o.comentarioTecnico)}</p></div>` : ''}
  `;
  document.getElementById('detailSaveBtn').onclick = () => { cerrarDetalle(); editarOrden(id); };
  document.getElementById('detailOverlay').classList.add('active');
}

function cerrarDetalle() {
  document.getElementById('detailOverlay').classList.remove('active');
}

// ── MODAL NUEVA / EDITAR ──
function abrirModal(id) {
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('editOrderId').value = id || '';
  document.getElementById('modalTitle').textContent = id ? 'Editar orden' : 'Nueva orden de reparación';

  const campos = [
    'ordNombre','ordDni','ordTelefono','ordEmail','ordMarca','ordModelo','ordColor',
    'ordCodigoSeguridad','ordPrecio','ordTrabajo','ordNotas','ordCostoRepuesto',
    'ordProveedor','ordTecnico','ordReparacionRealizada','ordComentarioTecnico'
  ];
  campos.forEach(c => document.getElementById(c).value = '');
  document.getElementById('ordEstado').value = 'recibido';
  document.getElementById('ordMojado').value = 'no';
  document.getElementById('ordGolpeado').value = 'no';
  document.getElementById('ordResultado').value = 'pendiente';
  document.querySelectorAll('.ord-accesorio').forEach(cb => cb.checked = false);

  if (id) {
    const o = ordenes.find(x => x.id === id);
    if (o) {
      document.getElementById('ordNombre').value = o.nombre || '';
      document.getElementById('ordDni').value = o.dni || '';
      document.getElementById('ordTelefono').value = o.telefono || '';
      document.getElementById('ordEmail').value = o.email || '';
      document.getElementById('ordMarca').value = o.marca || '';
      document.getElementById('ordModelo').value = o.modelo || '';
      document.getElementById('ordColor').value = o.color || '';
      document.getElementById('ordCodigoSeguridad').value = o.codigoSeguridad || '';
      document.getElementById('ordMojado').value = o.mojado ? 'si' : 'no';
      document.getElementById('ordGolpeado').value = o.golpeado ? 'si' : 'no';
      document.getElementById('ordPrecio').value = o.precio || '';
      document.getElementById('ordTrabajo').value = o.trabajo || '';
      document.getElementById('ordEstado').value = o.estado || 'recibido';
      document.getElementById('ordNotas').value = o.notas || '';
      document.getElementById('ordCostoRepuesto').value = o.costoRepuesto || '';
      document.getElementById('ordProveedor').value = o.proveedor || '';
      document.getElementById('ordTecnico').value = o.tecnico || '';
      document.getElementById('ordResultado').value = o.resultado || 'pendiente';
      document.getElementById('ordReparacionRealizada').value = o.reparacionRealizada || '';
      document.getElementById('ordComentarioTecnico').value = o.comentarioTecnico || '';
      const accesoriosSet = new Set(o.accesorios || []);
      document.querySelectorAll('.ord-accesorio').forEach(cb => cb.checked = accesoriosSet.has(cb.value));
    }
  }
}

function editarOrden(id) { abrirModal(id); }

function cerrarModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

async function guardarOrden() {
  const editId = document.getElementById('editOrderId').value;
  const nombre = document.getElementById('ordNombre').value.trim();
  const trabajo = document.getElementById('ordTrabajo').value.trim();
  if (!nombre || !trabajo) { alert('Completá al menos el nombre del cliente y el trabajo a realizar.'); return; }

  const btn = document.getElementById('modalSaveBtn');
  btn.disabled = true;

  const accesorios = [...document.querySelectorAll('.ord-accesorio')].filter(cb => cb.checked).map(cb => cb.value);

  const datos = {
    nombre,
    dni: document.getElementById('ordDni').value.trim(),
    telefono: document.getElementById('ordTelefono').value.trim(),
    email: document.getElementById('ordEmail').value.trim(),
    marca: document.getElementById('ordMarca').value.trim(),
    modelo: document.getElementById('ordModelo').value.trim(),
    color: document.getElementById('ordColor').value.trim(),
    codigoSeguridad: document.getElementById('ordCodigoSeguridad').value.trim(),
    mojado: document.getElementById('ordMojado').value === 'si',
    golpeado: document.getElementById('ordGolpeado').value === 'si',
    accesorios,
    precio: parseInt(document.getElementById('ordPrecio').value) || 0,
    trabajo,
    estado: document.getElementById('ordEstado').value,
    notas: document.getElementById('ordNotas').value.trim(),
    costoRepuesto: parseInt(document.getElementById('ordCostoRepuesto').value) || 0,
    proveedor: document.getElementById('ordProveedor').value.trim(),
    tecnico: document.getElementById('ordTecnico').value.trim(),
    resultado: document.getElementById('ordResultado').value,
    reparacionRealizada: document.getElementById('ordReparacionRealizada').value.trim(),
    comentarioTecnico: document.getElementById('ordComentarioTecnico').value.trim(),
    fechaModificado: Date.now()
  };

  try {
    if (editId) {
      await updateDoc(doc(db, 'ordenes', editId), datos);
    } else {
      const numero = await getNextNumber();
      datos.numero = numero;
      datos.fechaCreado = Date.now();
      await setDoc(doc(db, 'ordenes', padId(numero)), datos);
    }
    cerrarModal();
  } catch (e) {
    console.error(e);
    alert('No se pudo guardar la orden. Revisá tu conexión e intentá de nuevo.');
  } finally {
    btn.disabled = false;
  }
}

async function getNextNumber() {
  try {
    const q = query(collection(db, 'ordenes'), orderBy('numero', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return 1;
    return (snap.docs[0].data().numero || 0) + 1;
  } catch {
    const max = ordenes.reduce((m, o) => Math.max(m, o.numero || 0), 0);
    return max + 1;
  }
}

async function eliminarOrden(id) {
  const o = ordenes.find(x => x.id === id);
  if (!o) return;
  if (!confirm(`¿Eliminar la orden ${formatNumber(o.numero)}?\nEsta acción no se puede deshacer.`)) return;
  try {
    await deleteDoc(doc(db, 'ordenes', id));
  } catch (e) {
    console.error(e);
    alert('No se pudo eliminar la orden.');
  }
}

async function cambiarEstado(id) {
  const o = ordenes.find(x => x.id === id);
  if (!o) return;
  const idx = ESTADOS.indexOf(o.estado);
  const siguiente = ESTADOS[(idx + 1) % ESTADOS.length];
  try {
    await updateDoc(doc(db, 'ordenes', id), { estado: siguiente, fechaModificado: Date.now() });
  } catch (e) {
    console.error(e);
    alert('No se pudo cambiar el estado.');
  }
}

function exportarCSV() {
  if (ordenes.length === 0) { alert('No hay órdenes para exportar.'); return; }
  const headers = ['Numero','Fecha','Cliente','Telefono','Email','Marca','Modelo','Color','Trabajo','Precio','Estado','Notas'];
  const rows = ordenes.map(o => [
    formatNumber(o.numero), formatDate(o.fechaCreado), o.nombre, o.telefono, o.email || '',
    o.marca, o.modelo, o.color || '', o.trabajo, o.precio || 0, estadoLabel(o.estado), (o.notas || '').replace(/\n/g, ' ')
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ordenes-nicotech-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── MARCAS Y MODELOS (gestor de referencia) ──
function slugSimple(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function slugCatalogo(marca, modelo, tipo) {
  return `${marca}-${modelo}-${tipo}`
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function agregarMarca() {
  const input = document.getElementById('nuevaMarcaInput');
  const nombre = input.value.trim();
  if (!nombre) return;
  const id = slugSimple(nombre);
  try {
    await setDoc(doc(db, 'marcas', id), { nombre });
    input.value = '';
  } catch (e) {
    console.error(e);
    alert('No se pudo agregar la marca.');
  }
}

async function eliminarMarca(id) {
  const m = marcas.find(x => x.id === id);
  if (!m) return;
  const tieneModelos = modelos.some(mo => mo.marca === m.nombre);
  if (tieneModelos && !confirm(`"${m.nombre}" tiene modelos cargados. ¿Eliminar la marca de todos modos? (los modelos y precios ya cargados NO se borran solos, pero vas a tener que borrarlos aparte)`)) return;
  try {
    await deleteDoc(doc(db, 'marcas', id));
  } catch (e) {
    console.error(e);
    alert('No se pudo eliminar la marca.');
  }
}

function renderMarcas() {
  const cont = document.getElementById('marcasListContainer');
  cont.innerHTML = marcas.length
    ? marcas.map(m => `<span class="chip">${escapeHTML(m.nombre)}<button onclick="eliminarMarca('${m.id}')" title="Eliminar">×</button></span>`).join('')
    : '<span class="chip-empty">Todavía no cargaste ninguna marca.</span>';

  ['modeloMarcaSel', 'catMarcaSel', 'bulkMarcaSel'].forEach(selId => {
    const sel = document.getElementById(selId);
    const actual = sel.value;
    sel.innerHTML = '<option value="">— Elegí una marca —</option>' +
      marcas.map(m => `<option value="${escapeHTML(m.nombre)}">${escapeHTML(m.nombre)}</option>`).join('');
    if (marcas.some(m => m.nombre === actual)) sel.value = actual;
  });
}

async function agregarModelo() {
  const marca = document.getElementById('modeloMarcaSel').value;
  const textarea = document.getElementById('nuevoModeloInput');
  if (!marca) { alert('Elegí primero una marca.'); return; }

  const nombres = textarea.value
    .split(/[,/\n]/)
    .map(s => s.trim())
    .filter(Boolean);

  if (nombres.length === 0) return;

  try {
    const batch = writeBatch(db);
    nombres.forEach(modelo => {
      const id = slugSimple(marca + '-' + modelo);
      batch.set(doc(db, 'modelos', id), { marca, modelo });
    });
    await batch.commit();
    textarea.value = '';
  } catch (e) {
    console.error(e);
    alert('No se pudieron agregar los modelos.');
  }
}

async function eliminarModelo(id) {
  const mo = modelos.find(x => x.id === id);
  if (!mo) return;
  if (!confirm(`¿Eliminar el modelo "${mo.modelo}" de ${mo.marca}?`)) return;
  try {
    await deleteDoc(doc(db, 'modelos', id));
  } catch (e) {
    console.error(e);
    alert('No se pudo eliminar el modelo.');
  }
}

function renderModelosManage() {
  const marcaSel = document.getElementById('modeloMarcaSel').value;
  const cont = document.getElementById('modelosListContainer');
  const lista = modelos.filter(mo => mo.marca === marcaSel);
  cont.innerHTML = !marcaSel
    ? '<span class="chip-empty">Elegí una marca para ver sus modelos.</span>'
    : lista.length
      ? lista.map(mo => `<span class="chip">${escapeHTML(mo.modelo)}<button onclick="eliminarModelo('${mo.id}')" title="Eliminar">×</button></span>`).join('')
      : '<span class="chip-empty">Esta marca todavía no tiene modelos.</span>';
}

// ── FORMULARIO DE PRECIO (marca → checkboxes de modelos → tipo → costo) ──
function onCatMarcaChange() {
  renderCatModelosCheckboxes();
}

function renderCatModelosCheckboxes() {
  const marcaSel = document.getElementById('catMarcaSel').value;
  const cont = document.getElementById('catModelosCheckboxes');
  const lista = modelos.filter(mo => mo.marca === marcaSel);

  if (!marcaSel) {
    cont.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Elegí primero una marca</span>';
    return;
  }
  if (lista.length === 0) {
    cont.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Esta marca no tiene modelos cargados todavía (agregalos arriba en el paso 2)</span>';
    return;
  }
  cont.innerHTML = lista.map(mo => `
    <label class="modelo-check-label">
      <input type="checkbox" class="cat-modelo-check" value="${escapeHTML(mo.modelo)}"/> ${escapeHTML(mo.modelo)}
    </label>
  `).join('');
}

function renderCatalogo() {
  const tbody = document.getElementById('catalogBody');
  const tabla = document.getElementById('catalogTable');
  const empty = document.getElementById('catalogEmpty');
  const search = (document.getElementById('catalogSearch')?.value || '').toLowerCase();

  let filtrado = [...catalogo].sort((a, b) => (a.marca + a.modelo).localeCompare(b.marca + b.modelo));
  if (search) {
    filtrado = filtrado.filter(i => `${i.marca} ${i.modelo}`.toLowerCase().includes(search));
  }

  if (filtrado.length === 0) {
    tabla.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  tabla.style.display = 'table';
  empty.style.display = 'none';

  tbody.innerHTML = filtrado.map(i => {
    const t = TIPOS[i.tipo] || { label: i.tipo, icon: '🔧' };
    const precioCliente = calcularPrecio(i.tipo, i.costoBase);
    return `
      <tr>
        <td>${escapeHTML(i.marca)}</td>
        <td>${escapeHTML(i.modelo)}</td>
        <td>${t.icon} ${t.label}</td>
        <td class="col-costo">$ ${Number(i.costoBase || 0).toLocaleString('es-AR')}</td>
        <td class="col-precio-cliente">$ ${precioCliente.toLocaleString('es-AR')} <span class="margen-badge">${margenLabel(i.tipo, i.costoBase)}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn-sm" onclick="editarCatalogo('${i.id}')" title="Editar">✏️</button>
            <button class="btn-sm danger" onclick="eliminarCatalogo('${i.id}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function guardarCatalogoItem() {
  const editId = document.getElementById('catEditId').value;
  const marca = document.getElementById('catMarcaSel').value;
  const tipo = document.getElementById('catTipo').value;
  const costoBase = parseFloat(document.getElementById('catCosto').value);

  if (!marca || !tipo || isNaN(costoBase) || costoBase <= 0) {
    alert('Completá marca, tipo de reparación y un costo válido.');
    return;
  }

  try {
    if (editId) {
      // Edición de un ítem existente: el modelo no cambia, solo tipo/costo.
      await updateDoc(doc(db, 'catalogo', editId), { tipo, costoBase, activo: true });
    } else {
      const modelosElegidos = [...document.querySelectorAll('.cat-modelo-check')].filter(cb => cb.checked).map(cb => cb.value);
      if (modelosElegidos.length === 0) {
        alert('Tildá al menos un modelo.');
        return;
      }
      const batch = writeBatch(db);
      modelosElegidos.forEach(modelo => {
        const id = slugCatalogo(marca, modelo, tipo);
        batch.set(doc(db, 'catalogo', id), { marca, modelo, tipo, costoBase, activo: true });
      });
      await batch.commit();
    }
    cancelarEdicionCatalogo();
  } catch (e) {
    console.error(e);
    alert('No se pudo guardar el ítem del catálogo.');
  }
}

function editarCatalogo(id) {
  const item = catalogo.find(i => i.id === id);
  if (!item) return;
  document.getElementById('catEditId').value = id;
  document.getElementById('catMarcaSel').value = item.marca;
  document.getElementById('catTipo').value = item.tipo;
  document.getElementById('catCosto').value = item.costoBase;
  document.getElementById('catModelosCheckboxes').innerHTML = `<span class="modelo-check-label" style="color:var(--accent);">${escapeHTML(item.modelo)}</span>`;
  document.getElementById('catEditModeloNota').style.display = 'inline';
  document.getElementById('catFormBtn').textContent = 'Guardar cambios';
  document.getElementById('catFormCancel').style.display = 'inline-block';
  document.querySelector('.catalog-add-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicionCatalogo() {
  document.getElementById('catEditId').value = '';
  document.getElementById('catMarcaSel').value = '';
  document.getElementById('catTipo').value = '';
  document.getElementById('catCosto').value = '';
  document.getElementById('catEditModeloNota').style.display = 'none';
  document.getElementById('catFormBtn').textContent = 'Agregar al catálogo';
  document.getElementById('catFormCancel').style.display = 'none';
  renderCatModelosCheckboxes();
}

async function eliminarCatalogo(id) {
  const item = catalogo.find(i => i.id === id);
  if (!item) return;
  if (!confirm(`¿Eliminar "${item.marca} ${item.modelo} — ${TIPOS[item.tipo]?.label || item.tipo}" del catálogo?`)) return;
  try {
    await deleteDoc(doc(db, 'catalogo', id));
  } catch (e) {
    console.error(e);
    alert('No se pudo eliminar el ítem.');
  }
}

// ── IMPORTACIÓN MASIVA (pegar lista con Modelo + $Precio) ──
async function importarMasivo() {
  const marca = document.getElementById('bulkMarcaSel').value;
  const tipo = document.getElementById('bulkTipoSel').value;
  const raw = document.getElementById('bulkImportInput').value;
  const resultEl = document.getElementById('bulkImportResult');

  if (!marca || !tipo) {
    alert('Elegí la marca y el tipo de reparación para toda la lista antes de importar.');
    return;
  }

  const lineas = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lineas.length === 0) {
    alert('Pegá al menos un renglón con "Modelo   $Precio".');
    return;
  }

  const items = [];
  const errores = [];
  lineas.forEach((linea, i) => {
    // Acepta "Modelo <tab o espacios> $1.234.567" en cualquier separador antes del $
    const m = linea.match(/^(.+?)\s*\$\s*([\d.,]+)\s*$/);
    if (!m) { errores.push(`Renglón ${i + 1}: no se entendió "${linea}"`); return; }
    const costoBase = parseInt(m[2].replace(/[.,]/g, ''), 10);
    if (isNaN(costoBase) || costoBase <= 0) { errores.push(`Renglón ${i + 1}: precio inválido en "${linea}"`); return; }

    // El "/" separa varios modelos que comparten el mismo precio (ej: "12 / 12 Pro").
    const modelosDelRenglon = m[1].split('/').map(s => s.trim()).filter(Boolean);
    if (modelosDelRenglon.length === 0) { errores.push(`Renglón ${i + 1}: no se encontró ningún modelo en "${linea}"`); return; }
    modelosDelRenglon.forEach(modelo => items.push({ modelo, costoBase }));
  });

  if (items.length === 0) {
    resultEl.style.color = 'var(--danger)';
    resultEl.textContent = 'No se pudo leer ningún renglón. Revisá que cada línea termine en "$número".';
    return;
  }

  resultEl.style.color = 'var(--muted)';
  resultEl.textContent = `Importando ${items.length} ítems…`;

  try {
    const CHUNK = 200;

    // Si está tildado "reemplazar": borrar antes los precios existentes de esta marca+tipo.
    const reemplazar = document.getElementById('bulkReplaceCheckbox').checked;
    if (reemplazar) {
      const aBorrar = catalogo.filter(c => c.marca === marca && c.tipo === tipo);
      for (let i = 0; i < aBorrar.length; i += CHUNK) {
        const delBatch = writeBatch(db);
        aBorrar.slice(i, i + CHUNK).forEach(item => delBatch.delete(doc(db, 'catalogo', item.id)));
        await delBatch.commit();
      }
    }

    // Firestore permite hasta 500 operaciones por batch; acá van 2 por ítem (modelo + catálogo).
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = writeBatch(db);
      items.slice(i, i + CHUNK).forEach(({ modelo, costoBase }) => {
        const modId = slugSimple(marca + '-' + modelo);
        batch.set(doc(db, 'modelos', modId), { marca, modelo });
        const catId = slugCatalogo(marca, modelo, tipo);
        batch.set(doc(db, 'catalogo', catId), { marca, modelo, tipo, costoBase, activo: true });
      });
      await batch.commit();
    }

    resultEl.style.color = '#4ade80';
    resultEl.textContent = `✅ Se importaron ${items.length} ítems${reemplazar ? ' (reemplazando los anteriores de esta marca+tipo)' : ''}.` + (errores.length ? ` (${errores.length} renglones no se pudieron leer, ver consola)` : '');
    if (errores.length) console.warn('Renglones no importados:\n' + errores.join('\n'));
    document.getElementById('bulkImportInput').value = '';
  } catch (e) {
    console.error(e);
    resultEl.style.color = 'var(--danger)';
    resultEl.textContent = 'Error al importar. Revisá la consola (F12).';
  }
}

// ── VACIADO TOTAL DEL CATÁLOGO (todas las marcas y tipos) ──
async function vaciarCatalogoCompleto() {
  if (catalogo.length === 0) { alert('El catálogo ya está vacío.'); return; }

  const primeraConfirmacion = confirm(`Esto va a borrar los ${catalogo.length} precios cargados (de TODAS las marcas). Las marcas y modelos que ya registraste NO se borran, solo los precios. ¿Continuar?`);
  if (!primeraConfirmacion) return;

  const segundaConfirmacion = prompt('Para confirmar, escribí BORRAR (en mayúsculas) y aceptá:');
  if (segundaConfirmacion !== 'BORRAR') { alert('Cancelado, no se borró nada.'); return; }

  try {
    const CHUNK = 200;
    for (let i = 0; i < catalogo.length; i += CHUNK) {
      const batch = writeBatch(db);
      catalogo.slice(i, i + CHUNK).forEach(item => batch.delete(doc(db, 'catalogo', item.id)));
      await batch.commit();
    }
    alert('Catálogo de precios vaciado. Las marcas y modelos siguen intactos para volver a importar.');
  } catch (e) {
    console.error(e);
    alert('No se pudo vaciar el catálogo. Revisá la consola (F12).');
  }
}


// para no tener que tipear todo a mano la primera vez.
const SEED_DATA = [
  { marca: 'Samsung', modelo: 'A14', tipo: 'modulo', costoBase: 12000 },
  { marca: 'Samsung', modelo: 'A14', tipo: 'bateria', costoBase: 5000 },
  { marca: 'Samsung', modelo: 'A14', tipo: 'carga', costoBase: 4000 },
  { marca: 'Samsung', modelo: 'A54', tipo: 'modulo', costoBase: 22000 },
  { marca: 'Samsung', modelo: 'A54', tipo: 'bateria', costoBase: 7000 },
  { marca: 'Samsung', modelo: 'A54', tipo: 'carga', costoBase: 5500 },
  { marca: 'Samsung', modelo: 'S23', tipo: 'modulo', costoBase: 45000 },
  { marca: 'Samsung', modelo: 'S23', tipo: 'bateria', costoBase: 9000 },
  { marca: 'Motorola', modelo: 'G54', tipo: 'modulo', costoBase: 16000 },
  { marca: 'Motorola', modelo: 'G54', tipo: 'bateria', costoBase: 6000 },
  { marca: 'Motorola', modelo: 'G54', tipo: 'carga', costoBase: 5000 },
  { marca: 'Motorola', modelo: 'Edge 40', tipo: 'modulo', costoBase: 28000 },
  { marca: 'Motorola', modelo: 'Edge 40', tipo: 'bateria', costoBase: 8000 },
  { marca: 'Xiaomi', modelo: 'Redmi Note 12', tipo: 'modulo', costoBase: 14000 },
  { marca: 'Xiaomi', modelo: 'Redmi Note 12', tipo: 'bateria', costoBase: 5000 },
  { marca: 'Xiaomi', modelo: 'Redmi Note 12', tipo: 'carga', costoBase: 4500 },
  { marca: 'Xiaomi', modelo: 'Poco X5', tipo: 'modulo', costoBase: 17000 },
  { marca: 'Xiaomi', modelo: 'Poco X5', tipo: 'bateria', costoBase: 6000 },
];

async function cargarCatalogoBase() {
  if (!confirm(`Se van a cargar ${SEED_DATA.length} ítems de ejemplo al catálogo (y sus marcas/modelos). Los que ya existan se van a sobreescribir. ¿Continuar?`)) return;
  try {
    const batch = writeBatch(db);
    const marcasVistas = new Set();
    SEED_DATA.forEach(item => {
      const catId = slugCatalogo(item.marca, item.modelo, item.tipo);
      batch.set(doc(db, 'catalogo', catId), { ...item, activo: true });

      if (!marcasVistas.has(item.marca)) {
        marcasVistas.add(item.marca);
        batch.set(doc(db, 'marcas', slugSimple(item.marca)), { nombre: item.marca });
      }
      const modId = slugSimple(item.marca + '-' + item.modelo);
      batch.set(doc(db, 'modelos', modId), { marca: item.marca, modelo: item.modelo });
    });
    await batch.commit();
    alert('Catálogo base cargado, con sus marcas y modelos. Ahora podés editar cualquier precio.');
  } catch (e) {
    console.error(e);
    alert('No se pudo cargar el catálogo base.');
  }
}

// ── RELOJ ──
function actualizarReloj() {
  const el = document.getElementById('dashTime');
  if (el) el.textContent = new Date().toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}
setInterval(actualizarReloj, 1000 * 30);
actualizarReloj();

// ── EXPONER AL SCOPE GLOBAL (usado por onclick= en el HTML) ──
Object.assign(window, {
  doLogin, doLogout, cambiarTab, setSortCol, renderTabla,
  abrirDetalle, cerrarDetalle, abrirModal, cerrarModal, editarOrden,
  guardarOrden, eliminarOrden, cambiarEstado, exportarCSV,
  guardarCatalogoItem, editarCatalogo, cancelarEdicionCatalogo,
  eliminarCatalogo, renderCatalogo, cargarCatalogoBase,
  agregarMarca, eliminarMarca, agregarModelo, eliminarModelo,
  renderModelosManage, onCatMarcaChange, importarMasivo
});