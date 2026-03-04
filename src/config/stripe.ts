import Stripe from "stripe";

import env from "./envVariable";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});

export default stripe;
