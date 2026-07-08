import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  HeartPulse,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BrandWordmark } from '@/components/domain/brand-mark';
import { getDataProvider } from '@/lib/data';
import type { Practitioner } from '@/lib/data/types';
import { DoctorCard } from '@/components/domain/doctor-card';

export const dynamic = 'force-dynamic';

const SPECIALTIES = [
  { name: 'Internal Medicine', icon: Stethoscope, blurb: 'Adult primary care' },
  { name: 'Cardiology', icon: HeartPulse, blurb: 'Heart & vascular health' },
  { name: 'Pediatrics', icon: Sparkles, blurb: 'Care for children' },
  { name: 'Dermatology', icon: ShieldCheck, blurb: 'Skin, hair & nails' },
  { name: 'Orthopedics', icon: ClipboardCheck, blurb: 'Bones, joints & muscles' },
  { name: 'ENT', icon: HeartPulse, blurb: 'Ear, nose & throat' },
];

export default async function LandingPage() {
  const dp = getDataProvider();
  let featured: Practitioner[] = [];
  const nextAvailable: Record<string, string> = {};
  try {
    const list = await dp.getPractitioners({ activeOnly: true });
    featured = list.slice(0, 3);
    const from = new Date().toISOString().slice(0, 10);
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 6);
    const to = toDate.toISOString().slice(0, 10);
    await Promise.all(
      featured.map(async (d) => {
        try {
          const slots = await dp.getAvailableSlots(d.id, from, to);
          const first = slots.find((s) => s.available);
          if (first) nextAvailable[d.id] = formatWhen(first.start);
        } catch {
          /* silent */
        }
      }),
    );
  } catch {
    /* silent on landing */
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
          <Link href="/" aria-label="Home">
            <BrandWordmark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/doctors">Find a doctor</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="#how">How it works</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/appointments">My appointments</Link>
            </Button>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/staff/login">Staff</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="glow-radial relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                <span className="status-dot bg-emerald-500" />
                Booking now open · Same-week availability
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                Great care,
                <br />
                booked in <span className="text-primary">under a minute.</span>
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                Browse our doctors, pick a time that fits your day, and confirm online. Your medical record
                stays in one place, secured by our OpenEMR-backed platform.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg" className="group">
                  <Link href="/doctors">
                    Find a doctor{' '}
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">I&apos;m a returning patient</Link>
                </Button>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <li className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                  Secure &amp; encrypted
                </li>
                <li className="inline-flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-primary" aria-hidden />
                  Instant confirmation
                </li>
                <li className="inline-flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" aria-hidden />
                  Clinic credit on qualifying visits
                </li>
              </ul>
            </div>

            <HeroVisual />
          </div>
        </div>
      </section>

      {/* Specialties */}
      <section className="border-t bg-card/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-8 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Specialties</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Care for the whole family
              </h2>
            </div>
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/doctors">
                Browse all <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SPECIALTIES.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.name}
                  href={`/doctors?specialty=${encodeURIComponent(s.name)}`}
                  className="group flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm card-hover"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.blurb}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured doctors */}
      {featured.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-8 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Doctors</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Meet our team</h2>
              </div>
              <Button asChild variant="ghost">
                <Link href="/doctors">
                  See all <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((d) => (
                <DoctorCard key={d.id} doctor={d} nextAvailable={nextAvailable[d.id]} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="how" className="border-t bg-card/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">How it works</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Three quick steps</h2>

          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                n: '1',
                icon: Search,
                title: 'Find a doctor',
                body: 'Filter by specialty and see who has availability this week.',
              },
              {
                n: '2',
                icon: CalendarCheck,
                title: 'Pick a slot',
                body: 'Choose a time that works for you. We hold the slot while you check out.',
              },
              {
                n: '3',
                icon: ClipboardCheck,
                title: 'Confirm & pay',
                body: 'Verify your mobile number and pay online. You get instant confirmation.',
              },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.n} className="relative">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
                          {step.n}
                        </div>
                        <Icon className="h-5 w-5 text-primary" aria-hidden />
                      </div>
                      <h3 className="mt-4 text-base font-semibold tracking-tight">{step.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready when you are.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Booking takes about a minute. Payment is secure. You&apos;ll get a confirmation right away.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/doctors">
                Book an appointment <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Demo credentials — Patient: OTP <code className="rounded bg-muted px-1 py-0.5">123456</code>{' '}
            · Staff: <code className="rounded bg-muted px-1 py-0.5">admin@clinic.local</code> /{' '}
            <code className="rounded bg-muted px-1 py-0.5">demo1234</code>
          </p>
        </div>
      </section>

      <footer className="border-t bg-card/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <BrandWordmark />
          <p className="text-xs text-muted-foreground">
            Powered by OpenEMR · This is a demo environment. Do not use for real patient care.
          </p>
        </div>
      </footer>
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const isSame = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isSame(d, today)) return `Today at ${time}`;
  if (isSame(d, tomorrow)) return `Tomorrow at ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
      {/* Fake "appointment card" preview — hints at what booking looks like */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute -left-6 -top-6 h-40 w-40 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-8 -right-6 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl"
        />

        <Card className="relative overflow-hidden shadow-lg">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-semibold text-white">
                YR
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Dr. Yusuf Rahman</p>
                <p className="truncate text-xs text-muted-foreground">Cardiology</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                <span className="status-dot bg-emerald-500" /> Available
              </span>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tomorrow · Morning</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {['9:00', '9:20', '9:40', '10:00', '10:20', '10:40'].map((t, i) => (
                  <div
                    key={t}
                    className={
                      i === 1
                        ? 'flex h-9 items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground shadow-sm'
                        : 'flex h-9 items-center justify-center rounded-md border bg-card text-xs font-medium text-foreground'
                    }
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border bg-secondary/60 p-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Consultation</p>
                <p className="text-sm font-semibold tabular-nums">$250.00</p>
              </div>
              <div className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm">
                Confirm
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Floating stat chip */}
        <div className="absolute -bottom-3 -left-3 hidden rounded-lg border bg-card p-3 shadow-md sm:block">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Booked in</p>
              <p className="text-sm font-semibold tabular-nums">54 seconds</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
