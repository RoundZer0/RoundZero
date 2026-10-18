'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { RefreshCw, AlertTriangle, ArrowRight, LogIn, Swords } from 'lucide-react';

const ORANGE = '#ff9f0a';

function JoinRoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const codeParam = searchParams.get('code') || '';
  const [inviteCode, setInviteCode] = useState(codeParam.toUpperCase());
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState('');

  const handleQuickMatch = async () => {
    if (status !== 'authenticated') {
      signIn('google', { callbackUrl: '/join' });
      return;
    }
    setMatching(true);
    setError('');
    try {
      const res = await fetch('/api/room/quick-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Quick match failed.');
        setMatching(false);
        return;
      }
      router.push(`/room/${data.roomId}`);
    } catch {
      setError('Network error while finding match.');
      setMatching(false);
    }
  };

  const handleCreateDuel = async () => {
    if (status !== 'authenticated') {
      signIn('google', { callbackUrl: '/join' });
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '1v1 Code Duel' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create 1v1 duel.');
        setCreating(false);
        return;
      }
      router.push(`/room/${data.roomId}`);
    } catch {
      setError('Network error while creating duel.');
      setCreating(false);
    }
  };

  const handleJoin = async (codeToJoin?: string) => {
    const code = (codeToJoin || inviteCode).trim().toUpperCase();
    if (!code) {
      setError('Please enter an invite code.');
      return;
    }

    if (status !== 'authenticated') {
      signIn('google', { callbackUrl: `/join?code=${encodeURIComponent(code)}` });
      return;
    }

    setJoining(true);
    setError('');

    try {
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to join room.');
        setJoining(false);
        return;
      }

      router.push(`/room/${data.roomId}`);
    } catch {
      setError('Network error while joining room.');
      setJoining(false);
    }
  };

  useEffect(() => {
    if (codeParam) {
      setInviteCode(codeParam.toUpperCase());
    }
  }, [codeParam]);

  useEffect(() => {
    // If authenticated and code provided in URL, automatically attempt to join
    if (status === 'authenticated' && codeParam && !joining && !error) {
      handleJoin(codeParam.toUpperCase());
    }
  }, [status, codeParam]);

  return (
    <div className="min-h-screen bg-[#181818] text-white flex flex-col items-center justify-center p-6 relative overflow-x-hidden">
      {/* Background with LeetCode orange glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
          }}
        />
        <div
          className="absolute left-1/2 top-[35%] h-[500px] w-[500px] -translate-x-1/2 rounded-full blur-[140px]"
          style={{ background: 'rgba(255,159,10,0.035)' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#202020] p-8 space-y-6 shadow-2xl">
        <div className="space-y-2 text-center border-b border-white/[0.07] pb-5">
          <div className="text-[10px] uppercase tracking-widest font-mono flex items-center justify-center gap-1.5" style={{ color: ORANGE }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ORANGE }} />
            Collaborative Room
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <Swords className="h-5 w-5 text-[#ffa116]" />
            1v1 Code Duel & Room Lobby
          </h1>
          <p className="text-xs text-white/40">
            Challenge a peer to an instant head-to-head match or enter a room invite code.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {status === 'loading' ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-white/50 font-mono">
            <RefreshCw className="h-4 w-4 animate-spin" style={{ color: ORANGE }} />
            <span>Verifying session...</span>
          </div>
        ) : status === 'unauthenticated' ? (
          <div className="space-y-4">
            <p className="text-xs text-white/60 leading-relaxed text-center">
              You must be signed in to create duels or enter rooms. Sign in with your Google account to proceed.
            </p>
            <button
              onClick={() => signIn('google', { callbackUrl: `/join?code=${encodeURIComponent(inviteCode)}` })}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-black font-bold text-xs uppercase tracking-wider transition hover:brightness-110 shadow-lg"
              style={{ backgroundColor: ORANGE }}
            >
              <LogIn className="h-4 w-4" />
              <span>Sign in with Google</span>
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Instant 1v1 Duel Card */}
            <div className="p-4 rounded-xl border border-[#ff9f0a]/30 bg-[#ff9f0a]/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#ffa116]">
                  <Swords className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Start a 1v1 Duel</span>
                </div>
                <span className="text-[10px] font-mono rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-amber-300">
                  Head-to-Head
                </span>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                Jump into the 1v1 matchmaking queue to instantly find an opponent, or generate a private code to duel a specific friend.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleQuickMatch}
                  disabled={matching || creating}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-black transition hover:brightness-110 disabled:opacity-40 shadow-lg"
                  style={{ backgroundColor: ORANGE }}
                >
                  {matching ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-black" />
                      <span>Finding Match...</span>
                    </>
                  ) : (
                    <>
                      <Swords className="h-4 w-4 text-black" />
                      <span>Quick Match</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCreateDuel}
                  disabled={creating || matching}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-[#2e2e2e] hover:bg-[#383838] border border-white/10 transition disabled:opacity-40"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-zinc-300" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Private</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">OR JOIN EXISTING DUEL / ROOM</span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoin();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1.5 font-mono">
                  Room / Duel Invite Code
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ENTER 6-CHAR CODE"
                  className="w-full rounded-xl border border-white/[0.1] bg-[#282828] px-4 py-3 text-center text-lg font-bold font-mono tracking-[0.25em] text-[#ffa116] uppercase placeholder-white/20 focus:border-[#ffa116] focus:outline-none"
                  disabled={joining}
                />
              </div>

              <button
                type="submit"
                disabled={joining || !inviteCode.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] transition disabled:opacity-40"
              >
                {joining ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    <span>Connecting to room...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Duel / Room</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        <div className="border-t border-white/[0.07] pt-4 text-center">
          <Link
            href="/"
            className="text-xs text-white/40 hover:text-white transition"
          >
            ← Back to RoundZero
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#181818] flex items-center justify-center text-white font-mono text-xs">
          Loading...
        </div>
      }
    >
      <JoinRoomContent />
    </Suspense>
  );
}
