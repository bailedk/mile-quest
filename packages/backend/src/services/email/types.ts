/**
 * Email service interface and types
 * Provider-agnostic email abstraction
 */

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
  cid?: string; // For inline attachments
}

export interface SendEmailParams {
  to: string | string[] | EmailAddress | EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
  from?: string | EmailAddress;
  replyTo?: string | EmailAddress;
  cc?: string | string[] | EmailAddress | EmailAddress[];
  bcc?: string | string[] | EmailAddress | EmailAddress[];
  attachments?: EmailAttachment[];
  tags?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface SendBulkEmailParams {
  emails: Array<{
    to: string | string[] | EmailAddress | EmailAddress[];
    subject: string;
    html?: string;
    text?: string;
    substitutions?: Record<string, string>;
  }>;
  from?: string | EmailAddress;
  replyTo?: string | EmailAddress;
  template?: {
    subject: string;
    html?: string;
    text?: string;
  };
  tags?: Record<string, string>;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html?: string;
  text?: string;
  variables?: string[];
}

export interface EmailService {
  // Send operations
  sendEmail(params: SendEmailParams): Promise<{ messageId: string }>;
  sendBulkEmails(params: SendBulkEmailParams): Promise<{ messageIds: string[] }>;
  
  // Template operations
  sendTemplatedEmail(
    templateId: string,
    to: string | string[],
    templateData: Record<string, any>
  ): Promise<{ messageId: string }>;
  
  // Validation
  validateEmail(email: string): Promise<boolean>;
  verifyDomain(domain: string): Promise<boolean>;
  
  // Bounce/Complaint handling
  getSuppressedEmails(): Promise<string[]>;
  removeSuppressedEmail(email: string): Promise<void>;
  
  // Configuration
  getVerifiedDomains(): Promise<string[]>;
  getVerifiedEmails(): Promise<string[]>;
}

export interface EmailConfig {
  region?: string;
  defaultFrom?: string | EmailAddress;
  defaultReplyTo?: string | EmailAddress;
  configurationSet?: string;
  maxSendRate?: number;
  sandbox?: boolean;
}

export interface EmailMetrics {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened?: number;
  clicked?: number;
}

export class EmailError extends Error {
  constructor(
    message: string,
    public code: EmailErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

export enum EmailErrorCode {
  // Validation errors
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_DOMAIN = 'INVALID_DOMAIN',
  UNVERIFIED_SENDER = 'UNVERIFIED_SENDER',
  
  // Send errors
  SEND_FAILED = 'SEND_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  SUPPRESSED_RECIPIENT = 'SUPPRESSED_RECIPIENT',
  
  // Content errors
  INVALID_CONTENT = 'INVALID_CONTENT',
  ATTACHMENT_TOO_LARGE = 'ATTACHMENT_TOO_LARGE',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  
  // Service errors
  SERVICE_ERROR = 'SERVICE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // Other
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface EmailWebhookEvent {
  eventType: 'bounce' | 'complaint' | 'delivery' | 'send' | 'reject' | 'open' | 'click';
  mail: {
    messageId: string;
    timestamp: Date;
    source: string;
    destination: string[];
  };
  bounce?: {
    bounceType: 'Permanent' | 'Transient' | 'Undetermined';
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      status?: string;
      diagnosticCode?: string;
    }>;
  };
  complaint?: {
    complaintFeedbackType?: string;
    complainedRecipients: Array<{
      emailAddress: string;
    }>;
  };
  delivery?: {
    timestamp: Date;
    processingTimeMillis: number;
    recipients: string[];
  };
}