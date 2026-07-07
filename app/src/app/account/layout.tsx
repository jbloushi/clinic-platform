import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { requirePatient } from '@/lib/auth/guards';
import { BrandWordmark } from '@/components/domain/brand-mark';
import { AccountTopNav, AccountBottomNav } from './account-nav';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const patient = await requirePatient();
  const name = patient.firstName ? `${patient.firstName} ${patient.lastName ?? ''}`.trim() : patient.mobile;

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" aria-label="Home">
            <BrandWordmark />
          </Link>
          <div className="flex items-center gap-2">
            <AccountTopNav />
            <div className="flex items-center gap-2 rounded-full border px-3 py-1.5">
              <span className="hidden max-w-[120px] truncate text-xs text-muted-foreground sm:inline">{name}</span>
              <Link
                href="/api/auth/patient/logout"
                aria-label="Sign out"
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:py-8">{children}</main>

      <AccountBottomNav />
    </div>
  );
}
