# flow.ai — Backend Infrastructure Guide

## Stack Overview

```
[User's Browser]
  ↕  flow-ai-app.html (static file, hosted anywhere)
  
[Railway — Always-On Backend]  ← server.js (Express)
  ↕  Stripe API  (payments)
  ↕  Supabase    (paid user database)
  
[Stripe]  ← payment processing + webhooks
[Supabase]  ← PostgreSQL database (paid users, profiles, chat history)
```

---

## What You Need

### 1. Railway — $5/mo Starter Plan
**Purpose:** Always-on Node.js backend (Stripe secret key can NEVER be in frontend code)

**Deploy steps:**
1. Push `backend/` folder to GitHub
2. Create new Railway project → connect repo
3. Add environment variables (see below)
4. Railway auto-deploys on push
5. Copy your Railway URL → paste into `BACKEND_URL` in flow-ai-app.html

### 2. Supabase — Free tier
**Setup steps:**
1. Open your Supabase project
2. SQL Editor → paste `supabase-schema.sql` → Run
3. Settings → API → copy `service_role` key (NOT anon key)
4. Add to Railway env vars

### 3. Stripe — 2.9% + 30¢ per transaction
**At $20/sale you keep ~$19.12 after Stripe fees**

**Setup steps:**
1. stripe.com → Developers → API Keys
2. `pk_live_...` → paste into `STRIPE_PK` in flow-ai-app.html
3. `sk_live_...` → paste into `STRIPE_SECRET_KEY` Railway env var
4. Webhooks → Add endpoint: `https://YOUR_RAILWAY_URL/webhook`
5. Event: `payment_intent.succeeded`
6. Copy webhook secret → `STRIPE_WEBHOOK_SECRET` Railway env var

---

## Railway Environment Variables

```
STRIPE_SECRET_KEY         = sk_live_YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET     = whsec_YOUR_WEBHOOK_SECRET
SUPABASE_URL              = https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...YOUR_SERVICE_ROLE_KEY
APP_URL                   = https://your-flow-ai-app.vercel.app
PORT                      = 3000

# n8n Webhook Integration (optional)
N8N_WEBHOOK_URL           = https://your-n8n.com/webhook/flow-ai
N8N_WEBHOOK_SECRET        = a-shared-secret-for-hmac-signing
ADMIN_SECRET              = your-admin-secret-for-status-endpoint
```

---

## flow-ai-app.html — Two Lines to Update

Open flow-ai-app.html and find near the bottom of the script:

```js
const STRIPE_PK = 'pk_live_REPLACE_WITH_YOUR_PUBLISHABLE_KEY';
const BACKEND_URL = 'https://YOUR_RAILWAY_APP.up.railway.app';
```

Replace both with your actual values.

---

## Deploy Checklist

- [ ] Push `backend/` to GitHub
- [ ] Create Railway project → connect repo → add env vars
- [ ] Copy Railway URL → paste into `BACKEND_URL` in app HTML
- [ ] Run `supabase-schema.sql` in Supabase SQL editor
- [ ] Get Stripe keys → paste `pk_live_...` into app HTML, `sk_live_...` into Railway
- [ ] Set up Stripe webhook → paste secret into Railway
- [ ] Host `flow-ai-app.html` on Vercel or Netlify (drag & drop)
- [ ] Test with card: `4242 4242 4242 4242`, any future date, any CVC
- [ ] Switch Stripe from test → live mode
- [ ] Done — live 🌀

---

## n8n Webhook Integration

The backend dispatches events to an external n8n instance via webhook. Set `N8N_WEBHOOK_URL` in Railway to enable.

**Events dispatched:**
| Event | When | Payload |
|-------|------|---------|
| `payment.succeeded` | Stripe webhook confirms payment | email, amount, currency |
| `user.signup` | New user verifies magic link | email, paid, isNewUser |
| `user.login` | Returning user verifies magic link | email, paid, isNewUser |
| `profile.updated` | Artist saves/updates profile | email, prop, styles, goal |

**Endpoints:**
- `POST /webhooks/test` — send a test event to n8n
- `GET /webhooks/status` — check config (requires `x-admin-secret` header)

**Payload signature:** If `N8N_WEBHOOK_SECRET` is set, each request includes an `x-webhook-signature` header (HMAC-SHA256 of the JSON body). Use this in n8n to verify authenticity.

---

## Full Payment Flow

```
1. User hits paywall → clicks unlock
2. Stripe card form appears in app
3. User enters email + card
4. Browser → Railway: POST /create-payment-intent
5. Railway → Stripe: create PaymentIntent($20)
6. Stripe → Railway → Browser: clientSecret
7. Browser → Stripe: confirmCardPayment
8. Stripe processes charge
9. Browser → Railway: POST /confirm-payment
10. Railway → Stripe: verify succeeded
11. Railway → Supabase: INSERT paid_users
12. Browser: localStorage paid=1 → paywall disappears
13. [Backup] Stripe webhook → re-confirms in DB
```

---

## Login Flow (Magic Link)

```
1. User → "I Already Have An Account"
2. Enters email → POST /send-magic-link
3. Supabase emails magic link automatically
4. User clicks link → redirected with ?token=XXX&email=YYY
5. App → POST /verify-magic-link
6. Railway verifies with Supabase Auth
7. Returns { paid, profile }
8. If paid → unlocks + restores profile
9. If not paid → restores profile + checks trial
```

---

## Monthly Cost

| Service  | Cost       |
|----------|-----------|
| Railway  | $5/mo     |
| Supabase | Free      |
| Vercel   | Free      |
| Stripe   | ~2.9%+30¢ per sale |
| **Total fixed** | **$5/mo** |

One sale covers all infrastructure.
