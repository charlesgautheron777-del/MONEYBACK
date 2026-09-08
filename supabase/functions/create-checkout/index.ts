import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
    if (!stripeKey || !supabaseUrl || !serviceKey) throw new Error('Server configuration incomplete');

    const body = await req.json();
    const companyName = String(body.companyName ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!companyName || !email || !email.includes('@')) throw new Error('Entreprise et email professionnel requis');

    const supabase = createClient(supabaseUrl, serviceKey);
    const dealId = crypto.randomUUID();
    const accessToken = crypto.randomUUID();
    const { error: dealError } = await supabase.from('deals').insert({
      id: dealId,
      company_name: companyName,
      email,
      status: 'pending',
      amount_cents: 49000,
      access_token: accessToken,
      offer_type: 'paid_audit',
    });
    if (dealError) throw dealError;

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const origin = req.headers.get('origin') || 'https://moneyback.fr';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'MONEYBACK — Audit fournisseurs',
            description: 'Audit pilote des dépenses fournisseurs et détection d’opportunités de récupération.',
          },
          unit_amount: 49000,
        },
        quantity: 1,
      }],
      metadata: { deal_id: dealId, offer_type: 'paid_audit' },
      success_url: `${origin}/payment-success.html?deal_id=${dealId}`,
      cancel_url: `${origin}/checkout.html?cancelled=1`,
    });

    await supabase.from('deals').update({ stripe_checkout_session_id: session.id }).eq('id', dealId);
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur serveur' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
