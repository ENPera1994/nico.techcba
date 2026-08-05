// ══════════════════════════════════════════════
//  CALCULADORA DE PRESUPUESTO (lado cliente)
// ══════════════════════════════════════════════
// Lee el catálogo de precios desde Firestore (colección "catalogo").
// El catálogo se administra únicamente desde admin.html.
//
// Orden de selección: Reparación → Marca → Modelo.
// Va primero la reparación porque el mismo modelo de celular puede
// no existir con el mismo nombre en todas las categorías (ej: una
// batería puede cubrir 6 modelos agrupados en un solo renglón, pero
// el módulo/pantalla es específico por modelo). Filtrando por
// reparación primero, marca y modelo siempre muestran únicamente
// combinaciones que sí tienen precio cargado.

import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { TIPOS, calcularPrecio } from './precios.js';

let itemsData = [];

async function cargarCatalogo() {
  const empty = document.getElementById('emptyState');
  const loading = document.getElementById('calcLoading');
  const stepsBox = document.getElementById('calcSteps');
  const selTipo = document.getElementById('sel-tipo');

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
    selTipo.disabled = true;
    return;
  }

  poblarTipos();
}

function poblarTipos() {
  const sel = document.getElementById('sel-tipo');
  const tiposDisponibles = [...new Set(itemsData.map(i => i.tipo))];
  sel.innerHTML = '<option value="">— Elegí qué arreglar —</option>' +
    tiposDisponibles
      .filter(t => TIPOS[t])
      .map(t => `<option value="${t}">${TIPOS[t].icon} ${TIPOS[t].label}</option>`)
      .join('');
  sel.disabled = false;
  resetDependientesDesdeTipo();
  resetResultado();
}

function resetDependientesDesdeTipo() {
  const selM = document.getElementById('sel-marca');
  const selMo = document.getElementById('sel-modelo');
  selM.innerHTML = '<option value="">— Primero elegí reparación —</option>';
  selM.disabled = true;
  selMo.innerHTML = '<option value="">— Primero elegí marca —</option>';
  selMo.disabled = true;
}

function filtrarMarcas() {
  const tipo = document.getElementById('sel-tipo').value;
  const selM = document.getElementById('sel-marca');
  const selMo = document.getElementById('sel-modelo');
  selMo.innerHTML = '<option value="">— Primero elegí marca —</option>';
  selMo.disabled = true;
  resetResultado();

  if (!tipo) { selM.innerHTML = '<option value="">— Primero elegí reparación —</option>'; selM.disabled = true; return; }

  const marcas = [...new Set(itemsData.filter(i => i.tipo === tipo).map(i => i.marca))].sort();
  selM.innerHTML = '<option value="">— Elegí tu marca —</option>' + marcas.map(m => `<option value="${m}">${m}</option>`).join('');
  selM.disabled = false;
}

function filtrarModelos() {
  const tipo = document.getElementById('sel-tipo').value;
  const marca = document.getElementById('sel-marca').value;
  const selMo = document.getElementById('sel-modelo');
  resetResultado();

  if (!marca) { selMo.innerHTML = '<option value="">— Primero elegí marca —</option>'; selMo.disabled = true; return; }

  const modelos = [...new Set(itemsData.filter(i => i.tipo === tipo && i.marca === marca).map(i => i.modelo))].sort();
  selMo.innerHTML = '<option value="">— Elegí el modelo —</option>' + modelos.map(m => `<option value="${m}">${m}</option>`).join('');
  selMo.disabled = false;
}

function mostrarPrecio() {
  const tipo = document.getElementById('sel-tipo').value;
  const marca = document.getElementById('sel-marca').value;
  const modelo = document.getElementById('sel-modelo').value;

  resetResultado();
  if (!modelo) return;

  const item = itemsData.find(i => i.tipo === tipo && i.marca === marca && i.modelo === modelo);
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
  empty.textContent = 'Elegí reparación, marca y modelo para ver el precio.';
  empty.style.display = 'block';
  document.getElementById('resultadoCliente').style.display = 'none';
  document.getElementById('sinDatos').style.display = 'none';
}

window.filtrarMarcas = filtrarMarcas;
window.filtrarModelos = filtrarModelos;
window.mostrarPrecio = mostrarPrecio;

window.addEventListener('DOMContentLoaded', cargarCatalogo);