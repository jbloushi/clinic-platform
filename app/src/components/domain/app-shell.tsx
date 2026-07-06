'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Calendar,
  ClipboardList,
  Cog,
  FileText,
  FlaskConical,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Scan,
  Stethoscope,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/domain/brand-mark';

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
        { href: '/ops/providers', label: 'Providers', icon: Stethoscope },
        { href: '/ops/services', label: 'Services', icon: ClipboardList },
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
        { href: '/ops/settings', label: 'Settings', icon: Cog },
      ],
    },
  ],
  doctor: [
    {
      items: [
        { href: '/doctor', label: 'Overview', icon: LayoutDashboard },
        { href: '/doctor/schedule', label: "Today's schedule", icon: Calendar },
        { href: '/doctor/patients', label: 'Patients', icon: Users },
      ],
    },
    {
      label: 'Clinical',
      items: [
        { href: '/doctor/encounters', label: 'Encounters', icon: FileText },
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
        { href: '/doctors', label: 'Find a doctor', icon: Stethoscope },
      ],
    },
    {
      label: 'My account',
      items: [
        { href: '/account/appointments', label: 'Appointments', icon: Calendar },
        { href: '/account/records', label: 'Medical records', icon: FileText },
        { href: '/account/profile', label: 'Profile', icon: User },
      ],
    },
  ],
};

const PORTAL_LABEL: Record<Variant, string> = {
  ops: 'Clinic Operations',
  doctor: 'Doctor Portal',
  patient: 'My Clinic',
};

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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <BrandMark size={30} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight tracking-tight">
              {PORTAL_LABEL[variant]}
            </div>
            <div className="truncate text-[11px] leading-tight text-muted-foreground">
              Powered by OpenEMR
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {groups.map((g, gi) => (
            <div key={gi} className={cn(gi > 0 && 'mt-5')}>
              {g.label && (
                <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {g.label}
                </div>
              )}
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        {user && (
          <div className="border-t p-3">
            <div className="flex items-center gap-3 rounded-md p-2 hover:bg-accent">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                {initials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
                {user.subtitle && (
                  <p className="truncate text-xs leading-tight text-muted-foreground">{user.subtitle}</p>
                )}
              </div>
              <Link
                href={variant === 'patient' ? '/api/auth/patient/logout' : '/api/auth/staff/logout'}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur-md md:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2 md:hidden">
            <BrandMark size={24} />
            <span className="text-sm font-semibold">{PORTAL_LABEL[variant]}</span>
          </div>
          <div className="ml-auto" />
        </header>

        {open && (
          <div className="border-b bg-card md:hidden">
            <nav className="p-3">
              {groups.map((g, gi) => (
                <div key={gi} className={cn(gi > 0 && 'mt-4')}>
                  {g.label && (
                    <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      {g.label}
                    </div>
                  )}
                  {g.items.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setOpen(false)} />
                  ))}
                </div>
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
}) {
  const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      {item.label}
    </Link>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
