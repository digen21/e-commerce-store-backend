export interface MailVerificationInput {
  id: string;
  email: string;
  verificationToken: string;
}

export interface MailResetPasswordInput {
  email: string;
  resetToken: string;
}
