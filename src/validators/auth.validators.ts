import Joi from "joi";

export const registerValidatorSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().trim().required(),
    password: Joi.string().min(6).max(18).trim().required(),
    name: Joi.string().trim().required(),
  }),
});

export const loginValidatorSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().trim().required(),
    password: Joi.string().min(6).max(18).trim().required(),
  }),
});

export const verifyMailValidatorSchema = Joi.object({
  query: Joi.object({
    token: Joi.string().required(),
  }),
});

export const forgotPasswordValidatorSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().trim().required(),
  }),
});

export const resetPasswordValidatorSchema = Joi.object({
  body: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(6).max(18).trim().required(),
  }),
});

export const resendVerificationEmailValidatorSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().trim().required(),
  }),
});
