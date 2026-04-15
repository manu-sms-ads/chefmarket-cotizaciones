import { useState } from 'react';

const CARGO_OPTIONS = [
  'Propietario / Dueño',
  'Gerente General',
  'Gerente Administrativo',
  'Gerente de Compras',
  'Director de Logística',
  'Jefe de Cocina',
  'Administrador',
  'Contador',
  'Asistente Administrativo',
  'Otro',
];

const TIPO_NEGOCIO_OPTIONS = [
  'Restaurante',
  'Hotel',
  'Cafetería / Coffee Shop',
  'Panadería / Pastelería',
  'Dark Kitchen / Cocina en la Nube',
  'Catering / Servicios de Alimentación',
  'Casino Empresarial',
  'Supermercado / Minimercado',
  'Distribuidora de Alimentos',
  'Club / Evento',
  'Institución Educativa',
  'Clínica / Hospital',
  'Otro',
];

export default function StepOne({ data, onChange, onNext }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!data.nombreResponsable?.trim()) newErrors.nombreResponsable = 'Campo requerido';
    if (!data.cargo?.trim()) newErrors.cargo = 'Campo requerido';
    if (!data.telefono?.trim()) newErrors.telefono = 'Campo requerido';
    else if (!/^[0-9+\-\s()]{7,15}$/.test(data.telefono.trim()))
      newErrors.telefono = 'Número de teléfono inválido';
    if (!data.email?.trim()) newErrors.email = 'Campo requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))
      newErrors.email = 'Correo electrónico inválido';
    if (!data.tipoNegocio?.trim()) newErrors.tipoNegocio = 'Campo requerido';
    if (!data.ciudad?.trim()) newErrors.ciudad = 'Campo requerido';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    onNext();
  };

  const handleChange = (field, value) => {
    onChange(field, value);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in-up space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Datos del responsable</h2>
        <p className="text-sm text-gray-500 mt-1">
          Cuéntanos quién está solicitando la cotización y cómo contactarte.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nombre completo */}
        <div className="sm:col-span-2">
          <label className="input-label" htmlFor="nombreResponsable">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            id="nombreResponsable"
            type="text"
            className={`input-field ${errors.nombreResponsable ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="Ej: María González Pérez"
            value={data.nombreResponsable || ''}
            onChange={(e) => handleChange('nombreResponsable', e.target.value)}
          />
          {errors.nombreResponsable && (
            <p className="text-red-500 text-xs mt-1">{errors.nombreResponsable}</p>
          )}
        </div>

        {/* Cargo */}
        <div>
          <label className="input-label" htmlFor="cargo">
            Cargo <span className="text-red-500">*</span>
          </label>
          <select
            id="cargo"
            className={`input-field ${errors.cargo ? 'border-red-400 focus:ring-red-400' : ''}`}
            value={data.cargo || ''}
            onChange={(e) => handleChange('cargo', e.target.value)}
          >
            <option value="">Selecciona un cargo</option>
            {CARGO_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errors.cargo && <p className="text-red-500 text-xs mt-1">{errors.cargo}</p>}
        </div>

        {/* Tipo de negocio */}
        <div>
          <label className="input-label" htmlFor="tipoNegocio">
            Tipo de negocio <span className="text-red-500">*</span>
          </label>
          <select
            id="tipoNegocio"
            className={`input-field ${errors.tipoNegocio ? 'border-red-400 focus:ring-red-400' : ''}`}
            value={data.tipoNegocio || ''}
            onChange={(e) => handleChange('tipoNegocio', e.target.value)}
          >
            <option value="">Selecciona el tipo</option>
            {TIPO_NEGOCIO_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errors.tipoNegocio && (
            <p className="text-red-500 text-xs mt-1">{errors.tipoNegocio}</p>
          )}
        </div>

        {/* Teléfono */}
        <div>
          <label className="input-label" htmlFor="telefono">
            Teléfono / WhatsApp <span className="text-red-500">*</span>
          </label>
          <input
            id="telefono"
            type="tel"
            className={`input-field ${errors.telefono ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="Ej: 3001234567"
            value={data.telefono || ''}
            onChange={(e) => handleChange('telefono', e.target.value)}
          />
          {errors.telefono && <p className="text-red-500 text-xs mt-1">{errors.telefono}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="input-label" htmlFor="email">
            Correo electrónico <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            className={`input-field ${errors.email ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="correo@empresa.com"
            value={data.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* Ciudad */}
        <div>
          <label className="input-label" htmlFor="ciudad">
            Ciudad <span className="text-red-500">*</span>
          </label>
          <input
            id="ciudad"
            type="text"
            className={`input-field ${errors.ciudad ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="Ej: Bogotá, Medellín, Cali..."
            value={data.ciudad || ''}
            onChange={(e) => handleChange('ciudad', e.target.value)}
          />
          {errors.ciudad && <p className="text-red-500 text-xs mt-1">{errors.ciudad}</p>}
        </div>

        {/* Número de empleados */}
        <div>
          <label className="input-label" htmlFor="numEmpleados">
            N° de empleados aproximado
          </label>
          <select
            id="numEmpleados"
            className="input-field"
            value={data.numEmpleados || ''}
            onChange={(e) => handleChange('numEmpleados', e.target.value)}
          >
            <option value="">Seleccionar (opcional)</option>
            <option value="1-5">1 – 5</option>
            <option value="6-20">6 – 20</option>
            <option value="21-50">21 – 50</option>
            <option value="51-100">51 – 100</option>
            <option value="Más de 100">Más de 100</option>
          </select>
        </div>

        {/* Mensaje adicional */}
        <div className="sm:col-span-2">
          <label className="input-label" htmlFor="mensaje">
            ¿Qué productos o servicios te interesan? <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            id="mensaje"
            rows={3}
            className="input-field resize-none"
            placeholder="Cuéntanos brevemente qué estás buscando o cualquier información relevante para tu cotización..."
            value={data.mensaje || ''}
            onChange={(e) => handleChange('mensaje', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary">
          Continuar
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </form>
  );
}
