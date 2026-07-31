'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Building2,
  Calendar,
  ClipboardList,
  Cog,
  FileText,
  FlaskConical,
  Home,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Pill,
  Scan,
  Shuffle,
  Stethoscope,
  Tags,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ClinicBrand, ClinicBrandMark } from '@/components/domain/brand-mark';

type Variant = 'ops' | 'doctor' | 'patient';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label?: string; items: NavItem[] };

const NAV: Record<Variant, NavGroup[]> = {
  ops: [
    {
      items: [
        { href: '/ops', label: 'Overview', icon: LayoutDashboard },
        { href: '/ops/calendar', label: 'Calendar', icon: Calendar },
      ],
    },
    {
      label: 'Clinical',
      items: [
        { href: '/ops/patients', label: 'Patients', icon: Users },
        { href: '/ops/providers', label: 'Specialists', icon: Stethoscope },
        { href: '/ops/services', label: 'Services', icon: ClipboardList },
        { href: '/ops/offerings', label: 'Offerings', icon: Link2 },
        { href: '/ops/departments', label: 'Departments', icon: Tags },
        { href: '/ops/branches', label: 'Branches', icon: Building2 },
      ],
    },
    {
      label: 'Business',
      items: [
        { href: '/ops/billing', label: 'Billing', icon: Wallet },
        { href: '/ops/reports', label: 'Reports', icon: FileText },
      ],
    },
    {
      label: 'Admin',
      items: [
        { href: '/ops/users', label: 'Users', icon: User },
        { href: '/ops/assignment-settings', label: 'Assignment settings', icon: Shuffle },
        { href: '/ops/settings', label: 'Settings', icon: Cog },
      ],
    },
  ],
  doctor: [
    {
      items: [
        { href: '/doctor', label: 'Overview', icon: LayoutDashboard },
        { href: '/doctor/schedule', label: "Today's schedule", icon: Calendar },
        { href: '/doctor/patients', label: 'Patient charts', icon: Users },
      ],
    },
    {
      label: 'Clinical',
      items: [
        { href: '/doctor/encounters', label: 'Consultations', icon: FileText },
        { href: '/doctor/prescriptions', label: 'Prescriptions', icon: Pill },
        { href: '/doctor/labs', label: 'Lab requests', icon: FlaskConical },
        { href: '/doctor/imaging', label: 'Imaging', icon: Scan },
        { href: '/doctor/followups', label: 'Follow-ups', icon: ClipboardList },
      ],
    },
  ],
  patient: [
    {
      items: [
        { href: '/', label: 'Home', icon: Home },
        { href: '/doctors', label: 'Find a specialist', icon: Stethoscope },
      ],
    },
    {
      label: 'My account',
      items: [
        { href: '/account/appointments', label: 'My visits', icon: Calendar },
        { href: '/account/records', label: 'Medical records', icon: FileText },
        { href: '/account/profile', label: 'Profile', icon: User },
      ],
    },
  ],
};

/**
 * Routes that manage their own full-height layout and must not be wrapped in the
 * shell's padded content column — currently the consultation workspace, whose
 * three panes run edge to edge and scroll independently.
 */
const FULL_BLEED_ROUTES = [/^\/doctor\/consult\//];

const PORTAL_LABEL: Record<Variant, string> = {
  ops: 'Clinic Operations',
  doctor: 'Doctor workspace',
  patient: 'My Clinic',
};

/**
 * Staff application chrome.
 *
 * The doctor portal wears the deep-teal sidebar from the approved consultation
 * design; operations keeps a light sidebar, where dense tables and long sessions
 * make a quieter frame the better choice. The doctor main column is also
 * unconstrained in width — clinical work wants the operational density the
 * design shows, not a centred reading column.
 */
export function AppShell({
  variant,
  user,
  children,
}: {
  variant: Variant;
  user?: { name: string; subtitle?: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = NAV[variant];
  const onBrand = variant === 'doctor';
  const fullBleed = FULL_BLEED_ROUTES.some((route) => route.test(pathname));

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'hidden w-[224px] shrink-0 flex-col md:flex',
          onBrand ? 'bg-primary text-surface-soft' : 'border-e bg-surface',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center px-4',
            onBrand ? 'border-b border-white/15' : 'border-b',
          )}
        >
          {onBrand ? (
            <span className="flex items-center gap-2.5">
              <ClinicBrandMark size={34} variant="on-brand" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-editorial text-[14px] font-semibold">
                  Al Jarallah
                </span>
                <span className="block truncate text-[10.5px] text-surface-soft/65">
                  {PORTAL_LABEL[variant]}
                </span>
              </span>
            </span>
          ) : (
            <ClinicBrand size={32} descriptor={PORTAL_LABEL[variant]} />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Portal navigation">
          {groups.map((group, index) => (
            <div key={index} className={cn(index > 0 && 'mt-5')}>
              {group.label && (
                <div
                  className={cn(
                    'mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest',
                    onBrand ? 'text-surface-soft/55' : 'text-muted-foreground/70',
                  )}
                >
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} onBrand={onBrand} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {user && (
          <div className={cn('p-3', onBrand ? 'border-t border-white/15' : 'border-t')}>
            <div className="flex items-center gap-3 rounded-control p-2">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-editorial text-[12px] font-bold',
                  onBrand
                    ? 'bg-gradient-to-br from-surface-soft to-[#D8D2C4] text-primary'
                    : 'bg-tint-teal text-primary',
                )}
              >
                {initials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-tight">{user.name}</p>
                {user.subtitle && (
                  <p
                    className={cn(
                      'truncate text-[11px] leading-tight',
                      onBrand ? 'text-surface-soft/65' : 'text-muted-foreground',
                    )}
                  >
                    {user.subtitle}
                  </p>
                )}
              </div>
              <Link
                href={variant === 'patient' ? '/api/auth/patient/logout' : '/api/auth/staff/logout'}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                  onBrand
                    ? 'text-surface-soft/70 hover:bg-white/10 hover:text-surface-soft'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-surface/90 px-4 backdrop-blur-md md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <ClinicBrandMark size={26} />
            <span className="truncate text-sm font-semibold">{PORTAL_LABEL[variant]}</span>
          </div>
        </header>

        {open && (
          <div className="border-b bg-surface md:hidden">
            <nav className="p-3" aria-label="Portal navigation">
              {groups.map((group, index) => (
                <div key={index} className={cn(index > 0 && 'mt-4')}>
                  {group.label && (
                    <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      {group.label}
                    </div>
                  )}
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      onClick={() => setOpen(false)}
                    />
                  ))}
                </div>
              ))}
            </nav>
          </div>
        )}

        <main className={cn('flex min-w-0 flex-1 flex-col', !fullBleed && 'p-4 md:p-8')}>
          {fullBleed ? (
            children
          ) : (
            <div
              className={cn(
                'mx-auto w-full space-y-6',
                // Clinical and operational screens want density; the patient
                // portal keeps a comfortable reading column.
                variant === 'patient' ? 'max-w-5xl' : 'max-w-7xl',
              )}
            >
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  onBrand = false,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onBrand?: boolean;
  onClick?: () => void;
}) {
  const active =
    item.href === '/'
      ? pathname === '/'
      : pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-control px-3 py-2.5 text-[13.5px] font-medium',
        onBrand
          ? active
            ? 'bg-white/[.14] font-semibold text-surface-soft'
            : 'text-surface-soft/80 hover:bg-white/10 hover:text-surface-soft'
          : active
            ? 'bg-tint-teal text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter((part) => part && !/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)$/i.test(part))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
