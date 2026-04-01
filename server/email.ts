import { Resend } from 'resend';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Use the verified christcollective.info domain for sending emails
const getEmailSender = () => {
  return 'Christ Collective <no-reply@christcollective.info>';
};

export interface SendPasswordResetEmailParams {
  to: string;
  resetToken: string;
  userName?: string;
}

export async function sendPasswordResetEmail({ to, resetToken, userName }: SendPasswordResetEmailParams) {
  const baseUrl = process.env.APP_URL ?? 'https://christcollective3-production.up.railway.app';
  
  // URL-encode the token to prevent issues with special characters
  const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  try {
    const { data, error } = await resend.emails.send({
      from: getEmailSender(),
      to: [to],
      subject: 'Reset Password',
      html: `
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
      `,
    });

    if (error) {
      console.error('Error sending password reset email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log('Password reset email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in sendPasswordResetEmail:', error);
    throw error;
  }
}

export interface OrderConfirmationEmailParams {
  to: string;
  customerName: string;
  orderId: number;
  productName: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  currency: string;
  shippingAddress: {
    name: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export async function sendOrderConfirmationEmail(params: OrderConfirmationEmailParams) {
  const { to, customerName, orderId, productName, quantity, unitAmount, totalAmount, currency, shippingAddress } = params;
  
  console.log(`📧 Attempting to send order confirmation email to: ${to} for order #${orderId}`);
  
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  const baseUrl = process.env.APP_URL ?? 'https://christcollective3-production.up.railway.app';

  try {
    const { data, error } = await resend.emails.send({
      from: getEmailSender(),
      to: [to],
      subject: `Order Confirmation #${orderId} - Christ Collective`,
      html: `
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
              <h2 style="color: #D4AF37; margin-top: 0;">Order Confirmed!</h2>
              <p>Hello ${customerName},</p>
              <p>Thank you for your purchase! Your order has been confirmed and is being processed.</p>
              
              <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #333;">Order #${orderId}</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
                      <strong>${productName}</strong><br>
                      <span style="color: #666;">Qty: ${quantity} × ${formatPrice(unitAmount)}</span>
                    </td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold;">
                      ${formatPrice(totalAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; font-weight: bold;">Total</td>
                    <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #D4AF37; font-size: 18px;">
                      ${formatPrice(totalAmount)}
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #333;">Shipping Address</h3>
                <p style="margin: 0;">
                  ${shippingAddress.name}<br>
                  ${shippingAddress.address}<br>
                  ${shippingAddress.address2 ? shippingAddress.address2 + '<br>' : ''}
                  ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}
                </p>
              </div>

              <p>We'll send you another email with tracking information once your order ships.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/shop" style="background-color: #D4AF37; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Continue Shopping</a>
              </div>

              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              <p style="font-size: 12px; color: #999; text-align: center;">
                © ${new Date().getFullYear()} Christ Collective. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending order confirmation email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log('Order confirmation email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in sendOrderConfirmationEmail:', error);
    throw error;
  }
}
