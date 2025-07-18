/**
 * Mock implementation of EmailService for testing
 */

import {
  EmailService,
  EmailAddress,
  SendEmailParams,
  SendBulkEmailParams,
  EmailError,
  EmailErrorCode,
} from './types';

interface MockEmail {
  messageId: string;
  to: string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export class MockEmailService implements EmailService {
  private sentEmails: MockEmail[] = [];
  private verifiedEmails: Set<string> = new Set(['test@example.com', 'noreply@mile-quest.com']);
  private verifiedDomains: Set<string> = new Set(['mile-quest.com', 'example.com']);
  private suppressedEmails: Set<string> = new Set();
  private mockDelay: number = 0;
  private shouldFailNext: boolean = false;
  private nextFailureError: EmailError | null = null;
  private messageIdCounter: number = 1;

  constructor() {
    // Add some default verified emails
    this.verifiedEmails.add('test@example.com');
    this.verifiedEmails.add('noreply@mile-quest.com');
    this.verifiedEmails.add('support@mile-quest.com');
  }

  // Helper methods for testing
  setMockDelay(ms: number): void {
    this.mockDelay = ms;
  }

  failNext(error?: EmailError): void {
    this.shouldFailNext = true;
    this.nextFailureError = error || new EmailError(
      'Mock failure',
      EmailErrorCode.SERVICE_ERROR
    );
  }

  getSentEmails(): MockEmail[] {
    return [...this.sentEmails];
  }

  clearMockData(): void {
    this.sentEmails = [];
    this.suppressedEmails.clear();
    this.shouldFailNext = false;
    this.nextFailureError = null;
    this.messageIdCounter = 1;
  }

  addVerifiedEmail(email: string): void {
    this.verifiedEmails.add(email);
  }

  addVerifiedDomain(domain: string): void {
    this.verifiedDomains.add(domain);
  }

  addSuppressedEmail(email: string): void {
    this.suppressedEmails.add(email);
  }

  // EmailService implementation
  async sendEmail(params: SendEmailParams): Promise<{ messageId: string }> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    // Validate sender
    const fromEmail = this.extractEmail(params.from || 'noreply@mile-quest.com');
    if (!this.isVerifiedSender(fromEmail)) {
      throw new EmailError(
        `Sender ${fromEmail} is not verified`,
        EmailErrorCode.UNVERIFIED_SENDER
      );
    }

    // Check for suppressed recipients
    const recipients = this.normalizeAddresses(params.to);
    for (const recipient of recipients) {
      if (this.suppressedEmails.has(recipient)) {
        throw new EmailError(
          `Recipient ${recipient} is suppressed`,
          EmailErrorCode.SUPPRESSED_RECIPIENT
        );
      }
    }

    // Validate content
    if (!params.html && !params.text) {
      throw new EmailError(
        'Email must have either HTML or text content',
        EmailErrorCode.INVALID_CONTENT
      );
    }

    const messageId = `mock-message-${this.messageIdCounter++}`;
    
    const mockEmail: MockEmail = {
      messageId,
      to: recipients,
      from: fromEmail,
      subject: params.subject,
      html: params.html,
      text: params.text,
      timestamp: new Date(),
      tags: params.tags,
    };

    this.sentEmails.push(mockEmail);
    
    return { messageId };
  }

  async sendBulkEmails(params: SendBulkEmailParams): Promise<{ messageIds: string[] }> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    const messageIds: string[] = [];
    
    for (const email of params.emails) {
      const result = await this.sendEmail({
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        from: params.from,
        replyTo: params.replyTo,
        tags: params.tags,
      });
      messageIds.push(result.messageId);
    }

    return { messageIds };
  }

  async sendTemplatedEmail(
    templateId: string,
    to: string | string[],
    templateData: Record<string, any>
  ): Promise<{ messageId: string }> {
    await this.delay();
    
    // Mock template rendering
    const mockTemplates: Record<string, { subject: string; html: string }> = {
      'welcome': {
        subject: 'Welcome to Mile Quest!',
        html: '<h1>Welcome {{name}}!</h1><p>Thanks for joining Mile Quest.</p>',
      },
      'password-reset': {
        subject: 'Reset your password',
        html: '<p>Click <a href="{{resetLink}}">here</a> to reset your password.</p>',
      },
    };

    const template = mockTemplates[templateId];
    if (!template) {
      throw new EmailError(
        `Template ${templateId} not found`,
        EmailErrorCode.TEMPLATE_NOT_FOUND
      );
    }

    // Simple template variable replacement
    let html = template.html;
    let subject = template.subject;
    
    Object.entries(templateData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value));
      subject = subject.replace(regex, String(value));
    });

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  async validateEmail(email: string): Promise<boolean> {
    await this.delay();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async verifyDomain(domain: string): Promise<boolean> {
    await this.delay();
    
    this.verifiedDomains.add(domain);
    return true;
  }

  async getSuppressedEmails(): Promise<string[]> {
    await this.delay();
    return Array.from(this.suppressedEmails);
  }

  async removeSuppressedEmail(email: string): Promise<void> {
    await this.delay();
    this.suppressedEmails.delete(email);
  }

  async getVerifiedDomains(): Promise<string[]> {
    await this.delay();
    return Array.from(this.verifiedDomains);
  }

  async getVerifiedEmails(): Promise<string[]> {
    await this.delay();
    return Array.from(this.verifiedEmails);
  }

  // Helper methods
  private async delay(): Promise<void> {
    if (this.mockDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }
  }

  private extractEmail(address: string | EmailAddress): string {
    if (typeof address === 'string') {
      // Extract email from "Name <email@example.com>" format
      const match = address.match(/<(.+)>/);
      return match ? match[1] : address;
    }
    return address.email;
  }

  private normalizeAddresses(
    addresses: string | string[] | EmailAddress | EmailAddress[]
  ): string[] {
    if (!addresses) return [];
    
    const addressArray = Array.isArray(addresses) ? addresses : [addresses];
    
    return addressArray.map(addr => this.extractEmail(addr));
  }

  private isVerifiedSender(email: string): boolean {
    // Check if email is verified
    if (this.verifiedEmails.has(email)) {
      return true;
    }
    
    // Check if domain is verified
    const domain = email.split('@')[1];
    return this.verifiedDomains.has(domain);
  }
}