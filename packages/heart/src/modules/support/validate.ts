export interface CreateTicketInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  userId?: string | null;
}

export function validateCreateTicketInput(input: unknown): string[] {
  const errors: string[] = [];
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : '';
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';

  if (!name || name.length > 150) errors.push('name');
  if (!email || email.length > 255 || !/^\S+@\S+\.\S+$/.test(email)) errors.push('email');
  if (!subject || subject.length > 255) errors.push('subject');
  if (message.length < 10 || message.length > 5000) errors.push('message');
  return errors;
}
