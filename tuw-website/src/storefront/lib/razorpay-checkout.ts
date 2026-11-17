'use client';

export interface RazorpayCheckoutResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser only'));
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment checkout.'));
    document.body.appendChild(script);
  });
}

/** Opens Razorpay Checkout and resolves with the signed callback payload. */
export async function openRazorpayCheckout(params: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
}): Promise<RazorpayCheckoutResult> {
  await loadScript();
  type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };
  const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: params.keyId,
      amount: params.amountPaise,
      currency: 'INR',
      name: params.name,
      description: params.description ?? 'The Unplugged Wear',
      order_id: params.orderId,
      prefill: { email: params.email ?? '', contact: params.phone ?? '' },
      theme: { color: '#1A1A1A' },
      handler: (response: RazorpayCheckoutResult) => resolve(response),
      modal: { ondismiss: () => reject(new Error('Payment was cancelled.')) },
    });
    rzp.open();
  });
}
