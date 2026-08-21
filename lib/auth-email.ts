import "server-only";

import nodemailer from "nodemailer";
import { Resend } from "resend";

function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  return host && Number.isInteger(port) && port > 0 && user && password && from
    ? { host, port, user, password, from }
    : null;
}

export async function sendLoginOtp(email: string, otp: string) {
  const subject = "Votre code de connexion Rudyo AI";
  const text = `Votre code Rudyo AI est ${otp}. Il expire dans 10 minutes et ne peut être utilisé qu’une fois.`;
  const smtp = smtpConfig();

  if (smtp) {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transporter.sendMail({ from: smtp.from, to: email, subject, text });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.SMTP_FROM || process.env.RESULT_EMAIL_FROM;
  if (resendKey && from) {
    const result = await new Resend(resendKey).emails.send({ from, to: email, subject, text });
    if (result.error) throw new Error("Le fournisseur d’e-mail a refusé la demande.");
    return;
  }

  throw new Error("Aucun fournisseur d’e-mail d’authentification n’est configuré.");
}
