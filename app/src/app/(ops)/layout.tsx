import { AppShell } from '@/components/domain/app-shell';
import { requireStaff } from '@/lib/auth/guards';

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff(['reception', 'admin', 'finance', 'doctor']);
  return (
    <AppShell
      variant="ops"
      user={{
        name: `${staff.firstName} ${staff.lastName}`,
        subtitle: `${roleLabel(staff.role)} · ${staff.email}`,
      }}
    >
      {children}
    </AppShell>
  );
}

function roleLabel(role: string): string {
  return role[0].toUpperCase() + role.slice(1);
}
