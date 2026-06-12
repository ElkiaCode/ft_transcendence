import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST') ?? 'localhost',
      port: Number(this.configService.get<string>('SMTP_PORT') ?? 1025),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
    this.from =
      this.configService.get<string>('SMTP_FROM') ??
      'Transcendence <no-reply@transcendence.local>';
    this.frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ??
      'https://localhost:8443'
    ).replace(/\/+$/, '');
  }

  async sendDataErasureConfirmation(email: string, token: string) {
    const confirmationUrl = `${this.frontendUrl}/rgpd/confirm-deletion?token=${encodeURIComponent(token)}`;

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Confirm deletion of your Transcendence data',
      text: [
        'You requested the permanent deletion of your Transcendence account and personal data.',
        '',
        `Confirm this operation: ${confirmationUrl}`,
        '',
        'This link expires soon. If you did not make this request, you can ignore this email.',
      ].join('\n'),
      html: [
        '<p>You requested the permanent deletion of your Transcendence account and personal data.</p>',
        `<p><a href="${confirmationUrl}">Confirm permanent deletion</a></p>`,
        '<p>This link expires soon. If you did not make this request, you can ignore this email.</p>',
      ].join(''),
    });
  }

  async sendDataErasureCompleted(email: string) {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Your Transcendence data has been deleted',
      text: 'Your Transcendence account and associated personal data have been permanently deleted.',
      html: '<p>Your Transcendence account and associated personal data have been permanently deleted.</p>',
    });
  }
}
