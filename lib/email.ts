import "server-only";

import nodemailer, { type SendMailOptions } from "nodemailer";

type EmailBody =
  | { text: string; html?: string }
  | { text?: string; html: string };

export type SendEmailOptions = EmailBody & {
  to: NonNullable<SendMailOptions["to"]>;
  cc?: SendMailOptions["cc"];
  bcc?: SendMailOptions["bcc"];
  replyTo?: SendMailOptions["replyTo"];
  subject: string;
};

type EmailClient = {
  transporter: ReturnType<typeof nodemailer.createTransport>;
  from: string;
};

let emailClient: EmailClient | undefined;

function getRequiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getSmtpPort() {
  const rawPort = process.env.SMTP_PORT?.trim() || "587";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`SMTP_PORT must be a valid port number, received: ${rawPort}`);
  }

  return port;
}

function getSmtpSecure(port: number) {
  const value = process.env.SMTP_SECURE?.trim().toLowerCase();

  if (!value) {
    return port === 465;
  }

  if (value !== "true" && value !== "false") {
    throw new Error("SMTP_SECURE must be either true or false");
  }

  return value === "true";
}

function getEmailClient() {
  if (emailClient) {
    return emailClient;
  }

  const port = getSmtpPort();

  emailClient = {
    transporter: nodemailer.createTransport({
      host: getRequiredEnvironmentVariable("SMTP_HOST"),
      port,
      secure: getSmtpSecure(port),
      auth: {
        user: getRequiredEnvironmentVariable("SMTP_USER"),
        pass: getRequiredEnvironmentVariable("SMTP_PASSWORD"),
      },
    }),
    from: getRequiredEnvironmentVariable("SMTP_FROM"),
  };

  return emailClient;
}

export async function sendEmail(message: SendEmailOptions) {
  const { transporter, from } = getEmailClient();

  return transporter.sendMail({ ...message, from });
}

export async function verifyEmailConnection() {
  const { transporter } = getEmailClient();

  await transporter.verify();
}
