/**
 * setup-dashboard.js — Chef Market Colombia
 * Dashboard visual perfecto con filtro de fecha global.
 *
 * Arquitectura:
 *   • Fondo general: gris suave (#F4F6F4) → todo el sheet tiene bg explícito
 *   • Columnas D(3) y H(7) = 10px con bg = gris de página → divisores invisibles
 *   • Fila helper (R5) = 2px de alto, texto blanco sobre blanco → invisible
 *   • Secciones: bg blanco con borde sutil → efecto "tarjeta"
 *   • Filtro: barra naranja cohesiva y clara
 */
'use strict';

const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');

// ── .env.local ─────────────────────────────────────────────────────────────
const envRaw = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      const k = l.slice(0, i).trim();
      let v   = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [k, v];
    })
);

const SHEET_ID = env.GOOGLE_SHEET_ID;
const L        = env.GOOGLE_SHEET_NAME || 'LEADS';
const DASH     = 'DASHBOARD';
const NCOLS    = 11; // A–K  (índices 0–10)

const credentials = {
  type: 'service_account',
  project_id:    env.GOOGLE_PROJECT_ID,
  private_key_id: env.GOOGLE_PRIVATE_KEY_ID,
  private_key:   (env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  client_email:  env.GOOGLE_CLIENT_EMAIL,
  client_id:     env.GOOGLE_CLIENT_ID,
  auth_uri:  'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
};

// ── Paleta de colores ──────────────────────────────────────────────────────
const rgb = (r,g,b) => ({ red:r/255, green:g/255, blue:b/255 });
const C = {
  page:        rgb(244,246,244),   // Fondo general del dashboard
  white:       rgb(255,255,255),
  darkGreen:   rgb( 27, 68, 50),   // Encabezados principales
  midGreen:    rgb( 45,106, 79),   // Encabezados de sección
  lightGreen:  rgb( 82,183,136),   // Col headers
  paleGreen:   rgb(212,241,228),   // Fila TOTAL
  altRow:      rgb(248,253,250),   // Filas alternas
  orange:      rgb(229,114, 32),   // Filtro y KPIs
  paleOrange:  rgb(255,243,229),   // KPI value bg
  filterBg:    rgb(255,248,237),   // Filtro fondo
  darkGray:    rgb( 51, 51, 51),   // Texto datos
  midGray:     rgb(130,130,130),   // Texto secundario
  pctGreen:    rgb( 45,106, 79),   // Texto porcentaje
};

// ── Categorías ─────────────────────────────────────────────────────────────
const TIPOS_NEGOCIO = [
  'Restaurante','Hotel','Cafetería / Coffee Shop','Panadería / Pastelería',
  'Dark Kitchen / Cocina en la Nube','Catering / Servicios de Alimentación',
  'Casino Empresarial','Supermercado / Minimercado','Distribuidora de Alimentos',
  'Club / Evento','Institución Educativa','Clínica / Hospital','Otro',
];
const RANGOS_EMP = ['1-5','6-20','21-50','51-100','Más de 100','(Sin dato)'];
const DIAS       = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const CARGOS     = [
  'Propietario / Dueño','Gerente General','Gerente Administrativo',
  'Gerente de Compras','Director de Logística','Jefe de Cocina',
  'Administrador','Contador','Asistente Administrativo','Otro',
];
const ESTADOS       = ['Pendiente revisión','En contacto','Cotización enviada','Cerrado ganado','Cerrado perdido'];
const TIPOS_CONTRIB = ['Persona natural o sucesión ilíquida','Persona jurídica y asimilada','Gran contribuyente'];
const PERIOD_OPTIONS = [
  'Todo el tiempo','Hoy','Esta semana','Este mes',
  'Este trimestre','Este año','Últimos 7 días','Últimos 30 días',
  'Últimos 90 días','Personalizado',
];

// ── Referencias helper (sheet row 6 = array index 5) ──────────────────────
// B6=FechaDesde | H6=FechaHasta | K6=Total en período
const FD  = '$B$6';
const FH  = '$H$6';
const TOT = '$K$6';

// ── Fórmulas helper ────────────────────────────────────────────────────────
const HELPER_DESDE =
  `=IF(B5="Todo el tiempo","2020-01-01",` +
  `IF(B5="Hoy",TEXT(TODAY(),"YYYY-MM-DD"),` +
  `IF(B5="Esta semana",TEXT(TODAY()-WEEKDAY(TODAY(),2)+1,"YYYY-MM-DD"),` +
  `IF(B5="Este mes",TEXT(DATE(YEAR(TODAY()),MONTH(TODAY()),1),"YYYY-MM-DD"),` +
  `IF(B5="Este trimestre",TEXT(DATE(YEAR(TODAY()),INT((MONTH(TODAY())-1)/3)*3+1,1),"YYYY-MM-DD"),` +
  `IF(B5="Este año",TEXT(DATE(YEAR(TODAY()),1,1),"YYYY-MM-DD"),` +
  `IF(B5="Últimos 7 días",TEXT(TODAY()-7,"YYYY-MM-DD"),` +
  `IF(B5="Últimos 30 días",TEXT(TODAY()-30,"YYYY-MM-DD"),` +
  `IF(B5="Últimos 90 días",TEXT(TODAY()-90,"YYYY-MM-DD"),` +
  `IF(B5="Personalizado",IF(F5<>"",TEXT(F5,"YYYY-MM-DD"),"2020-01-01"),` +
  `"2020-01-01"))))))))))`;

const HELPER_HASTA =
  `=IF(B5="Todo el tiempo","2099-12-31",` +
  `IF(B5="Hoy",TEXT(TODAY(),"YYYY-MM-DD"),` +
  `IF(B5="Esta semana",TEXT(TODAY(),"YYYY-MM-DD"),` +
  `IF(B5="Este mes",TEXT(EOMONTH(TODAY(),0),"YYYY-MM-DD"),` +
  `IF(B5="Este trimestre",TEXT(EOMONTH(DATE(YEAR(TODAY()),INT((MONTH(TODAY())-1)/3)*3+3,1),0),"YYYY-MM-DD"),` +
  `IF(B5="Este año",TEXT(DATE(YEAR(TODAY()),12,31),"YYYY-MM-DD"),` +
  `IF(B5="Últimos 7 días",TEXT(TODAY(),"YYYY-MM-DD"),` +
  `IF(B5="Últimos 30 días",TEXT(TODAY(),"YYYY-MM-DD"),` +
  `IF(B5="Últimos 90 días",TEXT(TODAY(),"YYYY-MM-DD"),` +
  `IF(B5="Personalizado",IF(H5<>"",TEXT(H5,"YYYY-MM-DD"),"2099-12-31"),` +
  `"2099-12-31"))))))))))`;

// ── Fórmulas COUNTIFS con filtro de fecha ──────────────────────────────────
// Columna A se guarda como datetime serial → comparar con DATEVALUE()
// ">="&DATEVALUE(FD) = desde inicio del día inicial
// "<"&(DATEVALUE(FH)+1) = hasta antes del inicio del día siguiente (= todo el día FH)
const dateCrit = `">="&DATEVALUE(${FD}),${L}!A2:A,"<"&(DATEVALUE(${FH})+1)`;
const ci  = (col,val) =>
  `=IFERROR(COUNTIFS(${L}!A2:A,${dateCrit},${L}!${col}2:${col},"${val.replace(/"/g,'""')}"),0)`;
const ciW = (col,sub) =>
  `=IFERROR(COUNTIFS(${L}!A2:A,${dateCrit},${L}!${col}2:${col},"*${sub.replace(/"/g,'""')}*"),0)`;
const ciEmpty = (col) =>
  `=IFERROR(COUNTIFS(${L}!A2:A,${dateCrit},${L}!${col}2:${col},""),0)`;
const pct = (colLetter,rowNum) =>
  `=IFERROR(TEXT(${colLetter}${rowNum}/${TOT}*100,"0.0")&"%","–")`;

// ── Helpers de construcción ────────────────────────────────────────────────
const pad  = n => Array(n).fill('');
const r11  = obj => { const r=pad(NCOLS); for(const[c,v] of Object.entries(obj)) r[+c]=v; return r; };

// ── Filas del dashboard ────────────────────────────────────────────────────
function buildRows() {
  const rows = [];

  // R0 — Título principal
  rows.push(['CHEF MARKET COLOMBIA  ·  DASHBOARD DE COTIZACIONES', ...pad(NCOLS-1)]);

  // R1 — Subtítulo
  rows.push([
    `=CONCATENATE("Actualizado: ",TEXT(NOW(),"DD/MM/YYYY  HH:MM"))`,
    ...pad(8),
    `=CONCATENATE(COUNTA(${L}!A2:A)," leads totales")`, '',
  ]);

  // R2 — Espacio visual
  rows.push(pad(NCOLS));

  // R3 — Header filtro
  rows.push(['FILTRO DE PERÍODO', ...pad(NCOLS-1)]);

  // R4 (sheet row 5) — Controles del filtro
  // B5=dropdown | F5=fecha desde input | H5=fecha hasta input | J5-K5=período activo
  // Layout: A="Período:" | B-C=dropdown | D=spacer | E="Desde:" | F=input | G="Hasta:" | H=input | I=spacer | J-K=display
  rows.push(r11({
    0: 'Período:',
    1: 'Todo el tiempo',
    4: 'Desde:',
    5: '',          // input fecha desde (solo Personalizado) → F5, referenciado por HELPER_DESDE
    6: 'Hasta:',
    7: '',          // input fecha hasta (solo Personalizado) → H5, referenciado por HELPER_HASTA
    9: `=IF(B5="Personalizado",CONCATENATE(TEXT(DATEVALUE(${FD}),"DD/MM/YYYY"),"  →  ",TEXT(DATEVALUE(${FH}),"DD/MM/YYYY")),B5)`,
  }));

  // R5 (sheet row 6) — Fila helper INVISIBLE (2px, texto blanco)
  rows.push(r11({ 1:HELPER_DESDE, 7:HELPER_HASTA, 10:`=COUNTIFS(${L}!A2:A,">="&DATEVALUE(${FD}),${L}!A2:A,"<"&(DATEVALUE(${FH})+1))` }));

  // R6 — Espacio visual
  rows.push(pad(NCOLS));

  // R7-R8 — KPIs (labels + valores)
  rows.push(r11({ 0:'LEADS EN PERÍODO', 3:'RANGO ACTIVO', 6:'PROMEDIO SEMANAL', 9:'% CON NIT' }));
  rows.push(r11({
    0: `=${TOT}`,
    3: `=IF(B5="Todo el tiempo","Todo el tiempo",IF(B5="Hoy",TEXT(TODAY(),"DD/MM/YYYY"),CONCATENATE(TEXT(DATEVALUE(${FD}),"DD/MM/YY"),"  →  ",TEXT(DATEVALUE(${FH}),"DD/MM/YY"))))`,
    6: `=IF(B5="Todo el tiempo","—",IFERROR(IF((DATEVALUE(${FH})-DATEVALUE(${FD}))<=90,TEXT(${TOT}/MAX(1,(DATEVALUE(${FH})-DATEVALUE(${FD})+1)/7),"0.00")&" / sem",TEXT(${TOT}/MAX(1,(DATEVALUE(${FH})-DATEVALUE(${FD})+1)/30),"0.0")&" / mes"),"–"))`,
    9: `=IFERROR(TEXT(COUNTIFS(${L}!A2:A,">="&DATEVALUE(${FD}),${L}!A2:A,"<"&(DATEVALUE(${FH})+1),${L}!N2:N,"<>")/${TOT}*100,"0.0")&"%","N/D")`,
  }));

  // R9 — Espacio
  rows.push(pad(NCOLS));

  // R10 — Sección 1: headers
  rows.push(r11({ 0:'TIPO DE NEGOCIO', 4:'N° EMPLEADOS', 8:'DÍA DE LLEGADA' }));

  // R11 — Col headers
  rows.push(r11({ 0:'Tipo de Negocio',1:'Leads',2:'%', 4:'Rango',5:'Leads',6:'%', 8:'Día',9:'Leads',10:'%' }));

  // R12–R24 — Datos sección 1
  const maxS1 = Math.max(TIPOS_NEGOCIO.length, RANGOS_EMP.length, DIAS.length);
  for(let i=0;i<maxS1;i++){
    const sRow = 12+i+1;
    const row  = pad(NCOLS);
    if(TIPOS_NEGOCIO[i]){ row[0]=TIPOS_NEGOCIO[i]; row[1]=ci('K',TIPOS_NEGOCIO[i]); row[2]=pct('B',sRow); }
    if(RANGOS_EMP[i]){
      row[4]=RANGOS_EMP[i];
      row[5]=RANGOS_EMP[i]==='(Sin dato)'?ciEmpty('L'):ci('L',RANGOS_EMP[i]);
      row[6]=pct('F',sRow);
    }
    if(DIAS[i]){ row[8]=DIAS[i]; row[9]=ci('D',DIAS[i]); row[10]=pct('J',sRow); }
    rows.push(row);
  }
  // Total sección 1
  rows.push(r11({ 0:'TOTAL',1:`=${TOT}`,2:'100%', 4:'TOTAL',5:`=${TOT}`,6:'100%', 8:'TOTAL',9:`=${TOT}`,10:'100%' }));

  // R25+1 — Espacio
  rows.push(pad(NCOLS));

  // Sección 2: headers
  rows.push(r11({ 0:'CARGO / FUNCIÓN', 4:'ESTADO DEL LEAD', 8:'TIPO CONTRIBUYENTE' }));
  rows.push(r11({ 0:'Cargo',1:'Leads',2:'%', 4:'Estado',5:'Leads',6:'%', 8:'Contribuyente',9:'Leads',10:'%' }));

  // Datos sección 2
  const maxS2  = Math.max(CARGOS.length, ESTADOS.length, TIPOS_CONTRIB.length);
  const s2Base = rows.length;
  for(let i=0;i<maxS2;i++){
    const sRow = s2Base+i+1;
    const row  = pad(NCOLS);
    if(CARGOS[i]){ row[0]=CARGOS[i]; row[1]=ci('G',CARGOS[i]); row[2]=pct('B',sRow); }
    if(ESTADOS[i]){ row[4]=ESTADOS[i]; row[5]=ci('AG',ESTADOS[i]); row[6]=pct('F',sRow); }
    if(TIPOS_CONTRIB[i]){
      const kw = TIPOS_CONTRIB[i].includes('natural')?'natural':TIPOS_CONTRIB[i].includes('jur')?'jur':'Gran';
      row[8]=TIPOS_CONTRIB[i]; row[9]=ciW('S',kw); row[10]=pct('J',sRow);
    }
    rows.push(row);
  }
  // Total sección 2
  rows.push(r11({ 0:'TOTAL',1:`=${TOT}`,2:'100%', 4:'TOTAL',5:`=${TOT}`,6:'100%', 8:'TOTAL',9:`=${TOT}`,10:'100%' }));

  // Espacio
  rows.push(pad(NCOLS));

  // Tabla de últimas cotizaciones
  rows.push(['ÚLTIMAS 10 COTIZACIONES DEL PERÍODO', ...pad(NCOLS-1)]);
  // Header de tabla: col D (pos 3) = '' → spacer invisible entre las dos mitades
  rows.push(['Fecha','Nombre Responsable','Cargo','','Ciudad','NIT / Empresa','Estado','','','','']);

  // QUERY filtrada por período — dos fórmulas separadas para saltar el spacer D
  // Columnas disponibles: A(215) B(72) C(58) [D=18 spacer] E(175) F(80) G(52)
  // Q_LEFT  → A44 → spills A,B,C  (Fecha, Nombre Responsable, Cargo)
  // Q_RIGHT → E44 → spills E,F,G  (Ciudad, NIT Completo, Estado)
  // Columna D queda vacía → invisible ✓
  const dateWhere =
    `WHERE Col1 >= datetime '"&${FD}&" 00:00:00' AND Col1 < datetime '"&TEXT(DATEVALUE(${FH})+1,"YYYY-MM-DD")&" 00:00:00' `;
  const Q_LEFT =
    `=IFERROR(QUERY({${L}!A2:A,${L}!B2:B,${L}!F2:F,${L}!G2:G},` +
    `"SELECT Col2,Col3,Col4 ${dateWhere}ORDER BY Col1 DESC LIMIT 10 LABEL Col2'',Col3'',Col4''",0),` +
    `{"Sin registros en el período seleccionado","",""})`;
  const Q_RIGHT =
    `=IFERROR(QUERY({${L}!A2:A,${L}!J2:J,${L}!P2:P,${L}!AG2:AG},` +
    `"SELECT Col2,Col3,Col4 ${dateWhere}ORDER BY Col1 DESC LIMIT 10 LABEL Col2'',Col3'',Col4''",0),` +
    `{"","",""})`;
  const recRow = pad(NCOLS);
  recRow[0] = Q_LEFT;
  recRow[4] = Q_RIGHT;
  rows.push(recRow);
  for(let i=1;i<10;i++) rows.push(pad(NCOLS));

  // Espacio + Footer
  rows.push(pad(NCOLS));
  rows.push([`=CONCATENATE("Chef Market Colombia  ·  Dashboard generado: ",TEXT(TODAY(),"DD/MM/YYYY"))`, ...pad(NCOLS-1)]);

  return rows;
}

// ── Construcción del formato ───────────────────────────────────────────────
function buildFormatRequests(sid) {
  const R   = (r0,r1,c0,c1) => ({sheetId:sid,startRowIndex:r0,endRowIndex:r1,startColumnIndex:c0,endColumnIndex:c1});
  const fmt = (r0,r1,c0,c1,f) => ({ repeatCell:{ range:R(r0,r1,c0,c1), cell:{userEnteredFormat:f}, fields:'userEnteredFormat('+Object.keys(f).join(',')+')'  }});
  const merge  = (r0,r1,c0,c1) => ({mergeCells:{range:R(r0,r1,c0,c1),mergeType:'MERGE_ALL'}});
  const colW   = (c0,c1,px)    => ({updateDimensionProperties:{range:{sheetId:sid,dimension:'COLUMNS',startIndex:c0,endIndex:c1},properties:{pixelSize:px},fields:'pixelSize'}});
  const rowH   = (r0,r1,px)    => ({updateDimensionProperties:{range:{sheetId:sid,dimension:'ROWS',startIndex:r0,endIndex:r1},properties:{pixelSize:px},fields:'pixelSize'}});
  // Borde sutil: solo inferior, para separar filas
  const bord   = (c,s='SOLID') => ({style:s,colorStyle:{rgbColor:c}});

  const reqs = [];

  // ── 0. FONDO COMPLETO DEL SHEET (primero, como capa base) ─────
  reqs.push(fmt(0,200,0,NCOLS,{backgroundColor:C.page}));

  // ── ANCHOS ────────────────────────────────────────────────────
  reqs.push(colW(0,1,215));  // A — labels
  reqs.push(colW(1,2,72));   // B — count
  reqs.push(colW(2,3,58));   // C — %
  reqs.push(colW(3,4,18));   // D — divisor (separación visual entre secciones)
  reqs.push(colW(4,5,175));  // E — labels
  reqs.push(colW(5,6,80));   // F — count / date-desde input
  reqs.push(colW(6,7,52));   // G — %
  reqs.push(colW(7,8,18));   // H — divisor
  reqs.push(colW(8,9,215));  // I — labels
  reqs.push(colW(9,10,72));  // J — count
  reqs.push(colW(10,11,58)); // K — %

  // Divisores (cols D y H) → mismo color que el fondo de página
  reqs.push(fmt(0,200,3,4,{backgroundColor:C.page}));
  reqs.push(fmt(0,200,7,8,{backgroundColor:C.page}));

  // ── R0: TÍTULO ────────────────────────────────────────────────
  reqs.push(rowH(0,1,50));
  reqs.push(merge(0,1,0,NCOLS));
  reqs.push(fmt(0,1,0,NCOLS,{
    backgroundColor:C.darkGreen,
    textFormat:{bold:true,fontSize:17,foregroundColor:C.white},
    horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',
  }));

  // ── R1: SUBTÍTULO ─────────────────────────────────────────────
  reqs.push(rowH(1,2,24));
  reqs.push(merge(1,2,0,8));
  reqs.push(merge(1,2,8,NCOLS));
  reqs.push(fmt(1,2,0,NCOLS,{
    backgroundColor:C.midGreen,
    textFormat:{fontSize:9,foregroundColor:C.white},
    verticalAlignment:'MIDDLE',
  }));
  reqs.push(fmt(1,2,0,1,{horizontalAlignment:'LEFT',textFormat:{fontSize:9,foregroundColor:C.white}}));
  reqs.push(fmt(1,2,8,NCOLS,{horizontalAlignment:'RIGHT',textFormat:{fontSize:9,foregroundColor:C.white}}));

  // ── R2: ESPACIO (invisible) ───────────────────────────────────
  reqs.push(rowH(2,3,2));
  reqs.push(fmt(2,3,0,NCOLS,{backgroundColor:C.page}));

  // ── R3: HEADER FILTRO ─────────────────────────────────────────
  reqs.push(rowH(3,4,32));
  reqs.push(merge(3,4,0,NCOLS));
  reqs.push(fmt(3,4,0,NCOLS,{
    backgroundColor:C.orange,
    textFormat:{bold:true,fontSize:12,foregroundColor:C.white},
    horizontalAlignment:'LEFT',verticalAlignment:'MIDDLE',
  }));

  // ── R4: BARRA DE FILTRO ───────────────────────────────────────
  reqs.push(rowH(4,5,40));
  // Fondo completo de la fila
  reqs.push(fmt(4,5,0,NCOLS,{backgroundColor:C.filterBg,verticalAlignment:'MIDDLE'}));

  // "Período:" label (A5)
  reqs.push(fmt(4,5,0,1,{
    backgroundColor:C.filterBg,
    textFormat:{bold:true,fontSize:10,foregroundColor:C.darkGray},
    horizontalAlignment:'RIGHT',verticalAlignment:'MIDDLE',
  }));

  // Celda dropdown B5-C5 → borde naranja, texto naranja bold
  reqs.push(merge(4,5,1,3));
  reqs.push(fmt(4,5,1,3,{
    backgroundColor:C.white,
    textFormat:{bold:true,fontSize:11,foregroundColor:C.orange},
    horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',
    borders:{
      top:   bord(C.orange,'SOLID_MEDIUM'),
      bottom:bord(C.orange,'SOLID_MEDIUM'),
      left:  bord(C.orange,'SOLID_MEDIUM'),
      right: bord(C.orange,'SOLID_MEDIUM'),
    },
  }));

  // "Desde:" label (E5)
  reqs.push(fmt(4,5,4,5,{
    backgroundColor:C.filterBg,
    textFormat:{bold:true,fontSize:9,foregroundColor:C.midGray},
    horizontalAlignment:'RIGHT',verticalAlignment:'MIDDLE',
  }));

  // Input fecha desde (F5)
  reqs.push(fmt(4,5,5,6,{
    backgroundColor:C.white,
    textFormat:{fontSize:10,foregroundColor:C.darkGreen},
    horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',
    borders:{
      top:bord(C.lightGreen,'SOLID'),bottom:bord(C.lightGreen,'SOLID'),
      left:bord(C.lightGreen,'SOLID'),right:bord(C.lightGreen,'SOLID'),
    },
  }));

  // "Hasta:" label (G5 → col 6... wait, E=4,F=5,G=6)
  // Aclaración layout R4:
  //  col 0=A "Período:" | col 1-2=B-C dropdown | col3=D spacer
  //  col 4=E "Desde:" | col 5=F fecha-desde | col 6=G "Hasta:" | col 7=H fecha-hasta
  //  col 8=I spacer | col 9-10=J-K rango activo

  // "Hasta:" label (G5 = col 6)
  reqs.push(fmt(4,5,6,7,{
    backgroundColor:C.filterBg,
    textFormat:{bold:true,fontSize:9,foregroundColor:C.midGray},
    horizontalAlignment:'RIGHT',verticalAlignment:'MIDDLE',
  }));

  // Input fecha hasta (H5 = col 7)  — nota: H es el spacer pero aquí lo usamos de input
  // Para que se vea bien, hacemos E5 y H5 los inputs
  // Pero col 3 = D spacer y col 7 = H spacer → reorganizamos el layout real:
  // A(0)="Período:" B-C(1-2)=dropdown D(3)=spacer E(4)="Desde:" F(5)=date-desde G(6)="Hasta:" H(7)=date-hasta I(8)=spacer J-K(9-10)=rango
  // → El input de hasta queda en col 7 = la col H que normalmente es spacer
  // Así que ponemos el input de hasta en col 7 (H):
  reqs.push(fmt(4,5,7,8,{
    backgroundColor:C.white,
    textFormat:{fontSize:10,foregroundColor:C.darkGreen},
    horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',
    borders:{
      top:bord(C.lightGreen,'SOLID'),bottom:bord(C.lightGreen,'SOLID'),
      left:bord(C.lightGreen,'SOLID'),right:bord(C.lightGreen,'SOLID'),
    },
  }));

  // Rango activo J-K (cols 9-10)
  reqs.push(merge(4,5,9,NCOLS));
  reqs.push(fmt(4,5,9,NCOLS,{
    backgroundColor:C.filterBg,
    textFormat:{bold:true,fontSize:9,foregroundColor:C.orange},
    horizontalAlignment:'RIGHT',verticalAlignment:'MIDDLE',
  }));

  // Spacer en barra de filtro (I = col 8)
  reqs.push(fmt(4,5,8,9,{backgroundColor:C.filterBg}));

  // ── R5: HELPER ROW → INVISIBLE ────────────────────────────────
  // Altura mínima (2px) y texto blanco sobre fondo de página = no se ve
  reqs.push(rowH(5,6,2));
  reqs.push(fmt(5,6,0,NCOLS,{
    backgroundColor:C.page,
    textFormat:{fontSize:1,foregroundColor:C.page},
  }));

  // ── R6: ESPACIO (invisible) ───────────────────────────────────
  reqs.push(rowH(6,7,2));
  reqs.push(fmt(6,7,0,NCOLS,{backgroundColor:C.page}));

  // ── R7–R8: KPIs ───────────────────────────────────────────────
  reqs.push(rowH(7,8,28));
  reqs.push(rowH(8,9,66));

  // 4 bloques de KPI: (0-2), (3-5), (6-8), (9-10)
  // Usamos las 3 cols de cada sección como bloque de KPI
  const kpiRanges = [[0,3],[3,6],[6,9],[9,NCOLS]];
  for(const [c0,c1] of kpiRanges){
    reqs.push(merge(7,8,c0,c1));
    reqs.push(merge(8,9,c0,c1));
  }
  reqs.push(fmt(7,8,0,NCOLS,{
    backgroundColor:C.orange,
    textFormat:{bold:true,fontSize:10,foregroundColor:C.white},
    horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',
  }));
  reqs.push(fmt(8,9,0,NCOLS,{
    backgroundColor:C.paleOrange,
    textFormat:{bold:true,fontSize:26,foregroundColor:C.orange},
    horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',
  }));
  // Separadores entre KPIs
  for(const col of [2,5,8]){
    reqs.push(fmt(7,9,col,col+1,{backgroundColor:C.page}));
  }

  // ── R9: ESPACIO (invisible) ───────────────────────────────────
  reqs.push(rowH(9,10,2));
  reqs.push(fmt(9,10,0,NCOLS,{backgroundColor:C.page}));

  // ── FUNCIÓN: formatear una sección de distribución ────────────
  function fmtSection(secHR, colHR, dataS, dataE, totR){
    // Fondo blanco para toda la sección (crea el efecto "tarjeta")
    reqs.push(fmt(secHR,totR+1,0,3,{backgroundColor:C.white}));
    reqs.push(fmt(secHR,totR+1,4,7,{backgroundColor:C.white}));
    reqs.push(fmt(secHR,totR+1,8,NCOLS,{backgroundColor:C.white}));
    // Divisores siguen siendo color página
    reqs.push(fmt(secHR,totR+1,3,4,{backgroundColor:C.page}));
    reqs.push(fmt(secHR,totR+1,7,8,{backgroundColor:C.page}));

    // Header de sección
    reqs.push(rowH(secHR,secHR+1,32));
    for(const [c0,c1] of [[0,3],[4,7],[8,NCOLS]]){
      reqs.push(merge(secHR,secHR+1,c0,c1));
      reqs.push(fmt(secHR,secHR+1,c0,c1,{
        backgroundColor:C.midGreen,
        textFormat:{bold:true,fontSize:11,foregroundColor:C.white},
        horizontalAlignment:'LEFT',verticalAlignment:'MIDDLE',
      }));
    }

    // Col headers
    reqs.push(rowH(colHR,colHR+1,24));
    reqs.push(fmt(colHR,colHR+1,0,NCOLS,{
      backgroundColor:C.lightGreen,
      textFormat:{bold:true,fontSize:9,foregroundColor:C.white},
      horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',
    }));
    // Labels de col → alineados a la izquierda
    for(const c of [0,4,8]) reqs.push(fmt(colHR,colHR+1,c,c+1,{horizontalAlignment:'LEFT',textFormat:{bold:true,fontSize:9,foregroundColor:C.white}}));
    // Divisores en col headers
    for(const c of [3,7]) reqs.push(fmt(colHR,colHR+1,c,c+1,{backgroundColor:C.page}));

    // Filas de datos
    for(let r=dataS;r<dataE;r++){
      const bg = (r-dataS)%2===0 ? C.white : C.altRow;
      reqs.push(rowH(r,r+1,22));
      // Sección 1 (A-C)
      reqs.push(fmt(r,r+1,0,1,{backgroundColor:bg,textFormat:{fontSize:9,foregroundColor:C.darkGray},verticalAlignment:'MIDDLE',horizontalAlignment:'LEFT'}));
      reqs.push(fmt(r,r+1,1,2,{backgroundColor:bg,textFormat:{bold:true,fontSize:9,foregroundColor:C.darkGray},verticalAlignment:'MIDDLE',horizontalAlignment:'CENTER'}));
      reqs.push(fmt(r,r+1,2,3,{backgroundColor:bg,textFormat:{fontSize:9,foregroundColor:C.pctGreen},verticalAlignment:'MIDDLE',horizontalAlignment:'CENTER'}));
      // Sección 2 (E-G)
      reqs.push(fmt(r,r+1,4,5,{backgroundColor:bg,textFormat:{fontSize:9,foregroundColor:C.darkGray},verticalAlignment:'MIDDLE',horizontalAlignment:'LEFT'}));
      reqs.push(fmt(r,r+1,5,6,{backgroundColor:bg,textFormat:{bold:true,fontSize:9,foregroundColor:C.darkGray},verticalAlignment:'MIDDLE',horizontalAlignment:'CENTER'}));
      reqs.push(fmt(r,r+1,6,7,{backgroundColor:bg,textFormat:{fontSize:9,foregroundColor:C.pctGreen},verticalAlignment:'MIDDLE',horizontalAlignment:'CENTER'}));
      // Sección 3 (I-K)
      reqs.push(fmt(r,r+1,8,9,{backgroundColor:bg,textFormat:{fontSize:9,foregroundColor:C.darkGray},verticalAlignment:'MIDDLE',horizontalAlignment:'LEFT'}));
      reqs.push(fmt(r,r+1,9,10,{backgroundColor:bg,textFormat:{bold:true,fontSize:9,foregroundColor:C.darkGray},verticalAlignment:'MIDDLE',horizontalAlignment:'CENTER'}));
      reqs.push(fmt(r,r+1,10,11,{backgroundColor:bg,textFormat:{fontSize:9,foregroundColor:C.pctGreen},verticalAlignment:'MIDDLE',horizontalAlignment:'CENTER'}));
      // Divisores
      reqs.push(fmt(r,r+1,3,4,{backgroundColor:C.page}));
      reqs.push(fmt(r,r+1,7,8,{backgroundColor:C.page}));
    }

    // Fila TOTAL
    reqs.push(rowH(totR,totR+1,26));
    for(const [c0,c1] of [[0,3],[4,7],[8,NCOLS]]){
      reqs.push(fmt(totR,totR+1,c0,c1,{
        backgroundColor:C.paleGreen,
        textFormat:{bold:true,fontSize:9,foregroundColor:C.midGreen},
        verticalAlignment:'MIDDLE',
      }));
      reqs.push(fmt(totR,totR+1,c0,c0+1,{horizontalAlignment:'LEFT'}));
      reqs.push(fmt(totR,totR+1,c0+1,c0+2,{horizontalAlignment:'CENTER'}));
      reqs.push(fmt(totR,totR+1,c0+2,c1,{horizontalAlignment:'CENTER'}));
    }
    reqs.push(fmt(totR,totR+1,3,4,{backgroundColor:C.page}));
    reqs.push(fmt(totR,totR+1,7,8,{backgroundColor:C.page}));
  }

  // Calcular posiciones sección 1
  const maxS1 = Math.max(TIPOS_NEGOCIO.length, RANGOS_EMP.length, DIAS.length); // 13
  fmtSection(10, 11, 12, 12+maxS1, 12+maxS1);

  // Separador entre secciones (invisible)
  const sep1 = 12+maxS1+1;
  reqs.push(rowH(sep1,sep1+1,2));
  reqs.push(fmt(sep1,sep1+1,0,NCOLS,{backgroundColor:C.page}));

  // Sección 2
  const maxS2 = Math.max(CARGOS.length, ESTADOS.length, TIPOS_CONTRIB.length); // 10
  const s2H   = sep1+1;
  fmtSection(s2H, s2H+1, s2H+2, s2H+2+maxS2, s2H+2+maxS2);

  // Separador (invisible)
  const sep2 = s2H+2+maxS2+1;
  reqs.push(rowH(sep2,sep2+1,2));
  reqs.push(fmt(sep2,sep2+1,0,NCOLS,{backgroundColor:C.page}));

  // ── TABLA ÚLTIMAS COTIZACIONES ─────────────────────────────────
  const recH = sep2+1;

  // Header tabla
  reqs.push(rowH(recH,recH+1,34));
  reqs.push(merge(recH,recH+1,0,NCOLS));
  reqs.push(fmt(recH,recH+1,0,NCOLS,{
    backgroundColor:C.darkGreen,
    textFormat:{bold:true,fontSize:12,foregroundColor:C.white},
    horizontalAlignment:'LEFT',verticalAlignment:'MIDDLE',
  }));

  // Col headers tabla
  const recColH = recH+1;
  reqs.push(rowH(recColH,recColH+1,24));
  reqs.push(fmt(recColH,recColH+1,0,NCOLS,{backgroundColor:C.page}));
  // Cols A-C (0-3) y E-G (4-7) con lightGreen; D (3) queda como página (spacer invisible)
  reqs.push(fmt(recColH,recColH+1,0,3,{
    backgroundColor:C.lightGreen,
    textFormat:{bold:true,fontSize:9,foregroundColor:C.white},
    horizontalAlignment:'LEFT',verticalAlignment:'MIDDLE',
  }));
  reqs.push(fmt(recColH,recColH+1,4,7,{
    backgroundColor:C.lightGreen,
    textFormat:{bold:true,fontSize:9,foregroundColor:C.white},
    horizontalAlignment:'LEFT',verticalAlignment:'MIDDLE',
  }));
  reqs.push(fmt(recColH,recColH+1,3,4,{backgroundColor:C.page}));  // D spacer
  reqs.push(fmt(recColH,recColH+1,7,NCOLS,{backgroundColor:C.page}));

  // Filas de datos de la tabla
  // Fondo = página para todas las filas → las filas vacías son invisibles (se mezclan con el fondo)
  // Las filas con datos muestran texto oscuro legible sobre el fondo suave de página
  for(let i=0;i<10;i++){
    const r = recColH+1+i;
    reqs.push(rowH(r,r+1,22));
    reqs.push(fmt(r,r+1,0,7,{backgroundColor:C.page,textFormat:{fontSize:9,foregroundColor:C.darkGray},verticalAlignment:'MIDDLE',wrapStrategy:'CLIP'}));
    reqs.push(fmt(r,r+1,0,1,{horizontalAlignment:'LEFT'}));   // Fecha → izquierda
    reqs.push(fmt(r,r+1,1,4,{horizontalAlignment:'LEFT'}));   // Nombre/Cargo/spacer → izquierda
    reqs.push(fmt(r,r+1,4,7,{horizontalAlignment:'LEFT'}));   // Ciudad/NIT/Estado → izquierda
    reqs.push(fmt(r,r+1,7,NCOLS,{backgroundColor:C.page}));
  }

  // Separador antes del footer (invisible)
  const preFooterR = recColH+11;
  reqs.push(rowH(preFooterR,preFooterR+1,2));
  reqs.push(fmt(preFooterR,preFooterR+1,0,NCOLS,{backgroundColor:C.page}));

  // Footer
  const footerR = recColH+12;
  reqs.push(rowH(footerR,footerR+1,24));
  reqs.push(merge(footerR,footerR+1,0,NCOLS));
  reqs.push(fmt(footerR,footerR+1,0,NCOLS,{
    backgroundColor:C.midGreen,
    textFormat:{italic:true,fontSize:9,foregroundColor:C.white},
    horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',
  }));

  // ── Ocultar líneas de cuadrícula ──────────────────────────────
  reqs.push({
    updateSheetProperties:{
      properties:{sheetId:sid,gridProperties:{hideGridlines:true,frozenRowCount:0}},
      fields:'gridProperties(hideGridlines,frozenRowCount)',
    }
  });

  return reqs;
}

// ── Data validation ────────────────────────────────────────────────────────
function buildValidation(sid){
  return [{
    setDataValidation:{
      range:{sheetId:sid,startRowIndex:4,endRowIndex:5,startColumnIndex:1,endColumnIndex:3},
      rule:{
        condition:{ type:'ONE_OF_LIST', values:PERIOD_OPTIONS.map(v=>({userEnteredValue:v})) },
        showCustomUi:true, strict:true,
      },
    },
  }];
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main(){
  console.log('🔗 Conectando a Google Sheets...');
  const auth   = new google.auth.GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/spreadsheets']});
  const sheets = google.sheets({version:'v4',auth});

  const meta   = await sheets.spreadsheets.get({spreadsheetId:SHEET_ID});
  const allSh  = meta.data.sheets||[];

  const existing = allSh.find(s=>s.properties.title===DASH);
  if(existing){
    console.log('🗑  Eliminando DASHBOARD anterior...');
    await sheets.spreadsheets.batchUpdate({spreadsheetId:SHEET_ID,requestBody:{requests:[{deleteSheet:{sheetId:existing.properties.sheetId}}]}});
  }

  console.log('📊 Creando tab DASHBOARD...');
  const cr = await sheets.spreadsheets.batchUpdate({
    spreadsheetId:SHEET_ID,
    requestBody:{requests:[{addSheet:{properties:{title:DASH,index:0,tabColor:{red:0.176,green:0.416,blue:0.310},gridProperties:{rowCount:200,columnCount:NCOLS}}}}]},
  });
  const dashId = cr.data.replies[0].addSheet.properties.sheetId;

  console.log('✍️  Escribiendo fórmulas...');
  const data = buildRows();
  await sheets.spreadsheets.values.update({
    spreadsheetId:SHEET_ID, range:`${DASH}!A1`,
    valueInputOption:'USER_ENTERED', requestBody:{values:data},
  });

  console.log('🎨 Aplicando formato visual...');
  const fmtReqs = buildFormatRequests(dashId);
  for(let i=0;i<fmtReqs.length;i+=50){
    await sheets.spreadsheets.batchUpdate({spreadsheetId:SHEET_ID,requestBody:{requests:fmtReqs.slice(i,i+50)}});
  }

  console.log('🔽 Configurando dropdown...');
  await sheets.spreadsheets.batchUpdate({spreadsheetId:SHEET_ID,requestBody:{requests:buildValidation(dashId)}});

  console.log('');
  console.log('✅ Dashboard visual perfecto generado.');
  console.log(`   → https://docs.google.com/spreadsheets/d/${SHEET_ID}`);
  console.log('');
  console.log('   Cómo usar el filtro:');
  console.log('   • Celda B5: dropdown de período (Hoy / Esta semana / Este mes / ...)');
  console.log('   • Celdas F5 y H5: fechas manuales cuando eliges "Personalizado"');
  console.log('   • Todo el dashboard se recalcula automáticamente.');
}

main().catch(err=>{
  console.error('❌',err.message);
  if(err.response?.data) console.error(JSON.stringify(err.response.data,null,2));
  process.exit(1);
});
