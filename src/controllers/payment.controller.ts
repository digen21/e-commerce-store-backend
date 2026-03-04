import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";

import { orderService, paymentService, stripeService } from "@services";
import { IPaymentItem, OrderStatus, PaymentMethod, PaymentStatus } from "@types";
import { logger, ServerError } from "@utils";
import Stripe from "stripe";

class PaymentController {
  /**
   * Stripe webhook handler
   * Catches payment events and updates order status
   */
  webhook = async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"] as string;

    // Log incoming request for debugging
    logger.info("Webhook request received:", {
      hasSignature: !!signature,
      bodyType: typeof req.body,
      isBuffer: Buffer.isBuffer(req.body),
    });

    if (!signature) {
      logger.error("Missing Stripe signature");
      return res.status(httpStatus.BAD_REQUEST).send({
        success: false,
        message: "Missing Stripe signature",
        status: httpStatus.BAD_REQUEST,
      });
    }

    // Ensure body is a Buffer for Stripe verification
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    let event: Stripe.Event;

    try {
      event = stripeService.constructWebhookEvent(rawBody, signature);
      logger.info("Webhook event verified:", {
        type: event.type,
        id: event.id,
      });
    } catch (error) {
      logger.error("Webhook signature verification failed:", {
        error: error,
      });
      return res.status(httpStatus.BAD_REQUEST).send({
        success: false,
        message: "Webhook signature verification failed",
        status: httpStatus.BAD_REQUEST,
      });
    }

    logger.info("Stripe webhook received:", {
      type: event.type,
      id: event.id,
    });

    // Handle webhook event based on type
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "payment_intent.succeeded":
        await this.handlePaymentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case "payment_intent.payment_failed":
        await this.handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      default:
        logger.warn(`Unhandled Stripe event type: ${event.type}`);
    }

    // Acknowledge receipt
    return res.status(httpStatus.OK).send({
      success: true,
      message: "Webhook received successfully",
      status: httpStatus.OK,
    });
  };

  /**
   * Handle checkout session completed
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { orderId, userId } = session.metadata || {};

    logger.info("Checkout session completed:", {
      sessionId: session.id,
      orderId,
      userId,
    });

    // Payment will be processed via payment_intent.succeeded event
  }

  /**
   * Handle payment succeeded - Update order status to ACCEPTED
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const { orderId } = paymentIntent.metadata || {};

    logger.info("Payment succeeded:", {
      paymentIntentId: paymentIntent.id,
      orderId,
      amount: paymentIntent.amount,
    });

    if (!orderId) {
      logger.error("Order ID missing in payment intent metadata");
      throw new ServerError({
        message: "Order ID missing in payment metadata",
        status: httpStatus.BAD_REQUEST,
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find order
      const order = await orderService.findById(orderId, {}, { session });

      if (!order) {
        await session.abortTransaction();
        session.endSession();
        logger.error("Order not found for payment:", orderId);
        throw new ServerError({
          message: "Order not found",
          status: httpStatus.NOT_FOUND,
        });
      }

      // Parse items from metadata or use empty array
      const paymentItems: IPaymentItem[] = [];

      // Create payment record
      const paymentData = {
        orderId: new mongoose.Types.ObjectId(orderId),
        userId: order.user,
        paymentIntentId: paymentIntent.id,
        paymentMethod: PaymentMethod.STRIPE,
        status: PaymentStatus.SUCCESS,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency,
        items: paymentItems,
        stripeData: {
          paymentIntentId: paymentIntent.id,
          chargeId: paymentIntent.latest_charge as string,
        },
        paidAt: new Date(),
      };

      // Check if payment record exists
      const existingPayment = await paymentService.findOne(
        { paymentIntentId: paymentIntent.id },
        {},
        { session },
      );

      if (existingPayment) {
        // Update existing payment
        await paymentService.update(
          { _id: existingPayment._id },
          paymentData,
          { session },
        );
      } else {
        // Create new payment record
        await paymentService.create(paymentData);
      }

      // Update order status to ACCEPTED
      await orderService.update(
        { _id: orderId },
        {
          paymentStatus: PaymentStatus.SUCCESS,
          orderStatus: OrderStatus.ACCEPTED,
          paymentStatusTimeline: {
            ...order.paymentStatusTimeline,
            successAt: new Date(),
          },
        },
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      logger.info("Order updated to ACCEPTED:", {
        orderId,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("Error handling payment succeeded:", {
        orderId,
        error: error,
      });
      throw error;
    }
  }

  /**
   * Handle payment failed
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const { orderId } = paymentIntent.metadata || {};

    logger.info("Payment failed:", {
      paymentIntentId: paymentIntent.id,
      orderId,
      error: paymentIntent.last_payment_error?.message,
    });

    if (!orderId) {
      logger.error("Order ID missing in payment intent metadata");
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find order first
      const order = await orderService.findById(orderId, {}, { session });

      if (!order) {
        await session.abortTransaction();
        session.endSession();
        logger.error("Order not found for payment:", orderId);
        return;
      }

      // Create payment record with failed status
      const paymentItems: IPaymentItem[] = [];

      const paymentData = {
        orderId: new mongoose.Types.ObjectId(orderId),
        userId: order.user,
        paymentIntentId: paymentIntent.id,
        paymentMethod: PaymentMethod.STRIPE,
        status: PaymentStatus.FAILED,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency,
        items: paymentItems,
        stripeData: {
          paymentIntentId: paymentIntent.id,
          lastPaymentError: paymentIntent.last_payment_error?.message,
        },
        failedAt: new Date(),
      };

      // Check if payment record exists
      const existingPayment = await paymentService.findOne(
        { paymentIntentId: paymentIntent.id },
        {},
        { session },
      );

      if (existingPayment) {
        // Update existing payment
        await paymentService.update(
          { _id: existingPayment._id },
          paymentData,
          { session },
        );
      } else {
        // Create new payment record
        await paymentService.create(paymentData);
      }

      // Update order status to CANCELLED
      await orderService.update(
        { _id: orderId },
        {
          paymentStatus: PaymentStatus.FAILED,
          orderStatus: OrderStatus.CANCELLED,
          paymentStatusTimeline: {
            ...order.paymentStatusTimeline,
            failedAt: new Date(),
          },
        },
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      logger.info("Order updated to CANCELLED due to payment failure:", {
        orderId,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("Error handling payment failed:", {
        orderId,
        error: error,
      });
    }
  }

  // Placeholder for future payment operations
  generatePaymentLink = async (req: Request, res: Response) => {
    res.status(httpStatus.NOT_IMPLEMENTED).send({
      success: false,
      message:
        "Not implemented. Payment link is generated during order creation.",
      status: httpStatus.NOT_IMPLEMENTED,
    });
  };
}

const paymentController = new PaymentController();
export default paymentController;
