import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import mongoose, {
  PaginateOptions,
  QueryFilter,
  Types,
  UpdateQuery,
} from "mongoose";

import { Product } from "@models";
import {
  adminProfileService,
  analyticsLogger,
  orderService,
  paymentService,
  productService,
  stripeService,
  userDetailService,
} from "@services";
import { catchAsync, logger, ServerError } from "@utils";
import {
  IOrder,
  IOrderDoc,
  IOrderItem,
  IOrderStatusTimeline,
  IPaymentItem,
  IPaymentStatusTimeline,
  IUser,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  UserRoles,
} from "@types";

const ORDER_STATUS_META = {
  [OrderStatus.ACCEPTED]: {
    field: "acceptedAt" as const,
    log: analyticsLogger.logOrderConfirmed.bind(analyticsLogger),
  },
  [OrderStatus.CONFIRMED]: {
    field: "confirmedAt" as const,
    log: analyticsLogger.logOrderConfirmed.bind(analyticsLogger),
  },
  [OrderStatus.CANCELLED]: {
    field: "cancelledAt" as const,
    log: analyticsLogger.logOrderCancelled.bind(analyticsLogger),
  },
  [OrderStatus.SHIPPING]: {
    field: "shippedAt" as const,
    log: analyticsLogger.logOrderShipped.bind(analyticsLogger),
  },
  [OrderStatus.FULFILLED]: {
    field: "fulfilledAt" as const,
    log: analyticsLogger.logOrderFulfilled.bind(analyticsLogger),
  },
} as const;
type TrackableStatus = keyof typeof ORDER_STATUS_META;

class OrderController {
  createOrder = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = (req.user as IUser)._id;
      const { items, address } = req.body;
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Validate items
        if (!items || items.length === 0) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message: "Order items are required",
              status: httpStatus.BAD_REQUEST,
            }),
          );
        }

        // Check for existing pending orders to prevent duplicate payments
        const existingPendingOrder = await orderService.findOne(
          {
            user: userId,
            paymentStatus: PaymentStatus.PENDING,
            orderStatus: { $in: [OrderStatus.CREATED, OrderStatus.PENDING] },
          },
          {},
          { session },
        );

        if (existingPendingOrder) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message:
                "You already have a pending order. Please complete or cancel it before creating a new one.",
              status: httpStatus.BAD_REQUEST,
              meta: {
                existingOrderId: existingPendingOrder._id,
              },
            }),
          );
        }

        // Check if user has userDetails with at least one address
        const userDetails = await userDetailService.findOne(
          { user: userId, "addresses._id": address },
          { addresses: { $elemMatch: { _id: address } } },
          { session },
        );

        if (!userDetails) {
          throw new ServerError({
            message: "Missing shipping address",
            status: httpStatus.BAD_REQUEST,
            meta: { action: "Add address via PUT /api/users/me" },
          });
        }

        // Extract all product IDs from request
        const requestedIds = items.map((item: IOrderItem) =>
          item.product.toString(),
        );

        // Batch fetch all products in single query (avoids N+1)
        const products = await productService.find(
          { _id: { $in: requestedIds } },
          {},
          { session },
        );

        // Create map for quick lookup
        const productMap = new Map(products.map((p) => [p._id.toString(), p]));

        // Check for missing products
        const missingProductIds = requestedIds.filter(
          (id: string) => !productMap.has(id),
        );

        if (missingProductIds.length) {
          await session.abortTransaction();
          session.endSession();

          logger.error(
            `Products not found for IDs: ${missingProductIds.join(", ")}`,
            {
              context: "Product not found",
            },
          );

          return next(
            new ServerError({
              message: "Some products do not exist",
              status: httpStatus.BAD_REQUEST,
              meta: { missingProductIds },
            }),
          );
        }

        // Validate stock availability (but do NOT deduct yet - will deduct in initPayment)
        const orderItems: IOrderItem[] = [];
        let subtotal = 0;
        const outOfStockProducts: string[] = [];

        for (const item of items) {
          const product = productMap.get(item.product.toString());

          // Check if variant is specified and validate variant stock
          if (item.variant) {
            const variant = product.variants?.find(
              (v) => v._id?.toString() === item.variant?.toString(),
            );

            if (!variant) {
              await session.abortTransaction();
              session.endSession();
              return next(
                new ServerError({
                  message: `Variant not found for product: ${product.title}`,
                  status: httpStatus.BAD_REQUEST,
                }),
              );
            }

            if (variant.stock < item.quantity) {
              outOfStockProducts.push(
                `${product.title} (Size: ${variant.size})`,
              );
            }

            orderItems.push({
              product: product._id,
              price: product.price,
              quantity: item.quantity,
              variant: variant._id,
              size: variant.size,
            });
          } else {
            // Use global stock if no variant specified
            if (product.stock < item.quantity) {
              outOfStockProducts.push(product.title);
            }

            orderItems.push({
              product: product._id,
              price: product.price,
              quantity: item.quantity,
            });
          }

          subtotal += product.price * item.quantity;
        }

        // Check for out of stock products
        if (outOfStockProducts.length) {
          await session.abortTransaction();
          session.endSession();

          return next(
            new ServerError({
              message: `Insufficient stock for products: ${outOfStockProducts.join(", ")}`,
              status: httpStatus.BAD_REQUEST,
              meta: { outOfStockProducts },
            }),
          );
        }

        // Fetch admin profile to get tax rate
        const adminProfile = await adminProfileService.findOne(
          {},
          { taxRate: 1, currency: 1 },
        );
        const taxRate = adminProfile?.taxRate || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const totalAmount = subtotal + taxAmount;

        // Calculate CGST and SGST (split tax equally for intra-state supply in India)
        const cgstAmount = taxRate > 0 ? taxAmount / 2 : 0;
        const sgstAmount = taxRate > 0 ? taxAmount / 2 : 0;

        // Create order with tax breakdown (PENDING status, stock NOT deducted yet)
        const order = (await orderService.create(
          {
            user: userId,
            address: address,
            items: orderItems,
            subtotal,
            taxRate,
            taxAmount,
            cgstAmount,
            sgstAmount,
            totalAmount,
            paymentStatus: PaymentStatus.PENDING,
            orderStatus: OrderStatus.PENDING,
          } as Partial<IOrderDoc>,
          { session },
        )) as Partial<IOrderDoc>;

        // Log analytics
        await analyticsLogger.logOrderCreated(
          userId.toString(),
          order!._id.toString(),
          totalAmount,
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(httpStatus.CREATED).send({
          success: true,
          message:
            "Order created successfully. Proceed to payment to complete your order.",
          data: {
            order: {
              _id: order._id,
              user: order.user,
              items: order.items,
              subtotal: order.subtotal,
              taxAmount: order.taxAmount,
              cgstAmount: order.cgstAmount,
              sgstAmount: order.sgstAmount,
              totalAmount: order.totalAmount,
              paymentStatus: order.paymentStatus,
              orderStatus: order.orderStatus,
              createdAt: order.createdAt,
            },
          },
          status: httpStatus.CREATED,
        });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    },
  );

  initPayment = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = (req.user as IUser)._id;
      const { orderId } = req.body;
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Find the order
        const order = await orderService.findById(orderId, {}, { session });

        if (!order) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message: "Order not found",
              status: httpStatus.NOT_FOUND,
            }),
          );
        }

        // Check if user owns the order
        if (order.user.toString() !== userId.toString()) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message: "Unauthorized to initialize payment for this order",
              status: httpStatus.FORBIDDEN,
            }),
          );
        }

        // Check if order is in PENDING status
        if (
          order.orderStatus !== OrderStatus.PENDING ||
          order.paymentStatus !== PaymentStatus.PENDING
        ) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message:
                "Order is not in pending state. Payment can only be initialized for pending orders.",
              status: httpStatus.BAD_REQUEST,
              meta: {
                orderStatus: order.orderStatus,
                paymentStatus: order.paymentStatus,
              },
            }),
          );
        }

        // Check if payment record already exists
        const existingPayment = await paymentService.findOne(
          { order: order._id },
          {},
          { session },
        );

        if (existingPayment) {
          // If payment is already successful, return existing payment info
          if (existingPayment.status === PaymentStatus.SUCCESS) {
            await session.commitTransaction();
            session.endSession();
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Payment already completed",
              data: {
                order,
                payment: {
                  status: existingPayment.status,
                  paidAt: existingPayment.paidAt,
                },
              },
              status: httpStatus.OK,
            });
          }

          // If payment is pending and has payment link, return existing link
          if (
            existingPayment.status === PaymentStatus.PENDING &&
            existingPayment.stripeData?.paymentLinkId
          ) {
            await session.commitTransaction();
            session.endSession();
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Payment link already generated",
              data: {
                order,
                payment: {
                  paymentLinkId: existingPayment.stripeData.paymentLinkId,
                  status: existingPayment.status,
                  amount: existingPayment.amount,
                  currency: existingPayment.currency,
                },
              },
              status: httpStatus.OK,
            });
          }
        }

        // Build product map for payment link generation
        const productIds = order.items.map((item) => item.product.toString());
        const products = await productService.find(
          { _id: { $in: productIds } },
          {},
          { session },
        );
        const productMap = new Map(products.map((p) => [p._id.toString(), p]));

        // CRITICAL: Validate stock availability with locking
        // Use optimistic locking to prevent race conditions
        const stockValidationResults: Array<{
          productId: string;
          variantId?: string;
          requestedQuantity: number;
          availableStock: number;
          locked: boolean;
        }> = [];

        for (const item of order.items) {
          if (item.variant) {
            // For variant items, use findOneAndUpdate with condition for atomic locking
            const variantLockResult = await Product.findOneAndUpdate(
              {
                _id: item.product,
                "variants._id": item.variant,
                "variants.stock": { $gte: item.quantity },
              },
              {
                $inc: { "variants.$[variant].stock": -item.quantity },
              },
              {
                session,
                arrayFilters: [{ "variant._id": item.variant }],
                new: true,
              },
            );

            if (!variantLockResult) {
              // Stock locking failed - either product/variant doesn't exist or insufficient stock
              const product = productMap.get(item.product.toString());
              const variant = product?.variants?.find(
                (v) => v._id?.toString() === item.variant?.toString(),
              );
              stockValidationResults.push({
                productId: item.product.toString(),
                variantId: item.variant.toString(),
                requestedQuantity: item.quantity,
                availableStock: variant?.stock || 0,
                locked: false,
              });
            } else {
              stockValidationResults.push({
                productId: item.product.toString(),
                variantId: item.variant.toString(),
                requestedQuantity: item.quantity,
                availableStock:
                  variantLockResult.variants?.find(
                    (v) => v._id?.toString() === item.variant?.toString(),
                  )?.stock || 0,
                locked: true,
              });
            }
          } else {
            // For non-variant items, lock global stock
            const productLockResult = await Product.findOneAndUpdate(
              {
                _id: item.product,
                stock: { $gte: item.quantity },
              },
              {
                $inc: { stock: -item.quantity },
              },
              {
                session,
                new: true,
              },
            );

            if (!productLockResult) {
              // Stock locking failed - insufficient stock
              const product = productMap.get(item.product.toString());
              stockValidationResults.push({
                productId: item.product.toString(),
                requestedQuantity: item.quantity,
                availableStock: product?.stock || 0,
                locked: false,
              });
            } else {
              stockValidationResults.push({
                productId: item.product.toString(),
                requestedQuantity: item.quantity,
                availableStock: productLockResult.stock,
                locked: true,
              });
            }
          }
        }

        // Check if any stock locking failed
        const failedLocks = stockValidationResults.filter(
          (result) => !result.locked,
        );

        if (failedLocks.length > 0) {
          await session.abortTransaction();
          session.endSession();

          // Update order status to FAILED with reason
          const failureReason = `Insufficient stock: ${failedLocks
            .map((lock) => {
              const product = productMap.get(lock.productId);
              if (lock.variantId) {
                const variant = product?.variants?.find(
                  (v) => v._id?.toString() === lock.variantId,
                );
                return `${product?.title} (Size: ${variant?.size}) - Requested: ${lock.requestedQuantity}, Available: ${lock.availableStock}`;
              }
              return `${product?.title} - Requested: ${lock.requestedQuantity}, Available: ${lock.availableStock}`;
            })
            .join("; ")}`;

          await orderService.update(
            { _id: order._id },
            {
              orderStatus: OrderStatus.FAILED,
              failedReason: failureReason,
            },
          );

          return next(
            new ServerError({
              message:
                "Insufficient stock available. Some items in your order are no longer available in the requested quantity.",
              status: httpStatus.BAD_REQUEST,
              meta: {
                failedItems: failedLocks.map((lock) => ({
                  productId: lock.productId,
                  variantId: lock.variantId,
                  requestedQuantity: lock.requestedQuantity,
                  availableStock: lock.availableStock,
                })),
                failureReason,
              },
            }),
          );
        }

        // Stock successfully locked, now update order with reservedStock
        const orderItemsWithReservedStock = order.items.map((item) => ({
          ...item,
          reservedStock: item.quantity,
        }));

        await orderService.update(
          { _id: order._id },
          {
            items: orderItemsWithReservedStock,
          },
          { session },
        );

        // Stock successfully locked, now create payment link
        const paymentLink = await stripeService.generatePaymentLink({
          items: order.items.map((item) => {
            const product = productMap.get(item.product.toString());
            return {
              productId: item.product.toString(),
              productName: product.title,
              quantity: item.quantity,
              unitPrice: item.price,
              variantId: item.variant?.toString(),
              size: item.size,
            };
          }),
          orderId: order._id.toString(),
          userId: userId.toString(),
          taxAmount: order.taxAmount,
          taxDescription: `Tax (${order.taxRate}%)`,
        });

        // Create payment items
        const paymentItems: IPaymentItem[] = order.items.map((item) => {
          const product = productMap.get(item.product.toString());
          return {
            productId: item.product,
            productName: product.title,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity,
          };
        });

        // Create or update payment record
        // NOTE: paymentIntentId is NOT stored here - it will be populated by webhook
        // when payment_intent.succeeded event is received
        if (existingPayment) {
          await paymentService.update(
            { _id: existingPayment._id },
            {
              paymentLinkId: paymentLink.paymentLinkId,
              status: PaymentStatus.PENDING,
              amount: order.totalAmount,
              currency: "inr",
              items: paymentItems,
              stripeData: {
                paymentLinkId: paymentLink.paymentLinkId,
                checkoutSessionId: paymentLink.paymentLinkId,
              },
            },
            { session },
          );
        } else {
          await paymentService.create(
            {
              order: order._id as Types.ObjectId,
              user: userId,
              paymentLinkId: paymentLink.paymentLinkId,
              paymentMethod: PaymentMethod.STRIPE,
              status: PaymentStatus.PENDING,
              amount: order.totalAmount,
              currency: "inr",
              items: paymentItems,
              stripeData: {
                paymentLinkId: paymentLink.paymentLinkId,
                checkoutSessionId: paymentLink.paymentLinkId,
              },
            },
            { session },
          );
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(httpStatus.OK).send({
          success: true,
          message: "Payment link generated successfully",
          data: {
            order: {
              _id: order._id,
              orderStatus: order.orderStatus,
              paymentStatus: order.paymentStatus,
              totalAmount: order.totalAmount,
            },
            payment: {
              paymentUrl: paymentLink.paymentLinkUrl,
              paymentLinkId: paymentLink.paymentLinkId,
              amount: order.totalAmount,
              currency: "inr",
              expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            },
          },
          status: httpStatus.OK,
        });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    },
  );

  cancelOrder = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const { id } = req.params as { id: string };
        const userId = (req.user as IUser)._id;

        const order = await orderService.findById(id, {}, { session });

        if (!order) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message: "Order not Ffound",
              status: httpStatus.NOT_FOUND,
            }),
          );
        }

        // Check if user owns the order OR is an admin
        const isAdmin = (req.user as IUser).role === UserRoles.ADMIN;
        if (!isAdmin && order.user.toString() !== userId.toString()) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message: "Unauthorized to cancel this order",
              status: httpStatus.FORBIDDEN,
            }),
          );
        }

        // Check if order is already cancelled
        if (order.orderStatusTimeLine?.cancelledAt) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message: "Order is already cancelled",
              status: httpStatus.BAD_REQUEST,
              meta: {
                cancelledAt: order.orderStatusTimeLine.cancelledAt,
              },
            }),
          );
        }

        // Check if order can be cancelled (not shipped yet)
        if (order.orderStatusTimeLine?.shippedAt) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message: "Cannot cancel order after it has been shipped",
              status: httpStatus.BAD_REQUEST,
            }),
          );
        }

        if (
          order.orderStatus === OrderStatus.SHIPPING ||
          order.orderStatus === OrderStatus.FULFILLED
        ) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message: "Cannot cancel order that is already shipped",
              status: httpStatus.BAD_REQUEST,
            }),
          );
        }

        // Check if payment was successful - process refund if applicable
        let refundProcessed = false;
        let refundId: string | undefined;
        const refundAmount = order.totalAmount;

        // First: Restore stock immediately (regardless of payment status)
        const stockRestoreOperations = order.items.flatMap((item) => {
          if (item.variant) {
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

        // Second: Process refund if payment was successful
        if (order.paymentStatus === PaymentStatus.SUCCESS) {
          // Find payment record
          const payment = await paymentService.findOne(
            { order: order._id },
            {},
            { session },
          );

          if (payment && payment.paymentIntentId) {
            logger.info("Processing refund for cancelled order:", {
              orderId: order._id.toString(),
              paymentIntentId: payment.paymentIntentId,
              amount: refundAmount,
            });

            try {
              // Initiate refund via Stripe
              const refund = await stripeService.createRefund({
                paymentIntentId: payment.paymentIntentId,
                amount: refundAmount,
                reason: "requested_by_customer",
                metadata: {
                  orderId: order._id.toString(),
                  cancelledBy: userId.toString(),
                  cancelReason: "Customer requested cancellation",
                },
              });

              refundId = refund.id;
              refundProcessed = true;

              // Update payment record with refund details
              await paymentService.update(
                { _id: payment._id },
                {
                  refundStatus: RefundStatus.PROCESSING,
                  refundedAt: new Date(),
                  stripeData: {
                    ...payment.stripeData,
                    refundId: refund.id,
                    refundStatus: RefundStatus.PENDING,
                    refundAmount: refundAmount,
                    refundReason: "requested_by_customer",
                  },
                },
                { session },
              );

              logger.info("Refund initiated successfully:", {
                orderId: order._id.toString(),
                refundId: refund.id,
                status: refund.status,
              });
            } catch (refundError) {
              logger.error("Refund failed for cancelled order:", {
                orderId: order._id.toString(),
                paymentIntentId: payment.paymentIntentId,
                error: refundError,
              });

              // Continue with cancellation but mark refund as failed
              if (payment) {
                await paymentService.update(
                  { _id: payment._id },
                  {
                    refundStatus: RefundStatus.FAILED,
                    stripeData: {
                      ...payment.stripeData,
                      refundFailureReason:
                        refundError instanceof Error
                          ? refundError.message
                          : "Unknown refund error",
                    },
                  },
                  { session },
                );
              }
            }
          }
        }

        // Update order status to CANCELLED
        const updatedOrder = await orderService.update(
          { _id: order._id },
          {
            orderStatus: OrderStatus.CANCELLED,
            orderStatusTimeLine: {
              ...order.orderStatusTimeLine,
              cancelledAt: new Date(),
            },
            $set: {
              "items.$[].reservedStock": 0,
            },
          },
          { session },
        );

        // Log analytics
        await analyticsLogger.logOrderCancelled(
          userId.toString(),
          order._id.toString(),
          refundProcessed ? "Refund processed" : undefined,
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(httpStatus.OK).send({
          success: true,
          message: refundProcessed
            ? "Order cancelled successfully. Refund has been initiated."
            : "Order cancelled successfully",
          data: {
            order: updatedOrder,
            refund: refundProcessed
              ? {
                  refundId,
                  amount: refundAmount,
                  status: "processing",
                  message: "Refund will be processed within 5-10 business days",
                }
              : undefined,
          },
          status: httpStatus.OK,
        });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    },
  );

  handleOrderStatusChange = async (
    status: TrackableStatus,
    order: IOrderDoc,
    timelineUpdate: Partial<IOrderStatusTimeline>,
  ) => {
    const meta = ORDER_STATUS_META[status];
    timelineUpdate[meta.field] = new Date();
    await meta.log(order.user.toString(), order._id.toString());
  };

  updateOrderStatus = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const { id } = req.params as { id: string };
        const {
          orderStatus,
          paymentStatus,
          estimatedDeliveryDate,
          failedReason,
        } = req.body;

        const order = await orderService.findById(id, {}, { session });

        if (!order) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new ServerError({
              message: "Order not found",
              status: httpStatus.NOT_FOUND,
            }),
          );
        }

        const updateData: UpdateQuery<IOrder> = {};

        // Update order status if provided
        if (orderStatus && orderStatus !== order.orderStatus) {
          // Check payment status for ACCEPTED order
          if (orderStatus === OrderStatus.ACCEPTED) {
            if (order.paymentStatus !== PaymentStatus.SUCCESS) {
              await session.abortTransaction();
              session.endSession();
              return next(
                new ServerError({
                  message: "Cannot accept order without successful payment",
                  status: httpStatus.BAD_REQUEST,
                }),
              );
            }

            // Require estimated delivery date when accepting order
            if (!estimatedDeliveryDate) {
              await session.abortTransaction();
              session.endSession();
              return next(
                new ServerError({
                  message:
                    "Estimated delivery date is required when accepting an order",
                  status: httpStatus.BAD_REQUEST,
                }),
              );
            }

            updateData.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
          }

          updateData.orderStatus = orderStatus as OrderStatus;

          // Update timeline based on status
          const timelineUpdate: IPaymentStatusTimeline & IOrderStatusTimeline =
            {};

          await this.handleOrderStatusChange(
            orderStatus,
            order,
            timelineUpdate,
          );

          updateData.orderStatusTimeLine = {
            ...order.orderStatusTimeLine,
            ...timelineUpdate,
          };

          // Handle FAILED status - restore stock
          if (orderStatus === OrderStatus.FAILED) {
            // Store failed reason
            updateData.failedReason = failedReason;

            // Restore product stock
            const stockRestoreOperations = order.items.flatMap((item) => {
              if (item.variant) {
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

            // Clear reservedStock - will be done in the same update
            await orderService.update(
              { _id: order._id },
              {
                $set: {
                  "items.$[].reservedStock": 0,
                },
              },
              { session },
            );
          }
        }

        // Update payment status if provided
        if (paymentStatus && paymentStatus !== order.paymentStatus) {
          updateData.paymentStatus = paymentStatus as PaymentStatus;

          const timelineUpdate: IPaymentStatusTimeline = {};

          if (paymentStatus === PaymentStatus.SUCCESS) {
            timelineUpdate.successAt = new Date();
            await analyticsLogger.logPaymentSuccess(
              order.user.toString(),
              order._id.toString(),
              order.totalAmount,
            );
          } else if (paymentStatus === PaymentStatus.FAILED) {
            timelineUpdate.failedAt = new Date();
            await analyticsLogger.logPaymentFailed(
              order.user.toString(),
              order._id.toString(),
            );
          }

          updateData.paymentStatusTimeline = {
            ...order.paymentStatusTimeline,
            ...timelineUpdate,
          };
        }

        const updatedOrder = await orderService.update(
          { _id: order._id },
          updateData,
        );

        // Log status change
        await analyticsLogger.logOrderStatusChanged(
          order.user.toString(),
          order._id.toString(),
          updateData.orderStatus || order.orderStatus,
          updateData.paymentStatus || order.paymentStatus,
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(httpStatus.OK).send({
          success: true,
          message: "Order status updated successfully",
          data: updatedOrder,
          status: httpStatus.OK,
        });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    },
  );

  getOrder = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params as { id: string };
      const userId = (req.user as IUser)._id;

      const order = await orderService.findById(id);

      if (!order) {
        return next(
          new ServerError({
            message: "Order not found",
            status: httpStatus.NOT_FOUND,
          }),
        );
      }

      // Check if user owns the order (admin check handled by route middleware)
      if (order.user.toString() !== userId.toString()) {
        return next(
          new ServerError({
            message: "Unauthorized to view this order",
            status: httpStatus.FORBIDDEN,
          }),
        );
      }

      return res.status(httpStatus.OK).send({
        success: true,
        message: "Order retrieved successfully",
        data: order,
        status: httpStatus.OK,
      });
    },
  );

  getOrders = catchAsync(async (req: Request, res: Response) => {
    const userId = (req.user as IUser)._id;
    const {
      page = 1,
      limit = 10,
      status,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = -1,
    } = req.query;

    const query: QueryFilter<IOrderDoc> = { user: userId };

    if (status) {
      query.orderStatus = status as OrderStatus;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.totalAmount = {
        ...(minPrice !== undefined && { $gte: Number(minPrice) }),
        ...(maxPrice !== undefined && { $lte: Number(maxPrice) }),
      };
    }

    const options: PaginateOptions = {
      page: Number(page),
      limit: Number(limit),
      sort: { [sortBy as string]: Number(sortOrder) },
    };

    const result = await orderService.paginate(query, options);

    return res.status(httpStatus.OK).send({
      success: true,
      message: "Orders retrieved successfully",
      data: result.docs,
      pagination: {
        totalDocs: result.totalDocs,
        limit: result.limit,
        page: result.page,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
        nextPage: result.nextPage,
        prevPage: result.prevPage,
      },
      status: httpStatus.OK,
    });
  });

  getAllOrders = catchAsync(async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = -1,
    } = req.query;

    const query: QueryFilter<IOrderDoc> = {};

    if (status) {
      query.orderStatus = status as OrderStatus;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus as PaymentStatus;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.totalAmount = {
        ...(minPrice !== undefined && { $gte: Number(minPrice) }),
        ...(maxPrice !== undefined && { $lte: Number(maxPrice) }),
      };
    }

    const options: PaginateOptions = {
      page: Number(page),
      limit: Number(limit),
      sort: { [sortBy as string]: Number(sortOrder) },
      populate: [
        {
          path: "user",
          select: "name email",
        },
      ],
    };

    const result = await orderService.paginate(query, options);

    return res.status(httpStatus.OK).send({
      success: true,
      message: "Orders retrieved successfully",
      data: result.docs,
      pagination: {
        totalDocs: result.totalDocs,
        limit: result.limit,
        page: result.page,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
        nextPage: result.nextPage,
        prevPage: result.prevPage,
      },
      status: httpStatus.OK,
    });
  });
}

const orderController = new OrderController();
export default orderController;
