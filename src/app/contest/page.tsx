'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import {
  Trophy,
  Clock,
  Flame,
  Award,
  Users,
  ChevronRight,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
  Calendar,
  ShieldCheck,
  ArrowRight,
  Lock,
  Unlock,
  Eye,
  ArrowLeft,
  BookOpen,
  Code2,
  Download,
} from 'lucide-react';
import {
  generateGoogleCalendarUrl,
  generateIcsContent,
  getProblemEditorial,
  getRatingTier,
} from '@/lib/contestRating';

interface ContestQuestion {
  id: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  points: number;
  tags?: string[];
  isLocked?: boolean;
}

interface LeaderboardProblem {
  questionId: number;
  solved: boolean;
  points: number;
  attempts: number;
  solvedAt: string | null;
}

interface LeaderboardEntry {
  rank: number;
  email: string;
  name: string;
  image?: string;
  score: number;
  maxScore: number;
  totalTime: string;
  totalTimeSeconds: number;
  problems: LeaderboardProblem[];
  registeredAt: string;
  startedAt: string | null;
}

interface CollegeRanking {
  rank: number;
  college: string;
  registeredCount: number;
  participantCount: number;
  totalScore: number;
  averageScore: number;
}

interface ContestData {
  contestId: string;
  contestNumber?: number;
  title: string;
  slug: string;
  description: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: 'upcoming' | 'active' | 'completed';
  maxScore: number;
  questions: ContestQuestion[];
  isQuestionsRevealed: boolean;
  participantsCount: number;
  countdownSeconds: number;
  isLive: boolean;
  isEnded: boolean;
}

interface PastContest {
  contestId: string;
  contestNumber?: number;
  title: string;
  slug: string;
  status: string;
  startTime: string;
  endTime: string;
  participantsCount: number;
  topScore: number;
  questionsCount: number;
}

function ContestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestIdParam = searchParams.get('id') || '';

  const { data: session, status: authStatus } = useSession();

  const [selectedContestId, setSelectedContestId] = useState<string>(contestIdParam);
  const [contestData, setContestData] = useState<ContestData | null>(null);
  const [pastContests, setPastContests] = useState<PastContest[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'college-rankings' | 'problems' | 'editorial' | 'rules' | 'archive'>('leaderboard');
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [collegeRankings, setCollegeRankings] = useState<CollegeRanking[]>([]);
  const [myCollege, setMyCollege] = useState<string | null>(null);

  // Sync with URL query parameter
  useEffect(() => {
    if (contestIdParam && contestIdParam !== selectedContestId) {
      setSelectedContestId(contestIdParam);
    }
  }, [contestIdParam, selectedContestId]);

  // Fetch contest data (either requested contest or current upcoming contest)
  const fetchContest = useCallback(async (contestIdToFetch?: string) => {
    try {
      const url = contestIdToFetch
        ? `/api/contest?contestId=${encodeURIComponent(contestIdToFetch)}`
        : '/api/contest';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.contest) {
        setContestData(data.contest);
      }
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
      setCollegeRankings(data.collegeRankings || []);
      if (data.pastContests) {
        setPastContests(data.pastContests);
      }
    } catch (err) {
      console.error('Failed to load contest:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch leaderboard for active contest
  const fetchLeaderboard = useCallback(async (contestId: string) => {
    try {
      const res = await fetch(`/api/contest/${contestId}/leaderboard`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
      setCollegeRankings(data.collegeRankings || []);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  }, []);

  useEffect(() => {
    fetchContest(selectedContestId);
  }, [selectedContestId, fetchContest]);

  useEffect(() => {
    if (!contestData) return;

    // Only auto-poll if the contest is currently live
    if (contestData.isLive) {
      const interval = setInterval(() => {
        fetchLeaderboard(contestData.contestId);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [contestData, fetchLeaderboard]);

  useEffect(() => {
    if (!session?.user?.email) {
      setMyCollege(null);
      return;
    }

    fetch('/api/contest/register')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMyCollege(typeof data?.college === 'string' ? data.college : null))
      .catch(() => setMyCollege(null));
  }, [session?.user?.email]);

  // Countdown clock tick for upcoming or live contest
  useEffect(() => {
    if (!contestData || contestData.isEnded) return;

    const updateCountdown = () => {
      const now = Date.now();
      const targetTime = contestData.isLive
        ? new Date(contestData.endTime).getTime()
        : new Date(contestData.startTime).getTime();

      const diffSeconds = Math.max(0, Math.floor((targetTime - now) / 1000));

      const days = Math.floor(diffSeconds / (24 * 3600));
      const hours = Math.floor((diffSeconds % (24 * 3600)) / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      const seconds = diffSeconds % 60;

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [contestData]);

  const handleJoinContest = async () => {
    if (!contestData) return;

    if (authStatus !== 'authenticated') {
      signIn('google', { callbackUrl: `/contest${selectedContestId ? `?id=${selectedContestId}` : ''}` });
      return;
    }

    if (!contestData.isLive) {
      alert('The contest has not started yet. Entry opens strictly on Saturday at 9:00 PM IST.');
      return;
    }

    setJoining(true);
    try {
      const res = await fetch(`/api/contest/${contestData.contestId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to enter contest');
        setJoining(false);
        return;
      }

      if (data.sessionId) {
        router.push(`/oa/${data.sessionId}`);
      }
    } catch {
      alert('Network error entering contest. Please try again.');
      setJoining(false);
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Medium':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'Hard':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  const handleDownloadIcs = () => {
    if (!contestData) return;
    const icsContent = generateIcsContent(
      contestData.title,
      new Date(contestData.startTime),
      new Date(contestData.endTime)
    );
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${contestData.slug || 'roundzero-contest'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isCurrentContest = !selectedContestId || (contestData && pastContests.length > 0 && pastContests[0]?.contestId !== contestData.contestId);

  return (
    <div className="min-h-screen bg-[#141414] text-zinc-100 antialiased selection:bg-[#ffa116] selection:text-black">
      {/* Background Ambience */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-30">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#ffa116]/15 via-[#ff9f0a]/5 to-transparent blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Contest Switcher Bar (when viewing a specific past contest) */}
        {selectedContestId && (
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#1d1d1d] p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400">Viewing Contest Archive:</span>
              <span className="text-zinc-300 font-medium">{contestData?.title || selectedContestId}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedContestId('');
                router.push('/contest');
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#282828] border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white hover:border-amber-500/50 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Current Saturday Contest</span>
            </button>

          </div>
        )}

        {/* Top Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a]/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-mono font-bold text-amber-400">
                  <Trophy className="h-3.5 w-3.5" />
                  SATURDAY NIGHT CONTEST
                </span>

                {contestData?.isLive ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    LIVE NOW
                  </span>
                ) : contestData?.isEnded ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-400">
                    <CheckCircle2 className="h-3 w-3 text-zinc-400" />
                    CONTEST CONCLUDED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-300">
                    <Calendar className="h-3 w-3 text-amber-400" />
                    Every Saturday • 9:00 PM – 10:30 PM IST
                  </span>
                )}

                <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-mono text-zinc-400">
                  90 Mins • 4 Questions • 18 Pts
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                {contestData?.title || 'RoundZero Weekly Contest'}
              </h1>

              <p className="text-sm text-zinc-400 leading-relaxed">
                Weekly 90-minute synchronized coding assessment.
                Solve 4 algorithmic challenges (3, 4, 5, 6 pts) with real-time contest-wise ranking and automatic evaluation.
              </p>
            </div>

            {/* Countdown / Action Card */}
            <div className="flex flex-col items-center sm:items-end justify-center gap-4 bg-[#222222]/80 border border-[#333333] p-5 rounded-xl">
              <div className="text-right w-full">
                <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-2 flex items-center justify-between sm:justify-end gap-2">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    {contestData?.isLive
                      ? 'Contest Ends In'
                      : contestData?.isEnded
                      ? 'Final Standings Locked'
                      : 'Starts In'}
                  </span>
                </div>

                {!contestData?.isEnded ? (
                  <div className="grid grid-cols-4 gap-2 text-center font-mono">
                    <div className="rounded-lg bg-[#181818] border border-zinc-800 p-2 min-w-[54px]">
                      <div className="text-xl font-bold text-white">{String(timeLeft.days).padStart(2, '0')}</div>
                      <div className="text-[9px] uppercase text-zinc-500">Days</div>
                    </div>
                    <div className="rounded-lg bg-[#181818] border border-zinc-800 p-2 min-w-[54px]">
                      <div className="text-xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</div>
                      <div className="text-[9px] uppercase text-zinc-500">Hours</div>
                    </div>
                    <div className="rounded-lg bg-[#181818] border border-zinc-800 p-2 min-w-[54px]">
                      <div className="text-xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</div>
                      <div className="text-[9px] uppercase text-zinc-500">Mins</div>
                    </div>
                    <div className="rounded-lg bg-[#181818] border border-zinc-800 p-2 min-w-[54px]">
                      <div className="text-xl font-bold text-amber-400">{String(timeLeft.seconds).padStart(2, '0')}</div>
                      <div className="text-[9px] uppercase text-zinc-500">Secs</div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#181818] border border-zinc-800 px-4 py-2 text-center font-mono text-xs text-zinc-400">
                    Contest Finished • Results Archived
                  </div>
                )}
              </div>

              {joining ? (
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#ffa116]/60 px-6 py-3 text-sm font-bold text-zinc-950 cursor-wait"
                >
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Entering Assessment...</span>
                </button>
              ) : contestData?.isLive ? (
                <button
                  type="button"
                  onClick={handleJoinContest}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#ffa116] px-6 py-3 text-sm font-bold text-zinc-950 transition hover:bg-[#ffa116]/90 shadow-lg shadow-amber-500/20"
                >
                  <Flame className="h-4 w-4 fill-zinc-950" />
                  <span>Enter Live Contest</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : contestData?.isEnded ? (
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#282828] border border-zinc-700 px-5 py-3 text-xs font-semibold text-zinc-400 cursor-not-allowed"
                >
                  <CheckCircle2 className="h-4 w-4 text-zinc-500" />
                  <span>Contest Concluded</span>
                </button>
              ) : (
                <div className="flex flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
                  <Link
                    href="/registercontest"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#ffa116] px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-[#ffa116]/90 shadow-lg shadow-amber-500/20"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Register for Contest</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#282828] border border-[#383838] px-5 py-3 text-xs font-semibold text-zinc-400 cursor-not-allowed shadow"
                  >
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span>Contest Opens Saturday 9:00 PM IST</span>
                  </button>

                  {/* Add to Calendar Reminders */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <a
                      href={
                        contestData
                          ? generateGoogleCalendarUrl(
                              contestData.title,
                              new Date(contestData.startTime),
                              new Date(contestData.endTime)
                            )
                          : '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-[#222222] border border-zinc-700/80 px-2.5 py-1 text-[11px] font-mono font-medium text-amber-400 hover:text-amber-300 hover:border-amber-500/50 transition"
                      title="Add to Google Calendar"
                    >
                      <Calendar className="h-3 w-3" />
                      <span>Google Cal</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleDownloadIcs}
                      className="flex items-center gap-1.5 rounded-lg bg-[#222222] border border-zinc-700/80 px-2.5 py-1 text-[11px] font-mono font-medium text-zinc-300 hover:text-white hover:border-zinc-500 transition"
                      title="Download iCal (.ics) file"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download .ics</span>
                    </button>
                  </div>

                  <span className="text-[10px] text-zinc-500 font-mono">
                    Questions & lobby unlock at 9:00 PM strictly
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contest Structure Rules Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm">
              Q1
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Easy Problem</div>
              <div className="text-[11px] text-zinc-400 font-mono">3 Points • Warmup</div>
            </div>
          </div>

          <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-sm">
              Q2
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Medium Problem A</div>
              <div className="text-[11px] text-zinc-400 font-mono">4 Points • Data Structures</div>
            </div>
          </div>

          <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-sm">
              Q3
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Medium Problem B</div>
              <div className="text-[11px] text-zinc-400 font-mono">5 Points • Algorithms</div>
            </div>
          </div>

          <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-sm">
              Q4
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Hard Problem</div>
              <div className="text-[11px] text-zinc-400 font-mono">6 Points • Advanced DP / Graphs</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'leaderboard'
                  ? 'bg-[#282828] text-[#ffa116] border border-[#3e3e3e]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span>Contest Leaderboard</span>
              <span className="rounded-full bg-[#181818] border border-zinc-700 px-1.5 py-0.2 text-[10px] font-mono text-zinc-300">
                {leaderboard.length}
              </span>
            </button>

            {contestData?.isEnded && (
              <button
                type="button"
                onClick={() => setActiveTab('college-rankings')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'college-rankings'
                    ? 'bg-[#282828] text-[#ffa116] border border-[#3e3e3e]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>College Rankings</span>
                <span className="rounded-full bg-[#181818] border border-zinc-700 px-1.5 py-0.2 text-[10px] font-mono text-zinc-300">
                  {collegeRankings.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('problems')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'problems'
                  ? 'bg-[#282828] text-[#ffa116] border border-[#3e3e3e]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Award className="h-4 w-4" />
              <span>Problem Set</span>
              <span className="rounded-full bg-[#181818] border border-zinc-700 px-1.5 py-0.2 text-[10px] font-mono text-zinc-300">
                4
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('editorial')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'editorial'
                  ? 'bg-[#282828] text-[#ffa116] border border-[#3e3e3e]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Editorial & Solutions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'rules'
                  ? 'bg-[#282828] text-[#ffa116] border border-[#3e3e3e]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Rules & Scoring</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('archive')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'archive'
                  ? 'bg-[#282828] text-[#ffa116] border border-[#3e3e3e]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Past Contests</span>
              <span className="rounded-full bg-[#181818] border border-zinc-700 px-1.5 py-0.2 text-[10px] font-mono text-zinc-300">
                {pastContests.length}
              </span>
            </button>
          </div>

          {activeTab === 'leaderboard' && (
            <button
              type="button"
              onClick={() => contestData && fetchLeaderboard(contestData.contestId)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
              title="Refresh Leaderboard"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          )}

        </div>

        {activeTab === 'college-rankings' && contestData?.isEnded && (
          <div className="overflow-hidden rounded-xl border border-[#2e2e2e] bg-[#1a1a1a]">
            <div className="border-b border-[#2e2e2e] bg-[#1f1f1f] px-4 py-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-white font-mono">Registered College Rankings</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                Final standings are based on the combined score of contestants registered from each college.
              </p>
            </div>

            {collegeRankings.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400">No college registrations were found for this contest.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#2e2e2e] bg-[#222222] font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                      <th className="py-3.5 px-4">College</th>
                      <th className="py-3.5 px-4 text-center">Contestants</th>
                      <th className="py-3.5 px-4 text-center">Total Score</th>
                      <th className="py-3.5 px-4 text-center">Average Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {collegeRankings.map((entry) => {
                      const isMyCollege = myCollege?.trim().toLocaleLowerCase() === entry.college.toLocaleLowerCase();
                      return (
                        <tr
                          key={entry.college}
                          className={isMyCollege ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-[#222222]/50'}
                        >
                          <td className="py-3 px-4 text-center font-bold font-mono">
                            {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                          </td>
                          <td className="py-3 px-4 font-semibold text-zinc-100">
                            <span>{entry.college}</span>
                            {isMyCollege && (
                              <span className="ml-2 rounded bg-amber-500/20 border border-amber-500/40 px-1 py-0.2 text-[9px] font-bold text-amber-400">
                                YOUR COLLEGE
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-zinc-300">
                            {entry.participantCount} / {entry.registeredCount}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-extrabold text-amber-400">
                            {entry.totalScore}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-zinc-300">
                            {entry.averageScore}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Contest-Wise Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div className="overflow-hidden rounded-xl border border-[#2e2e2e] bg-[#1a1a1a]">
            <div className="border-b border-[#2e2e2e] bg-[#1f1f1f] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-white font-mono">
                  {contestData?.title || 'Contest'} — Official Standings
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                {leaderboard.length} Contestant{leaderboard.length === 1 ? '' : 's'} Ranked
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#222222] border border-zinc-800 text-amber-400">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">No Contestants Ranked Yet</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    {contestData?.isLive
                      ? 'The contest is live! Submit your solutions to appear at the top of the leaderboard.'
                      : 'Standings will update live as soon as contestants submit accepted solutions.'}
                  </p>
                </div>
                {contestData?.isLive ? (
                  <button
                    type="button"
                    onClick={handleJoinContest}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#ffa116] px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-[#ffa116]/90 shadow-md"
                  >
                    <Flame className="h-3.5 w-3.5 fill-zinc-950" />
                    <span>Enter Live Contest</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-[#222222] border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    <span>Opens Saturday at 9:00 PM IST</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#2e2e2e] bg-[#222222] font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                      <th className="py-3.5 px-4">Contestant</th>
                      <th className="py-3.5 px-4 text-center">Score</th>
                      <th className="py-3.5 px-4 text-center">Time / Penalty</th>
                      <th className="py-3.5 px-3 text-center">Q1 (3p)</th>
                      <th className="py-3.5 px-3 text-center">Q2 (4p)</th>
                      <th className="py-3.5 px-3 text-center">Q3 (5p)</th>
                      <th className="py-3.5 px-3 text-center">Q4 (6p)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {leaderboard.map((entry) => {
                      const isMe = session?.user?.email?.toLowerCase() === entry.email.toLowerCase();

                      return (
                        <tr
                          key={entry.email}
                          className={`transition ${
                            isMe ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-[#222222]/50'
                          }`}
                        >
                          {/* Rank */}
                          <td className="py-3 px-4 text-center font-bold font-mono">
                            {entry.rank === 1 ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs">
                                🥇
                              </span>
                            ) : entry.rank === 2 ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-zinc-300/20 text-zinc-200 border border-zinc-400/40 text-xs">
                                🥈
                              </span>
                            ) : entry.rank === 3 ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/40 text-xs">
                                🥉
                              </span>
                            ) : (
                              <span className="text-zinc-400 font-mono text-xs">#{entry.rank}</span>
                            )}
                          </td>

                          {/* Contestant */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {entry.image ? (
                                <img
                                  src={entry.image}
                                  alt={entry.name}
                                  className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
                                />
                              ) : (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-xs font-bold text-amber-400">
                                  {entry.name[0]?.toUpperCase() || 'U'}
                                </div>
                              )}
                              <div className="min-w-0">
                                  <div className="font-semibold text-zinc-100 flex items-center gap-1.5 truncate">
                                    <Link
                                      href={`/profile?u=${encodeURIComponent(entry.email.split('@')[0])}`}
                                      className="hover:text-amber-400 hover:underline transition"
                                      title="View Developer Profile"
                                    >
                                      {entry.name}
                                    </Link>
                                  {isMe && (
                                    <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1 py-0.2 text-[9px] font-bold text-amber-400">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-500 truncate">{entry.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Score */}
                          <td className="py-3 px-4 text-center font-mono">
                            <span className="text-sm font-extrabold text-amber-400">{entry.score}</span>
                            <span className="text-xs text-zinc-500"> / {entry.maxScore}</span>
                          </td>

                          {/* Time */}
                          <td className="py-3 px-4 text-center font-mono text-zinc-300 text-xs">
                            {entry.totalTime}
                          </td>

                          {/* Problem columns (Q1, Q2, Q3, Q4) */}
                          {[0, 1, 2, 3].map((idx) => {
                            const prob = entry.problems[idx];
                            const isSolved = prob?.solved;
                            const attempts = prob?.attempts || 0;

                            return (
                              <td key={idx} className="py-3 px-3 text-center">
                                {isSolved ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400 font-mono">
                                      <CheckCircle2 className="h-3 w-3" />
                                      +{prob.points}
                                    </span>
                                    {attempts > 1 && (
                                      <span className="text-[9px] text-zinc-500 font-mono mt-0.5">
                                        ({attempts} tries)
                                      </span>
                                    )}
                                  </div>
                                ) : attempts > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 font-mono">
                                    <XCircle className="h-3 w-3" />
                                    -{attempts}
                                  </span>
                                ) : (
                                  <span className="text-zinc-600 font-mono text-xs">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Problem Set (Questions Strictly Hidden While Upcoming) */}
        {activeTab === 'problems' && (
          <div className="space-y-4">
            {!contestData?.isQuestionsRevealed && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3 text-xs text-amber-300">
                <Lock className="h-5 w-5 shrink-0 text-amber-400" />
                <div>
                  <span className="font-bold">Contest Integrity Protection:</span> Problem titles, statements, and test cases remain sealed until Saturday at 9:00 PM IST. The difficulty and point weightings below are previewed for your preparation.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contestData?.questions.map((q, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-5 flex flex-col justify-between gap-4 hover:border-zinc-700 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-zinc-500">
                        Problem #{idx + 1}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getDifficultyColor(
                          q.difficulty
                        )}`}
                      >
                        {q.difficulty} • {q.points} pts
                      </span>
                    </div>

                    {contestData.isQuestionsRevealed ? (
                      <>
                        <h3 className="text-base font-bold text-white">{q.title}</h3>

                        {q.tags && q.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {q.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-zinc-800 border border-zinc-700/60 px-2 py-0.5 text-[10px] text-zinc-400 font-mono"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-1.5 py-1">
                        <div className="flex items-center gap-2 text-zinc-400 text-sm font-semibold">
                          <Lock className="h-4 w-4 text-zinc-500" />
                          <span>Problem Title Sealed</span>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          Problem statement will unlock automatically when the contest goes live.
                        </p>
                      </div>
                    )}
                  </div>

                  {contestData.isLive ? (
                    <button
                      type="button"
                      onClick={handleJoinContest}
                      className="flex items-center justify-between w-full rounded-lg bg-[#242424] border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-500/50 hover:text-amber-400 transition"
                    >
                      <span>Solve in Live Contest</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : contestData.isEnded && contestData.isQuestionsRevealed ? (
                    <Link
                      href={`/questions?search=${encodeURIComponent(q.title)}`}
                      className="flex items-center justify-between w-full rounded-lg bg-[#242424] border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-500/50 hover:text-amber-400 transition"
                    >
                      <span>Practice Past Problem</span>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between w-full rounded-lg bg-[#202020] border border-zinc-800/80 px-3 py-2 text-xs font-medium text-zinc-500">
                      <span>Unlocks Saturday at 9:00 PM IST</span>
                      <Lock className="h-3.5 w-3.5 text-zinc-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Editorial & Solutions */}
        {activeTab === 'editorial' && (
          <div className="space-y-6">
            {!contestData?.isQuestionsRevealed ? (
              <div className="rounded-xl border border-zinc-800 bg-[#1a1a1a] p-12 text-center space-y-3">
                <Lock className="h-8 w-8 text-amber-500/60 mx-auto" />
                <h3 className="text-base font-bold text-white">Editorial Locked</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                  Problem statements, optimal approaches, and reference solutions will automatically unlock once the Saturday Night contest goes live.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-amber-400" />
                      <span>Official Editorial & Problem Approaches</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Algorithmic walkthroughs, time complexity proofs, and verified reference implementations.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {contestData.questions.map((q, idx) => {
                    const editorial = getProblemEditorial(q);
                    return (
                      <div
                        key={idx}
                        className="rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] p-6 space-y-5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
                          <div>
                            <span className="font-mono text-xs text-zinc-500 uppercase tracking-wider">
                              Question #{idx + 1}
                            </span>
                            <h3 className="text-lg font-bold text-white mt-0.5">{q.title}</h3>
                          </div>
                          <span
                            className={`self-start sm:self-auto rounded-full border px-3 py-1 text-xs font-semibold ${getDifficultyColor(
                              q.difficulty
                            )}`}
                          >
                            {q.difficulty} • {q.points} Points
                          </span>
                        </div>

                        {/* Intuition & Approach */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-xl bg-[#222222] border border-zinc-800 p-4 space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5" />
                              Core Intuition
                            </h4>
                            <p className="text-xs text-zinc-300 leading-relaxed">{editorial.intuition}</p>
                          </div>

                          <div className="rounded-xl bg-[#222222] border border-zinc-800 p-4 space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Optimal Approach
                            </h4>
                            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                              {editorial.approach}
                            </p>
                          </div>
                        </div>

                        {/* Complexity */}
                        <div className="flex flex-wrap items-center gap-6 rounded-xl bg-[#1e1e1e] border border-zinc-800/80 px-4 py-3 text-xs font-mono">
                          <div>
                            <span className="text-zinc-500">Time Complexity: </span>
                            <span className="font-bold text-emerald-400">{editorial.timeComplexity}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Space Complexity: </span>
                            <span className="font-bold text-amber-400">{editorial.spaceComplexity}</span>
                          </div>
                        </div>

                        {/* Code Snippets */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                            <Code2 className="h-3.5 w-3.5" />
                            Reference Implementation (Python & C++)
                          </h4>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="rounded-xl bg-[#121212] border border-zinc-800 p-4 space-y-2">
                              <span className="text-[11px] font-mono font-bold text-amber-400 block">
                                Python 3
                              </span>
                              <pre className="font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed p-2 bg-[#181818] rounded-lg">
                                <code>{editorial.pythonSnippet}</code>
                              </pre>
                            </div>

                            <div className="rounded-xl bg-[#121212] border border-zinc-800 p-4 space-y-2">
                              <span className="text-[11px] font-mono font-bold text-cyan-400 block">
                                C++ 20
                              </span>
                              <pre className="font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed p-2 bg-[#181818] rounded-lg">
                                <code>{editorial.cppSnippet}</code>
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Rules & Scoring */}
        {activeTab === 'rules' && (
          <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-6 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              Contest Rules & Integrity
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-300 leading-relaxed">
              <div className="space-y-3 rounded-lg border border-zinc-800 bg-[#222222]/50 p-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Time & Schedule
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                  <li>Contest runs <strong>every Saturday from 9:00 PM to 10:30 PM IST</strong>.</li>
                  <li>Total duration is strictly <strong>90 minutes</strong> from live launch.</li>
                  <li>Problem statements remain strictly sealed until 9:00 PM sharp.</li>
                </ul>
              </div>

              <div className="space-y-3 rounded-lg border border-zinc-800 bg-[#222222]/50 p-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-400" />
                  Problem Distribution & Scoring
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                  <li><strong>Q1: Easy</strong> — 3 Points</li>
                  <li><strong>Q2: Medium</strong> — 4 Points</li>
                  <li><strong>Q3: Medium</strong> — 5 Points</li>
                  <li><strong>Q4: Hard</strong> — 6 Points</li>
                  <li><strong>Total Max Score</strong>: 18 Points</li>
                </ul>
              </div>

              <div className="space-y-3 rounded-lg border border-zinc-800 bg-[#222222]/50 p-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  Contest-Wise Ranking & Penalty
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                  <li>Rank is strictly isolated <strong>per contest</strong> (never globally combined).</li>
                  <li>Rank is determined by <strong>highest total score</strong> in that contest.</li>
                  <li>Ties broken by <strong>total time taken</strong> to achieve that score.</li>
                  <li>Failed submissions add a <strong>5-minute penalty</strong> upon accepted solve.</li>
                </ul>
              </div>

              <div className="space-y-3 rounded-lg border border-zinc-800 bg-[#222222]/50 p-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Unlock className="h-4 w-4 text-amber-400" />
                  Post-Contest Review
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                  <li>After 10:30 PM, all problem statements are unsealed for public review.</li>
                  <li>Past contests remain in the archive with their full contest-wise rankings.</li>
                  <li>Problems from completed contests can be practiced in the question bank.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Past Contests Archive (Contest-Wise Selection) */}
        {activeTab === 'archive' && (
          <div className="overflow-hidden rounded-xl border border-[#2e2e2e] bg-[#1a1a1a]">
            <div className="border-b border-[#2e2e2e] bg-[#1f1f1f] px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono">
                Historical Weekly Contests Archive
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                Select any contest to view its questions & standings
              </span>
            </div>

            {pastContests.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs font-mono">
                No past contests archived yet. The first contest goes live this Saturday!
              </div>
            ) : (
              <div className="divide-y divide-[#2a2a2a]">
                {pastContests.map((past) => {
                  const isSelected = selectedContestId === past.contestId;

                  return (
                    <div
                      key={past.contestId}
                      onClick={() => {
                        setSelectedContestId(past.contestId);
                        setActiveTab('leaderboard');
                        router.push(`/contest?id=${past.contestId}`);
                      }}
                      className={`p-4 flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/10 border-l-4 border-amber-500'
                          : 'hover:bg-[#222222]/60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          <span>{past.title}</span>
                          {isSelected && (
                            <span className="rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono px-2 py-0.5">
                              SELECTED
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {new Date(past.startTime).toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-xs font-mono">
                        <div className="text-right">
                          <div className="text-zinc-400">Contestants</div>
                          <div className="font-bold text-white">{past.participantsCount}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-zinc-400">Top Score</div>
                          <div className="font-bold text-amber-400">{past.topScore} / 18</div>
                        </div>

                        <div className="flex items-center gap-1 text-zinc-400 hover:text-amber-400">
                          <span className="text-[11px]">View Standings</span>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#141414] text-zinc-300 flex items-center justify-center font-mono text-sm">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <span>Loading RoundZero Contest...</span>
          </div>
        </div>
      }
    >
      <ContestContent />
    </Suspense>
  );
}
