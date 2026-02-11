import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAuthorizationResultEmail,
} from '../email';

// Mock the mailersend module
const mockSend = jest.fn().mockResolvedValue({ statusCode: 202 });

jest.mock('mailersend', () => {
  class MockSender {
    email: string;
    name?: string;
    constructor(email: string, name?: string) {
      this.email = email;
      this.name = name;
    }
  }

  class MockRecipient {
    email: string;
    name?: string;
    constructor(email: string, name?: string) {
      this.email = email;
      this.name = name;
    }
  }

  class MockAttachment {
    content: string;
    filename: string;
    disposition: string;
    constructor(content: string, filename: string, disposition?: string) {
      this.content = content;
      this.filename = filename;
      this.disposition = disposition || 'attachment';
    }
  }

  class MockEmailParams {
    from: any;
    to: any;
    subject: string = '';
    html: string = '';
    text: string = '';
    attachments: any[] = [];
    setFrom(from: any) { this.from = from; return this; }
    setTo(to: any) { this.to = to; return this; }
    setSubject(s: string) { this.subject = s; return this; }
    setHtml(h: string) { this.html = h; return this; }
    setText(t: string) { this.text = t; return this; }
    setAttachments(a: any[]) { this.attachments = a; return this; }
  }

  class MockMailerSend {
    email = { send: mockSend };
    constructor() {}
  }

  return {
    MailerSend: MockMailerSend,
    EmailParams: MockEmailParams,
    Sender: MockSender,
    Recipient: MockRecipient,
    Attachment: MockAttachment,
  };
});

// Suppress logger output during tests
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    exception: jest.fn(),
  },
}));

describe('Email Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, MAILERSEND_API_KEY: 'test-api-key' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email with token and code', async () => {
      await sendVerificationEmail('user@example.com', 'abc-token', '123456');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const params = mockSend.mock.calls[0][0];
      expect(params.to[0].email).toBe('user@example.com');
      expect(params.subject).toContain('Verify');
      expect(params.html).toContain('abc-token');
      expect(params.html).toContain('123456');
    });

    it('should not throw when API key is missing', async () => {
      process.env.MAILERSEND_API_KEY = '';
      await expect(sendVerificationEmail('u@e.com', 't', '1')).resolves.toBeUndefined();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should not throw when send fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('API error'));
      await expect(
        sendVerificationEmail('u@e.com', 't', '1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with token', async () => {
      await sendPasswordResetEmail('user@example.com', 'reset-token');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const params = mockSend.mock.calls[0][0];
      expect(params.to[0].email).toBe('user@example.com');
      expect(params.subject).toContain('Reset');
      expect(params.html).toContain('reset-token');
      expect(params.html).toContain('1 hour');
    });

    it('should not throw when API key is placeholder', async () => {
      process.env.MAILERSEND_API_KEY = 'your_mailersend_api_key_here';
      await expect(sendPasswordResetEmail('u@e.com', 't')).resolves.toBeUndefined();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('sendAuthorizationResultEmail', () => {
    it('should send approval email with UPLAN attachment', async () => {
      const uplanJson = '{"operationVolumes":[]}';
      await sendAuthorizationResultEmail(
        'user@example.com',
        'TestPlan',
        'aprobado',
        'Approved successfully',
        uplanJson,
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
      const params = mockSend.mock.calls[0][0];
      expect(params.to[0].email).toBe('user@example.com');
      expect(params.subject).toContain('Approved');
      expect(params.subject).toContain('TestPlan');
      expect(params.attachments).toHaveLength(1);
      expect(params.attachments[0].filename).toBe('TestPlan.json');
      expect(params.attachments[0].content).toBe(
        Buffer.from(uplanJson, 'utf-8').toString('base64'),
      );
    });

    it('should send denial email', async () => {
      await sendAuthorizationResultEmail(
        'user@example.com',
        'Plan2',
        'denegado',
        'Volume conflict',
        '{}',
      );

      const params = mockSend.mock.calls[0][0];
      expect(params.subject).toContain('Denied');
      expect(params.html).toContain('denied');
    });

    it('should not throw on send failure', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));
      await expect(
        sendAuthorizationResultEmail('u@e.com', 'P', 'aprobado', 'm', '{}'),
      ).resolves.toBeUndefined();
    });
  });
});
