import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";

import { Product } from "@models";
import { orderService, paymentService, stripeService } from "@services";
import { IUser, OrderStatus, PaymentStatus, StripeData } from "@types";
import { logger, ServerError } from "@utils";
import Stripe from "stripe";

class PaymentController {
  /**
   * Stripe webhook handler
   * Catches payment events and updates order status
   */
  webhook = async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
      logger.error("Missing Stripe signature");
      return res.status(httpStatus.BAD_REQUEST).send({
        success: false,
        message: "Missing Stripe signature",
        status: httpStatus.BAD_REQUEST,
      });
    }

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
      logger.error("Webhook signature verification failed:", { error });
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

    switch (event.type) {
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
    }

    return res.status(httpStatus.OK).send({
      success: true,
      message: "Webhook received successfully",
      status: httpStatus.OK,
    });
  };

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

      // Payment record must exist from initPayment
      const existingPayment = await paymentService.findOne(
        { order: orderId },
        {},
        { session },
      );

      if (!existingPayment) {
        await session.abortTransaction();
        session.endSession();
        logger.error("Payment record not found for order:", orderId);
        throw new ServerError({
          message: "Payment record not found",
          status: httpStatus.NOT_FOUND,
        });
      }

      // Update payment record with successful payment details
      const chargeId =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id;

      // Fetch charge to get invoice/receipt URL
      let invoiceUrl = null;
      let receiptNumber = null;
      if (chargeId) {
        try {
          const charge = await stripeService.getCharge(chargeId);
          invoiceUrl = charge.receipt_url || null;
          receiptNumber = charge.receipt_number || null;
        } catch (error) {
          logger.warn("Failed to fetch charge details for invoice:", error);
        }
      }

      // Update order to clear reservedStock (stock is now permanently deducted)
      await orderService.update(
        { _id: orderId },
        {
          $set: {
            "items.$[].reservedStock": 0,
          },
        },
        { session },
      );

      await paymentService.update(
        { _id: existingPayment._id },
        {
          paymentIntentId: paymentIntent.id,
          status: PaymentStatus.SUCCESS,
          amount: paymentIntent.amount / 100,
          stripeData: {
            paymentIntentId: paymentIntent.id,
            chargeId: chargeId || undefined,
            invoiceUrl,
            receiptNumber,
          },
          paidAt: new Date(),
        },
        { session },
      );

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
        error,
      });
      throw error;
    }
  }

  /**
   * Handle payment failed
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const { orderId } = paymentIntent.metadata || {};
    const failureReason =
      paymentIntent.last_payment_error?.message || "Payment failed";

    logger.info("Payment failed:", {
      paymentIntentId: paymentIntent.id,
      orderId,
      error: failureReason,
    });

    if (!orderId) {
      logger.error("Order ID missing in payment intent metadata");
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await orderService.findById(orderId, {}, { session });

      if (!order) {
        await session.abortTransaction();
        session.endSession();
        logger.error("Order not found for payment:", orderId);
        return;
      }

      // Payment record must exist from initPayment
      const existingPayment = await paymentService.findOne(
        { order: orderId },
        {},
        { session },
      );

      if (!existingPayment) {
        await session.abortTransaction();
        session.endSession();
        logger.error("Payment record not found for order:", orderId);
        return;
      }

      // Update payment record with failed status
      await paymentService.update(
        { _id: existingPayment._id },
        {
          paymentIntentId: paymentIntent.id,
          status: PaymentStatus.FAILED,
          amount: paymentIntent.amount / 100,
          stripeData: {
            paymentIntentId: paymentIntent.id,
            lastPaymentError: failureReason,
          },
          failedAt: new Date(),
          failedReason: failureReason,
        },
        { session },
      );

      // Restore stock and clear reservedStock
      const stockRestoreOperations = order.items.flatMap((item) => {
        if (item.variant) {
          // Restore variant stock
          return {
            updateOne: {
              filter: { _id: item.product, "variants._id": item.variant },
              update: {
                $inc: { "variants.$[variant].stock": item.quantity },
              },
              arrayFilters: [{ "variant._id": item.variant }],
            },
          };
        }
        // Restore global stock
        return {
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { stock: item.quantity } },
          },
        };
      });

      if (stockRestoreOperations.length > 0) {
        await Product.bulkWrite(stockRestoreOperations, { session });
      }

      // Update order status to FAILED and clear reservedStock
      await orderService.update(
        { _id: orderId },
        {
          paymentStatus: PaymentStatus.FAILED,
          orderStatus: OrderStatus.FAILED,
          failedReason: failureReason,
          $set: {
            "items.$[].reservedStock": 0,
          },
          paymentStatusTimeline: {
            ...order.paymentStatusTimeline,
            failedAt: new Date(),
          },
        },
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      logger.info("Order updated to FAILED due to payment failure:", {
        orderId,
        paymentIntentId: paymentIntent.id,
        reason: failureReason,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("Error handling payment failed:", {
        orderId,
        error,
      });
    }
  }

  /**
   * Fetch invoice URL from Stripe and store in database
   */
  private async fetchAndStoreInvoiceFromStripe(
    paymentId: string,
    paymentIntentId: string,
    existingStripeData?: StripeData,
  ): Promise<{
    invoiceUrl: string;
    receiptNumber?: string;
    chargeId?: string;
  }> {
    try {
      // Fetch payment intent from Stripe
      const paymentIntent =
        await stripeService.getPaymentIntent(paymentIntentId);

      // Get charge ID
      let chargeId = existingStripeData?.chargeId;
      if (!chargeId) {
        chargeId =
          typeof paymentIntent.latest_charge === "string"
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge?.id;
      }

      if (!chargeId) {
        throw new ServerError({
          message: "Charge ID not found for this payment",
          status: httpStatus.NOT_FOUND,
        });
      }

      // Fetch charge details from Stripe (includes receipt URL)
      const charge = await stripeService.getCharge(chargeId);
      const invoiceUrl = charge.receipt_url;
      const receiptNumber = charge.receipt_number;

      if (!invoiceUrl) {
        throw new ServerError({
          message: "Invoice URL not available from Stripe",
          status: httpStatus.NOT_FOUND,
        });
      }

      // Update payment record with invoice details
      await paymentService.update(
        { _id: paymentId },
        {
          stripeData: {
            ...existingStripeData,
            chargeId,
            invoiceUrl,
            receiptNumber,
          },
        },
      );

      logger.info("Fetched and stored invoice URL from Stripe:", {
        paymentId,
        invoiceUrl,
      });

      return { invoiceUrl, receiptNumber, chargeId };
    } catch (error) {
      logger.error("Failed to fetch invoice from Stripe:", error);
      throw error;
    }
  }

  /**
   * Get invoice for a successful payment
   * Returns invoice URL stored in database (from Stripe)
   */
  getInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const userId = (req.user as IUser)._id;

      const order = await orderService.findById(orderId);

      if (!order) {
        return next(
          new ServerError({
            message: "Order not found",
            status: httpStatus.NOT_FOUND,
          }),
        );
      }

      // Check if user owns the order
      if (order.user.toString() !== userId.toString()) {
        return next(
          new ServerError({
            message: "Unauthorized to view this invoice",
            status: httpStatus.FORBIDDEN,
          }),
        );
      }

      // Check if payment was successful
      if (order.paymentStatus !== PaymentStatus.SUCCESS) {
        return next(
          new ServerError({
            message: "Invoice not available. Payment not completed.",
            status: httpStatus.BAD_REQUEST,
          }),
        );
      }

      // Get payment details
      const payment = await paymentService.findOne({ order: orderId });

      if (!payment) {
        return next(
          new ServerError({
            message: "Payment record not found",
            status: httpStatus.NOT_FOUND,
          }),
        );
      }

      // Get invoice URL from stored stripeData
      let invoiceUrl = payment.stripeData?.invoiceUrl;
      let receiptNumber = payment.stripeData?.receiptNumber;
      let chargeId = payment.stripeData?.chargeId;

      // If invoice URL not stored, fetch from Stripe and store in database
      if (!invoiceUrl) {
        const paymentIntentId =
          payment.paymentIntentId || payment.stripeData?.paymentIntentId;

        if (!paymentIntentId) {
          return next(
            new ServerError({
              message: "Stripe payment intent ID not found",
              status: httpStatus.NOT_FOUND,
            }),
          );
        }

        try {
          const invoiceData = await this.fetchAndStoreInvoiceFromStripe(
            payment._id.toString(),
            paymentIntentId,
            payment.stripeData,
          );
          invoiceUrl = invoiceData.invoiceUrl;
          receiptNumber = invoiceData.receiptNumber;
          chargeId = invoiceData.chargeId;
        } catch (error) {
          if (error instanceof ServerError) {
            return next(error);
          }
          return next(
            new ServerError({
              message: "Failed to retrieve invoice from Stripe",
              status: httpStatus.BAD_GATEWAY,
            }),
          );
        }
      }

      if (!invoiceUrl) {
        return next(
          new ServerError({
            message: "Invoice not available from Stripe",
            status: httpStatus.NOT_FOUND,
          }),
        );
      }

      // Build invoice data from database
      const invoice = {
        invoiceNumber: `INV-${order._id.toString().slice(-8).toUpperCase()}`,
        invoiceDate: payment.paidAt || new Date(),
        stripeReceiptUrl: invoiceUrl,
        receiptNumber,
        chargeId,
        paymentIntentId:
          payment.paymentIntentId || payment.stripeData?.paymentIntentId,
        order: {
          _id: order._id,
          createdAt: order.createdAt,
        },
        customer: {
          userId: order.user,
        },
        items: order.items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
        })),
        subtotal: order.subtotal,
        tax: {
          rate: order.taxRate,
          amount: order.taxAmount,
          cgst: order.cgstAmount,
          sgst: order.sgstAmount,
        },
        total: order.totalAmount,
        payment: {
          method: payment.paymentMethod,
          status: payment.status,
          paidAt: payment.paidAt,
          transactionId:
            payment.paymentIntentId || payment.stripeData?.paymentIntentId,
        },
      };

      return res.status(httpStatus.OK).send({
        success: true,
        message: "Invoice retrieved successfully",
        data: invoice,
        status: httpStatus.OK,
      });
    } catch (error) {
      logger.error("Error getting invoice:", error);
      throw error;
    }
  };
}

const paymentController = new PaymentController();
export default paymentController;
