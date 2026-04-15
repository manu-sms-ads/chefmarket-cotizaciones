import Head from 'next/head';
import { useState } from 'react';
import toast from 'react-hot-toast';
import StepIndicator from '../components/StepIndicator';
import StepOne from '../components/StepOne';
import StepTwo from '../components/StepTwo';
import StepThree from '../components/StepThree';

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rutFile, setRutFile] = useState(null);
  const [rutData, setRutData] = useState(null);

  const [contactData, setContactData] = useState({
    nombreResponsable: '',
    cargo: '',
    telefono: '',
    email: '',
    tipoNegocio: '',
    ciudad: '',
    numEmpleados: '',
    mensaje: '',
  });

  const handleContactChange = (field, value) => {
    setContactData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const toastId = toast.loading('Procesando tu RUT y enviando información...', {
      style: { minWidth: '280px' },
    });

    try {
      const formData = new FormData();
      formData.append('rut', rutFile);
      Object.entries(contactData).forEach(([key, val]) => {
        formData.append(key, val || '');
      });

      const res = await fetch('/api/submit', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Error al enviar la solicitud');
      }

      setRutData(result.rutData || {});
      toast.success('¡Solicitud enviada correctamente!', { id: toastId });
      setCurrentStep(3);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Ocurrió un error. Inténtalo de nuevo.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Solicitar Cotización · Chef Market Colombia</title>
        <meta
          name="description"
          content="Completa el formulario para solicitar una cotización personalizada de productos Chef Market Colombia."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Background decorativo */}
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 relative">
        {/* Blob decorativo superior */}
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 w-96 h-96 bg-brand-100 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 w-80 h-80 bg-amber-100 rounded-full blur-3xl opacity-40 translate-y-1/2 -translate-x-1/2 pointer-events-none"
        />

        <div className="relative z-10 max-w-2xl mx-auto px-4 py-10 md:py-16">
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img
                src="/logo-chefmarket.jpg"
                alt="Chef Market Colombia"
                className="h-20 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
              Solicita tu cotización
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              Completa el formulario y recibirás una propuesta personalizada en menos de 48 horas.
            </p>
          </div>

          {/* Card del formulario */}
          <div className="card">
            {currentStep < 3 && <StepIndicator currentStep={currentStep} />}

            {currentStep === 1 && (
              <StepOne
                data={contactData}
                onChange={handleContactChange}
                onNext={() => setCurrentStep(2)}
              />
            )}

            {currentStep === 2 && (
              <StepTwo
                rutFile={rutFile}
                onFileChange={setRutFile}
                onNext={handleSubmit}
                onBack={() => setCurrentStep(1)}
                isSubmitting={isSubmitting}
              />
            )}

            {currentStep === 3 && (
              <StepThree rutData={rutData} contactData={contactData} />
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} Chef Market Colombia · Tu información está protegida y es confidencial.
          </p>
        </div>
      </div>
    </>
  );
}
