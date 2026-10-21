'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { addOACredits } from '@/lib/userCredits';
import { Lock, RefreshCw, CreditCard } from 'lucide-react';

interface Props {
  planId?: string;
  amount?: number;
  credits?: number;
  planName?: string;
  buttonText?: string;
  className?: string;
}

export default function RazorpayPayButton({
  planId = 'unlimited_3months_99',
  amount = 1,
  credits = 999,
  planName = '3 Months Unlimited Pro Pass',
  buttonText = 'Pay ₹99 via Razorpay',
  className = '',
}: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const userEmail = session?.user?.email || '';
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Load Razorpay Checkout JS SDK dynamically
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handlePay = async () => {
    setIsProcessing(true);

    try {
      //create razorpay order
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          amount,
          currency: 'INR',
          credits,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.id) {
        alert('Failed to initialize Razorpay payment order.');
        setIsProcessing(false);
        return;
      }

      const isUnlimited = planId.includes('unlimited') || planId === 'unlimited_3months_99';

      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const options = {
          key: orderData.keyId || 'rzp_test_key',
          amount: orderData.amount, 
          currency: orderData.currency || 'INR',
          name: 'RoundZero',
          description: `Payment for ${planName}`,
          image: 'https://cdn-icons-png.flaticon.com/512/9322/9322127.png',
          order_id: orderData.id,
          handler: async function (response: any) {
            
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id || orderData.id,
                razorpay_payment_id: response.razorpay_payment_id || `pay_${Date.now()}`,
                razorpay_signature: response.razorpay_signature || 'mock_sig',
                planId,
                credits,
                userEmail,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok) {
              // Activate 3-month unlimited pass
              addOACredits(credits, 'purchase', `Purchased ${planName} (₹${amount})`, isUnlimited, userEmail);

              // Route to receipt page
              router.push(
                `/payment-success?orderId=${verifyData.orderId}&paymentId=${verifyData.paymentId}&amount=${amount}&credits=${credits}&planName=${encodeURIComponent(
                  planName
                )}`
              );
            } else {
              alert('Payment signature verification failed.');
              setIsProcessing(false);
            }
          },
          prefill: {
            name: session?.user?.name || 'Candidate User',
            email: userEmail || 'user@example.com',
            contact: '9876543210',
          },
          theme: {
            color: '#f59e0b',
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          alert('Payment Failed: ' + (resp.error.description || 'Cancelled by user'));
          setIsProcessing(false);
        });
        rzp.open();
      } else {
        // Fallback simulation mode
        setTimeout(() => {
          addOACredits(credits, 'purchase', `Purchased ${planName} (₹${amount})`, isUnlimited, userEmail);
          router.push(
            `/payment-success?orderId=${orderData.id}&paymentId=pay_sim_${Date.now()}&amount=${amount}&credits=${credits}&planName=${encodeURIComponent(
              planName
            )}`
          );
        }, 600);
      }
    } catch (err) {
      console.error('Payment error:', err);
      alert('An error occurred during Razorpay payment initiation.');
      setIsProcessing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={isProcessing}
      className={
        className ||
        'w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold border border-amber-400/40 text-xs transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50'
      }
    >
      {isProcessing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin text-zinc-950" />
          <span>Opening Razorpay Gateway...</span>
        </>
      ) : (
        <>
          <Lock className="h-4 w-4 text-zinc-950" />
          <span>{buttonText}</span>
        </>
      )}
    </button>
  );
}
