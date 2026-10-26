/**
 * Emails: every user-controlled value interpolated into an HTML part is escaped (SEC-09).
 * The contact description lands in the SUPPORT mailbox, the plan name in official emails to the
 * plan owner, so a `<script>`/`"` payload must arrive as inert text.
 */

const mockSend = jest.fn().mockResolvedValue({ statusCode: 202 });

jest.mock('mailersend', () => {
  class Chainable {
    html = '';
    text = '';
    subject = '';
    setFrom() { return this; }
    setTo() { return this; }
    setReplyTo() { return this; }
    setSubject(s: string) { this.subject = s; return this; }
    setHtml(h: string) { this.html = h; return this; }
    setText(t: string) { this.text = t; return this; }
    setAttachments() { return this; }
  }
  class Plain {}
  return {
    MailerSend: class { email = { send: mockSend }; },
    EmailParams: Chainable,
    Sender: Plain,
    Recipient: Plain,
    Attachment: Plain,
  };
});

jest.mock('../logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), exception: jest.fn() },
}));

import {
  sendAuthorizationResultEmail,
  sendContactNotificationEmail,
  sendContactTicketEmail,
  sendPlanDeletionEmail,
} from '../email';

const ORIGINAL_KEY = process.env.MAILERSEND_API_KEY;

const XSS = `<script>alert(1)</script>"><img src=x onerror=alert(2)> it's A & B`;
const ESCAPED = `&lt;script&gt;alert(1)&lt;/script&gt;&quot;&gt;&lt;img src=x onerror=alert(2)&gt; it&#39;s A &amp; B`;

function sentHtml(): string {
  expect(mockSend).toHaveBeenCalledTimes(1);
  return mockSend.mock.calls[0][0].html as string;
}

function expectInert(html: string) {
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img src=x');
  expect(html).not.toContain('"><img');
  expect(html).toContain(ESCAPED);
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.MAILERSEND_API_KEY = 'test-api-key';
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.MAILERSEND_API_KEY;
  else process.env.MAILERSEND_API_KEY = ORIGINAL_KEY;
});

describe('HTML escaping of user-controlled email content', () => {
  it('sendContactNotificationEmail (to support): description, subject, category and reply-to address', async () => {
    await sendContactNotificationEmail('UPPS-20260101-AAAA', XSS, XSS, XSS, 'a"<b>@example.com');

    const html = sentHtml();
    expectInert(html);
    // description is the one rendered in its own block: it must be there escaped, exactly once per field
    expect(html.split(ESCAPED).length - 1).toBe(3);
    expect(html).toContain('a&quot;&lt;b&gt;@example.com');
    expect(html).not.toContain('<b>@example.com');
  });

  it('sendContactTicketEmail (to the user): subject and category', async () => {
    await sendContactTicketEmail('user@example.com', 'UPPS-20260101-AAAA', XSS, XSS);

    const html = sentHtml();
    expectInert(html);
    expect(html.split(ESCAPED).length - 1).toBe(2);
  });

  it.each(['aprobado', 'denegado', 'withdrawn'] as const)(
    'sendAuthorizationResultEmail (%s): plan name',
    async (status) => {
      await sendAuthorizationResultEmail('owner@example.com', XSS, status, 'msg', '{}');

      expectInert(sentHtml());
    },
  );

  it('sendPlanDeletionEmail: plan name in both places it is rendered', async () => {
    await sendPlanDeletionEmail('owner@example.com', XSS);

    const html = sentHtml();
    expectInert(html);
    expect(html.split(ESCAPED).length - 1).toBe(2);
  });

  it('leaves ordinary text untouched (no double escaping, accents and spaces intact)', async () => {
    await sendPlanDeletionEmail('owner@example.com', 'Vuelo Valencia-Alicante n.º 3');

    expect(sentHtml()).toContain('Vuelo Valencia-Alicante n.º 3');
  });
});
