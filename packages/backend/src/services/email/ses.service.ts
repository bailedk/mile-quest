/**
 * AWS SES implementation of the EmailService interface
 */

import {
  SESClient,
  SendEmailCommand,
  SendBulkTemplatedEmailCommand,
  SendTemplatedEmailCommand,
  VerifyEmailIdentityCommand,
  VerifyDomainIdentityCommand,
  ListVerifiedEmailAddressesCommand,
  ListIdentitiesCommand,
  GetIdentityVerificationAttributesCommand,
  PutConfigurationSetSuppressionOptionsCommand,
  ListSuppressedDestinationsCommand,
  DeleteSuppressedDestinationCommand,
  MessageTag,
  Destination,
  Message,
  Body,
  Content,
} from '@aws-sdk/client-ses';
import { BaseAWSService, ServiceConfig, ServiceMetrics } from '../aws/base-service';
import {
  EmailService,
  EmailAddress,
  SendEmailParams,
  SendBulkEmailParams,
  EmailConfig,
  EmailError,
  EmailErrorCode,
} from './types';

export class SESEmailService extends BaseAWSService implements EmailService {
  private client: SESClient;
  private defaultFrom: string | EmailAddress;
  private defaultReplyTo?: string | EmailAddress;
  private configurationSet?: string;
  private sandbox: boolean;

  constructor(config?: EmailConfig & ServiceConfig, metrics?: ServiceMetrics) {
    super('SESEmail', config, metrics);
    
    this.defaultFrom = config?.defaultFrom || this.getEnvVar('DEFAULT_FROM_EMAIL');
    this.defaultReplyTo = config?.defaultReplyTo;
    this.configurationSet = config?.configurationSet;
    this.sandbox = config?.sandbox ?? this.getEnvVar('SES_SANDBOX', 'true') === 'true';
    
    this.client = new SESClient({
      region: this.config.region,
      endpoint: this.config.endpoint,
      credentials: this.config.credentials,
    });

    this.validateConfig();
  }

  async sendEmail(params: SendEmailParams): Promise<{ messageId: string }> {
    return this.executeWithMetrics('sendEmail', async () => {
      try {
        const destination: Destination = {
          ToAddresses: this.normalizeAddresses(params.to),
          CcAddresses: params.cc ? this.normalizeAddresses(params.cc) : undefined,
          BccAddresses: params.bcc ? this.normalizeAddresses(params.bcc) : undefined,
        };

        const message: Message = {
          Subject: { Data: params.subject, Charset: 'UTF-8' },
          Body: this.createEmailBody(params.html, params.text),
        };

        const tags: MessageTag[] | undefined = params.tags
          ? Object.entries(params.tags).map(([name, value]) => ({ Name: name, Value: value }))
          : undefined;

        const command = new SendEmailCommand({
          Source: this.formatAddress(params.from || this.defaultFrom),
          Destination: destination,
          Message: message,
          ReplyToAddresses: params.replyTo 
            ? [this.formatAddress(params.replyTo)]
            : this.defaultReplyTo
            ? [this.formatAddress(this.defaultReplyTo)]
            : undefined,
          ConfigurationSetName: this.configurationSet,
          Tags: tags,
        });

        const response = await this.client.send(command);
        
        return {
          messageId: response.MessageId!,
        };
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async sendBulkEmails(params: SendBulkEmailParams): Promise<{ messageIds: string[] }> {
    return this.executeWithMetrics('sendBulkEmails', async () => {
      try {
        // For non-templated bulk emails, we'll send them individually
        // In a production environment, you might want to batch these
        const promises = params.emails.map(email => 
          this.sendEmail({
            to: email.to,
            subject: email.subject,
            html: email.html,
            text: email.text,
            from: params.from,
            replyTo: params.replyTo,
            tags: params.tags,
          })
        );

        const results = await Promise.all(promises);
        return {
          messageIds: results.map(r => r.messageId),
        };
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async sendTemplatedEmail(
    templateId: string,
    to: string | string[],
    templateData: Record<string, any>
  ): Promise<{ messageId: string }> {
    return this.executeWithMetrics('sendTemplatedEmail', async () => {
      try {
        const command = new SendTemplatedEmailCommand({
          Source: this.formatAddress(this.defaultFrom),
          Destination: {
            ToAddresses: this.normalizeAddresses(to),
          },
          Template: templateId,
          TemplateData: JSON.stringify(templateData),
          ConfigurationSetName: this.configurationSet,
        });

        const response = await this.client.send(command);
        
        return {
          messageId: response.MessageId!,
        };
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async validateEmail(email: string): Promise<boolean> {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return false;
    }

    // In sandbox mode, check if email is verified
    if (this.sandbox) {
      const verifiedEmails = await this.getVerifiedEmails();
      return verifiedEmails.includes(email);
    }

    return true;
  }

  async verifyDomain(domain: string): Promise<boolean> {
    return this.executeWithMetrics('verifyDomain', async () => {
      try {
        await this.client.send(
          new VerifyDomainIdentityCommand({ Domain: domain })
        );
        
        // Check verification status
        const response = await this.client.send(
          new GetIdentityVerificationAttributesCommand({
            Identities: [domain],
          })
        );

        const status = response.VerificationAttributes?.[domain];
        return status?.VerificationStatus === 'Success';
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async getSuppressedEmails(): Promise<string[]> {
    return this.executeWithMetrics('getSuppressedEmails', async () => {
      try {
        const suppressed: string[] = [];
        let nextToken: string | undefined;

        do {
          const response = await this.client.send(
            new ListSuppressedDestinationsCommand({
              NextToken: nextToken,
              PageSize: 100,
            })
          );

          if (response.SuppressedDestinationSummaries) {
            suppressed.push(
              ...response.SuppressedDestinationSummaries.map(s => s.EmailAddress!)
            );
          }

          nextToken = response.NextToken;
        } while (nextToken);

        return suppressed;
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async removeSuppressedEmail(email: string): Promise<void> {
    return this.executeWithMetrics('removeSuppressedEmail', async () => {
      try {
        await this.client.send(
          new DeleteSuppressedDestinationCommand({
            EmailAddress: email,
          })
        );
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async getVerifiedDomains(): Promise<string[]> {
    return this.executeWithMetrics('getVerifiedDomains', async () => {
      try {
        const response = await this.client.send(
          new ListIdentitiesCommand({ IdentityType: 'Domain' })
        );

        if (!response.Identities || response.Identities.length === 0) {
          return [];
        }

        // Get verification status for all domains
        const verificationResponse = await this.client.send(
          new GetIdentityVerificationAttributesCommand({
            Identities: response.Identities,
          })
        );

        return response.Identities.filter(domain => 
          verificationResponse.VerificationAttributes?.[domain]?.VerificationStatus === 'Success'
        );
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async getVerifiedEmails(): Promise<string[]> {
    return this.executeWithMetrics('getVerifiedEmails', async () => {
      try {
        const response = await this.client.send(
          new ListVerifiedEmailAddressesCommand({})
        );

        return response.VerifiedEmailAddresses || [];
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  protected async performHealthCheck(): Promise<void> {
    // Try to list verified email addresses as a health check
    await this.getVerifiedEmails();
  }

  protected mapError(error: any): Error {
    if (error instanceof EmailError) {
      return error;
    }

    const errorCode = error.name || error.Code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || 'An unknown error occurred';

    switch (errorCode) {
      case 'MessageRejected':
        return new EmailError(
          'Email rejected by SES',
          EmailErrorCode.SEND_FAILED,
          error
        );
      case 'MailFromDomainNotVerifiedException':
      case 'EmailNotVerifiedException':
        return new EmailError(
          'Sender email or domain not verified',
          EmailErrorCode.UNVERIFIED_SENDER,
          error
        );
      case 'InvalidParameterValue':
        return new EmailError(
          'Invalid email parameter',
          EmailErrorCode.INVALID_EMAIL,
          error
        );
      case 'Throttling':
      case 'TooManyRequestsException':
        return new EmailError(
          'Rate limit exceeded',
          EmailErrorCode.RATE_LIMITED,
          error
        );
      case 'ConfigurationSetDoesNotExist':
        return new EmailError(
          'Configuration set not found',
          EmailErrorCode.CONFIGURATION_ERROR,
          error
        );
      case 'TemplateDoesNotExist':
        return new EmailError(
          'Email template not found',
          EmailErrorCode.TEMPLATE_NOT_FOUND,
          error
        );
      case 'AccountSuspended':
        return new EmailError(
          'SES account suspended',
          EmailErrorCode.SERVICE_ERROR,
          error
        );
      default:
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          return new EmailError(
            'Network error',
            EmailErrorCode.NETWORK_ERROR,
            error
          );
        }
        return new EmailError(
          errorMessage,
          EmailErrorCode.UNKNOWN_ERROR,
          error
        );
    }
  }

  private normalizeAddresses(
    addresses: string | string[] | EmailAddress | EmailAddress[]
  ): string[] {
    if (!addresses) return [];
    
    const addressArray = Array.isArray(addresses) ? addresses : [addresses];
    
    return addressArray.map(addr => {
      if (typeof addr === 'string') {
        return addr;
      }
      return this.formatAddress(addr);
    });
  }

  private formatAddress(address: string | EmailAddress): string {
    if (typeof address === 'string') {
      return address;
    }
    
    if (address.name) {
      // Format as "Name <email@example.com>"
      return `${address.name} <${address.email}>`;
    }
    
    return address.email;
  }

  private createEmailBody(html?: string, text?: string): Body {
    const body: Body = {};
    
    if (html) {
      body.Html = { Data: html, Charset: 'UTF-8' };
    }
    
    if (text) {
      body.Text = { Data: text, Charset: 'UTF-8' };
    }
    
    if (!html && !text) {
      throw new EmailError(
        'Email must have either HTML or text content',
        EmailErrorCode.INVALID_CONTENT
      );
    }
    
    return body;
  }
}