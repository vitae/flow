import { NextResponse } from 'next/server';

export const maxDuration = 300; // 5 min — pipeline stages can take a while

export async function POST() {
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: 'RAILWAY_WORKER_URL not set' }, { status: 500 });
  }

  try {
    const res = await fetch(`${workerUrl}/push-pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RAILWAY_WORKER_SECRET}`,
      },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: `Worker unreachable: ${err.message}` }, { status: 502 });
  }
}
