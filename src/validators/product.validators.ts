import Joi from "joi";
import id from "./id.validators";

export const createProductValidatorSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().trim().required(),
    description: Joi.string().trim().allow(""),
    price: Joi.number().positive().required(),
    category: Joi.string().trim(),
    stock: Joi.number().min(0).required(),
    images: Joi.array().items(Joi.string().uri()).default([]),
  }),
});

export const updateProductValidatorSchema = Joi.object({
  params: Joi.object({
    id: id,
  }),
  body: Joi.object({
    title: Joi.string().trim(),
    description: Joi.string().trim().allow(""),
    price: Joi.number().positive(),
    category: Joi.string().trim(),
    stock: Joi.number().min(0),
    images: Joi.array().items(Joi.string().uri()),
  }),
});

export const deleteProductValidatorSchema = Joi.object({
  params: Joi.object({
    id: id,
  }),
});

export const getProductValidatorSchema = Joi.object({
  params: Joi.object({
    id: id,
  }),
});

export const getPresignedUrlValidatorSchema = Joi.object({
  body: Joi.object({
    folder: Joi.string().trim().required(),
    public_id: Joi.string().trim().required(),
    resource_type: Joi.string().valid("image", "video").default("image"),
  }),
});
