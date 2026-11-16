// Facts the returns module announces after its transaction commits.
declare module '../../platform/events/index.ts' {
  interface HeartEvents {
    'return.requested': { returnId: string; rmaNumber: string; orderNumber: string };
    'return.decided': { returnId: string; rmaNumber: string; status: string; replacementOrder: string | null };
  }
}
export {};
