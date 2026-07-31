import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ClinicBrand } from './brand-mark';
import { PatientMobileNav } from './patient-mobile-nav';
import { PublicFooter, PublicHeader } from './public-nav';

/**
 * The single chrome for every patient-facing page.
 *
 * Navigation is persistent by construction: the bottom bar and the padding that
 * reserves room for it live here, so no page can render without them. They were
 * previously opt-in per page, which is why the mobile bar disappeared on
 * `/departments`, `/services` and the whole booking funnel.
 *
 * Two variants, differing only in how much they surround the content with:
 *
 *  - `full` — marketing header and footer. Browsing.
 *  - `focused` — a back affordance and the step title, nothing sideways. Used
 *    through the booking funnel, where offering "Departments" mid-checkout
 *    invites abandonment. The bottom bar still shows: leaving should be
 *    possible, just not suggested.
 */
export async function PatientShell({
  variant = 'full',
  backHref,
  backLabel = 'Back',
  title,
  description,
  children,
}: {
  variant?: 'full' | 'focused';
  /** `focused` only — where the back arrow goes. */
  backHref?: string;
  backLabel?: string;
  /** `focused` only — the step name. */
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  const focused = variant === 'focused';

  return (
    <div className="has-mobile-nav flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-3"
      >
        Skip to main content
      </a>

      {focused ? (
        <header className="border-b bg-surface px-5 pt-4 md:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className="flex min-w-0 items-center gap-2">
                {backHref && (
                  <Link
                    href={backHref}
                    aria-label={backLabel}
                    className="-ms-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-primary hover:bg-muted"
                  >
                    <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden />
                  </Link>
                )}
                {title && (
                  <h1 className="truncate font-editorial text-[20px] font-semibold">{title}</h1>
                )}
              </div>
              <Link href="/" aria-label="Clinic home" className="hidden shrink-0 sm:block">
                <ClinicBrand size={30} descriptor={null} />
              </Link>
            </div>
            {description && (
              <p className="pb-4 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
            )}
          </div>
        </header>
      ) : (
        <PublicHeader />
      )}

      <main id="main-content" className={focused ? 'flex flex-1 flex-col' : undefined}>
        {focused ? (
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-5 md:px-8">
            {children}
          </div>
        ) : (
          children
        )}
      </main>

      {!focused && <PublicFooter />}
      <PatientMobileNav />
    </div>
  );
}
