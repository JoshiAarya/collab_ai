/**
 * Email Service - SendGrid Integration
 * Handles all email notifications (invites, notifications, etc.)
 */

import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@collabai.com';
    this.fromName = process.env.FROM_NAME || 'CollabAI';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    this.enabled = !!this.apiKey;

    if (!this.enabled) {
      logger.warn('SendGrid API key not configured - emails will be logged only');
    }
  }

  /**
   * Send email via SendGrid API
   */
  async sendEmail({ to, subject, html, text }) {
    if (!this.enabled) {
      logger.info('Email would be sent (SendGrid not configured)', {
        to,
        subject,
        preview: text?.substring(0, 100)
      });
      return { success: true, mock: true };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: to }]
          }],
          from: {
            email: this.fromEmail,
            name: this.fromName
          },
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid API error: ${error}`);
      }

      logger.info('Email sent successfully', { to, subject });
      return { success: true };

    } catch (error) {
      logger.error('Failed to send email', {
        to,
        subject,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send project invite email
   */
  async sendProjectInvite({ to, inviterName, projectTitle, inviteCode }) {
    const inviteUrl = `${this.frontendUrl}/join/${inviteCode}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          .code { background: #e5e7eb; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 2px; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 You're Invited to CollabAI</h1>
          </div>
          <div class="content">
            <p>Hi there!</p>
            <p><strong>${inviterName}</strong> has invited you to collaborate on the project:</p>
            <h2 style="color: #8b5cf6; margin: 20px 0;">${projectTitle}</h2>
            <p>Join the team and start collaborating with AI-powered discussions, document sharing, and intelligent insights.</p>
            
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="button">Join Project</a>
            </div>

            <p style="margin-top: 30px;">Or use this invite code:</p>
            <div class="code">${inviteCode}</div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              This invite link will take you directly to the project. If you don't have an account yet, you'll be able to create one.
            </p>
          </div>
          <div class="footer">
            <p>CollabAI - Real-Time AI Collaborative Workspace</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
You're invited to CollabAI!

${inviterName} has invited you to collaborate on: ${projectTitle}

Join the project: ${inviteUrl}

Or use invite code: ${inviteCode}

CollabAI - Real-Time AI Collaborative Workspace
    `.trim();

    return await this.sendEmail({
      to,
      subject: `You're invited to ${projectTitle} on CollabAI`,
      html,
      text
    });
  }

  /**
   * Send discussion invite email
   */
  async sendDiscussionInvite({ to, inviterName, projectTitle, discussionTitle, inviteCode, discussionId }) {
    // Use invite code format with discussion parameter
    const discussionUrl = `${this.frontendUrl}/join/${inviteCode}?discussion=${discussionId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10a37f 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #10a37f; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 New Discussion Invitation</h1>
          </div>
          <div class="content">
            <p>Hi there!</p>
            <p><strong>${inviterName}</strong> has invited you to join a discussion in <strong>${projectTitle}</strong>:</p>
            <h2 style="color: #10a37f; margin: 20px 0;">${discussionTitle}</h2>
            
            <div style="text-align: center;">
              <a href="${discussionUrl}" class="button">Join Discussion</a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Click the button above to join the discussion and start collaborating with your team.
            </p>
          </div>
          <div class="footer">
            <p>CollabAI - Real-Time AI Collaborative Workspace</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
New Discussion Invitation

${inviterName} has invited you to join a discussion in ${projectTitle}:

Discussion: ${discussionTitle}

Join here: ${discussionUrl}

CollabAI - Real-Time AI Collaborative Workspace
    `.trim();

    return await this.sendEmail({
      to,
      subject: `Join discussion: ${discussionTitle}`,
      html,
      text
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail({ to, username }) {
    const loginUrl = `${this.frontendUrl}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #8b5cf6; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to CollabAI!</h1>
            <p style="font-size: 18px; margin-top: 10px;">Your AI-powered collaboration journey starts here</p>
          </div>
          <div class="content">
            <p>Hi <strong>${username}</strong>!</p>
            <p>Welcome to CollabAI - where teams collaborate with the power of AI. We're excited to have you on board!</p>

            <h3 style="color: #8b5cf6; margin-top: 30px;">What you can do:</h3>

            <div class="feature">
              <strong>🚀 Create Projects</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280;">Start a new project and invite your team to collaborate in real-time.</p>
            </div>

            <div class="feature">
              <strong>💬 AI-Powered Discussions</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280;">Mention @CollabAI to get intelligent assistance and insights.</p>
            </div>

            <div class="feature">
              <strong>📄 Document Intelligence</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280;">Upload documents and let AI understand and reference them in discussions.</p>
            </div>

            <div class="feature">
              <strong>📊 Smart Dashboards</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280;">Get automatic insights, track decisions, and identify blockers.</p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${loginUrl}" class="button">Get Started</a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Need help? Check out our documentation or reach out to our support team.
            </p>
          </div>
          <div class="footer">
            <p>CollabAI - Real-Time AI Collaborative Workspace</p>
            <p>Happy collaborating! 🎯</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to CollabAI!

Hi ${username}!

Welcome to CollabAI - where teams collaborate with the power of AI.

What you can do:
- Create projects and invite your team
- Get AI assistance with @CollabAI mentions
- Upload documents for intelligent context
- Track decisions and insights automatically

Get started: ${loginUrl}

Happy collaborating!
CollabAI Team
    `.trim();

    return await this.sendEmail({
      to,
      subject: 'Welcome to CollabAI! 🎉',
      html,
      text
    });
  }
}

export default new EmailService();
