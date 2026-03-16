import { NextResponse } from 'next/server';

export const maxDuration = 120;

export async function GET() {
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: 'RAILWAY_WORKER_URL not set' }, { status: 500 });
  }

  try {
    const res = await fetch(`${workerUrl}/scout-preview`, {
      headers: {
        'Authorization': `Bearer ${process.env.RAILWAY_WORKER_SECRET}`,
      },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: `Worker unreachable: ${err.message}` }, { status: 502 });
  }
}
