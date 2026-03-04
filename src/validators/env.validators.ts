import Joi from "joi";

const envValidatorSchema = Joi.object({
  PORT: Joi.number().default(5000),
  NODE_ENV: Joi.string().required(),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.string().required(),
  MAIL_USER: Joi.string().required(),
  MAIL_PASSWORD: Joi.string().required(),
  CLOUDINARY_SECRET: Joi.string().required(),
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_KEY: Joi.string().required(),
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),
  STRIPE_CURRENCY: Joi.string().default("inr"),
  FRONTEND_URL: Joi.string().required(),
}).unknown(true);

export default envValidatorSchema;
