/**
 * parseRut.js
 * Extrae los campos clave del texto bruto de un RUT de la DIAN (Colombia).
 * El RUT de la DIAN tiene campos con etiquetas fijas — usamos expresiones
 * regulares basadas en esas etiquetas para localizar cada valor.
 */

/**
 * Limpia y normaliza el texto extraído del PDF.
 * @param {string} raw - Texto crudo del PDF
 * @returns {string}
 */
function normalize(raw) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')   // colapsa espacios múltiples
    .trim();
}

/**
 * Busca un valor luego de una etiqueta, con cierta tolerancia de formato.
 * @param {string} text - Texto normalizado
 * @param {string[]} labels - Posibles etiquetas a buscar
 * @param {RegExp} [valuePattern] - Patrón para capturar el valor
 * @returns {string|null}
 */
function extract(text, labels, valuePattern = /([^\n]+)/) {
  for (const label of labels) {
    // Busca la etiqueta y captura lo que sigue (mismo renglón o siguiente)
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `${escapedLabel}[:\\s]*${valuePattern.source}`,
      'i'
    );
    const match = text.match(pattern);
    if (match && match[1]?.trim()) {
      const value = match[1].trim();
      // Filtramos valores que son solo guiones, puntos o están vacíos
      if (value && !/^[-–—.]+$/.test(value)) return value;
    }
  }
  return null;
}

/**
 * Extrae el NIT (sin dígito de verificación) y el DV.
 * El NIT en el RUT aparece como "900.123.456-7" o "900123456-7".
 * @param {string} text
 * @returns {{ nit: string|null, digitoVerificacion: string|null }}
 */
function extractNIT(text) {
  // Patrón 1: etiqueta "NIT" seguida del número
  const nitPattern = /\bNIT\b[:\s]*([0-9]{1,3}(?:[.\s]?[0-9]{3})*)\s*[-–]\s*([0-9])/i;
  const nitMatch = text.match(nitPattern);
  if (nitMatch) {
    return {
      nit: nitMatch[1].replace(/[.\s]/g, ''),
      digitoVerificacion: nitMatch[2],
    };
  }

  // Patrón 2: el número de identificación aparece en bloque
  const idPattern = /N[oú]mero\s+de\s+identificaci[oó]n[:\s]*([0-9]{1,3}(?:[.\s]?[0-9]{3})*)\s*[-–]\s*([0-9])/i;
  const idMatch = text.match(idPattern);
  if (idMatch) {
    return {
      nit: idMatch[1].replace(/[.\s]/g, ''),
      digitoVerificacion: idMatch[2],
    };
  }

  // Patrón 3: número que aparece claramente en el encabezado del RUT
  const rawPattern = /([0-9]{6,12})\s*[-–]\s*([0-9])/;
  const rawMatch = text.match(rawPattern);
  if (rawMatch) {
    return {
      nit: rawMatch[1],
      digitoVerificacion: rawMatch[2],
    };
  }

  return { nit: null, digitoVerificacion: null };
}

/**
 * Extrae los códigos CIIU y sus descripciones de actividades económicas.
 * @param {string} text
 * @returns {string}
 */
function extractActividadEconomica(text) {
  // Busca patrones tipo "CIIU XXXX Descripción"
  const ciiuPattern = /CIIU\s*[:\-]?\s*([0-9]{4})[^\n]*\n?([^\n]{0,80})/gi;
  const matches = [];
  let match;
  while ((match = ciiuPattern.exec(text)) !== null) {
    const codigo = match[1];
    const desc = match[2]?.trim();
    if (codigo) {
      matches.push(desc ? `${codigo} – ${desc}` : codigo);
    }
  }

  if (matches.length > 0) return matches.slice(0, 3).join(' | ');

  // Fallback: busca la etiqueta "Actividad económica"
  return extract(text, [
    'Actividad económica',
    'Actividades económicas',
    'Actividad Económica Principal',
    'Actividad principal',
  ]);
}

/**
 * Extrae las responsabilidades tributarias del RUT.
 * @param {string} text
 * @returns {string}
 */
function extractResponsabilidades(text) {
  // Busca el bloque de responsabilidades — suele tener múltiples líneas con códigos
  const blockPattern = /Responsabilidades[,\s]+calidades[^\n]*\n([\s\S]{10,400}?)(?:\n[A-Z]{2,}|\nFecha|$)/i;
  const blockMatch = text.match(blockPattern);
  if (blockMatch) {
    const block = blockMatch[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 2 && !/^[-–]+$/.test(l))
      .join(' | ');
    if (block) return block.substring(0, 300); // máximo 300 chars
  }

  return extract(text, [
    'Responsabilidades',
    'Obligaciones',
    'Responsabilidades tributarias',
  ]);
}

/**
 * Función principal: parsea el texto completo del RUT.
 * @param {string} rawText - Texto extraído del PDF con pdf-parse
 * @returns {Object} Campos del RUT
 */
export function parseRutText(rawText) {
  const text = normalize(rawText);

  const { nit, digitoVerificacion } = extractNIT(text);

  const razonSocial = extract(text, [
    'Razón social',
    'Razon social',
    'Nombre o Razón Social',
    'Primer apellido',      // para personas naturales el RUT combina apellidos + nombres
  ]);

  const nombreComercial = extract(text, [
    'Nombre comercial',
    'Nombre Comercial',
  ]);

  const tipoContribuyente = extract(text, [
    'Tipo de contribuyente',
    'Tipo contribuyente',
    'Tipo de persona',
    'Clase de contribuyente',
  ]);

  const tipoDocumento = extract(text, [
    'Tipo de documento',
    'Tipo documento',
  ]);

  const direccion = extract(text, [
    'Dirección principal',
    'Direccion principal',
    'Dirección',
    'Direccion',
    'Domicilio principal',
  ]);

  const municipio = extract(text, [
    'Municipio',
    'Ciudad',
    'Municipio/Ciudad',
  ]);

  const departamento = extract(text, [
    'Departamento',
    'Dpto',
  ]);

  const codigoPostal = extract(text, [
    'Código postal',
    'Codigo postal',
    'C[oó]digo\s+postal',
  ]);

  const telefonoEmpresa = extract(text, [
    'Teléfono',
    'Telefono',
    'Tel[eé]fono principal',
    'Tel\.',
  ], /([0-9()+\-\s]{6,20})/);

  const correoEmpresa = extract(text, [
    'Correo electrónico',
    'Correo electronico',
    'Email',
    'Correo',
  ], /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);

  const actividadEconomica = extractActividadEconomica(text);

  const responsabilidades = extractResponsabilidades(text);

  const fechaInscripcion = extract(text, [
    'Fecha de inscripción',
    'Fecha de inscripcion',
    'Fecha inscripci[oó]n',
    'Inscripción al RUT',
    'Fecha de registro',
  ], /([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4}|[0-9]{4}[-\/][0-9]{2}[-\/][0-9]{2})/);

  const fechaActualizacion = extract(text, [
    'Fecha de actualización',
    'Fecha de actualizacion',
    'Última actualización',
    'Ultima actualizacion',
    'Fecha actualización',
  ], /([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4}|[0-9]{4}[-\/][0-9]{2}[-\/][0-9]{2})/);

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
