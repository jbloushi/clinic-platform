'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function StaffLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('admin@clinic.local');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get('forbidden') ? 'You do not have access to that area.' : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === 'invalid_credentials' ? 'Email or password is incorrect.' : 'Sign-in failed.');
        return;
      }
      router.push(data.redirect ?? '/ops');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Stethoscope className="h-5 w-5" />
        </div>
        <CardTitle>Staff sign in</CardTitle>
        <CardDescription>Reception, doctors, admin, and finance</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="pt-2 text-center text-xs text-muted-foreground">
            Demo accounts (password <code className="rounded bg-muted px-1">demo1234</code>):
            <br />
            admin@clinic.local · reception@clinic.local · doctor@clinic.local · finance@clinic.local
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
