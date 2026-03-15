import express from 'express';
import { processAllPending } from './process';

const app = express();
app.use(express.json());

const WORKER_SECRET = process.env.RAILWAY_WORKER_SECRET;

app.post('/process', async (req, res) => {
  if (req.headers.authorization !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await processAllPending();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({
  ok: true,
  env: {
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    googleClient: !!process.env.GOOGLE_CLIENT_ID,
    youtubeApi: !!process.env.YOUTUBE_API_KEY,
    workerSecret: !!process.env.RAILWAY_WORKER_SECRET,
  }
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Worker listening on port ${PORT}`));
