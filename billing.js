// billing.js
// Maneja el cobro de la suscripción mensual de cada restaurante con Stripe.
// Necesita STRIPE_SECRET_KEY, STRIPE_PRICE_ID y STRIPE_WEBHOOK_SECRET
// (se consiguen gratis creando una cuenta en https://dashboard.stripe.com).

function stripeConfigurado() {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

function obtenerStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const Stripe = require('stripe');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Crea una sesión de pago de Stripe para un restaurante que se está registrando.
// El pendingSignupId queda guardado en los metadatos, para poder identificar
// a qué registro pendiente corresponde cuando llegue la confirmación de pago.
async function crearCheckoutSuscripcion({ pendingSignupId, adminEmail, appDomain, subdomain }) {
  const stripe = obtenerStripe();
  if (!stripe) throw new Error('Stripe no está configurado (falta STRIPE_SECRET_KEY)');

  const baseUrl = appDomain ? `https://${appDomain}` : 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: adminEmail,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    subscription_data: {
      trial_period_days: Number(process.env.STRIPE_TRIAL_DAYS) || 14,
      metadata: { pendingSignupId }
    },
    metadata: { pendingSignupId },
    success_url: `${baseUrl}/registro-exitoso.html?subdomain=${encodeURIComponent(subdomain)}`,
    cancel_url: `${baseUrl}/registro.html?canceled=1`
  });

  return session;
}

module.exports = { stripeConfigurado, obtenerStripe, crearCheckoutSuscripcion };
