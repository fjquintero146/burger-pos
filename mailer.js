// mailer.js
// Envía correos usando SMTP (Gmail, Outlook, o cualquier proveedor) configurado
// por variables de entorno. Si no están configuradas, simplemente no envía nada
// (y lo avisa en los logs) sin romper el resto de la app.

const nodemailer = require('nodemailer');

function smtpConfigurado() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function obtenerTransporter() {
  if (!smtpConfigurado()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

// Envía un correo con un PDF adjunto. Devuelve { enviado: true } o
// { enviado: false, motivo: '...' } — nunca lanza una excepción hacia afuera,
// para que un problema de correo no interrumpa el cierre de turno.
async function enviarCorreoConPdf({ to, subject, text, pdfBuffer, pdfNombre }) {
  if (!to) {
    return { enviado: false, motivo: 'No hay un correo configurado para recibir el cierre (Configuración → Correo de cierre de caja)' };
  }
  const t = obtenerTransporter();
  if (!t) {
    return { enviado: false, motivo: 'El servidor no tiene configurado el envío de correos (variables SMTP_*)' };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      attachments: [{ filename: pdfNombre, content: pdfBuffer, contentType: 'application/pdf' }]
    });
    return { enviado: true };
  } catch (err) {
    console.error('Error enviando correo de cierre:', err.message);
    return { enviado: false, motivo: 'Error al enviar el correo: ' + err.message };
  }
}

module.exports = { enviarCorreoConPdf, smtpConfigurado };
