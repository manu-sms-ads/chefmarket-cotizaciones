/**
 * parseRut.js — v4 (definitivo)
 * Extrae todos los campos del RUT DIAN de Colombia.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ESTRUCTURA DEL PDF DIAN — PÁGINA 1 (campo de datos)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  [14XXXXXXXXXXX]            ← número de formulario (11-12 dígitos, empieza en 14)
 *  [NIT + DV concatenados]    ← 10-11 dígitos
 *  [Dirección seccional]      ← ej. "Impuestos de Medellín"
 *  [N° establecimientos]
 *  [Tipo de contribuyente]    ← "Persona jurídica" o "Persona natural"
 *  [código 1]
 *
 *  ── PERSONA JURÍDICA (empresa) ──────────────────────────────────────────
 *  [RAZÓN SOCIAL]             ← inmediatamente antes de COLOMBIA
 *  [NOMBRE COMERCIAL]         ← opcional
 *  COLOMBIA                   ← 1 único COLOMBIA en pág 1 → ubicación del negocio
 *  [169]                      ← código país DIAN
 *  [Departamento]
 *  [código dept 2d]
 *  [Municipio]
 *  [código municipal 3d]
 *  [DIRECCIÓN PRINCIPAL]
 *  [correo@dominio.com]
 *  [teléfonos]
 *  [CIIU + fechas actividad]
 *  ...
 *  Hoja 2                     ← FIN DE PÁGINA 1 (marcador confiable)
 *
 *  ── PERSONA NATURAL (individuo) ─────────────────────────────────────────
 *  COLOMBIA                   ← 1.° COLOMBIA → lugar expedición cédula
 *  [169]
 *  [Dept expedición]  [código]  [Ciudad expedición]  [código]
 *  [PRIMER APELLIDO]
 *  [SEGUNDO APELLIDO]
 *  [PRIMER NOMBRE]
 *  [OTROS NOMBRES]
 *  COLOMBIA                   ← 2.° COLOMBIA → ubicación del negocio
 *  [169]
 *  [Departamento negocio]  [código]  [Ciudad negocio]  [código]
 *  [DIRECCIÓN PRINCIPAL]
 *  [correo]  [teléfonos]
 *  ...
 *  Hoja 2
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Normaliza saltos de línea y elimina retornos de carro. */
function norm(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Extrae el NIT y el Dígito de Verificación.
 *
 * El formulario DIAN tiene número de formulario (14XXXXXXXXXX, 11-12 dígitos)
 * seguido del NIT+DV (10-11 dígitos) en la misma línea o la siguiente.
 *
 * @param {string} text
 * @returns {{ nit: string|null, digitoVerificacion: string|null }}
 */
function extractNIT(text) {
  // Patrón principal: formulario (14 + 9-10 dígitos) + espacio + NIT+DV
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

  // Fallback: número de 9-10 dígitos aislado en una línea
  const anyNit = text.match(/\n\s*(\d{9,10})\s*\n/);
  if (anyNit) return { nit: anyNit[1], digitoVerificacion: null };

  return { nit: null, digitoVerificacion: null };
}

/**
 * Extrae razón social / nombre comercial / dirección / departamento / municipio
 * usando la estructura secuencial conocida del formulario DIAN.
 *
 * Estrategia:
 *   1. Delimitar la página 1 con el marcador "Hoja 2" (siempre presente).
 *   2. Encontrar todos los bloques COLOMBIA\n169 dentro de la página 1.
 *   3a. Persona jurídica (1 COLOMBIA): nombres ANTES, ubicación DESPUÉS.
 *   3b. Persona natural (2+ COLOMBIA): nombres ENTRE el 1.° y el último,
 *       saltando los códigos de lugar de expedición; ubicación DESPUÉS del último.
 *
 * @param {string} text  Texto normalizado completo del PDF
 * @param {number} formularioPos  Posición del número de formulario en el texto
 * @returns {{ razonSocial, nombreComercial, departamento, municipio, direccion }}
 */
function extractFromDataBlock(text, formularioPos) {
  const EMPTY = {
    razonSocial: null, nombreComercial: null,
    departamento: null, municipio: null, direccion: null,
  };

  if (formularioPos === -1) return EMPTY;

  // ── 1. Delimitar página 1: todo antes de "Hoja 2" ────────────────────────
  //    "Hoja 2" aparece sin excepción en los RUTs DIAN con más de 1 página.
  //    Para RUTs de 1 página, usamos el final del texto.
  const hoja2Idx = text.indexOf('Hoja 2', formularioPos);
  const page1End = hoja2Idx !== -1 ? hoja2Idx : text.length;
  const page1 = text.substring(formularioPos, page1End);

  // ── 2. Localizar bloques COLOMBIA\n169 dentro de la página 1 ─────────────
  const colRe = /COLOMBIA\n169/g;
  const colMatches = [];
  let cm;
  while ((cm = colRe.exec(page1)) !== null) {
    colMatches.push(cm.index); // posición relativa a page1
  }

  if (colMatches.length === 0) return EMPTY;

  const lastColRelPos = colMatches[colMatches.length - 1];
  const lastColAbsPos = formularioPos + lastColRelPos;

  // ── 3. Extraer nombres ───────────────────────────────────────────────────
  let razonSocial = null;
  let nombreComercial = null;

  const isNatural = /Persona\s+natural/i.test(page1);

  if (isNatural && colMatches.length >= 2) {
    // ── Persona natural ──────────────────────────────────────────────────
    // Los nombres van ENTRE el 1.° COLOMBIA (lugar expedición cédula)
    // y el último COLOMBIA (ubicación negocio), después de los 4 códigos
    // de lugar de expedición: código-país → dept → código-dept → ciudad → código-ciudad
    //
    // Patrón a saltar: \n[cod]\n[DEPT]\n[cod]\n[CIUDAD]\n[cod]\n → luego los nombres
    const firstColEnd = formularioPos + colMatches[0] + 'COLOMBIA\n169'.length;
    const between = text.substring(firstColEnd, lastColAbsPos);

    const namePart = between.match(
      /\n\d{1,4}\n[A-ZÁÉÍÓÚÑ][^\n]+\n\d{1,4}\n[A-ZÁÉÍÓÚÑ][^\n]+\n\d{1,4}\n([\s\S]+)/
    );
    if (namePart) {
      const nameLines = namePart[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 1 && !/^\d+(\.\d+)?$/.test(l));
      // Para persona natural, concatenamos todos los fragmentos de nombre
      if (nameLines.length > 0) razonSocial = nameLines.join(' ').trim().substring(0, 120);
    }
  } else {
    // ── Persona jurídica (o natural con un solo COLOMBIA en pág 1) ────────
    // Los nombres van INMEDIATAMENTE ANTES del último COLOMBIA.
    // Se leen hacia atrás hasta encontrar una línea "de parada":
    //   - número puro ("1", "11", "0.0")
    //   - string corto (≤ 1 char)
    //   - palabras clave de sección ("Persona ", "Impuestos ", etc.)
    const beforeLastCol = page1.substring(0, lastColRelPos);
    const dataLines = beforeLastCol
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const nameLines = [];
    for (let i = dataLines.length - 1; i >= 0; i--) {
      const l = dataLines[i];
      if (/^\d+(\.\d+)?$/.test(l)) break;          // número puro: stop
      if (l.length <= 1) break;                      // línea vacía/corta: stop
      if (/^(Persona\s|Gran\s+contrib|Entidad\s+del\s+Estado|Impuestos\s)/i.test(l)) break;
      nameLines.unshift(l);
    }

    if (nameLines.length >= 1) razonSocial    = nameLines[0];
    if (nameLines.length >= 2) nombreComercial = nameLines[1];
  }

  // ── 4. Extraer ubicación (dept, municipio, dirección) ────────────────────
  // Estructura invariable después de COLOMBIA:
  //   \n[código-país]\n[DEPARTAMENTO]\n[código-dept]\n[MUNICIPIO]\n[código-mun]\n[DIRECCIÓN]
  //
  // Usamos el ÚLTIMO COLOMBIA de la página 1 (siempre = UBICACIÓN del negocio).
  let departamento = null;
  let municipio    = null;
  let direccion    = null;

  const afterLastCol = text.substring(lastColAbsPos + 'COLOMBIA'.length);

  // El primer grupo captura DEPARTAMENTO, el segundo MUNICIPIO, el tercero DIRECCIÓN.
  // Permite códigos de 1-4 dígitos y nombres con tildes, espacios y puntos.
  const structM = afterLastCol.match(
    /\n\d{1,4}\n([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s\.]{1,50})\n\d{1,4}\n([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s\.]{1,50})\n\d{1,4}\n([A-Za-záéíóúñÁÉÍÓÚÑ][^\n]{1,120})/
  );

  if (structM) {
    departamento = structM[1].trim();
    municipio    = structM[2].trim();
    direccion    = structM[3].trim().replace(/\s{2,}/g, ' ');
  }

  return { razonSocial, nombreComercial, departamento, municipio, direccion };
}

/**
 * Extrae los códigos CIIU de la actividad económica.
 * El RUT codifica actividades como pares CIIU(4 dígitos) + fecha(8 dígitos YYYYMMDD).
 *
 * @param {string} text
 * @returns {string|null}
 */
function extractActividades(text) {
  // Dos actividades concatenadas: CCCCYYYYMMDDCCCCYYYYMMDD (24 dígitos)
  const doble = text.match(/\b(\d{4})((?:19|20)\d{6})(\d{4})((?:19|20)\d{6})/);
  if (doble) {
    const [, ciiu1, , ciiu2] = doble;
    const partes = [`CIIU ${ciiu1}`];
    if (ciiu2 && ciiu2 !== ciiu1) partes.push(`CIIU ${ciiu2}`);
    return partes.join(' | ');
  }

  // Una sola actividad: CCCCYYYYMMDD (12 dígitos)
  const simple = text.match(/\b(\d{4})((?:19|20)\d{6})\b/);
  if (simple) return `CIIU ${simple[1]}`;

  // Fallback: etiqueta CIIU explícita en el texto
  const tag = text.match(/CIIU\s*[:\-]?\s*(\d{4})/i);
  if (tag) return `CIIU ${tag[1]}`;

  return null;
}

/**
 * Extrae las fechas de inscripción y última actualización del RUT.
 * Ambas se codifican junto con los códigos CIIU en el bloque de actividades.
 *
 * @param {string} text
 * @returns {{ fechaInscripcion: string|null, fechaActualizacion: string|null }}
 */
function extractFechas(text) {
  const fmt = (s) => `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;

  // Dos actividades: CIIU1(4)+fecha1(8)+CIIU2(4)+fecha2(8)
  const doble = text.match(/\b\d{4}((?:19|20)\d{6})\d{4}((?:19|20)\d{6})/);
  if (doble) {
    return { fechaInscripcion: fmt(doble[1]), fechaActualizacion: fmt(doble[2]) };
  }

  // Una sola actividad: CIIU(4)+fecha(8)
  const simple = text.match(/\b\d{4}((?:19|20)\d{6})\b/);
  if (simple) {
    return { fechaInscripcion: fmt(simple[1]), fechaActualizacion: null };
  }

  // Fallback: fechas en formatos legibles DD/MM/YYYY o YYYY-MM-DD
  const fechas = [
    ...text.matchAll(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/g),
  ];
  return {
    fechaInscripcion:   fechas[0]?.[1] ?? null,
    fechaActualizacion: fechas[1]?.[1] ?? null,
  };
}

/**
 * Extrae las responsabilidades tributarias.
 * El DIAN las lista como "NN - Descripción" donde NN es el código numérico.
 *
 * @param {string} text
 * @returns {string|null}
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
  return set.size ? [...set].slice(0, 8).join(' | ') : null;
}

// ── Función principal ──────────────────────────────────────────────────────

/**
 * Parsea el texto completo extraído de un PDF de RUT DIAN y devuelve
 * un objeto con todos los campos relevantes.
 *
 * @param {string} rawText  Texto extraído con pdf-parse
 * @returns {Object}
 */
export function parseRutText(rawText) {
  const EMPTY = {
    nit: null, digitoVerificacion: null,
    razonSocial: null, nombreComercial: null,
    tipoContribuyente: null, tipoDocumento: null,
    direccion: null, municipio: null, departamento: null, codigoPostal: null,
    telefonoEmpresa: null, correoEmpresa: null,
    actividadEconomica: null, responsabilidades: null,
    fechaInscripcion: null, fechaActualizacion: null,
  };

  if (!rawText || rawText.trim().length < 50) return EMPTY;

  const text = norm(rawText);

  // ── 1. NIT + DV ───────────────────────────────────────────────────────────
  const { nit, digitoVerificacion } = extractNIT(text);

  // ── 2–6. Bloque estructural: nombres + ubicación ──────────────────────────
  // Necesitamos la posición del formulario para delimitar el bloque de datos.
  const formularioPos = text.search(/\b14\d{9,10}\b/);

  const { razonSocial, nombreComercial, departamento, municipio, direccion } =
    extractFromDataBlock(text, formularioPos);

  // ── 7. Tipo de contribuyente ──────────────────────────────────────────────
  const tipoContribMatch = text.match(
    /(Persona\s+(?:natural\s+o\s+sucesi[oó]n\s+il[ií]quida|natural|jur[ií]dica\s+y\s+asimilada|jur[ií]dica)|Gran\s+contribuyente|Entidad\s+del\s+Estado)/i
  );
  const tipoContribuyente = tipoContribMatch ? tipoContribMatch[0].trim() : null;

  // ── 8. Tipo de documento ──────────────────────────────────────────────────
  // Solo el tipo del titular principal (campo 25), no de representantes.
  // Se busca en la primera aparición en el texto de la página de datos.
  const tipoDocMatch = text.match(
    /\b(C[eé]dula\s+de\s+Ciudadan[ií]a|C[eé]dula\s+de\s+Extranjer[ií]a|Tarjeta\s+de\s+Identidad|Pasaporte|Registro\s+Civil|NIT)\b/i
  );
  const tipoDocumento = tipoDocMatch ? tipoDocMatch[0].trim() : null;

  // ── 9. Correo electrónico ─────────────────────────────────────────────────
  const emailMatch = text.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
  const correoEmpresa = emailMatch ? emailMatch[0].toLowerCase() : null;

  // ── 10. Teléfono principal ────────────────────────────────────────────────
  // Celular colombiano: 10 dígitos empezando en 3xx
  // Fijo colombiano: indicativo 60x + 7 dígitos = 10 dígitos
  const telMatch = text.match(/\b(3\d{9}|60\d{8})\b/);
  const telefonoEmpresa = telMatch ? telMatch[0] : null;

  // ── 11. Actividad económica (CIIU) ────────────────────────────────────────
  const actividadEconomica = extractActividades(text);

  // ── 12. Responsabilidades tributarias ─────────────────────────────────────
  const responsabilidades = extractResponsabilidades(text);

  // ── 13. Fechas de inscripción y actualización ─────────────────────────────
  const { fechaInscripcion, fechaActualizacion } = extractFechas(text);

  // ── 14. Código postal (6 dígitos, Colombia) ───────────────────────────────
  // El NIT tiene 9-10 dígitos → no confundir. Un código postal es exactamente 6 dígitos.
  let codigoPostal = null;
  const cpRe = /\b(\d{6})\b/g;
  let cpM;
  while ((cpM = cpRe.exec(text)) !== null) {
    const cp = cpM[1];
    if (nit && (cp === nit || nit.startsWith(cp))) continue; // excluir fragmentos del NIT
    codigoPostal = cp;
    break;
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
