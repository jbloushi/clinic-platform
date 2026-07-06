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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Variant = 'ops' | 'doctor' | 'patient';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const NAV: Record<Variant, NavItem[]> = {
  ops: [
    { href: '/ops', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/ops/calendar', label: 'Calendar', icon: Calendar },
    { href: '/ops/patients', label: 'Patients', icon: Users },
    { href: '/ops/billing', label: 'Billing', icon: Wallet },
    { href: '/ops/providers', label: 'Providers', icon: Stethoscope },
    { href: '/ops/services', label: 'Services', icon: ClipboardList },
    { href: '/ops/reports', label: 'Reports', icon: FileText },
    { href: '/ops/users', label: 'Users', icon: User },
    { href: '/ops/settings', label: 'Settings', icon: Cog },
  ],
  doctor: [
    { href: '/doctor', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/doctor/schedule', label: "Today's schedule", icon: Calendar },
    { href: '/doctor/patients', label: 'Patients', icon: Users },
    { href: '/doctor/encounters', label: 'Encounters', icon: FileText },
    { href: '/doctor/prescriptions', label: 'Prescriptions', icon: Pill },
    { href: '/doctor/labs', label: 'Lab requests', icon: FlaskConical },
    { href: '/doctor/imaging', label: 'Imaging', icon: Scan },
    { href: '/doctor/followups', label: 'Follow-ups', icon: ClipboardList },
  ],
  patient: [
    { href: '/', label: 'Home', icon: Home },
    { href: '/doctors', label: 'Find a doctor', icon: Stethoscope },
    { href: '/account/appointments', label: 'My appointments', icon: Calendar },
    { href: '/account/records', label: 'My records', icon: FileText },
    { href: '/account/profile', label: 'Profile', icon: User },
  ],
};

const PORTAL_LABEL: Record<Variant, string> = {
  ops: 'Clinic Operations',
  doctor: 'Doctor Portal',
  patient: 'Clinic',
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
  const nav = NAV[variant];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center border-b px-5">
          <span className="text-base font-semibold tracking-tight">{PORTAL_LABEL[variant]}</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {user && (
          <div className="border-t p-3">
            <div className="flex items-center gap-3 rounded-md p-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                {user.subtitle && <p className="truncate text-xs text-muted-foreground">{user.subtitle}</p>}
              </div>
              <Link href={variant === 'patient' ? '/api/auth/patient/logout' : '/api/auth/staff/logout'} className="ml-auto">
                <Button size="icon" variant="ghost" aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col">
        {/* Topbar (mobile hamburger + portal label) */}
        <header className="flex h-16 items-center gap-3 border-b bg-card px-4 md:px-8">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground md:hidden">{PORTAL_LABEL[variant]}</span>
          <div className="ml-auto" />
        </header>

        {open && (
          <div className="border-b bg-card md:hidden">
            <nav className="grid gap-0.5 p-3">
              {nav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                      active ? 'bg-secondary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
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

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
