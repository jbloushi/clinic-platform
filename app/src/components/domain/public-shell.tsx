import Link from 'next/link';
import { CalendarDays, Menu, Phone, ShieldCheck } from 'lucide-react';
import { BrandWordmark } from './brand-mark';
import { Button } from '@/components/ui/button';

const nav = [
  { href: '/departments', label: 'Departments' },
  { href: '/services', label: 'Services' },
  { href: '/doctors', label: 'Doctors' },
  { href: '/branches', label: 'Branches' },
];

export function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background"><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-3">Skip to main content</a><PublicHeader /><main id="main-content">{children}</main><PublicFooter /></div>;
}

export function PublicHeader() {
  return <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4"><Link href="/" aria-label="Dr. Al Jarallah Clinic home"><BrandWordmark /></Link><nav className="ms-auto hidden items-center gap-1 md:flex" aria-label="Main navigation">{nav.map((item) => <Button key={item.href} asChild variant="ghost" size="sm"><Link href={item.href}>{item.label}</Link></Button>)}</nav><Button asChild size="sm" className="ms-auto md:ms-2"><Link href="/book"><CalendarDays />Book appointment</Link></Button><details className="relative md:hidden"><summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border" aria-label="Open navigation"><Menu className="h-5 w-5" /></summary><nav className="absolute end-0 top-12 w-56 rounded-lg border bg-card p-2 shadow-lg" aria-label="Mobile navigation">{nav.map((item) => <Link key={item.href} href={item.href} className="block min-h-11 rounded-md px-3 py-3 text-sm font-medium hover:bg-accent">{item.label}</Link>)}</nav></details></div></header>;
}

export function PublicFooter() {
  return <footer className="border-t bg-card"><div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3"><div><BrandWordmark /><p className="mt-3 max-w-xs text-sm text-muted-foreground">Coordinated specialist care across Hawally and Jahra.</p></div><div><h2 className="text-sm font-semibold">Patient information</h2><div className="mt-3 grid gap-2 text-sm text-muted-foreground"><Link href="/branches">Clinic branches</Link><Link href="/insurance">Insurance information</Link><Link href="/contact">Contact the clinic</Link></div></div><div className="space-y-3 text-sm text-muted-foreground"><p className="flex gap-2"><ShieldCheck className="h-4 w-4" />Your clinical record remains protected in OpenEMR.</p><p className="flex gap-2"><Phone className="h-4 w-4" />For urgent symptoms, contact emergency services.</p></div></div></footer>;
}
