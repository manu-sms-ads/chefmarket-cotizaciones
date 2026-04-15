/**
 * parseRut.js v2
 * Extrae los campos del RUT DIAN de Colombia.
 *
 * El PDF del RUT DIAN tiene una estructura particular:
 *  - La primera mitad contiene todos los NOMBRES de los campos (etiquetas).
 *  - La segunda mitad contiene los VALORES reales en orden.
 *
 * Estrategia: patrones específicos por tipo de dato, anclados en el texto
 * de la sección de valores (no de etiquetas).
 */

/**
 * Normaliza saltos de línea.
 */
function norm(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Extrae el NIT y el Dígito de Verificación.
 * En el RUT aparece como número de formulario (12 dígitos) seguido del NIT+DV
 * en la misma línea o la siguiente.
 * Ej: "141196221666    11440917530" → NIT=1144091753 DV=0
 */
function extractNIT(text) {
  // Patrón principal: formulario(12) + espacio + NIT+DV(10-11)
  const m = text.match(/\b\d{12}\b\s+(\d{9,11})\b/);
  if (m) {
    const combined = m[1].replace(/\s/g, '');
    if (combined.length >= 10) {
      return {
        nit: combined.slice(0, combined.length - 1),
        digitoVerificacion: combined.slice(-1),
      };
    }
  }

  // Fallback: número de identificación con código de tipo al inicio
  // "131 1 4 4 0 9 1 7 5 3" → quitar prefijo de 2 dígitos → "1144091753"
  const idWithType = text.match(/\b1[23]\s*([\d\s]{15,25})/);
  if (idWithType) {
    const digits = idWithType[1].replace(/\s/g, '');
    if (digits.length >= 9) {
      return { nit: digits, digitoVerificacion: null };
    }
  }

  // Fallback: cualquier número de 9-10 dígitos en el área de datos
  const anyNit = text.match(/\n\s*(\d{9,10})\s*\n/);
  if (anyNit) {
    return { nit: anyNit[1], digitoVerificacion: null };
  }

  return { nit: null, digitoVerificacion: null };
}

/**
 * Extrae los códigos CIIU y fechas de inicio de actividad.
 * El bloque de actividades en el RUT aparece como 24 dígitos continuos:
 * CCCC AAAAMMDD CCCC AAAAMMDD  (código 4 dígitos + fecha 8 dígitos, x2)
 */
function extractActividades(text) {
  // Las fechas de actividad son YYYYMMDD donde YYYY empieza en 19xx o 20xx
  // Esto filtra los números del encabezado del formulario (12345678...)
  const bloque = text.match(/\b(\d{4})((?:19|20)\d{6})(\d{4})((?:19|20)\d{6})/);
  if (bloque) {
    const [, ciiu1, fecha1, ciiu2] = bloque;
    const partes = [`CIIU ${ciiu1}`];
    if (ciiu2 && ciiu2 !== ciiu1) partes.push(`CIIU ${ciiu2}`);
    return partes.join(' | ');
  }

  // Fallback: buscar código CIIU explícito
  const ciiuTag = text.match(/CIIU\s*[:\-]?\s*(\d{4})/i);
  if (ciiuTag) return `CIIU ${ciiuTag[1]}`;

  return null;
}

/**
 * Extrae fechas de inscripción y actualización del bloque de actividades.
 * CCCC AAAAMMDD CCCC AAAAMMDD → fecha1 y fecha2 en formato DD/MM/YYYY
 */
function extractFechas(text) {
  const bloque = text.match(/\b\d{4}((?:19|20)\d{6})\d{4}((?:19|20)\d{6})/);
  if (bloque) {
    const fmt = (s) => `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
    return {
      fechaInscripcion: fmt(bloque[1]),
      fechaActualizacion: fmt(bloque[2]),
    };
  }

  // Fallback: buscar fechas en formatos estándar
  const fechas = [...text.matchAll(/\b(\d{2}[-\/]\d{2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})\b/g)];
  return {
    fechaInscripcion: fechas[0]?.[1] ?? null,
    fechaActualizacion: fechas[1]?.[1] ?? null,
  };
}

/**
 * Extrae las responsabilidades tributarias.
 * Patrón DIAN: "XX - Descripción" o "XX- Descripción" donde XX es el código.
 */
function extractResponsabilidades(text) {
  const set = new Set();
  // Las responsabilidades usan guión, los campos del formulario usan punto
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
  if (!rawText || rawText.trim().length < 50) {
    return {
      nit: null, digitoVerificacion: null, razonSocial: null,
      nombreComercial: null, tipoContribuyente: null, tipoDocumento: null,
      direccion: null, municipio: null, departamento: null, codigoPostal: null,
      telefonoEmpresa: null, correoEmpresa: null, actividadEconomica: null,
      responsabilidades: null, fechaInscripcion: null, fechaActualizacion: null,
    };
  }

  const text = norm(rawText);
  const lines = text.split('\n').map((l) => l.trim());

  /* ── 1. NIT + DV ─────────────────────────────────────────────── */
  const { nit, digitoVerificacion } = extractNIT(text);

  /* ── 2 & 3. Razón social + Nombre comercial ─────────────────── */
  //
  // El RUT DIAN tiene DOS bloques "COLOMBIA\n169":
  //   1er bloque = lugar de expedición del documento de identidad
  //   2do bloque = UBICACIÓN (dirección del negocio)
  //
  // Los nombres (razón social y/o nombre comercial) aparecen
  // justo DESPUÉS del código de ciudad del 1er bloque y ANTES del 2do bloque.
  //
  // Estructura del 1er bloque:
  //   COLOMBIA → 169 → [Departamento] → [cod 2d] → [Ciudad] → [cod 3d]
  //   → [NOMBRE / CONCAT]
  //   → [NOMBRE COMERCIAL]  ← opcional
  //   → COLOMBIA → 169 (inicio 2do bloque UBICACIÓN)

  let razonSocial = null;
  let nombreComercial = null;

  // 1. Buscar las dos ocurrencias de "COLOMBIA\n169"
  const colombiaRe = /COLOMBIA\n169/g;
  const colombiaMatches = [...text.matchAll(colombiaRe)];

  if (colombiaMatches.length >= 2) {
    const firstEnd  = colombiaMatches[0].index + 'COLOMBIA\n169'.length;
    const secondStart = colombiaMatches[1].index;
    const between = text.substring(firstEnd, secondStart);

    // Dividir el bloque entre los dos COLOMBIA en líneas limpias
    const btLines = between.split('\n').map((l) => l.trim());

    // El código de ciudad del 1er bloque es el ÚLTIMO número de 3 dígitos
    // en este fragmento (antes de los nombres)
    let lastCodeIdx = -1;
    for (let i = 0; i < btLines.length; i++) {
      if (/^\d{3}$/.test(btLines[i])) lastCodeIdx = i;
    }

    if (lastCodeIdx !== -1) {
      // Todo lo que viene DESPUÉS del código de ciudad = nombres
      const nameLines = btLines.slice(lastCodeIdx + 1).filter((l) => l);

      if (nameLines.length >= 1) razonSocial = nameLines[0];
      if (nameLines.length >= 2) nombreComercial = nameLines[1];
    }
  }

  // 2. Fallback: buscar antes de "CONTRIBUYENTE" (algunos RUTs lo incluyen)
  if (!razonSocial) {
    const contribIdx = lines.findIndex((l) => l.trim() === 'CONTRIBUYENTE');
    if (contribIdx > 0) {
      for (let i = contribIdx - 1; i >= Math.max(0, contribIdx - 4); i--) {
        const l = lines[i];
        if (l && l.length > 3 && /^[A-ZÁÉÍÓÚÑ]/.test(l) && !/^\d/.test(l)) {
          razonSocial = l.trim();
          break;
        }
      }
    }
  }

  // 3. Fallback final: nombre concatenado en bloque largo sin espacios
  if (!razonSocial) {
    const concat = text.match(/\n([A-ZÁÉÍÓÚÑ]{10,80})\n/);
    if (concat && !/^COLOMBIA/.test(concat[1])) {
      razonSocial = concat[1].trim();
    }
  }

  /* ── 4. Tipo de contribuyente ────────────────────────────────── */
  const tipoContribMatch = text.match(
    /(Persona\s+(?:natural\s+o\s+sucesi[oó]n\s+il[ií]quida|natural|jur[ií]dica\s+y\s+asimilada|jur[ií]dica)|Gran\s+contribuyente|Entidad\s+del\s+Estado|Persona\s+jur[ií]dica)/i
  );
  const tipoContribuyente = tipoContribMatch ? tipoContribMatch[0].trim() : null;

  /* ── 5. Tipo de documento ────────────────────────────────────── */
  // Solo tipos de documento reales (no la etiqueta del NIT)
  const tipoDocMatch = text.match(
    /\b(C[eé]dula\s+de\s+Ciudadan[ií]a|Tarjeta\s+de\s+Identidad|C[eé]dula\s+de\s+Extranjer[ií]a|Pasaporte|Registro\s+Civil|Tarjeta\s+de\s+Extranjer[ií]a|N[uú]mero\s+[Úú]nico\s+de\s+Identificaci[oó]n)\b/i
  );
  const tipoDocumento = tipoDocMatch ? tipoDocMatch[0].trim() : null;

  /* ── 6. Departamento (sección UBICACIÓN = última ocurrencia) ─── */
  const DEPARTAMENTOS = [
    'Valle del Cauca', 'Norte de Santander', 'Cundinamarca', 'Bogotá D.C.',
    'Antioquia', 'Atlántico', 'Santander', 'Bolívar', 'Nariño', 'Córdoba',
    'Tolima', 'Magdalena', 'La Guajira', 'Meta', 'Huila', 'Boyacá', 'Caldas',
    'Risaralda', 'Quindío', 'Sucre', 'Cesar', 'Chocó', 'Caquetá', 'Arauca',
    'Casanare', 'Putumayo', 'Amazonas', 'Guainía', 'Guaviare', 'Vaupés',
    'Vichada', 'San Andrés', 'Cauca', 'Bogotá', 'Distrito Capital',
  ];

  // Recolectar TODOS los matches con posición y longitud
  const deptMatches = [];
  for (const dept of DEPARTAMENTOS) {
    const re = new RegExp(dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      deptMatches.push({ dept, start: m.index, end: m.index + dept.length });
    }
  }
  // Eliminar matches que son sub-cadena de uno más largo en la misma posición
  const cleanDeptMatches = deptMatches.filter(
    (a) => !deptMatches.some((b) => b !== a && b.start <= a.start && b.end >= a.end && b.dept.length > a.dept.length)
  );
  // Tomar el match más tardío (sección UBICACIÓN está al final del texto)
  cleanDeptMatches.sort((a, b) => b.start - a.start);
  const bestDept = cleanDeptMatches[0] ?? null;
  let departamento = bestDept?.dept ?? null;
  let lastDeptPos = bestDept?.start ?? -1;

  /* ── 7. Ciudad / Municipio ───────────────────────────────────── */
  let municipio = null;
  if (departamento && lastDeptPos !== -1) {
    const afterDept = text.substring(lastDeptPos + departamento.length);
    // Tras el departamento viene el código (2-3 dígitos) y luego la ciudad
    // El código puede tener espacios al final (ej: "63   \n") → usamos \s*
    const cityM = afterDept.match(/\n\d{1,3}\s*\n([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s\.]{2,40})\n/);
    if (cityM) municipio = cityM[1].trim();
  }

  /* ── 8. Dirección principal ──────────────────────────────────── */
  // Empieza con abreviatura de vía: CL, KR, AV, etc.
  // Solo en la línea donde aparece la dirección (sin cruzar saltos de línea)
  const dirMatch = text.match(
    /\b(CL|KR|KRA|AV|TV|DG|AC|CRA|CALLE|CARRERA|AVENIDA|DIAGONAL|TRANSVERSAL|VIA|MZ|LT)\b[ \t\d\w#\-\.]+/i
  );
  const direccion = dirMatch
    ? dirMatch[0].replace(/[ \t]{2,}/g, ' ').trim().substring(0, 80)
    : null;

  /* ── 9. Correo electrónico ───────────────────────────────────── */
  const emailMatch = text.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
  const correoEmpresa = emailMatch ? emailMatch[0].toLowerCase() : null;

  /* ── 10. Teléfono ────────────────────────────────────────────── */
  // Celular colombiano: 10 dígitos empezando en 3
  // Fijo: 7 dígitos (prefijo de ciudad ya incluido en algunos RUTs)
  const telMatch = text.match(/\b(3\d{9}|\d{7})\b/);
  const telefonoEmpresa = telMatch ? telMatch[0].trim() : null;

  /* ── 11. Actividad económica (CIIU) ──────────────────────────── */
  const actividadEconomica = extractActividades(text);

  /* ── 12. Responsabilidades tributarias ───────────────────────── */
  const responsabilidades = extractResponsabilidades(text);

  /* ── 13. Fechas ──────────────────────────────────────────────── */
  const { fechaInscripcion, fechaActualizacion } = extractFechas(text);

  /* ── 14. Código postal ───────────────────────────────────────── */
  // Código postal colombiano = 6 dígitos; filtramos el NIT para no confundirlos
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
