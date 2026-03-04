import "dotenv/config";

import { envValidatorSchema } from "@validators";

const { error, value } = envValidatorSchema.validate(process.env);

if (error) throw new Error(`missing env variable ${error.message}`);

const env = {
  PORT: value.PORT,
  NODE_ENV: value.NODE_ENV,
  JWT_SECRET: value.JWT_SECRET,
  DATABASE_URL: value.DATABASE_URL,
  EXPIRY_TIME: "5d",
  IS_DEV: value.NODE_ENV === "development",
  IS_PROD: value.NODE_ENV === "production",
  MAIL_HOST: value.MAIL_HOST,
  MAIL_PORT: value.MAIL_PORT,
  MAIL_USER: value.MAIL_USER,
  MAIL_PASSWORD: value.MAIL_PASSWORD,
  CLOUDINARY_SECRET: value.CLOUDINARY_SECRET,
  CLOUDINARY_CLOUD_NAME: value.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_KEY: value.CLOUDINARY_KEY,
  STRIPE_SECRET_KEY: value.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: value.STRIPE_WEBHOOK_SECRET,
  STRIPE_CURRENCY: value.STRIPE_CURRENCY || "inr",
  FRONTEND_URL: value.FRONTEND_URL,
};

export default env;
