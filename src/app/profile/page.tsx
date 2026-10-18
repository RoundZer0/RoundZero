'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import {
  Trophy,
  Award,
  Zap,
  Flame,
  CheckCircle2,
  Clock,
  Swords,
  Share2,
  Edit3,
  Calendar,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Shield,
  Star,
  RefreshCw,
  Copy,
  Check,
  User as UserIcon,
} from 'lucide-react';
import { getRatingTier, RatingBadgeInfo } from '@/lib/contestRating';
import SubmissionHeatmap from '@/components/SubmissionHeatmap';

interface ProfileData {
  user: {
    email: string;
    name: string;
    username: string;
    image?: string;
    bio: string;
    credits: number;
    isUnlimited: boolean;
    potdStreak: number;
    contestRating: number;
    highestRating: number;
    contestsAttended: number;
    duelWins: number;
    duelLosses: number;
    createdAt: string;
    tier: RatingBadgeInfo;
  };
  stats: {
    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    totalOAs: number;
    avgOAScore: number;
  };
  heatmap?: {
    calendar: Record<string, number>;
    totalSubmissions: number;
    activeDays: number;
    longestStreak: number;
    currentStreak: number;
  };
  contestHistory: Array<{
    contestId: string;
    title: string;
    status: string;
    startTime: string;
    endTime: string;
    score: number;
    maxScore: number;
    totalTimeSeconds: number;
    problemsSolved: number;
  }>;
  oaHistory: Array<{
    sessionId: string;
    title: string;
    totalScore: number;
    maxScore: number;
    status: string;
    timeLimitMinutes: number;
    createdAt: string;
    questionCount: number;
  }>;
}

function ProfileContent() {
  const { data: session, status: authStatus } = useSession();
  const searchParams = useSearchParams();
  const queryUsername = searchParams.get('u') || '';

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'contests' | 'oas' | 'badges'>('contests');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwnProfile =
    !queryUsername ||
    (session?.user?.email && profile?.user.email.toLowerCase() === session.user.email.toLowerCase());

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        const url = queryUsername
          ? `/api/profile?username=${encodeURIComponent(queryUsername)}`
          : `/api/profile`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setEditName(data.user.name);
          setEditBio(data.user.bio);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }

    if (authStatus !== 'loading') {
      fetchProfile();
    }
  }, [queryUsername, authStatus]);

  const handleShare = () => {
    if (typeof window === 'undefined' || !profile) return;
    const shareUrl = `${window.location.origin}/profile?u=${encodeURIComponent(
      profile.user.username || profile.user.email.split('@')[0]
    )}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, bio: editBio }),
      });
      if (res.ok) {
        const data = await res.json();
        if (profile) {
          setProfile({
            ...profile,
            user: { ...profile.user, name: data.user.name, bio: data.user.bio },
          });
        }
        setIsEditing(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center text-zinc-400 font-mono text-sm">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
          <span>Loading Developer Portfolio...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex flex-col items-center justify-center p-6 text-center">
        <UserIcon className="h-12 w-12 text-zinc-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Profile Not Found</h2>
        <p className="text-zinc-400 text-sm max-w-md mb-6">
          Sign in or create your RoundZero account to start building your developer portfolio and earning contest ratings.
        </p>
        <button
          onClick={() => signIn('google')}
          className="rounded-xl bg-[#ffa116] px-6 py-2.5 text-xs font-bold text-black hover:brightness-105"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  const { user, stats, contestHistory, oaHistory } = profile;
  const tier = user.tier || getRatingTier(user.contestRating);

  return (
    <div className="min-h-screen bg-[#141414] text-zinc-100 antialiased selection:bg-[#ffa116] selection:text-black">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-25">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#ffa116]/15 via-[#ff9f0a]/5 to-transparent blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Profile Card Header */}
        <div className="relative overflow-hidden rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a]/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-5">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name}
                  className="h-20 w-20 rounded-2xl border-2 border-amber-500/40 object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-amber-500/40 bg-zinc-800 text-2xl font-bold text-amber-400 shadow-lg">
                  {user.name[0]?.toUpperCase() || 'U'}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-extrabold text-white tracking-tight">{user.name}</h1>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-mono font-bold ${tier.color} ${tier.bgColor} ${tier.borderColor}`}
                  >
                    <Trophy className="h-3 w-3" />
                    {tier.label} ({user.contestRating})
                  </span>
                </div>

                <p className="text-xs font-mono text-zinc-400">@{user.username || user.email.split('@')[0]}</p>
                <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">{user.bio}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-2 rounded-xl bg-[#282828] border border-zinc-700 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:text-white hover:border-amber-500/50 transition"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4 text-amber-400" />}
                <span>{copied ? 'Link Copied!' : 'Share Profile'}</span>
              </button>

              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2 rounded-xl bg-[#242424] border border-zinc-700 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white transition"
                >
                  <Edit3 className="h-4 w-4 text-zinc-400" />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Edit Panel */}
          {isEditing && (
            <div className="mt-6 border-t border-zinc-800 pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg bg-[#222222] border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Bio / Headline</label>
                  <input
                    type="text"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full rounded-lg bg-[#222222] border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-[#ffa116] text-black font-bold text-xs hover:brightness-105 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4 Core Metric Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Contest Rating */}
          <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Contest Rating</span>
              <Trophy className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">{user.contestRating}</div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span>Peak: {user.highestRating}</span>
              <span>{user.contestsAttended} Contests</span>
            </div>
          </div>

          {/* Solved Problems */}
          <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Problems Solved</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">{stats.totalSolved}</div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-emerald-400">{stats.easySolved}E</span>
              <span className="text-zinc-600">•</span>
              <span className="text-amber-400">{stats.mediumSolved}M</span>
              <span className="text-zinc-600">•</span>
              <span className="text-rose-400">{stats.hardSolved}H</span>
            </div>
          </div>

          {/* 1v1 Duels Record */}
          <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">1v1 Duels</span>
              <Swords className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">
              <span className="text-emerald-400">{user.duelWins}W</span>
              <span className="text-zinc-600 mx-1.5">-</span>
              <span className="text-rose-400">{user.duelLosses}L</span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              Win Rate:{' '}
              {user.duelWins + user.duelLosses > 0
                ? `${Math.round((user.duelWins / (user.duelWins + user.duelLosses)) * 100)}%`
                : '100%'}
            </div>
          </div>

          {/* Daily POTD Streak */}
          <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">POTD Streak</span>
              <Flame className="h-4 w-4 text-amber-500 fill-amber-500/20" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400 font-mono">{user.potdStreak} Days</div>
            <div className="text-[11px] text-zinc-500 font-mono">
              {stats.totalOAs} OA Simulation{stats.totalOAs === 1 ? '' : 's'} taken
            </div>
          </div>
        </div>

        {/* 365-Day Activity & Solves Heatmap */}
        <SubmissionHeatmap
          calendar={profile.heatmap?.calendar}
          totalSubmissions={profile.heatmap?.totalSubmissions}
          activeDays={profile.heatmap?.activeDays}
          longestStreak={profile.heatmap?.longestStreak}
          currentStreak={profile.heatmap?.currentStreak}
        />

        {/* Deep Dive Tabs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <button
              onClick={() => setActiveTab('contests')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'contests'
                  ? 'bg-[#282828] text-amber-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>Contest Performance ({contestHistory.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('oas')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'oas'
                  ? 'bg-[#282828] text-amber-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              <span>Assessment Records ({oaHistory.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('badges')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'badges'
                  ? 'bg-[#282828] text-amber-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Verified Badges</span>
            </button>
          </div>

          {/* TAB 1: Contest Performance */}
          {activeTab === 'contests' && (
            <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-5">
              {contestHistory.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs font-mono">
                  No Saturday contests attended yet. Join RoundZero Weekly Contest #1 this Saturday!
                </div>
              ) : (
                <div className="space-y-3">
                  {contestHistory.map((c) => (
                    <div
                      key={c.contestId}
                      className="flex items-center justify-between p-4 rounded-xl bg-[#222222] border border-zinc-800/80 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white text-sm">{c.title}</div>
                        <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                          {new Date(c.startTime).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 font-mono text-xs">
                        <div className="text-right">
                          <div className="text-zinc-500 text-[10px]">Problems</div>
                          <div className="font-bold text-white">{c.problemsSolved} / 4</div>
                        </div>
                        <div className="text-right">
                          <div className="text-zinc-500 text-[10px]">Score</div>
                          <div className="font-bold text-amber-400">{c.score} / {c.maxScore}</div>
                        </div>
                        <Link
                          href={`/contest?id=${encodeURIComponent(c.contestId)}`}
                          className="flex items-center gap-1 text-zinc-400 hover:text-amber-400 transition"
                        >
                          <span className="text-[11px]">Standings</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Assessments / OA History */}
          {activeTab === 'oas' && (
            <div className="rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] p-5">
              {oaHistory.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs font-mono">
                  No online assessment sessions found. Create an OA to test your coding abilities.
                </div>
              ) : (
                <div className="space-y-3">
                  {oaHistory.map((oa) => (
                    <div
                      key={oa.sessionId}
                      className="flex items-center justify-between p-4 rounded-xl bg-[#222222] border border-zinc-800/80 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white text-sm">{oa.title}</div>
                        <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                          {oa.questionCount} Questions • {oa.timeLimitMinutes} Mins • {new Date(oa.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 font-mono text-xs">
                        <div className="text-right">
                          <div className="text-zinc-500 text-[10px]">Score</div>
                          <div className="font-bold text-emerald-400">
                            {oa.totalScore} / {oa.maxScore}
                          </div>
                        </div>
                        <Link
                          href={`/oa/results/${oa.sessionId}`}
                          className="flex items-center gap-1 text-zinc-400 hover:text-amber-400 transition"
                        >
                          <span className="text-[11px]">Analysis</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Badges */}
          {activeTab === 'badges' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Star className="h-4 w-4" />
                  <span>Contest Pioneer</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Early participant in the premiere RoundZero Saturday Night Contests.
                </p>
                <span className="inline-block rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                  Unlocked
                </span>
              </div>

              <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                  <Swords className="h-4 w-4" />
                  <span>Code Duelist</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Engaged in live 1v1 multiplayer coding matches in the RoundZero arena.
                </p>
                <span className="inline-block rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-mono text-purple-300">
                  {user.duelWins > 0 ? 'Unlocked' : 'Compete in 1v1 Room'}
                </span>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Flame className="h-4 w-4" />
                  <span>Consistency Streak</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Maintained daily consistency by solving the Problem of the Day.
                </p>
                <span className="inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                  {user.potdStreak >= 3 ? 'Unlocked' : `${user.potdStreak}/3 Days`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#141414] text-zinc-400 flex items-center justify-center font-mono text-sm">
          Loading Profile...
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
