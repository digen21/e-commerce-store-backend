import nodemailer from "nodemailer";

import { env } from "@config";

const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD } = env;

const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: MAIL_PORT,
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASSWORD,
  },
});

export default transporter;
