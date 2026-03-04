import { env, transporter } from "@config";
import { MailResetPasswordInput, MailVerificationInput } from "@types";
import { logger } from "@utils";

class MailService {
  async sendVerificationMail(mailVerificationInput: MailVerificationInput) {
    try {
      const options = {
        from: env.MAIL_USER,
        to: mailVerificationInput.email,
        subject: "Verification Email",
        // basically the FE URL
        html: `<a href="${env.FRONTEND_URL}/verify-mail?token=${mailVerificationInput.verificationToken}">Click Here To Verify Mail</a>`,
      };

      const info = await transporter.sendMail(options);

      return info.messageId && info.accepted?.length > 0;
    } catch (error) {
      logger.error("Failed to send verification mail", {
        context: "Nodemailer",
        error,
      });
    }
  }

  async sendResetPasswordMail(mailResetPasswordInput: MailResetPasswordInput) {
    try {
      const options = {
        from: env.MAIL_USER,
        to: mailResetPasswordInput.email,
        subject: "Reset Password",
        html: `<a href="${env.FRONTEND_URL}/reset-password?token=${mailResetPasswordInput.resetToken}">Click Here To Reset Password</a>`,
      };

      const info = await transporter.sendMail(options);

      return info.messageId && info.accepted?.length > 0;
    } catch (error) {
      logger.error("Failed to send reset password mail", {
        context: "Nodemailer",
        error,
      });
    }
  }
}

const mailService = new MailService();
export default mailService;
