import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workerUrl = process.env.RAILWAY_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: 'RAILWAY_WORKER_URL not set' }, { status: 500 });
  }

  // Trigger scout agent on Railway — it handles discovery, dedup, and queueing
  const res = await fetch(`${workerUrl}/scout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RAILWAY_WORKER_SECRET}`,
    },
  });

  const result = await res.json();
  return NextResponse.json(result);
}
