/**
 * Factory for creating EmailService instances based on configuration
 */

import { EmailService, EmailConfig } from './types';
import { SESEmailService } from './ses.service';
import { MockEmailService } from './mock.service';
import { ServiceConfig, ServiceMetrics } from '../aws/base-service';

export type EmailProvider = 'ses' | 'mock' | 'sendgrid' | 'postmark' | 'resend';

export interface EmailServiceFactory {
  create(
    provider?: EmailProvider,
    config?: EmailConfig & ServiceConfig,
    metrics?: ServiceMetrics
  ): EmailService;
}

class DefaultEmailServiceFactory implements EmailServiceFactory {
  create(
    provider?: EmailProvider,
    config?: EmailConfig & ServiceConfig,
    metrics?: ServiceMetrics
  ): EmailService {
    const emailProvider = provider || (process.env.EMAIL_PROVIDER as EmailProvider) || 'ses';

    switch (emailProvider) {
      case 'ses':
        return new SESEmailService(config, metrics);
      
      case 'mock':
        return new MockEmailService();
      
      case 'sendgrid':
        // Placeholder for future SendGrid implementation
        throw new Error('SendGrid provider not yet implemented');
      
      case 'postmark':
        // Placeholder for future Postmark implementation
        throw new Error('Postmark provider not yet implemented');
      
      case 'resend':
        // Placeholder for future Resend implementation
        throw new Error('Resend provider not yet implemented');
      
      default:
        throw new Error(`Unknown email provider: ${emailProvider}`);
    }
  }
}

// Singleton instance
let factory: EmailServiceFactory = new DefaultEmailServiceFactory();

/**
 * Create an EmailService instance based on environment configuration
 */
export function createEmailService(
  config?: EmailConfig & ServiceConfig,
  metrics?: ServiceMetrics
): EmailService {
  return factory.create(undefined, config, metrics);
}

/**
 * Create an EmailService instance with a specific provider
 */
export function createEmailServiceWithProvider(
  provider: EmailProvider,
  config?: EmailConfig & ServiceConfig,
  metrics?: ServiceMetrics
): EmailService {
  return factory.create(provider, config, metrics);
}

/**
 * Set a custom factory implementation (useful for testing)
 */
export function setEmailServiceFactory(customFactory: EmailServiceFactory): void {
  factory = customFactory;
}

/**
 * Reset to the default factory
 */
export function resetEmailServiceFactory(): void {
  factory = new DefaultEmailServiceFactory();
}