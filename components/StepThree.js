export default function StepThree({ rutData, contactData }) {
  const fields = [
    { label: 'NIT', value: rutData?.nit ? `${rutData.nit}${rutData.digitoVerificacion ? `-${rutData.digitoVerificacion}` : ''}` : null },
    { label: 'Razón Social', value: rutData?.razonSocial },
    { label: 'Nombre Comercial', value: rutData?.nombreComercial },
    { label: 'Tipo de Contribuyente', value: rutData?.tipoContribuyente },
    { label: 'Dirección', value: rutData?.direccion },
    { label: 'Municipio', value: rutData?.municipio },
    { label: 'Departamento', value: rutData?.departamento },
    { label: 'Teléfono empresa', value: rutData?.telefonoEmpresa },
    { label: 'Correo empresa', value: rutData?.correoEmpresa },
    { label: 'Actividad Económica', value: rutData?.actividadEconomica },
    { label: 'Responsabilidades', value: rutData?.responsabilidades },
    { label: 'Fecha inscripción RUT', value: rutData?.fechaInscripcion },
  ].filter((f) => f.value);

  return (
    <div className="animate-fade-in-up text-center space-y-6">
      {/* Ícono de éxito */}
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">¡Solicitud enviada!</h2>
        <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
          Recibimos tu información. Nuestro equipo revisará tu solicitud y se pondrá en contacto
          con <span className="font-medium text-gray-700">{contactData?.email}</span> a la brevedad.
        </p>
      </div>

      {/* Resumen de datos extraídos del RUT */}
      {fields.length > 0 && (
        <div className="text-left bg-gray-50 rounded-2xl p-5 border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Datos extraídos de tu RUT
          </p>
          <div className="space-y-2">
            {fields.map(({ label, value }) => (
              <div key={label} className="flex gap-2 text-sm">
                <span className="text-gray-400 min-w-[140px] flex-shrink-0">{label}:</span>
                <span className="text-gray-800 font-medium break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nota informativa */}
      <div className="flex items-start gap-2 p-4 bg-brand-50 border border-brand-100 rounded-xl text-left">
        <svg
          className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-brand-700">
          Todos tus datos quedan registrados de forma segura. El equipo de Chef Market Colombia
          estará en contacto en un plazo máximo de <strong>24–48 horas hábiles</strong>.
        </p>
      </div>

      <a
        href="https://www.chefmarketcolombia.com"
        className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Volver al sitio principal
      </a>
    </div>
  );
}
