import { env } from "../config/env";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export const sendForgotPasswordEmail = async (
  email: string,
  tempPassword: string,
  userName: string
) => {
  const mailOptions = {
    from: env.SMTP_FROM,
    to: email,
    subject: "UniBus - Password Reset",
    html: `
      <h2>Password Reset Request</h2>
      <p>Hello ${userName},</p>
      <p>We received a request to reset your password. Here is your temporary password:</p>
      <div style="background-color: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <code style="font-size: 18px; font-weight: bold;">${tempPassword}</code>
      </div>
      <p>Please use this password to log in to your account and change it to a new password of your choice.</p>
      <p><strong>For your security:</strong></p>
      <ul>
        <li>Change your password immediately after logging in</li>
        <li>Do not share this password with anyone</li>
      </ul>
      <p>If you did not request this password reset, please ignore this email or contact support.</p>
      <br>
      <p>Best regards,<br>UniBus Team</p>
    `,
  };

  return transporter.sendMail(mailOptions);
};
