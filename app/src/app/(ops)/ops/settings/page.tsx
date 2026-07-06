import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { env, useMock } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Environment and integration configuration for this instance." />

      <Card>
        <CardHeader><CardTitle className="text-base">Environment</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <Row label="APP_ENV" value={env.APP_ENV} />
          <Row label="Data source" value={useMock ? 'Mock (in-memory)' : 'Live OpenEMR'} />
          <Row label="Writes allowed" value={String(env.ALLOW_WRITES)} />
          <Row label="Payments" value={env.PAYMENTS_PROVIDER} />
          <Row label="OTP mode" value={env.OTP_MODE} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">OpenEMR connection</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Base URL" value={env.OPENEMR_BASE_URL} />
          <Row label="REST API" value={env.OPENEMR_API_URL} />
          <Row label="FHIR API" value={env.OPENEMR_FHIR_URL} />
          <Row label="Grant type" value={env.OPENEMR_GRANT_TYPE} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Badge variant="outline" className="mr-2">Demo</Badge>
        Configuration is via <code className="rounded bg-muted px-1">.env.local</code>. Editing here is planned for Phase 3.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-xs">{value}</p>
    </div>
  );
}
