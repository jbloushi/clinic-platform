import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { env, useMock } from '@/lib/env';
import { isWhatsAppConfigured } from '@/lib/whatsapp';
import { isChatwootConfigured } from '@/lib/chatwoot';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const whatsappReady = isWhatsAppConfigured();
  const chatwootReady = isChatwootConfigured();

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
          <Row label="Facility ID" value={String(env.OPENEMR_FACILITY_ID)} />
          <Row label="Appointment category ID" value={String(env.OPENEMR_APPOINTMENT_CATEGORY_ID)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Patient messaging</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <Row
            label="WhatsApp delivery"
            value={whatsappReady ? 'Configured (Cloud API)' : 'Not configured'}
          />
          <Row
            label="Chatwoot agent notes"
            value={chatwootReady ? 'Configured' : 'Not configured'}
          />
          <Row label="Scheduled jobs" value={env.CRON_SECRET ? 'Enabled' : 'Disabled (no CRON_SECRET)'} />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">Demo</Badge>
        <p>
          Read-only. Configuration is applied through environment variables — see{' '}
          <code className="rounded bg-muted px-1">.env.local</code> — so a restart is the only way
          these values change.
        </p>
      </div>
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
