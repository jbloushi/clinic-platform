import { Suspense } from 'react';
import { StaffLoginForm } from './login-form';

export default function StaffLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense fallback={null}>
        <StaffLoginForm />
      </Suspense>
    </main>
  );
}
