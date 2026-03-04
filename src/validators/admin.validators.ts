import Joi from "joi";

const AdminAddressSchema = Joi.object({
  addressLine1: Joi.string().required(),
  addressLine2: Joi.string().optional(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  postalCode: Joi.string().required(),
  country: Joi.string().required(),
});

export const adminProfileValidatorSchema = Joi.object({
  body: Joi.object({
    storeName: Joi.string().required().trim(),
    email: Joi.string().email().required().lowercase(),
    phone: Joi.string().required().trim(),
    gstn: Joi.string().trim().optional(),
    currency: Joi.string().uppercase().default("INR"),
    address: AdminAddressSchema.required(),
    taxRate: Joi.number().min(0).max(100).default(0),
    lowStockThreshold: Joi.number().min(0).default(10),
  }),
});
