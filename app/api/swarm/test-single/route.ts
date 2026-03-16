import { NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(req: Request) {
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: 'RAILWAY_WORKER_URL not set' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const res = await fetch(`${workerUrl}/test-single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RAILWAY_WORKER_SECRET}`,
      },
      body: JSON.stringify({ url: body.url }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: `Worker unreachable: ${err.message}` }, { status: 502 });
  }
}
