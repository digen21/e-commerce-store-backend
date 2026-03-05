import Stripe from "stripe";

import { env, stripe } from "@config";
import { CreatePaymentLinkOutput, StripeServiceInput } from "@types";

class StripeService {
  async generatePaymentLink(
    input: StripeServiceInput,
  ): Promise<CreatePaymentLinkOutput> {
    try {
      // Build line items for Stripe
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        input.items.map((item) => ({
          price_data: {
            currency: "inr",
            product_data: {
              name: item.productName,
              metadata: {
                productId: item.productId,
                variantId: item.variantId,
                size: item.size,
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
        expand: ["payment_intent"],
        currency: "inr",
        line_items: lineItems,
        mode: "payment",
        success_url: `${env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.FRONTEND_URL}/payment/cancel`,
        metadata: {
          orderId: input.orderId,
          userId: input.userId,
        },
        invoice_creation: {
          enabled: true,
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
   * Retrieve a payment intent from Stripe
   */
  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Retrieve a charge from Stripe
   */
  async getCharge(chargeId: string): Promise<Stripe.Charge> {
    return stripe.charges.retrieve(chargeId, {
      expand: ["invoice"],
    });
  }

  /**
   * Create a refund for a payment intent or charge
   */
  async createRefund(params: {
    paymentIntentId?: string;
    chargeId?: string;
    amount?: number; // Optional - full refund if not specified
    reason?: "duplicate" | "fraudulent" | "requested_by_customer";
    metadata?: Record<string, string>;
  }): Promise<Stripe.Refund> {
    const refundParams: Stripe.RefundCreateParams = {
      metadata: params.metadata || {},
    };

    if (params.paymentIntentId) {
      refundParams.payment_intent = params.paymentIntentId;
    } else if (params.chargeId) {
      refundParams.charge = params.chargeId;
    } else {
      throw new Error("Either paymentIntentId or chargeId is required");
    }

    if (params.amount) {
      refundParams.amount = Math.round(params.amount * 100); // Convert to cents
    }

    if (params.reason) {
      refundParams.reason = params.reason;
    }

    return stripe.refunds.create(refundParams);
  }

  /**
   * Retrieve a refund from Stripe
   */
  async getRefund(refundId: string): Promise<Stripe.Refund> {
    return stripe.refunds.retrieve(refundId);
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
