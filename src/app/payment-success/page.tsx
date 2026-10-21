'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowRight, Zap, Trophy, ShieldCheck } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();

  const orderId = searchParams.get('orderId') || 'ord_mock_123';
  const paymentId = searchParams.get('paymentId') || 'pay_mock_456';
  const amount = searchParams.get('amount') || '99';
  const credits = searchParams.get('credits') || '1';
  const planName = searchParams.get('planName') || 'Single Assessment Pass';

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-12 space-y-8">
      <div className="rounded-xl border border-emerald-500/30 bg-zinc-950 p-8 text-center space-y-6 shadow-2xl">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Payment Successful!</h1>
          <p className="text-xs text-zinc-400 font-mono">
            Thank you for your purchase via Razorpay. Your OA credits are now active!
          </p>
        </div>

        {/* Receipt Box */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2.5 text-xs font-mono text-left">
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Order ID:</span>
            <span className="text-white font-bold">{orderId}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Payment ID:</span>
            <span className="text-amber-400 font-bold">{paymentId}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Package:</span>
            <span className="text-white font-bold">{planName}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-zinc-400">Amount Paid:</span>
            <span className="text-emerald-400 font-bold text-sm">₹{amount} INR</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs border border-amber-400/40 transition flex items-center justify-center gap-1.5"
          >
            <Zap className="h-4 w-4" />
            Start Assessment Now
          </Link>
          <Link
            href="/history"
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white font-semibold text-xs"
          >
            View My Balance
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-950 text-white font-mono text-xs">
          Loading Payment Receipt...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
