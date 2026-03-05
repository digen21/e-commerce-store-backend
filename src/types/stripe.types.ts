export interface StripeServiceInput extends CreatePaymentLinkInput {
  subtotal?: number;
  taxAmount?: number;
  taxDescription?: string;
}

export interface StripItemMetaData {
  productId: string;
  variantId?: string;
  size?: string;
}

export interface StripProductData {
  name: string;
  description?: string;
  metadata?: StripItemMetaData;
}

export interface StripeLineItem {
  price_data: {
    currency: string;
    product_data: StripProductData;
    unit_amount: number;
  };
  quantity: number;
}

export interface CreatePaymentLinkItems {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  variantId?: string;
  size?: string;
}

export interface CreatePaymentLinkInput {
  items: CreatePaymentLinkItems[];
  orderId: string;
  userId: string;
}

export interface CreatePaymentLinkOutput {
  paymentLinkId: string;
  paymentLinkUrl: string;
  paymentIntentId: string;
}
