import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  const supabase = createServerClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      // Find user by email or Stripe customer ID
      const email = session.customer_details?.email;
      if (email) {
        await supabase.from('users').update({
          stripe_customer_id: customerId,
          subscription_tier: 'pro',
        }).eq('email', email);

        // Get subscription details
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await supabase.from('subscriptions').upsert({
          user_id: (await supabase.from('users').select('id').eq('email', email).single()).data?.id,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: sub.items.data[0]?.price.id,
          status: 'active',
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }, { onConflict: 'user_id' });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from('subscriptions').update({
        status: sub.status === 'active' ? 'active' : 'inactive',
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from('subscriptions').update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', sub.id);

      // Downgrade user
      const { data: subRecord } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', sub.id)
        .single();

      if (subRecord) {
        await supabase.from('users').update({
          subscription_tier: 'free',
        }).eq('id', subRecord.user_id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
