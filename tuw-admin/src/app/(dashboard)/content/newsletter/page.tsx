import DashboardShell from '@/components/layout/DashboardShell';
import { adminListSubscribers } from '@tuw/heart/modules/marketing';
import { session } from '@/server/session';

export default async function NewsletterPage() {
  const claims = await session.requireStaff('content.manage', '/content/newsletter');
  const subscribers = await adminListSubscribers(claims.sub);
  return (
    <DashboardShell>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Newsletter subscribers</h1>
        <table className="w-full text-sm border">
          <thead><tr><th className="p-2 text-left">Email</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Source</th><th className="p-2 text-left">Confirmed</th><th className="p-2 text-left">Unsubscribed</th></tr></thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-2">{s.email}</td><td className="p-2">{s.status}</td><td className="p-2">{s.source}</td>
                <td className="p-2">{s.confirmedAt ? new Date(s.confirmedAt).toLocaleDateString() : '—'}</td>
                <td className="p-2">{s.unsubscribedAt ? new Date(s.unsubscribedAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {subscribers.length === 0 && <p className="text-sm text-muted-foreground">No subscribers yet.</p>}
      </div>
    </DashboardShell>
  );
}
