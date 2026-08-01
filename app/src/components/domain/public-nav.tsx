import Link from 'next/link';
import { CalendarDays, Menu, Phone, ShieldCheck } from 'lucide-react';
import { ClinicBrand, CLINIC_NAME } from './brand-mark';
import { LanguageSwitcher } from './language-switcher';
import { PublicNavLinks, PublicNavMenuLinks } from './public-nav-links';
import { Button } from '@/components/ui/button';
import { getLocale } from '@/lib/i18n-server';

/**
 * Marketing header and footer for the patient site.
 *
 * Kept apart from `PatientShell` so the shell can compose them without the two
 * modules importing each other.
 */
export async function PublicHeader() {
  const locale = await getLocale();

  return (
    <header className="sticky top-0 z-40 border-b bg-surface-soft/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2">
        <Link href="/" aria-label={`${CLINIC_NAME} home`} className="min-w-0">
          <ClinicBrand size={34} />
        </Link>

        <nav className="ms-auto hidden items-center gap-1 md:flex" aria-label="Main navigation">
          <PublicNavLinks />
        </nav>

        <div className="ms-auto flex items-center gap-2 md:ms-1">
          <LanguageSwitcher locale={locale} />
          <Button asChild size="sm" className="hidden rounded-control sm:inline-flex">
            <Link href="/book/v2">
              <CalendarDays />
              Book appointment
            </Link>
          </Button>
          <details className="relative md:hidden">
            <summary
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-control border"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </summary>
            <nav
              className="absolute end-0 top-12 w-64 rounded-card border bg-surface p-2 shadow-lg"
              aria-label="Mobile navigation"
            >
              <Link
                href="/book/v2"
                className="mb-1 flex min-h-11 items-center gap-2 rounded-control bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground"
              >
                <CalendarDays className="h-4 w-4" />
                Book appointment
              </Link>
              <PublicNavMenuLinks />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <ClinicBrand size={32} />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Coordinated specialist care across Hawally and Jahra.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Patient information</h2>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <Link href="/branches">Clinic branches</Link>
            <Link href="/insurance">Insurance information</Link>
            <Link href="/contact">Contact the clinic</Link>
          </div>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="flex gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Your clinical record remains protected in OpenEMR.
          </p>
          <p className="flex gap-2">
            <Phone className="h-4 w-4 shrink-0" />
            For urgent symptoms, contact emergency services.
          </p>
        </div>
      </div>
    </footer>
  );
}
