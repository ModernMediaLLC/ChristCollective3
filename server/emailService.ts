import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { Campaign, Donation } from '@shared/schema';

interface DonationEmailData {
  recipientEmail: string;
  recipientName: string;
  donation: {
    amount: number;
    tip: number;
    total: number;
    transactionId: string;
    date: Date;
  };
  campaign: {
    title: string;
    description: string;
  };
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private resend: Resend | null = null;
  private useResend: boolean = false;

  constructor() {
    // Initialize with Resend if API key is available, otherwise use Ethereal
    this.initializeEmailService();
  }

  private async initializeEmailService() {
    // Check if Resend API key is available
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
      this.useResend = true;
      console.log('Email service initialized with Resend');
    } else {
      // Fallback to Ethereal for development
      try {
        const testAccount = await nodemailer.createTestAccount();
        
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        console.log('Email service initialized with test account:', testAccount.user);
      } catch (error) {
        console.error('Failed to initialize email service:', error);
      }
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string, userName?: string): Promise<boolean> {
    try {
      const baseUrl = process.env.APP_URL || 'https://www.christcollective.com';
      
      // URL-encode the token to prevent issues with special characters
      const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #D4AF37; margin: 0;">Christ Collective</h1>
            </div>
            <div style="background-color: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
              ${userName ? `<p>Hello ${userName},</p>` : '<p>Hello,</p>'}
              <p>We have received a request to reset your password at Christ Collective.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #D4AF37; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 14px;">${resetLink}</p>
              <p style="color: #e74c3c; font-weight: bold; margin-top: 20px;">⚠️ This link expires after 1 hour</p>
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              <p style="font-size: 12px; color: #999; text-align: center;">
                © ${new Date().getFullYear()} Christ Collective. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `;

      if (this.useResend && this.resend) {
        // Use Resend for production email delivery
        const { data, error } = await this.resend.emails.send({
          from: 'Christ Collective <contact@christcollective.info>',
          to: [to],
          subject: 'Reset Your Password - Christ Collective',
          html: emailHtml,
        });

        if (error) {
          console.error('Error sending password reset email via Resend:', error);
          throw new Error(`Failed to send email: ${error.message}`);
        }

        console.log('Password reset email sent via Resend:', data?.id);
        return true;
      } else {
        // Fallback to Ethereal/Nodemailer for development
        if (!this.transporter) {
          console.error('Email transporter not initialized');
          return false;
        }

        const mailOptions = {
          from: '"Christ Collective" <contact@christcollective.info>',
          to: to,
          subject: 'Reset Your Password - Christ Collective',
          html: emailHtml,
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log('Password reset email sent:', info.messageId);
        
        // For development with Ethereal email, log the preview URL
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log('📧 Password reset email preview URL:', previewUrl);
        }
        
        return true;
      }
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return false;
    }
  }

  async sendEmailVerification(to: string, verificationToken: string, userName?: string): Promise<boolean> {
    try {
      const baseUrl = process.env.APP_URL || 'https://www.christcollective.com';

      const verifyLink = `${baseUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #D4AF37; margin: 0;">Christ Collective</h1>
            </div>
            <div style="background-color: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
              ${userName ? `<p>Hello ${userName},</p>` : '<p>Hello,</p>'}
              <p>Welcome to Christ Collective! Please verify your email address to activate your account.</p>
              <p>Click the button below to verify your email:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyLink}" style="background-color: #D4AF37; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 14px;">${verifyLink}</p>
              <p style="color: #e74c3c; font-weight: bold; margin-top: 20px;">This link expires after 24 hours</p>
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                If you didn't create an account with Christ Collective, you can safely ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              <p style="font-size: 12px; color: #999; text-align: center;">
                &copy; ${new Date().getFullYear()} Christ Collective. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `;

      if (this.useResend && this.resend) {
        const { data, error } = await this.resend.emails.send({
          from: 'Christ Collective <contact@christcollective.info>',
          to: [to],
          subject: 'Verify Your Email - Christ Collective',
          html: emailHtml,
        });

        if (error) {
          console.error('Error sending verification email via Resend:', error);
          throw new Error(`Failed to send email: ${error.message}`);
        }

        console.log('Verification email sent via Resend:', data?.id);
        return true;
      } else {
        if (!this.transporter) {
          console.error('Email transporter not initialized');
          return false;
        }

        const mailOptions = {
          from: '"Christ Collective" <contact@christcollective.info>',
          to: to,
          subject: 'Verify Your Email - Christ Collective',
          html: emailHtml,
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log('Verification email sent:', info.messageId);

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log('Verification email preview URL:', previewUrl);
        }

        return true;
      }
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return false;
    }
  }

  async sendDonationConfirmation(data: DonationEmailData): Promise<boolean> {
    try {
      const html = this.generateDonationReceiptHTML(data);
      const text = this.generateDonationReceiptText(data);

      if (this.useResend && this.resend) {
        const { data: result, error } = await this.resend.emails.send({
          from: 'Christ Collective <contact@christcollective.info>',
          to: [data.recipientEmail],
          subject: 'Thank You for Your Donation - Christ Collective',
          html,
          text,
        });

        if (error) {
          console.error('Error sending donation confirmation via Resend:', error);
          return false;
        }

        console.log('Donation confirmation email sent via Resend:', result?.id);
        return true;
      }

      if (!this.transporter) {
        console.error('Email transporter not initialized');
        return false;
      }

      const mailOptions = {
        from: '"Christ Collective" <contact@christcollective.info>',
        to: data.recipientEmail,
        subject: 'Thank You for Your Donation - Christ Collective',
        html,
        text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Donation confirmation email sent:', info.messageId);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('📧 Donation email preview URL:', previewUrl);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to send donation confirmation email:', error);
      return false;
    }
  }

  private generateDonationReceiptHTML(data: DonationEmailData): string {
    const { recipientName, donation, campaign } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Donation Receipt - Christ Collective</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #D4AF37; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .receipt-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #D4AF37; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          .divider { border-top: 1px solid #eee; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank You for Your Donation</h1>
            <p>Christ Collective</p>
          </div>
          
          <div class="content">
            <h2>Dear ${recipientName},</h2>
            <p>Thank you for your generous donation to support <strong>${campaign.title}</strong>. Your contribution makes a meaningful difference in advancing our mission of uniting Christians worldwide.</p>
            
            <div class="receipt-box">
              <h3>Donation Receipt</h3>
              <div class="divider"></div>
              
              <p><strong>Campaign:</strong> ${campaign.title}</p>
              <p><strong>Donation Amount:</strong> $${donation.amount.toFixed(2)}</p>
              ${donation.tip > 0 ? `<p><strong>Platform Tip:</strong> $${donation.tip.toFixed(2)}</p>` : ''}
              <div class="divider"></div>
              <p><strong>Total Amount:</strong> <span class="amount">$${donation.total.toFixed(2)}</span></p>
              <p><strong>Transaction ID:</strong> ${donation.transactionId}</p>
              <p><strong>Date:</strong> ${donation.date.toLocaleDateString()}</p>
            </div>
            
            <p>This email serves as your official donation receipt. Please keep this for your records.</p>
            
            <p>Your support helps us:</p>
            <ul>
              <li>Connect Christians across denominational boundaries</li>
              <li>Support business networking and growth</li>
              <li>Enable content creators to share their faith</li>
              <li>Fund community outreach and charitable initiatives</li>
            </ul>
            
            <p>If you have any questions about your donation, please contact us at contact@christcollective.info.</p>
            
            <p>Blessings,<br>The Christ Collective Team</p>
          </div>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Christ Collective. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDonationReceiptText(data: DonationEmailData): string {
    const { recipientName, donation, campaign } = data;
    
    return `
Thank You for Your Donation - Christ Collective

Dear ${recipientName},

Thank you for your generous donation to support ${campaign.title}. Your contribution makes a meaningful difference in advancing our mission of uniting Christians worldwide.

DONATION RECEIPT
================

Campaign: ${campaign.title}
Donation Amount: $${donation.amount.toFixed(2)}
${donation.tip > 0 ? `Platform Tip: $${donation.tip.toFixed(2)}\n` : ''}Total Amount: $${donation.total.toFixed(2)}
Transaction ID: ${donation.transactionId}
Date: ${donation.date.toLocaleDateString()}

This email serves as your official donation receipt. Please keep this for your records.

Your support helps us:
- Connect Christians across denominational boundaries
- Support business networking and growth
- Enable content creators to share their faith
- Fund community outreach and charitable initiatives

If you have any questions about your donation, please contact us at contact@christcollective.info.

Blessings,
The Christ Collective Team

--
© ${new Date().getFullYear()} Christ Collective. All rights reserved.
This is an automated message. Please do not reply to this email.
    `;
  }
}

export const emailService = new EmailService();