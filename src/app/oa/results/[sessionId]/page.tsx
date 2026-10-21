'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { OASession, Question } from '@/types/oa';
import DifficultyBadge from '@/components/DifficultyBadge';
import CodeEditor from '@/components/CodeEditor';
import { getSessionLocal } from '@/lib/sessionStore';
import confetti from 'canvas-confetti';
import {
  Trophy,
  ArrowRight,
  Code,
  FileCode,
  X,
  BookOpen,
  Flame,
  Swords,
} from 'lucide-react';

export default function OAResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { data: authSession } = useSession();

  const [session, setSession] = useState<OASession | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewCodeQuestion, setViewCodeQuestion] = useState<Question | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`/api/oa/${sessionId}`);
        if (res.ok) {
          let sess = await res.json();

          // Check if local storage has submissions saved right before navigation
          if (!sess.submissions || Object.keys(sess.submissions).length === 0) {
            const localSess = getSessionLocal(sessionId, sess.userEmail || authSession?.user?.email || undefined);
            if (localSess?.submissions && Object.keys(localSess.submissions).length > 0) {
              sess = {
                ...sess,
                submissions: localSess.submissions,
                totalScore: localSess.totalScore || sess.totalScore,
              };
            }
          }

          setSession(sess);

          if (sess.roomId) {
            try {
              const rRes = await fetch(`/api/room/${sess.roomId}`);
              if (rRes.ok) {
                const rData = await rRes.json();
                setRoom(rData);
              }
            } catch {}
          }

          const pct = (sess.totalScore / (sess.maxScore || 1)) * 100;
          if (pct >= 50) {
            setTimeout(() => {
              confetti({
                particleCount: 80,
                spread: 60,
                origin: { y: 0.6 },
              });
            }, 300);
          }
        }
      } catch (e) {
        console.error('Failed to load session from API', e);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [sessionId, authSession?.user?.email]);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 text-white font-mono text-xs space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span className="text-zinc-400">Loading Performance Summary...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 text-white p-4 space-y-4">
        <h1 className="text-2xl font-bold">Session Results Not Found</h1>
        <Link href="/" className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-bold text-sm">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const scorePct = Math.round((session.totalScore / (session.maxScore || 1)) * 100);

  const getGrade = (pct: number) => {
    if (pct >= 90) return { label: 'A+ Exceptional', color: 'text-emerald-400' };
    if (pct >= 75) return { label: 'A Strong Pass', color: 'text-emerald-300' };
    if (pct >= 60) return { label: 'B Passed', color: 'text-amber-400' };
    if (pct >= 40) return { label: 'C Partial', color: 'text-orange-400' };
    return { label: 'Needs Improvement', color: 'text-rose-400' };
  };

  const grade = getGrade(scorePct);

  // 1v1 Duel Victory / Defeat Determination
  const myEmail = (session.userEmail || authSession?.user?.email || '').toLowerCase();
  const is1v1Duel = (room?.roomType === '1v1_duel' || !!room?.winnerEmail || !!session.roomId);
  const isWinner = !!(room?.winnerEmail && myEmail && room.winnerEmail.toLowerCase() === myEmail);
  const isLoser = !!(room?.winnerEmail && myEmail && room.winnerEmail.toLowerCase() !== myEmail);
  const opponent = room?.members?.find((m: any) => m.email?.toLowerCase() !== myEmail);
  const opponentName = opponent?.name || opponent?.email || 'your opponent';
  const winReason = room?.winReason;
  const isSelfForfeit = room?.forfeitedBy && room.forfeitedBy.toLowerCase() === myEmail;

  // Check if current user actually submitted any accepted solution
  const hasAcceptedSubmission = Object.values(session.submissions || {}).some(
    (sub: any) =>
      sub &&
      sub.status === 'submitted' &&
      Array.isArray(sub.testResults) &&
      sub.testResults.length > 0 &&
      sub.testResults.every((r: any) => r.passed)
  );

  const myMember = room?.members?.find((m: any) => m.email?.toLowerCase() === myEmail);
  const oppMember = room?.members?.find((m: any) => m.email?.toLowerCase() !== myEmail);
  const mySolved = Boolean((myMember?.problemsSolved && myMember.problemsSolved > 0) || hasAcceptedSubmission || (session.totalScore && session.totalScore > 0));
  const oppSolved = Boolean((oppMember?.problemsSolved && oppMember.problemsSolved > 0) || (oppMember?.totalScore && oppMember.totalScore > 0));

  let duelTitle = 'MATCH CONCLUDED';
  let duelSubtitle = 'The 1v1 duel match has concluded.';

  if (isWinner) {
    if (winReason === 'opponent_cheated') {
      duelTitle = '⚔️ VICTORY: OPPONENT DISQUALIFIED!';
      duelSubtitle = `${opponentName} violated proctoring rules (switched tabs / exited fullscreen). You won the duel!`;
    } else if (winReason === 'opponent_forfeit' || !mySolved) {
      duelTitle = '⚔️ VICTORY: OPPONENT FORFEITED!';
      duelSubtitle = `${opponentName} forfeited or left the match. You won the duel!`;
    } else if (mySolved) {
      duelTitle = '⚔️ VICTORY: YOU WON!';
      duelSubtitle = `Outstanding! You submitted an accepted solution first and defeated ${opponentName}.`;
    } else {
      duelTitle = '⚔️ VICTORY: OPPONENT FORFEITED!';
      duelSubtitle = `${opponentName} forfeited or left the match. You won the duel!`;
    }
  } else if (isLoser) {
    if (isSelfForfeit || !oppSolved) {
      duelTitle = '⚔️ DUEL FORFEITED';
      duelSubtitle = `You forfeited or left the duel. Victory was awarded to ${opponentName}.`;
    } else {
      duelTitle = '⚔️ DEFEAT';
      duelSubtitle = `Match ended in defeat. ${opponentName} submitted the accepted solution first.`;
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* 1v1 Code Duel Head-to-Head Banner */}
      {is1v1Duel && (
        <div className={`rounded-2xl border p-6 sm:p-8 text-center space-y-6 shadow-2xl ${
          isWinner
            ? 'border-emerald-500/50 bg-gradient-to-b from-emerald-500/15 via-[#202020] to-[#181818]'
            : isLoser
            ? 'border-rose-500/50 bg-gradient-to-b from-rose-500/15 via-[#202020] to-[#181818]'
            : 'border-amber-500/40 bg-[#202020]'
        }`}>
          <div className="flex flex-col items-center justify-center gap-3">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center border shadow-xl ${
              isWinner
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : isLoser
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                : 'bg-amber-500/20 border-amber-500/50 text-amber-400'
            }`}>
              <Swords className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-zinc-400">
                1v1 Code Duel Result
              </div>
              <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight font-mono ${
                isWinner ? 'text-emerald-400' : isLoser ? 'text-rose-400' : 'text-white'
              }`}>
                {duelTitle}
              </h1>
              <p className="text-sm text-zinc-300 max-w-md mx-auto">
                {duelSubtitle}
              </p>
            </div>
          </div>

          {/* Head-to-Head Duel Comparison Card */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4 max-w-xl mx-auto pt-2">
            {/* You */}
            <div className={`p-4 rounded-xl border text-center space-y-1 ${
              isWinner
                ? 'bg-emerald-500/10 border-emerald-500/40'
                : 'bg-[#252525] border-zinc-700'
            }`}>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">You</div>
              <div className="font-bold text-sm text-white truncate">{session.userEmail || 'You'}</div>
              <div className={`text-xs font-mono font-bold ${isWinner ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {isWinner ? (mySolved ? '👑 Winner (Solved First)' : '👑 Winner (Opponent Forfeited)') : (isSelfForfeit ? 'Forfeited' : 'Defeated')}
              </div>
            </div>

            <div className="text-zinc-500 font-mono text-xs font-bold px-2">VS</div>

            {/* Opponent */}
            <div className={`p-4 rounded-xl border text-center space-y-1 ${
              isLoser
                ? 'bg-emerald-500/10 border-emerald-500/40'
                : 'bg-[#252525] border-zinc-700'
            }`}>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Opponent</div>
              <div className="font-bold text-sm text-white truncate">{opponent?.name || opponent?.email || 'Opponent'}</div>
              <div className={`text-xs font-mono font-bold ${isLoser ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {isLoser ? (oppSolved ? '👑 Winner (Solved First)' : '👑 Winner (Opponent Forfeited)') : 'Defeated'}
              </div>
            </div>
          </div>

          {/* Quick Duel Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link
              href="/join"
              className="flex items-center gap-2 rounded-xl bg-[#ffa116] px-5 py-2.5 font-bold text-black text-xs hover:brightness-110 transition shadow-lg"
            >
              <Swords className="h-4 w-4" />
              Start New Duel / Rematch
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 font-semibold text-zinc-200 hover:text-white hover:bg-zinc-700 transition text-xs"
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              View Duel Record & Rating
            </Link>
          </div>
        </div>
      )}

      {/* Top Banner Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center space-y-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <Trophy className="h-7 w-7" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center justify-center gap-2">
            {session.config?.isPOTD && <Flame className="h-7 w-7 text-amber-500 fill-amber-500/20" />}
            {session.config?.isPOTD ? 'Problem of the Day Completed!' : 'Assessment Performance Report'}
          </h1>
          <p className="text-zinc-400 text-xs font-mono">{session.title}</p>
        </div>

        {/* Score Display */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-2">
          <div className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-zinc-700 bg-zinc-950">
            <div className="text-center">
              <span className="text-3xl font-extrabold font-mono text-white block">
                {scorePct}%
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-400">
                Score
              </span>
            </div>
          </div>

          <div className="text-left space-y-1.5 font-mono">
            <div className="text-xs uppercase tracking-wider text-zinc-400">
              Grade Result
            </div>
            <div className={`text-xl font-bold ${grade.color}`}>
              {grade.label}
            </div>
            <div className="text-xs text-zinc-300">
              Points: <strong className="text-amber-400">{session.totalScore}</strong> / {session.maxScore} pts
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-zinc-800">
          {session.config?.isPOTD && (
            <Link
              href="/potd"
              className="flex items-center gap-2 rounded-lg bg-amber-500 border border-amber-400/40 px-5 py-2.5 font-bold text-zinc-950 text-xs hover:bg-amber-400 transition"
            >
              <Flame className="h-4 w-4" />
              View Today&apos;s POTD & Streak
            </Link>
          )}
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 font-semibold text-zinc-200 hover:bg-zinc-800 transition text-xs"
          >
            Create New Assessment
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/questions"
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 font-semibold text-zinc-200 hover:bg-zinc-800 transition text-xs"
          >
            <BookOpen className="h-4 w-4" />
            Browse Question Bank
          </Link>
        </div>
      </div>

      {/* Detailed Question Breakdown Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2 uppercase tracking-wider">
          <FileCode className="h-4 w-4 text-amber-400" />
          Question Submissions Breakdown
        </h2>

        <div className="space-y-3">
          {session.questions.map((q, idx) => {
            const sub = session.submissions[q.id];
            const earnedPoints = sub ? sub.score : 0;
            const passedTests = sub?.testResults?.filter((t) => t.passed).length || 0;
            const totalTests = sub?.testResults?.length || q.inputOutput.length || 1;

            return (
              <div
                key={q.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-800 font-mono text-xs font-bold text-zinc-300">
                      Q{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-xs">
                          #{q.id}. {q.title}
                        </h3>
                        <DifficultyBadge difficulty={q.difficulty} points={q.points} size="sm" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right font-mono">
                      <div className="text-[11px] text-zinc-400">Awarded Points</div>
                      <div className="text-xs font-bold text-amber-400">
                        {earnedPoints} / {q.points} pts
                      </div>
                    </div>

                    <button
                      onClick={() => setViewCodeQuestion(q)}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800"
                    >
                      <Code className="h-3.5 w-3.5 text-amber-400" />
                      View Code
                    </button>
                  </div>
                </div>

                {sub && (
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-900 text-xs font-mono">
                    <span className="text-zinc-500">Sample Test Runs:</span>
                    <span className="text-emerald-400 font-bold">
                      {passedTests} / {totalTests} Passed
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Code Inspector Modal */}
      {viewCodeQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl h-[80vh] flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Submitted Solution: #{viewCodeQuestion.id}. {viewCodeQuestion.title}
                </h3>
                <span className="text-xs text-zinc-400 font-mono">
                  Language: {session.submissions[viewCodeQuestion.id]?.language || 'python'}
                </span>
              </div>
              <button
                onClick={() => setViewCodeQuestion(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0">
              <CodeEditor
                value={
                  session.submissions[viewCodeQuestion.id]?.code ||
                  viewCodeQuestion.starterCode
                }
                onChange={() => {}}
                readOnly={true}
                language={session.submissions[viewCodeQuestion.id]?.language || 'python'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
