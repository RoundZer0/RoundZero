'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getUserCredits, syncUserCreditsWithDB } from '@/lib/userCredits';
import RazorpayPayButton from '@/components/RazorpayPayButton';
import {
  Zap,
  Check,
  ShieldCheck,
  ArrowRight,
  FilePlus,
  CreditCard,
  Lock,
  Sparkles,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [credits, setCredits] = useState(1);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [unlimitedExpiry, setUnlimitedExpiry] = useState<string | undefined>(undefined);

  useEffect(() => {
    const update = () => {
      const userState = getUserCredits();
      setCredits(userState.credits);
      setIsUnlimited(userState.isUnlimited);
      setUnlimitedExpiry(userState.unlimitedExpiry);
    };
    update();

    if (session?.user?.email) {
      syncUserCreditsWithDB(session.user.email).then(update);
    }

    window.addEventListener('roundzero_credits_updated', update);
    return () => window.removeEventListener('roundzero_credits_updated', update);
  }, [session?.user?.email]);

  const plan = {
    id: 'unlimited_3months_99',
    name: '3 Months Unlimited Pro Pass',
    price: 1,
    credits: 999,
    unlimited: true,
    duration: '3 Months Unlimited Access',
    description: 'Complete technical assessment platform access for 3 full months.',
    features: [
      'Unlimited OA Generations for 3 Months',
      'Access 2,800+ Algorithm Problem Dataset',
      'Custom Difficulty Levels & Topic Filters',
      'Monaco Code Editor & Sample Test Execution',
      'Custom Score Multipliers & Detailed Performance Reports',
      'Instant Razorpay Payment Activation',
    ],
  };

  const [daysRemaining, setDaysRemaining] = useState(0);
  const [formattedExpiry, setFormattedExpiry] = useState('');

  useEffect(() => {
    if (isUnlimited && unlimitedExpiry) {
      const expMs = new Date(unlimitedExpiry).getTime();
      setDaysRemaining(Math.max(0, Math.ceil((expMs - Date.now()) / (1000 * 60 * 60 * 24))));
      setFormattedExpiry(
        new Date(unlimitedExpiry).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
    }
  }, [isUnlimited, unlimitedExpiry]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-md border border-[#383838] bg-[#1e1e1e] px-3 py-1 text-xs font-mono text-zinc-300">
          <CreditCard className="h-3.5 w-3.5 text-[#ffa116]" />
          Razorpay Payment Pass
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          3 Months Unlimited Access
        </h1>
        <p className="text-zinc-400 text-xs sm:text-sm">
          Get 3 full months of unlimited online assessment generations for just ₹99 via Razorpay!
        </p>

        <div className="pt-1">
          <span className="inline-flex items-center gap-2 rounded-lg bg-[#282828] border border-[#383838] px-3 py-1 text-xs font-mono text-zinc-300">
            Current Status:{' '}
            <strong className="text-[#ffa116]">
              {isUnlimited ? `Pro Pass Active (${daysRemaining} Days Left)` : `${credits} Credit(s)`}
            </strong>
          </span>
        </div>
      </div>

      {/* Active Pro Pass Banner if Purchased */}
      {isUnlimited ? (
        <div className="max-w-xl mx-auto rounded-2xl border-2 border-emerald-500/80 bg-[#282828] p-8 space-y-6 shadow-2xl text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-white">
              You Have an Active Pro Pass! 🎉
            </h2>
            <p className="text-xs text-zinc-300 max-w-md mx-auto leading-relaxed">
              Your 3-Month Unlimited Pro Pass is active. Enjoy creating and taking unlimited technical online assessments with custom rules, point multipliers, and test cases!
            </p>
          </div>

          <div className="rounded-xl border border-[#383838] bg-[#1e1e1e] p-4 space-y-2 text-xs font-mono text-zinc-300 max-w-sm mx-auto">
            <div className="flex justify-between">
              <span className="text-zinc-400">Pass Status:</span>
              <span className="text-emerald-400 font-bold">Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Expires On:</span>
              <span className="text-[#ffa116] font-bold">{formattedExpiry}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Time Remaining:</span>
              <span className="text-white font-bold">{daysRemaining} Days</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ffa116] hover:bg-[#ffa116]/90 text-[#1a1a1a] font-bold text-xs shadow-lg transition"
            >
              <Zap className="h-4 w-4" fill="currentColor" />
              Enjoy Writing OAs — Create Now
            </Link>
          </div>
        </div>
      ) : (
        /* Regular Purchase Options */
        <>
          {/* Free Alternative Banner */}
          <div className="rounded-xl border border-[#ffa116]/40 bg-[#282828] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#ffa116] flex items-center gap-1.5">
                <FilePlus className="h-4 w-4" />
                Free Alternative — No Payment Required!
              </span>
              <p className="text-xs text-zinc-300">
                Don&apos;t want to pay ₹99? Submit 3 unique algorithm questions (with description, test cases & edge cases) to earn free passes!
              </p>
            </div>

            <Link
              href="/contribute"
              className="px-4 py-2 rounded-lg bg-[#1e1e1e] hover:bg-[#383838] border border-[#383838] text-xs font-bold text-[#ffa116] whitespace-nowrap"
            >
              Contribute Questions (+1 Free OA)
            </Link>
          </div>

          {/* Single Pricing Card (₹99 for 3 Months) */}
          <div className="max-w-xl mx-auto rounded-2xl border-2 border-[#ffa116] bg-[#282828] p-8 space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#ffa116] text-[#1a1a1a] text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-bl-lg">
              Special Unlimited Pass
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#ffa116] text-xs font-mono font-bold uppercase">
                <Calendar className="h-4 w-4" />
                3 Months Full Access
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-white">{plan.name}</h2>
                <p className="text-xs text-zinc-400 mt-1">{plan.description}</p>
              </div>

              <div className="flex items-baseline gap-2 font-mono pt-2">
                <span className="text-4xl font-extrabold text-white">₹99</span>
                <span className="text-xs text-zinc-400">/ 3 Months Unlimited</span>
              </div>

              <div className="space-y-3 pt-6 border-t border-[#383838]">
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs text-zinc-200">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <RazorpayPayButton
              planId={plan.id}
              amount={plan.price}
              credits={plan.credits}
              planName={plan.name}
              buttonText="Pay ₹99 & Unlock 3 Months Pass"
            />

            <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500 font-mono text-center">
              <Lock className="h-3.5 w-3.5 text-[#ffa116]" />
              Secured by Razorpay Gateway • Instant Digital Fulfillment
            </div>
          </div>
        </>
      )}

      {/* Trust Badges */}
      <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs font-mono text-zinc-400 border-t border-[#383838]">
        <span className="flex items-center gap-1.5">
          <Lock className="h-4 w-4 text-[#ffa116]" />
          Razorpay 256-Bit Encryption
        </span>
        <span>•</span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Instant Activation
        </span>
      </div>
    </div>
  );
}
