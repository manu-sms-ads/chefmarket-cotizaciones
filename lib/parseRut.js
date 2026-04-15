/**
 * parseRut.js v3
 * Extrae los campos del RUT DIAN de Colombia.
 *
 * El PDF del RUT DIAN tiene esta estructura en la sección de datos:
 *
 *   [14xxxxxxxxxxx]   ← número de formulario (12 dígitos, empieza en 14)
 *   [NIT + DV]        ← 9-11 dígitos
 *   [Dirección seccional]
 *   [N establecimientos]
 *   [Tipo de contribuyente]
 *   [código]
 *   (líneas en blanco)
 *   [RAZÓN SOCIAL]    ← lo que queremos
 *   [NOMBRE COMERCIAL]← opcional
 *   COLOMBIA
 *   [169]             ← código país DIAN
 *   [Departamento]
 *   [código dept]
 *   [Municipio]
 *   [código municipio]
 *   [DIRECCIÓN PRINCIPAL] ← lo que queremos
 *   [email]
 *   [teléfonos]
 *   [CIIU + fechas de actividad]
 *   ...
 *
 * Los RUTs multi-página repiten "COLOMBIA\n169" en encabezados de hojas
 * posteriores → siempre se usa la PRIMERA ocurrencia de COLOMBIA como ancla.
 */

'use strict';

/**
 * Normaliza saltos de línea.
 */
function norm(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Extrae el NIT y el Dígito de Verificación.
 * Patrón: número de formulario (14XXXXXXXXX, 11-12 dígitos) + espacio + NIT+DV (10-11 dígitos)
 */
function extractNIT(text) {
  const m = text.match(/\b14\d{9,10}\b\s+(\d{9,11})\b/);
  if (m) {
    const combined = m[1].replace(/\s/g, '');
    if (combined.length >= 10) {
      return {
        nit: combined.slice(0, combined.length - 1),
        digitoVerificacion: combined.slice(-1),
      };
    }
  }

  const anyNit = text.match(/\n\s*(\d{9,10})\s*\n/);
  if (anyNit) return { nit: anyNit[1], digitoVerificacion: null };

  return { nit: null, digitoVerificacion: null };
}

/**
 * Extrae razón social, nombre comercial, departamento, municipio y dirección
 * usando la estructura secuencial del bloque de datos del RUT DIAN.
 *
 * Ancla: primera ocurrencia de COLOMBIA en la sección de datos (después del
 * número de formulario 14XXXXXXXXX).
 */
function extractFromDataBlock(text) {
  const result = {
    razonSocial: null,
    nombreComercial: null,
    departamento: null,
    municipio: null,
    direccion: null,
  };

  // Ancla: número de formulario DIAN (empieza en 14, 11-12 dígitos)
  const formularioPos = text.search(/\b14\d{9,10}\b/);
  if (formularioPos === -1) return result;

  // Primera ocurrencia de COLOMBIA en la sección de datos
  const firstColPos = text.indexOf('COLOMBIA', formularioPos);
  if (firstColPos === -1) return result;

  // ─── RAZÓN SOCIAL / NOMBRE COMERCIAL ────────────────────────────────────
  // Los nombres aparecen en las líneas inmediatamente ANTES de la primera
  // COLOMBIA (luego del tipo de contribuyente y código).
  const beforeColombia = text.substring(formularioPos, firstColPos);
  const dataLines = beforeColombia
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const nameLines = [];
  for (let i = dataLines.length - 1; i >= 0; i--) {
    const l = dataLines[i];
    // Condiciones de parada: número puro, string corto, palabras clave conocidas
    if (/^\d+(\.\d+)?$/.test(l)) break; // "1", "11", "0.0"
    if (l.length <= 1) break;
    if (/^(Persona\s|Gran\s|Entidad\s|Impuestos\s|CLASIFICACI|IDENTIFICACI|UBICACI|COLOMBIA)/i.test(l)) break;
    nameLines.unshift(l);
  }

  if (nameLines.length >= 1) result.razonSocial = nameLines[0];
  if (nameLines.length >= 2) result.nombreComercial = nameLines[1];

  // ─── DEPARTAMENTO / MUNICIPIO / DIRECCIÓN ───────────────────────────────
  // Estructura después de COLOMBIA:
  //   \n[código 2-3d]\n[Departamento]\n[código 2d]\n[Municipio]\n[código 1-3d]\n[Dirección]
  const afterColombia = text.substring(firstColPos + 'COLOMBIA'.length);

  const structM = afterColombia.match(
    /\n\d{1,3}\n([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s\.]{1,45})\n\d{1,3}\n([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s\.]{1,45})\n\d{1,3}\n([A-Za-záéíóúñÁÉÍÓÚÑ][^\n]+)/
  );

  if (structM) {
    result.departamento = structM[1].trim();
    result.municipio    = structM[2].trim();
    result.direccion    = structM[3].trim().replace(/\s{2,}/g, ' ').substring(0, 100);
  }

  return result;
}

/**
 * Extrae los códigos CIIU.
 * El bloque de actividades en el RUT aparece como pares de CIIU(4d) + fecha(8d):
 *   CCCCAAAAMMDD CCCCAAAAMMDD ...
 */
function extractActividades(text) {
  // Dos actividades (24 dígitos: CIIU+fecha+CIIU+fecha)
  const bloque = text.match(/\b(\d{4})((?:19|20)\d{6})(\d{4})((?:19|20)\d{6})/);
  if (bloque) {
    const [, ciiu1, , ciiu2] = bloque;
    const partes = [`CIIU ${ciiu1}`];
    if (ciiu2 && ciiu2 !== ciiu1) partes.push(`CIIU ${ciiu2}`);
    return partes.join(' | ');
  }

  // Una sola actividad
  const single = text.match(/\b(\d{4})((?:19|20)\d{6})\b/);
  if (single) return `CIIU ${single[1]}`;

  // Fallback: CIIU explícito en el texto
  const ciiuTag = text.match(/CIIU\s*[:\-]?\s*(\d{4})/i);
  if (ciiuTag) return `CIIU ${ciiuTag[1]}`;

  return null;
}

/**
 * Extrae fechas de inscripción y actualización del bloque de actividades.
 */
function extractFechas(text) {
  const fmt = (s) => `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;

  // Dos actividades: CIIU(4)+fecha(8)+CIIU(4)+fecha(8)
  const bloque = text.match(/\b\d{4}((?:19|20)\d{6})\d{4}((?:19|20)\d{6})/);
  if (bloque) {
    return {
      fechaInscripcion:    fmt(bloque[1]),
      fechaActualizacion:  fmt(bloque[2]),
    };
  }

  // Una sola actividad: CIIU(4)+fecha(8)
  const single12 = text.match(/\b\d{4}((?:19|20)\d{6})\b/);
  if (single12) {
    return {
      fechaInscripcion:   fmt(single12[1]),
      fechaActualizacion: null,
    };
  }

  // Fallback: fechas en formato legible (DD/MM/YYYY o YYYY-MM-DD)
  const fechas = [
    ...text.matchAll(/\b(\d{2}[-\/]\d{2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})\b/g),
  ];
  return {
    fechaInscripcion:   fechas[0]?.[1] ?? null,
    fechaActualizacion: fechas[1]?.[1] ?? null,
  };
}

/**
 * Extrae las responsabilidades tributarias.
 * Patrón DIAN: "XX - Descripción" donde XX es el código numérico.
 */
function extractResponsabilidades(text) {
  const set = new Set();
  const re = /\b(\d{2})\s*[-–]\s*([A-Za-záéíóúñÁÉÍÓÚÑ][^\n]{4,100})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const code = parseInt(m[1], 10);
    const desc = m[2].trim().replace(/\s{2,}/g, ' ');
    if (code >= 1 && code <= 99 && desc.length > 4) {
      set.add(`${m[1]} - ${desc}`);
    }
  }
  return set.size ? [...set].slice(0, 6).join(' | ') : null;
}

/**
 * Función principal: parsea el texto completo del RUT DIAN.
 * @param {string} rawText - Texto extraído del PDF con pdf-parse
 * @returns {Object} Campos del RUT
 */
export function parseRutText(rawText) {
  const empty = {
    nit: null, digitoVerificacion: null, razonSocial: null,
    nombreComercial: null, tipoContribuyente: null, tipoDocumento: null,
    direccion: null, municipio: null, departamento: null, codigoPostal: null,
    telefonoEmpresa: null, correoEmpresa: null, actividadEconomica: null,
    responsabilidades: null, fechaInscripcion: null, fechaActualizacion: null,
  };

  if (!rawText || rawText.trim().length < 50) return empty;

  const text = norm(rawText);

  /* ── 1. NIT + DV ────────────────────────────────────────────────── */
  const { nit, digitoVerificacion } = extractNIT(text);

  /* ── 2–6. Razón social, nombre comercial, dirección, dept, ciudad ─ */
  const {
    razonSocial,
    nombreComercial,
    departamento,
    municipio,
    direccion,
  } = extractFromDataBlock(text);

  /* ── 7. Tipo de contribuyente ────────────────────────────────────── */
  const tipoContribMatch = text.match(
    /(Persona\s+(?:natural\s+o\s+sucesi[oó]n\s+il[ií]quida|natural|jur[ií]dica\s+y\s+asimilada|jur[ií]dica)|Gran\s+contribuyente|Entidad\s+del\s+Estado|Persona\s+jur[ií]dica)/i
  );
  const tipoContribuyente = tipoContribMatch ? tipoContribMatch[0].trim() : null;

  /* ── 8. Tipo de documento ────────────────────────────────────────── */
  const tipoDocMatch = text.match(
    /\b(C[eé]dula\s+de\s+Ciudadan[ií]a|Tarjeta\s+de\s+Identidad|C[eé]dula\s+de\s+Extranjer[ií]a|Pasaporte|Registro\s+Civil|Tarjeta\s+de\s+Extranjer[ií]a|N[uú]mero\s+[Úú]nico\s+de\s+Identificaci[oó]n)\b/i
  );
  const tipoDocumento = tipoDocMatch ? tipoDocMatch[0].trim() : null;

  /* ── 9. Correo electrónico ───────────────────────────────────────── */
  const emailMatch = text.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
  const correoEmpresa = emailMatch ? emailMatch[0].toLowerCase() : null;

  /* ── 10. Teléfono ───────────────────────────────────────────────── */
  // Celular colombiano: 10 dígitos empezando en 3
  // Fijo colombiano: 10 dígitos empezando en 60x
  const telMatch = text.match(/\b(3\d{9}|60\d{8}|\d{7})\b/);
  const telefonoEmpresa = telMatch ? telMatch[0].trim() : null;

  /* ── 11. Actividad económica (CIIU) ─────────────────────────────── */
  const actividadEconomica = extractActividades(text);

  /* ── 12. Responsabilidades tributarias ──────────────────────────── */
  const responsabilidades = extractResponsabilidades(text);

  /* ── 13. Fechas ─────────────────────────────────────────────────── */
  const { fechaInscripcion, fechaActualizacion } = extractFechas(text);

  /* ── 14. Código postal (6 dígitos, Colombia) ────────────────────── */
  let codigoPostal = null;
  const cpRe = /\b(\d{6})\b/g;
  let cpM;
  while ((cpM = cpRe.exec(text)) !== null) {
    if (cpM[1] !== nit && !nit?.startsWith(cpM[1])) {
      codigoPostal = cpM[1];
      break;
    }
  }

  return {
    nit,
    digitoVerificacion,
    razonSocial,
    nombreComercial,
    tipoContribuyente,
    tipoDocumento,
    direccion,
    municipio,
    departamento,
    codigoPostal,
    telefonoEmpresa,
    correoEmpresa,
    actividadEconomica,
    responsabilidades,
    fechaInscripcion,
    fechaActualizacion,
  };
}
