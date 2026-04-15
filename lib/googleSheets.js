/**
 * googleSheets.js
 * Maneja la conexión con Google Sheets API usando una cuenta de servicio.
 */

import { google } from 'googleapis';

/**
 * Retorna un cliente autenticado de Google Sheets.
 * Las credenciales se leen desde variables de entorno (seguro para Vercel).
 */
function getAuthClient() {
  const credentials = {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  };

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

/**
 * Encabezados de la hoja de cálculo.
 * Están ordenados para que el equipo de Chef Market pueda filtrar fácilmente.
 */
export const HEADERS = [
  // ── Marca de tiempo ──────────────────────────────────────────────────
  'Fecha y Hora (Colombia)',
  'Fecha',
  'Hora',
  'Día de la Semana',
  'Semana del Año',
  // ── Datos de contacto ─────────────────────────────────────────────────
  'Nombre Responsable',
  'Cargo',
  'Teléfono / WhatsApp',
  'Correo Electrónico',
  'Ciudad',
  'Tipo de Negocio',
  'N° Empleados',
  'Mensaje / Intereses',
  // ── Datos del RUT ─────────────────────────────────────────────────────
  'NIT',
  'Dígito de Verificación',
  'NIT Completo',
  'Razón Social',
  'Nombre Comercial',
  'Tipo de Contribuyente',
  'Tipo de Documento',
  'Dirección Principal',
  'Municipio (RUT)',
  'Departamento (RUT)',
  'Código Postal',
  'Teléfono Empresa (RUT)',
  'Correo Empresa (RUT)',
  'Actividad Económica (CIIU)',
  'Responsabilidades Tributarias',
  'Fecha Inscripción RUT',
  'Fecha Última Actualización RUT',
  // ── Metadatos ─────────────────────────────────────────────────────────
  'Nombre Archivo RUT',
  'Campos RUT Extraídos',
  'Estado',
];

/**
 * Agrega los encabezados si la hoja está vacía.
 * @param {import('googleapis').sheets_v4.Sheets} sheets
 * @param {string} spreadsheetId
 * @param {string} sheetName
 */
async function ensureHeaders(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:A1`,
  });

  const firstCell = res.data.values?.[0]?.[0];
  if (!firstCell) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });

    // Formatear encabezados: negrita + fondo oscuro + texto blanco
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = sheetMeta.data.sheets?.find(
      (s) => s.properties?.title === sheetName
    );
    const sheetId = sheet?.properties?.sheetId ?? 0;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.18, green: 0.18, blue: 0.18 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });
  }
}

/**
 * Devuelve el nombre del día en español.
 * @param {Date} date
 * @returns {string}
 */
function getDayName(date) {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[date.getDay()];
}

/**
 * Devuelve el número de semana del año (ISO).
 * @param {Date} date
 * @returns {number}
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Agrega una fila de datos a Google Sheets.
 * @param {Object} params
 * @param {Object} params.contactData  - Datos del formulario (paso 1)
 * @param {Object} params.rutData      - Campos extraídos del RUT
 * @param {string} params.rutFileName  - Nombre del archivo PDF del RUT
 * @returns {Promise<void>}
 */
export async function appendRow({ contactData, rutData, rutFileName }) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Cotizaciones';

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID no está configurado en las variables de entorno.');
  }

  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  await ensureHeaders(sheets, spreadsheetId, sheetName);

  // ── Marca de tiempo en zona horaria de Colombia (UTC-5) ──────────────
  const now = new Date();
  const colombiaOffset = -5 * 60; // minutos
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const colombiaDate = new Date(utcMs + colombiaOffset * 60000);

  const pad = (n) => String(n).padStart(2, '0');
  const fechaHora = `${colombiaDate.getFullYear()}-${pad(colombiaDate.getMonth() + 1)}-${pad(colombiaDate.getDate())} ${pad(colombiaDate.getHours())}:${pad(colombiaDate.getMinutes())}:${pad(colombiaDate.getSeconds())}`;
  const fecha = `${pad(colombiaDate.getDate())}/${pad(colombiaDate.getMonth() + 1)}/${colombiaDate.getFullYear()}`;
  const hora = `${pad(colombiaDate.getHours())}:${pad(colombiaDate.getMinutes())}:${pad(colombiaDate.getSeconds())}`;
  const diaSemana = getDayName(colombiaDate);
  const semana = `Semana ${getWeekNumber(colombiaDate)}`;

  // ── Calcular cuántos campos del RUT se extrajeron ────────────────────
  const rutFields = Object.values(rutData || {}).filter(Boolean);
  const camposExtraidos = `${rutFields.length} / ${Object.keys(rutData || {}).length}`;

  // ── Armar el NIT completo ─────────────────────────────────────────────
  const nitCompleto =
    rutData?.nit && rutData?.digitoVerificacion
      ? `${rutData.nit}-${rutData.digitoVerificacion}`
      : rutData?.nit || '';

  // ── Construir la fila en el mismo orden que HEADERS ──────────────────
  const row = [
    // Marca de tiempo
    fechaHora,
    fecha,
    hora,
    diaSemana,
    semana,
    // Datos de contacto
    contactData.nombreResponsable || '',
    contactData.cargo || '',
    contactData.telefono || '',
    contactData.email || '',
    contactData.ciudad || '',
    contactData.tipoNegocio || '',
    contactData.numEmpleados || '',
    contactData.mensaje || '',
    // Datos del RUT
    rutData?.nit || '',
    rutData?.digitoVerificacion || '',
    nitCompleto,
    rutData?.razonSocial || '',
    rutData?.nombreComercial || '',
    rutData?.tipoContribuyente || '',
    rutData?.tipoDocumento || '',
    rutData?.direccion || '',
    rutData?.municipio || '',
    rutData?.departamento || '',
    rutData?.codigoPostal || '',
    rutData?.telefonoEmpresa || '',
    rutData?.correoEmpresa || '',
    rutData?.actividadEconomica || '',
    rutData?.responsabilidades || '',
    rutData?.fechaInscripcion || '',
    rutData?.fechaActualizacion || '',
    // Metadatos
    rutFileName || '',
    camposExtraidos,
    'Pendiente revisión',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}
