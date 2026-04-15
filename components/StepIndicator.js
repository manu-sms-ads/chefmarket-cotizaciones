import clsx from 'clsx';

const steps = [
  { number: 1, label: 'Datos de contacto' },
  { number: 2, label: 'Cargar RUT' },
  { number: 3, label: 'Confirmación' },
];

export default function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          {/* Círculo del paso */}
          <div className="flex flex-col items-center">
            <div
              className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                currentStep > step.number
                  ? 'bg-brand-500 text-white shadow-md'
                  : currentStep === step.number
                  ? 'bg-brand-500 text-white shadow-lg ring-4 ring-brand-100'
                  : 'bg-gray-200 text-gray-400'
              )}
            >
              {currentStep > step.number ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span
              className={clsx(
                'mt-1.5 text-xs font-medium whitespace-nowrap hidden sm:block',
                currentStep >= step.number ? 'text-brand-600' : 'text-gray-400'
              )}
            >
              {step.label}
            </span>
          </div>

          {/* Línea conectora */}
          {index < steps.length - 1 && (
            <div
              className={clsx(
                'h-0.5 w-16 md:w-24 mx-2 transition-all duration-500 mb-4',
                currentStep > step.number ? 'bg-brand-500' : 'bg-gray-200'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
