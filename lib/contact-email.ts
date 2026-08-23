import "server-only";

import nodemailer from "nodemailer";
import { Resend } from "resend";

export type ContactNotification = {
  requestId: string;
  name: string;
  email: string;
  phone?: string;
  videoType: string;
  objective: string;
  deadline?: string;
  budget?: string;
  filesNote?: string;
  message?: string;
};

export async function sendContactNotification(input: ContactNotification) {
  const to = process.env.CONTACT_EMAIL_TO?.trim();
  const from = process.env.SMTP_FROM?.trim() || process.env.RESULT_EMAIL_FROM?.trim();
  if (!to || !from) throw new Error("Le destinataire des devis n’est pas configuré.");

  const subject = `[Rudyo AI] Nouvelle demande ${input.requestId}`;
  const text = [
    `Identifiant: ${input.requestId}`,
    `Nom: ${input.name}`,
    `E-mail: ${input.email}`,
    input.phone ? `Téléphone: ${input.phone}` : null,
    `Type de vidéo: ${input.videoType}`,
    `Objectif: ${input.objective}`,
    input.deadline ? `Échéance: ${input.deadline}` : null,
    input.budget ? `Budget: ${input.budget}` : null,
    input.filesNote ? `Fichiers: ${input.filesNote}` : null,
    input.message ? `Message: ${input.message}` : null,
  ].filter(Boolean).join("\n");

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  if (host && Number.isInteger(port) && port > 0 && user && password) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transporter.sendMail({ from, to, replyTo: input.email, subject, text });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const result = await new Resend(resendKey).emails.send({ from, to, replyTo: input.email, subject, text });
    if (result.error) throw new Error("Le fournisseur d’e-mail a refusé le devis.");
    return;
  }

  throw new Error("Aucun fournisseur d’e-mail de devis n’est configuré.");
}
