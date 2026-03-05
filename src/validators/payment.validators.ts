import Joi from "joi";
import id from "./id.validators";

export const getInvoiceValidatorSchema = Joi.object({
  params: Joi.object({
    orderId: id.required(),
  }),
});
