import Stripe from "stripe";

import { env, stripe } from "@config";
import {
  CreatePaymentLinkOutput,
  StripeLineItem,
  StripeServiceInput,
} from "@types";

class StripeService {
  async generatePaymentLink(
    input: StripeServiceInput,
  ): Promise<CreatePaymentLinkOutput> {
    try {
      // Build line items for Stripe
      const lineItems: StripeLineItem[] = input.items.map((item) => ({
        price_data: {
          currency: "inr",
          product_data: {
            name: item.productName,
            metadata: {
              productId: item.productId,
            },
          },
          unit_amount: Math.round(item.unitPrice * 100), // Convert to cents
        },
        quantity: item.quantity,
      }));

      // Add tax as a separate line item if provided
      if (input.taxAmount && input.taxAmount > 0) {
        lineItems.push({
          price_data: {
            currency: "inr",
            product_data: {
              name: input.taxDescription || "Tax",
              description: "Applicable taxes (CGST + SGST)",
            },
            unit_amount: Math.round(input.taxAmount * 100),
          },
          quantity: 1,
        });
      }

      // Create checkout session with payment intent
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        currency: "inr",
        line_items: lineItems,
        mode: "payment",
        success_url: `${env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.FRONTEND_URL}/payment/cancel`,
        metadata: {
          orderId: input.orderId,
          userId: input.userId,
        },
        payment_intent_data: {
          metadata: {
            orderId: input.orderId,
            userId: input.userId,
          },
        },
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiry
      });

      return {
        paymentLinkId: session.id,
        paymentLinkUrl: session.url!,
        paymentIntentId: session.payment_intent as string,
      };
    } catch (error) {
      console.error("Error generating Stripe payment link:", error);
      throw error;
    }
  }

  /**
   * Construct and verify webhook event
   */
  constructWebhookEvent(body: Buffer, signature: string): Stripe.Event {
    return stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  }
}

const stripeService = new StripeService();
export default stripeService;
