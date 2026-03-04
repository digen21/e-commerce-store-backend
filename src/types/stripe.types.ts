export interface StripeServiceInput extends CreatePaymentLinkInput {
  subtotal?: number;
  taxAmount?: number;
  taxDescription?: string;
}

export interface StripeLineItem {
  price_data: {
    currency: string;
    product_data: {
      name: string;
      description?: string;
    };
    unit_amount: number;
  };
  quantity: number;
}

export interface CreatePaymentLinkInput {
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  orderId: string;
  userId: string;
}

export interface CreatePaymentLinkOutput {
  paymentLinkId: string;
  paymentLinkUrl: string;
  paymentIntentId: string;
}
