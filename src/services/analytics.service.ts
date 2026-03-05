import { Order, Product } from "@models";
import { analyticsService } from "@services";
import {
  AnalyticPeriod,
  AnalyticTrend,
  DashboardMetrics,
  EventType,
  IAnalyticsMetaData,
  OrderStatus,
  PaymentStatus,
  SalePerformanceResponse,
  StatusDistribution,
} from "@types";

// Status color mapping for dashboard
const STATUS_COLORS: Record<string, string> = {
  FULFILLED: "#22c55e",
  SHIPPING: "#3b82f6",
  CONFIRMED: "#eab308",
  ACCEPTED: "#8b5cf6",
  CREATED: "#f97316",
  PENDING: "#06b6d4",
  CANCELLED: "#ef4444",
  FAILED: "#6b7280",
};

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

  /**
   * Get sales performance data with trends
   */
  async getSalesPerformance(
    period: AnalyticPeriod,
  ): Promise<SalePerformanceResponse> {
    const now = new Date();
    let startDate: Date;
    let dateGrouping: Record<string, unknown>;
    if (period === "weekly") {
      // Last 7 days (including today)
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      dateGrouping = {
        $dateToString: {
          format: "%Y-%m-%d",
          date: "$createdAt",
          timezone: "UTC",
        },
      };
    } else {
      // Last 6 months (including current month)
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 5);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      dateGrouping = {
        $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" },
      };
    }

    // Aggregate fulfilled orders with successful payment
    const aggregation = await Order.aggregate([
      {
        $match: {
          paymentStatus: PaymentStatus.SUCCESS,
          orderStatus: OrderStatus.FULFILLED,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: dateGrouping,
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Generate all expected date periods
    const trends: Array<AnalyticTrend> = [];
    const aggregationMap = new Map(
      aggregation.map((item) => [
        item._id,
        { revenue: item.revenue, orders: item.orders },
      ]),
    );

    if (period === "weekly") {
      // Generate last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const data = aggregationMap.get(dateStr) || { revenue: 0, orders: 0 };
        trends.push({
          date: dateStr,
          revenue: data.revenue,
          orders: data.orders,
        });
      }
    } else {
      // Generate last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const dateStr = `${year}-${month}`;

        const data = aggregationMap.get(dateStr) || { revenue: 0, orders: 0 };
        trends.push({
          date: dateStr,
          revenue: data.revenue,
          orders: data.orders,
        });
      }
    }

    // Calculate summary
    const totalRevenue = trends.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = trends.reduce((sum, item) => sum + item.orders, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      period,
      currency: "INR",
      trends,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      },
    };
  }

  /**
   * Get order status distribution data
   */
  async getOrderStatusDistribution(): Promise<{
    totalOrders: number;
    distribution: Array<StatusDistribution>;
  }> {
    // Aggregate orders by status
    const aggregation = await Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Calculate total orders
    const totalOrders = aggregation.reduce((sum, item) => sum + item.count, 0);

    // Build distribution array
    const distribution = aggregation.map((item) => ({
      status: item._id,
      count: item.count,
      percentage:
        totalOrders > 0
          ? Math.round((item.count / totalOrders) * 1000) / 10
          : 0,
      color: STATUS_COLORS[item._id] || "#9ca3af",
    }));

    return {
      totalOrders,
      distribution,
    };
  }

  /**
   * Get dashboard overview data with metrics comparison
   */
  async getDashboardOverview(): Promise<{
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    conversionRate: number;
    metrics: DashboardMetrics;
  }> {
    const now = new Date();
    const previousDate = new Date(now);
    previousDate.setDate(previousDate.getDate() - 30); // Compare with 30 days ago

    // Get current period stats (last 30 days)
    const currentOrdersAgg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: previousDate },
          paymentStatus: PaymentStatus.SUCCESS,
          orderStatus: OrderStatus.FULFILLED,
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
    ]);

    const currentStats = currentOrdersAgg[0] || {
      totalOrders: 0,
      totalRevenue: 0,
    };

    // Get previous period stats (30 days before)
    const previousOrdersAgg = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(previousDate.getTime() - 30 * 24 * 60 * 60 * 1000),
            $lt: previousDate,
          },
          paymentStatus: PaymentStatus.SUCCESS,
          orderStatus: OrderStatus.FULFILLED,
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
    ]);

    const previousStats = previousOrdersAgg[0] || {
      totalOrders: 0,
      totalRevenue: 0,
    };

    // Get total products count
    const totalProducts = await Product.countDocuments();

    // Get total orders (all time)
    const allTimeOrders = await Order.countDocuments();

    // Get all time revenue (only FULFILLED orders)
    const allTimeRevenueAgg = await Order.aggregate([
      {
        $match: {
          paymentStatus: PaymentStatus.SUCCESS,
          orderStatus: OrderStatus.FULFILLED,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);
    const allTimeRevenue = allTimeRevenueAgg[0]?.total || 0;

    // Calculate conversion rate (successful orders / total orders * 100)
    const successfulOrders = await Order.countDocuments({
      paymentStatus: PaymentStatus.SUCCESS,
    });
    const conversionRate =
      allTimeOrders > 0
        ? Math.round((successfulOrders / allTimeOrders) * 10000) / 100
        : 0;

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 1000) / 10;
    };

    const productsChange = 0; // Products don't have historical comparison in this implementation
    const ordersChange = calculateChange(
      currentStats.totalOrders,
      previousStats.totalOrders,
    );
    const revenueChange = calculateChange(
      currentStats.totalRevenue,
      previousStats.totalRevenue,
    );
    const conversionChange = 0; // Would need more complex tracking for historical conversion rates

    return {
      totalProducts,
      totalOrders: allTimeOrders,
      totalRevenue: Math.round(allTimeRevenue * 100) / 100,
      conversionRate,
      metrics: {
        productsChange,
        ordersChange,
        revenueChange,
        conversionChange,
      },
    };
  }
}

export const analyticsLogger = new AnalyticsLogger();
