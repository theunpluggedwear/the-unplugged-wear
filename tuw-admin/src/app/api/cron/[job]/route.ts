import { loadJobs, runJob } from '@tuw/heart/platform/jobs/catalog';
import { secretMatches } from '@tuw/heart/platform/guards';





export async function GET(request: Request, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secretMatches(request.headers.get('authorization'), secret ? `Bearer ${secret}` : undefined)) {
    return Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid cron secret.', details: [] } }, { status: 401 });
  }
  const { job } = await params;
  loadJobs();
  const run = await runJob(job);
  return Response.json(run, { status: run.ok ? 200 : run.error === 'Unknown job' ? 404 : 500 });
}
