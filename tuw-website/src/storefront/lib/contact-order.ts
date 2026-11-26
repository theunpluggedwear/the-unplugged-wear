const ORDER_TOPICS = new Set(['An order', 'Returns & exchanges', 'order', 'returns']);

export function requiresOrderRef(subject: string): boolean {
  return ORDER_TOPICS.has(subject.trim());
}
