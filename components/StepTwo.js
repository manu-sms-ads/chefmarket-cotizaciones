import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import clsx from 'clsx';

export default function StepTwo({ rutFile, onFileChange, onNext, onBack, isSubmitting }) {
  const [error, setError] = useState('');

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      setError('');
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors.some((e) => e.code === 'file-too-large')) {
          setError('El archivo no puede superar los 10 MB.');
        } else if (rejection.errors.some((e) => e.code === 'file-invalid-type')) {
          setError('Solo se aceptan archivos PDF.');
        } else {
          setError('Archivo no válido. Sube el RUT en formato PDF.');
        }
        return;
      }
      if (acceptedFiles.length > 0) {
        onFileChange(acceptedFiles[0]);
      }
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024, // 10 MB
    multiple: false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!rutFile) {
      setError('Por favor carga el RUT de tu negocio antes de continuar.');
      return;
    }
    setError('');
    onNext();
  };

  const removeFile = () => {
    onFileChange(null);
    setError('');
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in-up space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Cargar RUT del negocio</h2>
        <p className="text-sm text-gray-500 mt-1">
          Sube el RUT expedido por la DIAN. Extraeremos automáticamente la información del negocio
          para completar tu solicitud de cotización.
        </p>
      </div>

      {/* Zona de carga */}
      {!rutFile ? (
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-brand-400 bg-brand-50 scale-[1.01]'
              : 'border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className={clsx(
              'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-200',
              isDragActive ? 'bg-brand-100' : 'bg-gray-100'
            )}>
              <svg
                className={clsx('w-7 h-7', isDragActive ? 'text-brand-500' : 'text-gray-400')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            {isDragActive ? (
              <p className="text-brand-600 font-medium text-sm">Suelta el archivo aquí</p>
            ) : (
              <>
                <div>
                  <p className="text-gray-700 font-medium text-sm">
                    Arrastra tu RUT aquí o{' '}
                    <span className="text-brand-500 underline underline-offset-2">selecciona el archivo</span>
                  </p>
                  <p className="text-gray-400 text-xs mt-1">PDF · Máximo 10 MB</p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Vista previa del archivo cargado */
        <div className="border-2 border-brand-200 bg-brand-50 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 4h5v7h7v9H6V4z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{rutFile.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(rutFile.size)} · PDF</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-brand-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-medium">Listo</span>
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar archivo"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Info sobre qué se extrae */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Información que extraeremos del RUT:
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            'NIT y dígito de verificación',
            'Razón social',
            'Nombre comercial',
            'Tipo de contribuyente',
            'Dirección principal',
            'Municipio y departamento',
            'Teléfono y correo',
            'Actividad económica (CIIU)',
            'Responsabilidades tributarias',
            'Fecha de inscripción al RUT',
          ].map((item) => (
            <div key={item} className="flex items-center gap-1.5 text-xs text-amber-700">
              <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Botones de navegación */}
      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-secondary" disabled={isSubmitting}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="spinner" />
              Procesando RUT...
            </>
          ) : (
            <>
              Enviar solicitud
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
