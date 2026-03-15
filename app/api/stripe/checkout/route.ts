import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const { price_id, mode } = await req.json();

    if (!price_id) {
      return NextResponse.json({ error: 'price_id is required' }, { status: 400 });
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [{ price: price_id, quantity: 1 }],
      mode: mode === 'payment' ? 'payment' : 'subscription',
      ui_mode: 'embedded',
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://gwdf.pro'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
