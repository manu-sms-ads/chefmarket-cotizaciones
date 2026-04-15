# Guía de configuración y despliegue
## Chef Market Colombia — Formulario de Cotizaciones

---

## Resumen de lo que se construyó

| Qué | Cómo |
|---|---|
| Formulario multi-paso (2 pasos + confirmación) | Next.js + React + Tailwind CSS |
| Carga y procesamiento del RUT (DIAN PDF) | pdf-parse + parser propio |
| Almacenamiento de datos | Google Sheets (1 fila por solicitud) |
| Hosting | Vercel (gratis, con soporte de subdominio) |
| Zona horaria | Colombia (UTC-5), automático |

---

## Paso 1 — Crear la cuenta de servicio de Google

Necesitas una **cuenta de servicio** para que el servidor escriba en Google Sheets sin login manual.

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo (ej: `chefmarket-cotizaciones`)
3. Ve a **APIs y Servicios → Biblioteca** y habilita:
   - **Google Sheets API**
4. Ve a **APIs y Servicios → Credenciales → Crear credenciales → Cuenta de servicio**
   - Nombre: `chefmarket-sheets`
   - Rol: `Editor` (o un rol personalizado con permiso `sheets.spreadsheets`)
5. Una vez creada, abre la cuenta de servicio → pestaña **Claves** → **Agregar clave → JSON**
6. Descarga el archivo JSON — guárdalo en un lugar seguro (NO lo subas a Git)

---

## Paso 2 — Crear el Google Sheet

1. Ve a [sheets.google.com](https://sheets.google.com) y crea una hoja nueva
2. Nómbrala como quieras (ej: `Chef Market - Cotizaciones 2025`)
3. **Comparte** la hoja con el email de la cuenta de servicio (lo encontrarás en el JSON descargado, campo `client_email`)
   - Permiso: **Editor**
4. Copia el **ID** de la hoja desde la URL:
   ```
   https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
   ```

---

## Paso 3 — Configurar variables de entorno

Copia `.env.local.example` y renómbralo a `.env.local`:

```bash
cp .env.local.example .env.local
```

Abre `.env.local` y completa con los valores del JSON de la cuenta de servicio:

```env
GOOGLE_SHEET_ID=ID_copiado_del_paso_anterior
GOOGLE_SHEET_NAME=Cotizaciones
GOOGLE_PROJECT_ID=valor del JSON → project_id
GOOGLE_PRIVATE_KEY_ID=valor del JSON → private_key_id
GOOGLE_PRIVATE_KEY=valor del JSON → private_key  (incluyendo -----BEGIN...-----)
GOOGLE_CLIENT_EMAIL=valor del JSON → client_email
GOOGLE_CLIENT_ID=valor del JSON → client_id
```

> ⚠️ **Importante con `GOOGLE_PRIVATE_KEY`**: en el archivo JSON los saltos de línea aparecen como `\n` literales. Cópialos exactamente igual en `.env.local`, incluyendo las comillas dobles.

---

## Paso 4 — Correr localmente

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — deberías ver el formulario.

Prueba subir un PDF del RUT y verifica que aparezca una nueva fila en tu Google Sheet.

---

## Paso 5 — Desplegar en Vercel

### 5a. Subir el código a GitHub

```bash
git init
git add .
git commit -m "feat: formulario de cotizaciones Chef Market"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/chefmarket-cotizaciones.git
git push -u origin main
```

### 5b. Importar en Vercel

1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Importa el repositorio de GitHub
3. Framework: **Next.js** (se detecta automático)
4. **Environment Variables**: agrega cada variable de `.env.local` en la sección de variables de Vercel

### 5c. Conectar el subdominio

1. En Vercel → tu proyecto → **Settings → Domains**
2. Agrega: `cotizaciones.chefmarketcolombia.com`
3. Vercel te dará un registro DNS para agregar
4. Ve al panel de DNS de tu dominio (donde está registrado `chefmarketcolombia.com`)
5. Agrega un registro **CNAME**:
   - Nombre: `cotizaciones`
   - Valor: `cname.vercel-dns.com`
6. En 5-10 minutos el subdominio estará activo con HTTPS automático

---

## Estructura de columnas en Google Sheets

La primera vez que llegue una solicitud, el sistema crea automáticamente los encabezados:

| Columna | Descripción |
|---|---|
| Fecha y Hora (Colombia) | Timestamp completo — ej: `2025-03-14 09:30:45` |
| Fecha | Solo la fecha — `14/03/2025` |
| Hora | Solo la hora — `09:30:45` |
| Día de la Semana | `Lunes`, `Martes`… |
| Semana del Año | `Semana 11` |
| Nombre Responsable | Del formulario paso 1 |
| Cargo | Del formulario |
| Teléfono / WhatsApp | Del formulario |
| Correo Electrónico | Del formulario |
| Ciudad | Del formulario |
| Tipo de Negocio | Del formulario |
| N° Empleados | Del formulario (opcional) |
| Mensaje / Intereses | Del formulario (opcional) |
| NIT | Del RUT |
| Dígito de Verificación | Del RUT |
| NIT Completo | `NIT-DV` — ej: `900123456-7` |
| Razón Social | Del RUT |
| Nombre Comercial | Del RUT |
| Tipo de Contribuyente | Del RUT |
| Tipo de Documento | Del RUT |
| Dirección Principal | Del RUT |
| Municipio (RUT) | Del RUT |
| Departamento (RUT) | Del RUT |
| Código Postal | Del RUT |
| Teléfono Empresa (RUT) | Del RUT |
| Correo Empresa (RUT) | Del RUT |
| Actividad Económica (CIIU) | Del RUT — código + descripción |
| Responsabilidades Tributarias | Del RUT |
| Fecha Inscripción RUT | Del RUT |
| Fecha Última Actualización RUT | Del RUT |
| Nombre Archivo RUT | Nombre del PDF subido |
| Campos RUT Extraídos | Ej: `12 / 15` (cuántos campos se lograron extraer) |
| Estado | `Pendiente revisión` (puedes cambiarlo manualmente) |

---

## Preguntas frecuentes

**¿Qué pasa si el RUT no se puede leer bien?**
El formulario igual se envía y los campos del RUT quedan vacíos. El cliente habrá dejado su información de contacto para hacer seguimiento manual.

**¿Puedo cambiar los campos del formulario?**
Sí — edita `components/StepOne.js` para agregar o quitar campos de contacto. Recuerda agregar las columnas correspondientes en `lib/googleSheets.js`.

**¿Puedo personalizar los colores?**
Sí — edita `tailwind.config.js`, la sección `colors.brand`. El color base es naranja (#f97316). Reemplázalo por el código hex del color corporativo de Chef Market.

**¿Se puede agregar el logo?**
Sí — coloca el logo en `public/logo.png` y en `pages/index.js` reemplaza el bloque `{/* Logo placeholder */}` por:
```jsx
<img src="/logo.png" alt="Chef Market Colombia" className="h-12 mx-auto" />
```
