// ══════════════════════════════════════════════
//  FORMULARIO DE CONTACTO → WhatsApp
// ══════════════════════════════════════════════

function enviarConsulta() {
  const nombre = document.getElementById('ctNombre').value.trim();
  const contacto = document.getElementById('ctContacto').value.trim();
  const equipo = document.getElementById('ctEquipo').value.trim();
  const problema = document.getElementById('ctProblema').value.trim();

  const camposNombre = document.getElementById('ctNombre').closest('.form-field');
  const camposContacto = document.getElementById('ctContacto').closest('.form-field');

  camposNombre.classList.toggle('has-error', !nombre);
  camposContacto.classList.toggle('has-error', !contacto);

  if (!nombre || !contacto) return;

  const msg = `Hola Nico! Soy ${nombre}. Tengo un ${equipo || 'equipo'} con el siguiente problema: ${problema || '(sin descripción)'}. Mi contacto: ${contacto}`;
  window.open(`https://wa.me/5493512836584?text=${encodeURIComponent(msg)}`, '_blank');
}

window.enviarConsulta = enviarConsulta;