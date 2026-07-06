import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { requirePatient } from '@/lib/auth/guards';
import { getWalletBalance, listWalletTransactions } from '@/lib/data/platform-repo';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const patient = await requirePatient();
  const [balance, tx] = await Promise.all([getWalletBalance(patient.id), listWalletTransactions(patient.id)]);

  return (
    <div>
      <PageHeader title="Profile" description="Your account and wallet activity." />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Name" value={[patient.firstName, patient.lastName].filter(Boolean).join(' ') || '—'} />
            <Field label="Mobile" value={patient.mobile} />
            <Field label="OpenEMR ID" value={patient.openemrPatientUuid ?? 'Not yet linked'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Wallet balance</CardTitle>
            <p className="text-3xl font-semibold">{formatCurrency(balance)}</p>
          </CardHeader>
          <CardContent>
            {tx.length === 0 ? (
              <p className="text-sm text-muted-foreground">No wallet activity yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {tx.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2">
                    <span className="capitalize">{t.source.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(t.createdAt.toISOString())}</span>
                    <span className={`text-sm font-medium ${t.amountMinor >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {t.amountMinor >= 0 ? '+' : ''}{formatCurrency(t.amountMinor, t.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value || '—'}</p>
    </div>
  );
}
