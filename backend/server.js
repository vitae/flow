// flow.ai — Railway Backend
// Stack: Node.js + Express + Stripe + Supabase
// Deploy: Railway (always-on, $5/mo Starter plan)

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ── n8n Webhook Dispatch ────────────────────────────────────────────────────
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

async function dispatchWebhook(event, payload) {
  if (!N8N_WEBHOOK_URL) return;
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const headers = { 'Content-Type': 'application/json' };
  if (N8N_WEBHOOK_SECRET) {
    headers['x-webhook-signature'] = crypto
      .createHmac('sha256', N8N_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');
  }
  try {
    await fetch(N8N_WEBHOOK_URL, { method: 'POST', headers, body });
    console.log(`⚡ n8n webhook dispatched: ${event}`);
  } catch (err) {
    console.error(`⚡ n8n webhook failed (${event}):`, err.message);
  }
}

// ── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://glowwitdaflow.com',
    'https://flow-ai.vercel.app',
    'http://localhost:3000',
    '*'
  ]
}));

app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'flow.ai backend online ✓' }));

// ── Create PaymentIntent ──────────────────────────────────────────────────────
app.post('/create-payment-intent', async (req, res) => {
  const { email, amount = 2000, currency = 'usd' } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const { data: existing } = await supabase
      .from('paid_users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) return res.json({ alreadyPaid: true });

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { email, product: 'flow.ai lifetime access' },
      receipt_email: email,
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('PaymentIntent error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Confirm Payment ───────────────────────────────────────────────────────────
app.post('/confirm-payment', async (req, res) => {
  const { email, paymentIntentId } = req.body;
  if (!email || !paymentIntentId) return res.status(400).json({ error: 'email and paymentIntentId required' });

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded') return res.status(400).json({ error: 'Payment not confirmed' });

    const { error } = await supabase.from('paid_users').upsert({
      email: email.toLowerCase(),
      stripe_payment_intent_id: paymentIntentId,
      amount_paid: pi.amount,
      currency: pi.currency,
      paid_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Confirm payment error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Check access ──────────────────────────────────────────────────────────────
app.get('/check-access', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const { data } = await supabase
    .from('paid_users')
    .select('paid_at')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  res.json({ paid: !!data, paidAt: data?.paid_at || null });
});

// ── Stripe Webhook ────────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const email = pi.metadata?.email;
    if (email) {
      await supabase.from('paid_users').upsert({
        email: email.toLowerCase(),
        stripe_payment_intent_id: pi.id,
        amount_paid: pi.amount,
        currency: pi.currency,
        paid_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      console.log(`✓ Payment confirmed for ${email}`);
      dispatchWebhook('payment.succeeded', { email, amount: pi.amount, currency: pi.currency });
    }
  }

  res.json({ received: true });
});

// ── Magic Link Auth ───────────────────────────────────────────────────────────
const { createClient: createAdminClient } = require('@supabase/supabase-js');

const supabaseAdmin = createAdminClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

app.post('/send-magic-link', async (req, res) => {
  const { email, redirectUrl } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
      options: { redirectTo: redirectUrl || process.env.APP_URL }
    });
    if (error) throw error;
    res.json({ sent: true });
  } catch (err) {
    console.error('Magic link error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/verify-magic-link', async (req, res) => {
  const { token, email } = req.body;
  if (!token || !email) return res.status(400).json({ error: 'token and email required' });

  try {
    const { error: authErr } = await supabaseAdmin.auth.verifyOtp({
      email: email.toLowerCase(),
      token,
      type: 'magiclink'
    });
    if (authErr) throw authErr;

    const verifiedEmail = email.toLowerCase();

    const { data: paidRow } = await supabase
      .from('paid_users')
      .select('paid_at')
      .eq('email', verifiedEmail)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('artist_profiles')
      .select('*')
      .eq('email', verifiedEmail)
      .maybeSingle();

    const isNewUser = !paidRow && !profile;
    dispatchWebhook(isNewUser ? 'user.signup' : 'user.login', {
      email: verifiedEmail,
      paid: !!paidRow,
      isNewUser,
    });

    res.json({
      verified: true,
      paid: !!paidRow,
      paidAt: paidRow?.paid_at || null,
      profile: profile || null,
    });
  } catch (err) {
    console.error('Verify magic link error:', err.message);
    res.status(401).json({ error: 'Invalid or expired login link.' });
  }
});

// ── Save / Get Profile ────────────────────────────────────────────────────────
app.post('/save-profile', async (req, res) => {
  const { email, ...profile } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const { error } = await supabase.from('artist_profiles').upsert({
    email: email.toLowerCase(),
    instagram: profile.instagram || profile.name,
    prop: profile.prop,
    styles: profile.style || [],
    music: profile.music || [],
    colors: profile.colors || [],
    color_names: profile.colorNames || [],
    career: profile.career,
    goal: profile.goal,
    bio: profile.bio,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' });

  if (error) return res.status(500).json({ error: error.message });

  dispatchWebhook('profile.updated', {
    email: email.toLowerCase(),
    prop: profile.prop,
    styles: profile.style || [],
    goal: profile.goal,
  });

  res.json({ saved: true });
});

app.get('/profile', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const { data } = await supabase
    .from('artist_profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  res.json({ profile: data || null });
});

// ── n8n Webhook Management ──────────────────────────────────────────────────
app.post('/webhooks/test', async (req, res) => {
  if (!N8N_WEBHOOK_URL) return res.status(400).json({ error: 'N8N_WEBHOOK_URL not configured' });
  try {
    await dispatchWebhook('test', { message: 'flow.ai webhook test' });
    res.json({ sent: true, url: N8N_WEBHOOK_URL.replace(/\/[^/]+$/, '/***') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/webhooks/status', (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({
    n8nConfigured: !!N8N_WEBHOOK_URL,
    signatureEnabled: !!N8N_WEBHOOK_SECRET,
  });
});

app.listen(PORT, () => console.log(`flow.ai backend running on port ${PORT}`));
