import DashboardShell from '@/components/layout/DashboardShell';
import {
  Badge,
  ContentCard,
  EmptyState,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { adminListSubscribers } from '@tuw/heart/modules/marketing';
import { formatDate } from '@/lib/format';
import { session } from '@/server/session';

export default async function NewsletterPage() {
  const claims = await session.requireStaff('content.manage', '/content/newsletter');
  const subscribers = await adminListSubscribers(claims.sub);
  return (
    <DashboardShell pageTitle="Newsletter subscribers">
      <PageHeader
        title="Newsletter subscribers"
        subtitle="Double opt-in sign-ups and their current status."
        actions={<Badge variant="info">{subscribers.length} Total</Badge>}
      />

      {subscribers.length === 0 ? (
        <EmptyState title="No subscribers yet" description="Confirmed sign-ups will appear here." />
      ) : (
        <ContentCard padding="0px">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Confirmed</TableHead>
                <TableHead>Unsubscribed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((s) => (
                <TableRow key={s.id} hoverable={false}>
                  <TableCell>{s.email}</TableCell>
                  <TableCell><Badge variant={s.status === 'active' ? 'success' : 'neutral'}>{s.status}</Badge></TableCell>
                  <TableCell>{s.source}</TableCell>
                  <TableCell>{s.confirmedAt ? formatDate(s.confirmedAt) : '—'}</TableCell>
                  <TableCell>{s.unsubscribedAt ? formatDate(s.unsubscribedAt) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentCard>
      )}
    </DashboardShell>
  );
}
