import { Suspense } from 'react';
import { PatientLoginForm } from './login-form';

export default function PatientLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense fallback={null}>
        <PatientLoginForm />
      </Suspense>
    </main>
  );
}
