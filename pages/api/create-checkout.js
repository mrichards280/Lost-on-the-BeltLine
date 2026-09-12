import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const ENTRY_PRICE_CENTS = 5000;
export const SHIRT_PRICE_CENTS = 2200;
export const HAT_PRICE_CENTS = 2500;

const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamName, member1, member2, email, merch } = req.body ?? {};

  const missing = { teamName, member1, member2, email };
  for (const [field, value] of Object.entries(missing)) {
    if (typeof value !== 'string' || value.trim() === '') {
      return res.status(400).json({ error: `Missing ${field}` });
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'That email address looks wrong' });
  }
  if (merch?.shirt && !SHIRT_SIZES.includes(merch.shirtSize)) {
    return res.status(400).json({ error: 'Pick a shirt size' });
  }

  const lineItems = [
    {
      price_data: {
        currency: 'usd',
        product_data: { name: 'Hunt entry (team of 2)' },
        unit_amount: ENTRY_PRICE_CENTS,
      },
      quantity: 1,
    },
  ];

  if (merch?.shirt) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: `Shirt (${merch.shirtSize})` },
        unit_amount: SHIRT_PRICE_CENTS,
      },
      quantity: 1,
    });
  }

  if (merch?.hat) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Hat' },
        unit_amount: HAT_PRICE_CENTS,
      },
      quantity: 1,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: 'payment',
      customer_email: email.trim(),
      success_url: `${process.env.SITE_URL}/registered?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/register`,
      // The team record is created by the webhook, not here — a browser that
      // closes on the Stripe page must not leave a paid-for team uncreated, and
      // must not create an unpaid one either.
      metadata: {
        teamName: teamName.trim(),
        member1: member1.trim(),
        member2: member2.trim(),
        email: email.trim(),
        merch: JSON.stringify(merch ?? {}),
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout failed', err);
    return res.status(500).json({ error: 'Could not start checkout' });
  }
}
