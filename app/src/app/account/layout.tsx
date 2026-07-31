import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { requirePatient } from '@/lib/auth/guards';
import { ClinicBrand } from '@/components/domain/brand-mark';
import { LanguageSwitcher } from '@/components/domain/language-switcher';
import { PatientMobileNav } from '@/components/domain/patient-mobile-nav';
import { getLocale } from '@/lib/i18n-server';
import { AccountTopNav } from './account-nav';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [patient, locale] = await Promise.all([requirePatient(), getLocale()]);
  const name = patient.firstName
    ? `${patient.firstName} ${patient.lastName ?? ''}`.trim()
    : patient.mobile;

  return (
    <div className="has-mobile-nav min-h-screen bg-background">
      <a
        href="#account-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-3"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-3 px-5 py-2 md:px-8">
          <Link href="/" aria-label="Clinic home" className="min-w-0">
            <ClinicBrand size={32} />
          </Link>
          <div className="ms-auto flex items-center gap-2">
            <AccountTopNav />
            <LanguageSwitcher locale={locale} />
            <div className="flex items-center gap-2 rounded-full border ps-3 pe-1.5 py-1">
              <span className="hidden max-w-[120px] truncate text-xs text-muted-foreground sm:inline">
                {name}
              </span>
              <Link
                href="/api/auth/patient/logout"
                aria-label="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main id="account-content" className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-8">
        {children}
      </main>

      <PatientMobileNav />
    </div>
  );
}
