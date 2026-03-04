import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import mongoose, { QueryFilter, Types } from "mongoose";

import { Product } from "@models";
import {
  analyticsLogger,
  orderService,
  paymentService,
  productService,
  stripeService,
  userDetailService,
} from "@services";
import {
  IOrder,
  IOrderDoc,
  IOrderItem,
  IOrderStatusTimeline,
  IPaymentItem,
  IPaymentStatusTimeline,
  IUser,  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@types";
import { catchAsync, logger, ServerError } from "@utils";

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
          return next(
            new ServerError({
              message: "Order items are required",
              status: httpStatus.BAD_REQUEST,
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
            message: "Invalid or missing shipping address",
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

        // Validate stock and build order items
        const orderItems: IOrderItem[] = [];
        let totalAmount = 0;
        const outOfStockProducts: string[] = [];

        for (const item of items) {
          const product = productMap.get(item.product.toString());

          if (product.stock < item.quantity) {
            outOfStockProducts.push(product.title);
          }

          orderItems.push({
            product: product._id,
            price: product.price,
            quantity: item.quantity,
          });

          totalAmount += product.price * item.quantity;
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

        // Create order
        const order = await orderService.create({
          user: userId,
          address: address,
          items: orderItems,
          totalAmount,
          paymentStatus: PaymentStatus.PENDING,
          orderStatus: OrderStatus.CREATED,
        } as Partial<IOrderDoc>);

        // Update product stock (batch operation)
        const stockUpdateOperations = orderItems.map((item) => ({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { stock: -item.quantity } },
          },
        }));

        try {
          // Generate Stripe payment link
          const paymentLink = await stripeService.generatePaymentLink({
            items: orderItems.map((item) => {
              const product = productMap.get(item.product.toString());
              return {
                productId: item.product.toString(),
                productName: product.title,
                quantity: item.quantity,
                unitPrice: item.price,
              };
            }),
            orderId: order!._id.toString(),
            userId: userId.toString(),
          });

          // Create payment record
          const paymentItems: IPaymentItem[] = orderItems.map((item) => {
            const product = productMap.get(item.product.toString());
            return {
              productId: item.product,
              productName: product.title,
              quantity: item.quantity,
              unitPrice: item.price,
              totalPrice: item.price * item.quantity,
            };
          });

          await paymentService.create({
            order: order._id as Types.ObjectId,
            user: userId,
            paymentIntentId: paymentLink.paymentIntentId,
            paymentLinkId: paymentLink.paymentLinkId,
            paymentMethod: PaymentMethod.STRIPE,
            status: PaymentStatus.PENDING,
            amount: totalAmount,
            currency: "inr",
            items: paymentItems,
            stripeData: {
              paymentIntentId: paymentLink.paymentIntentId,
              paymentLinkId: paymentLink.paymentLinkId,
            },
          });

          if (stockUpdateOperations.length > 0) {
            await Product.bulkWrite(stockUpdateOperations, { session });
          }

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
            message: "Order created successfully. Please complete payment.",
            data: {
              order,
              payment: {
                paymentUrl: paymentLink.paymentLinkUrl,
                paymentIntentId: paymentLink.paymentIntentId,
                amount: totalAmount,
                currency: "inr",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              },
            },
            status: httpStatus.CREATED,
          });
        } catch (error) {
          await orderService.update(
            { _id: order._id },
            { orderStatus: OrderStatus.FAILED },
          );
          throw error;
        }
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
              message: "Unauthorized to cancel this order",
              status: httpStatus.FORBIDDEN,
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

        // Update order status
        const updatedOrder = await orderService.update(
          { _id: order._id },
          {
            orderStatus: OrderStatus.CANCELLED,
            orderStatusTimeLine: {
              ...order.orderStatusTimeLine,
              cancelledAt: new Date(),
            },
          },
        );

        // Restore product stock (batch operation)
        const stockRestoreOperations = order.items.map((item) => ({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { stock: item.quantity } },
          },
        }));

        if (stockRestoreOperations.length > 0) {
          await Product.bulkWrite(stockRestoreOperations, { session });
        }

        // Log analytics
        await analyticsLogger.logOrderCancelled(
          userId.toString(),
          order._id.toString(),
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(httpStatus.OK).send({
          success: true,
          message: "Order cancelled successfully",
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
        const { orderStatus, paymentStatus } = req.body;

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

        const updateData: Partial<IOrder> = {};

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

    const options = {
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

    const options = {
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
}

const orderController = new OrderController();
export default orderController;


