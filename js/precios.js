// ══════════════════════════════════════════════
//  FÓRMULA DE PRECIOS — compartida entre calculadora.js y admin.js
// ══════════════════════════════════════════════
// Acá vive la lógica de margen. Si el día de mañana cambian los
// porcentajes, este es el único lugar que hay que tocar.

export const TIPOS = {
  modulo:  { label: 'Módulo / Pantalla', icon: '📱' },
  bateria: { label: 'Batería',           icon: '🔋' },
  carga:   { label: 'Puerto de carga',   icon: '🔌' },
};

/**
 * Calcula el precio final al cliente a partir del costo base del repuesto.
 *   Módulo         → costo × 3.5
 *   Batería        → costo × 3
 *   Placa de carga → si costo < $10.000: precio fijo $35.000
 *                    si costo ≥ $10.000: costo × 3
 */
export function calcularPrecio(tipo, costoBase) {
  const costo = Number(costoBase) || 0;
  switch (tipo) {
    case 'modulo':
      return Math.round(costo * 3.5);
    case 'bateria':
      return Math.round(costo * 3);
    case 'carga':
      return costo < 10000 ? 35000 : Math.round(costo * 3);
    default:
      return Math.round(costo);
  }
}

/** Texto corto para mostrar junto al precio, ej: "×3.5" o "fijo". */
export function margenLabel(tipo, costoBase) {
  const costo = Number(costoBase) || 0;
  if (tipo === 'modulo') return '×3.5';
  if (tipo === 'bateria') return '×3';
  if (tipo === 'carga') return costo < 10000 ? 'fijo' : '×3';
  return '';
}
