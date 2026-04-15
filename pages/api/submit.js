/**
 * /api/submit
 * Recibe el formulario (multipart), procesa el PDF del RUT y guarda en Google Sheets.
 */

import multiparty from 'multiparty';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { parseRutText } from '../../lib/parseRut';
import { appendRow } from '../../lib/googleSheets';

// Desactivar el bodyParser de Next.js para poder manejar multipart manualmente
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Parsea el formulario multipart y retorna { fields, files }.
 * @param {import('next').NextApiRequest} req
 * @returns {Promise<{ fields: Object, files: Object }>}
 */
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new multiparty.Form({ maxFilesSize: 10 * 1024 * 1024 }); // 10 MB
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

/**
 * Aplanamos los campos del formulario (multiparty los devuelve como arrays).
 * @param {Object} rawFields
 * @returns {Object}
 */
function flattenFields(rawFields) {
  return Object.fromEntries(
    Object.entries(rawFields).map(([key, val]) => [key, Array.isArray(val) ? val[0] : val])
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let tempFilePath = null;

  try {
    // 1. Parsear el formulario
    const { fields: rawFields, files } = await parseForm(req);
    const fields = flattenFields(rawFields);

    // 2. Validar campos requeridos
    const required = ['nombreResponsable', 'cargo', 'telefono', 'email', 'tipoNegocio', 'ciudad'];
    for (const field of required) {
      if (!fields[field]?.trim()) {
        return res.status(400).json({ error: `El campo '${field}' es requerido.` });
      }
    }

    // 3. Validar que se subió el RUT
    const rutFile = files?.rut?.[0];
    if (!rutFile) {
      return res.status(400).json({ error: 'No se recibió el archivo del RUT.' });
    }

    // Validar que sea PDF
    if (
      rutFile.headers?.['content-type'] !== 'application/pdf' &&
      !rutFile.originalFilename?.toLowerCase().endsWith('.pdf')
    ) {
      return res.status(400).json({ error: 'El archivo del RUT debe ser un PDF.' });
    }

    tempFilePath = rutFile.path;

    // 4. Extraer texto del PDF
    const pdfBuffer = fs.readFileSync(tempFilePath);
    let pdfText = '';
    try {
      const pdfData = await pdfParse(pdfBuffer);
      pdfText = pdfData.text || '';
    } catch (pdfErr) {
      console.warn('Advertencia al parsear PDF:', pdfErr.message);
      // Continuamos aunque el PDF falle — los campos del RUT quedarán vacíos
    }

    // 5. Parsear campos del RUT
    const rutData = parseRutText(pdfText);

    // 6. Guardar en Google Sheets
    await appendRow({
      contactData: {
        nombreResponsable: fields.nombreResponsable,
        cargo: fields.cargo,
        telefono: fields.telefono,
        email: fields.email,
        ciudad: fields.ciudad,
        tipoNegocio: fields.tipoNegocio,
        numEmpleados: fields.numEmpleados || '',
        mensaje: fields.mensaje || '',
      },
      rutData,
      rutFileName: rutFile.originalFilename || 'rut.pdf',
    });

    // 7. Responder con éxito e incluir los datos extraídos del RUT
    return res.status(200).json({
      success: true,
      message: 'Solicitud registrada correctamente.',
      rutData,
    });
  } catch (error) {
    console.error('Error en /api/submit:', error);

    // Distinguir errores de Google Sheets
    if (error.message?.includes('GOOGLE_SHEET_ID')) {
      return res.status(500).json({
        error:
          'Error de configuración del servidor. Por favor contacta al administrador.',
      });
    }

    return res.status(500).json({
      error: 'Error interno al procesar la solicitud. Intenta de nuevo.',
    });
  } finally {
    // Limpiar archivo temporal
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (_) {
        // silencioso — el archivo puede haber sido limpiado por el SO
      }
    }
  }
}
