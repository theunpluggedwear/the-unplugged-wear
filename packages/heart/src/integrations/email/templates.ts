const CONTENT: Readonly<Record<string, { subject: string; text: string }>> = {
  'auth.verify': { subject: 'Confirm your email', text: 'Confirm your email address to finish setting up your account.' },
  'auth.reset': { subject: 'Reset your password', text: 'Use the link below to reset your password. If you did not ask for this, ignore this email.' },
  'auth.invite': { subject: 'You are invited to TUW Admin', text: 'You have been invited to the admin workspace. Use the link below to accept.' },
  'auth.set_password': { subject: 'Your account is ready', text: 'Set a password to finish activating your account.' },
  'cart.abandoned': { subject: 'Your bag is waiting', text: 'Your bag is still saved. Use the link below to return to it.' },
  'stock.back_in_stock': { subject: 'Back in stock', text: 'An item you asked about is available again.' },
  'contact.inquiry': { subject: 'Website inquiry', text: 'A visitor sent an inquiry through the contact form.' },
  'household.invite': { subject: 'Household invitation', text: 'You have been invited to join a household.' },
};

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function renderTemplate(template: string, link?: string): RenderedEmail {
  const entry = CONTENT[template] ?? { subject: 'Notification', text: 'You have a new notification.' };
  const action = link
    ? `<p><a href="${escapeHtml(link)}">Open link</a></p>`
    : '';
  return {
    subject: entry.subject,
    html: `<p>${escapeHtml(entry.text)}</p>${action}`,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] ?? char);
}
