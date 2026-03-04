import Joi from "joi";
import id from "./id.validators";

const AddressSchema = Joi.object({
  fullName: Joi.string().trim().required(),
  phone: Joi.string().trim().required(),
  addressLine1: Joi.string().trim().required(),
  addressLine2: Joi.string().trim().allow(""),
  city: Joi.string().trim().required(),
  state: Joi.string().trim().required(),
  postalCode: Joi.string().trim().required(),
  country: Joi.string().trim().default("India"),
});

export const createUserDetailsValidatorSchema = Joi.object({
  body: Joi.object({
    addresses: Joi.array().items(AddressSchema).default([]),
  }),
});

export const updateUserDetailsValidatorSchema = Joi.object({
  body: Joi.object({
    addresses: Joi.array().items(AddressSchema),
  }),
});

export const getUserDetailsValidatorSchema = Joi.object({
  params: Joi.object({
    id,
  }),
});
