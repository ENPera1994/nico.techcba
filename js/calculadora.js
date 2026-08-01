// ══════════════════════════════════════════════
//  CALCULADORA DE PRESUPUESTO (lado cliente)
// ══════════════════════════════════════════════
// Lee el catálogo de precios desde Firestore (colección "catalogo").
// El catálogo se administra únicamente desde admin.html.

import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { TIPOS, calcularPrecio } from './precios.js';

let itemsData = [];

async function cargarCatalogo() {
  const empty = document.getElementById('emptyState');
  const loading = document.getElementById('calcLoading');
  const stepsBox = document.getElementById('calcSteps');

  loading.style.display = 'block';
  empty.style.display = 'none';
  stepsBox.style.opacity = '0.4';
  stepsBox.style.pointerEvents = 'none';

  try {
    const snap = await getDocs(collection(db, 'catalogo'));
    itemsData = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (d.activo === false) return;
      itemsData.push(d);
    });
  } catch (e) {
    console.error('No se pudo cargar el catálogo de precios:', e);
    itemsData = [];
  }

  loading.style.display = 'none';
  stepsBox.style.opacity = '1';
  stepsBox.style.pointerEvents = 'auto';

  if (itemsData.length === 0) {
    empty.textContent = '⚠️ Todavía no hay precios cargados. Escribinos por WhatsApp y te cotizamos al toque.';
    empty.style.display = 'block';
    document.getElementById('sel-marca').disabled = true;
    return;
  }

  poblarMarcas();
}

function poblarMarcas() {
  const sel = document.getElementById('sel-marca');
  const marcas = [...new Set(itemsData.map(i => i.marca))].sort();
  sel.innerHTML = '<option value="">— Elegí tu marca —</option>';
  marcas.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
  sel.disabled = false;
  resetDependientes();
  resetResultado();
}

function resetDependientes() {
  const selM = document.getElementById('sel-modelo');
  const selR = document.getElementById('sel-rep');
  selM.innerHTML = '<option value="">— Primero elegí marca —</option>';
  selM.disabled = true;
  selR.innerHTML = '<option value="">— Primero elegí modelo —</option>';
  selR.disabled = true;
}

function filtrarModelos() {
  const marca = document.getElementById('sel-marca').value;
  const selM = document.getElementById('sel-modelo');
  const selR = document.getElementById('sel-rep');
  selR.innerHTML = '<option value="">— Primero elegí modelo —</option>';
  selR.disabled = true;
  resetResultado();

  if (!marca) { selM.innerHTML = '<option value="">— Primero elegí marca —</option>'; selM.disabled = true; return; }

  const modelos = [...new Set(itemsData.filter(i => i.marca === marca).map(i => i.modelo))].sort();
  selM.innerHTML = '<option value="">— Elegí el modelo —</option>';
  modelos.forEach(m => selM.innerHTML += `<option value="${m}">${m}</option>`);
  selM.disabled = false;
}

function filtrarReparaciones() {
  const marca = document.getElementById('sel-marca').value;
  const modelo = document.getElementById('sel-modelo').value;
  const selR = document.getElementById('sel-rep');
  resetResultado();

  if (!modelo) { selR.innerHTML = '<option value="">— Primero elegí modelo —</option>'; selR.disabled = true; return; }

  const reps = itemsData.filter(i => i.marca === marca && i.modelo === modelo);
  selR.innerHTML = '<option value="">— Elegí qué querés arreglar —</option>';
  reps.forEach(r => {
    const t = TIPOS[r.tipo];
    if (!t) return;
    selR.innerHTML += `<option value="${r.tipo}">${t.icon} ${t.label}</option>`;
  });
  selR.disabled = false;
}

function mostrarPrecio() {
  const marca = document.getElementById('sel-marca').value;
  const modelo = document.getElementById('sel-modelo').value;
  const tipo = document.getElementById('sel-rep').value;

  resetResultado();
  if (!tipo) return;

  const item = itemsData.find(i => i.marca === marca && i.modelo === modelo && i.tipo === tipo);
  const empty = document.getElementById('emptyState');
  const result = document.getElementById('resultadoCliente');
  const nodata = document.getElementById('sinDatos');

  empty.style.display = 'none';
  result.style.display = 'none';
  nodata.style.display = 'none';

  if (!item) { nodata.style.display = 'block'; return; }

  const t = TIPOS[tipo];
  const precioFinal = calcularPrecio(tipo, item.costoBase);

  document.getElementById('precioMostrado').textContent = `$ ${precioFinal.toLocaleString('es-AR')}`;
  document.getElementById('descripcionRep').textContent = `${t.icon} ${t.label} — ${marca} ${modelo}`;

  const msg = `Hola Nico! Quiero consultar por ${t.label.toLowerCase()} para ${marca} ${modelo}. Vi en la web que el precio estimado es $${precioFinal.toLocaleString('es-AR')}. ¿Podemos coordinar?`;
  document.getElementById('btnWsp').href = `https://wa.me/5493512836584?text=${encodeURIComponent(msg)}`;

  result.style.display = 'block';
}

function resetResultado() {
  const empty = document.getElementById('emptyState');
  empty.textContent = 'Elegí marca, modelo y reparación para ver el precio.';
  empty.style.display = 'block';
  document.getElementById('resultadoCliente').style.display = 'none';
  document.getElementById('sinDatos').style.display = 'none';
}

window.filtrarModelos = filtrarModelos;
window.filtrarReparaciones = filtrarReparaciones;
window.mostrarPrecio = mostrarPrecio;

window.addEventListener('DOMContentLoaded', cargarCatalogo);
