import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requirePatient } from '@/lib/auth/guards';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const patient = await requirePatient();
  const name = patient.firstName ? `${patient.firstName} ${patient.lastName ?? ''}`.trim() : patient.mobile;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">Clinic Platform</Link>
        <nav className="flex items-center gap-1 text-sm">
          <Button asChild variant="ghost" size="sm"><Link href="/account/appointments">Appointments</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link href="/account/records">Records</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link href="/account/profile">Profile</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link href="/doctors">Book</Link></Button>
          <div className="ml-2 flex items-center gap-2 rounded-md border px-3 py-1.5">
            <span className="text-xs text-muted-foreground">{name}</span>
            <Link href="/api/auth/patient/logout" aria-label="Sign out">
              <LogOut className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </Link>
          </div>
        </nav>
      </header>
      <main className="space-y-6">{children}</main>
    </div>
  );
}
