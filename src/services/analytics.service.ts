import { analyticsService } from "@services";
import { EventType, IAnalyticsMetaData } from "@types";

class AnalyticsLogger {
  async logOrderEvent(
    user: string,
    eventType: EventType,
    metadata?: IAnalyticsMetaData,
  ): Promise<void> {
    try {
      await analyticsService.create({
        user: user,
        eventType,
        metadata,
      });
    } catch (error) {
      console.error("Failed to log analytics event:", error);
    }
  }

  async logOrderCreated(
    user: string,
    order: string,
    totalAmount: number,
  ): Promise<void> {
    return this.logOrderEvent(user, EventType.ORDER_CREATED, {
      order,
      cartValue: totalAmount,
    });
  }

  async logOrderConfirmed(user: string, order: string): Promise<void> {
    return this.logOrderEvent(user, EventType.ORDER_CONFIRMED, {
      order,
    });
  }

  async logOrderCancelled(
    user: string,
    order: string,
    reason?: string,
  ): Promise<void> {
    return this.logOrderEvent(user, EventType.ORDER_CANCELLED, {
      order,
      reason,
    });
  }

  async logOrderShipped(user: string, order: string): Promise<void> {
    return this.logOrderEvent(user, EventType.ORDER_SHIPPED, {
      order,
    });
  }

  async logOrderFulfilled(user: string, order: string): Promise<void> {
    return this.logOrderEvent(user, EventType.ORDER_FULFILLED, {
      order,
    });
  }

  async logOrderStatusChanged(
    user: string,
    order: string,
    orderStatus: string,
    paymentStatus?: string,
  ): Promise<void> {
    return this.logOrderEvent(user, EventType.ORDER_STATUS_CHANGED, {
      order,
      orderStatus,
      paymentStatus,
    });
  }

  async logPaymentSuccess(
    user: string,
    order: string,
    amount: number,
  ): Promise<void> {
    return this.logOrderEvent(user, EventType.PAYMENT_SUCCESS, {
      order,
      cartValue: amount,
    });
  }

  async logPaymentFailed(
    user: string,
    order: string,
    reason?: string,
  ): Promise<void> {
    return this.logOrderEvent(user, EventType.PAYMENT_FAILED, {
      order,
      reason,
    });
  }
}

export const analyticsLogger = new AnalyticsLogger();
