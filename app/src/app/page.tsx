import Link from 'next/link';
import { ArrowRight, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  // The full patient home is in the "informative screens" batch (built last).
  // For now, a placeholder that routes users into the working parts of the app.
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-full bg-primary/10 p-4 text-primary">
        <Stethoscope className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Clinic Platform</h1>
      <p className="max-w-md text-muted-foreground">
        A modern clinic operating platform. Book a doctor, run the clinic, and provide care — all
        backed by OpenEMR.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/doctors">
            Find a doctor <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/staff/login">Staff sign in</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Demo: patient login uses OTP <code className="rounded bg-muted px-1">123456</code>. Staff logins are seeded.
      </p>
    </main>
  );
}
