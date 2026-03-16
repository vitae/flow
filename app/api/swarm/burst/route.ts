import { NextResponse } from 'next/server';

export const maxDuration = 300; // 5 min max for Vercel

export async function POST(req: Request) {
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: 'RAILWAY_WORKER_URL not set' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${workerUrl}/burst`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RAILWAY_WORKER_SECRET}`,
      },
      body: JSON.stringify({ count: body.count || 5 }),
    });

    // Stream the NDJSON response back to the client
    if (res.body) {
      const reader = res.body.getReader();
      const lines: any[] = [];
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          if (part.trim()) {
            try { lines.push(JSON.parse(part)); } catch {}
          }
        }
      }

      // Return the collected results
      const done_msg = lines.find(l => l.phase === 'done');
      return NextResponse.json({
        ok: done_msg?.ok ?? false,
        summary: done_msg?.summary,
        results: done_msg?.results,
        log: lines.map(l => l.message).filter(Boolean),
      });
    }

    return NextResponse.json({ error: 'No response from worker' }, { status: 502 });
  } catch (err: any) {
    return NextResponse.json({ error: `Worker unreachable: ${err.message}` }, { status: 502 });
  }
}
