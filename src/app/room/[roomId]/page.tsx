'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Users,
  Copy,
  Check,
  Play,
  RefreshCw,
  Clock,
  Crown,
  LogOut,
  Wifi,
  WifiOff,
  SlidersHorizontal,
  Search,
  X,
  Mail,
  UserPlus,
  AlertTriangle,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import {
  OAFilterConfig,
  Difficulty,
  DatasetStats,
  Question,
} from '@/types/oa';
import DifficultyBadge from '@/components/DifficultyBadge';
import { checkOACredit, fetchUserCreditsFromDB } from '@/lib/userCredits';

const ORANGE = '#ff9f0a';
const POLL_INTERVAL_MS = 3000;

interface RoomMember {
  email: string;
  name?: string;
  image?: string;
  sessionId?: string;
  isReady?: boolean;
  problemsSolved?: number;
  totalScore?: number;
}

interface RoomData {
  roomId: string;
  inviteCode: string;
  title: string;
  roomType?: '1v1_duel' | 'group_mock';
  creatorEmail: string;
  members: RoomMember[];
  status: 'waiting' | 'active' | 'completed';
  winnerEmail?: string;
  oaConfig?: any;
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { data: authSession, status: authStatus } = useSession();
  const myEmail = authSession?.user?.email ?? '';

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/');
    }
  }, [authStatus, router]);

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');
  const [isAddingPeople, setIsAddingPeople] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Initial credits state loaded from authentic in-memory status
  const [credits, setCredits] = useState<{
    loading: boolean;
    success: boolean;
    isUnlimited: boolean;
    message: string;
    remainingCredits: number;
  }>(() => {
    const initial = checkOACredit();
    return {
      loading: false,
      success: initial.success,
      isUnlimited: initial.isUnlimited,
      message: initial.message,
      remainingCredits: initial.remainingCredits,
    };
  });

  // OA Configuration state (creator only)
  const [showConfig, setShowConfig] = useState(false);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(['Easy', 'Medium', 'Hard']);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Array', 'Dynamic Programming', 'String', 'Tree']);
  const [tagSearch, setTagSearch] = useState('');
  const [mode, setMode] = useState<'random' | 'manual'>('random');
  const [questionCount, setQuestionCount] = useState(3);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [title, setTitle] = useState('');
  const [pointsConfig, setPointsConfig] = useState({ Easy: 100, Medium: 200, Hard: 400 });
  const [matchingQuestions, setMatchingQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [searchQuestionTerm, setSearchQuestionTerm] = useState('');
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const isCreator = room?.creatorEmail === myEmail;

  // Poll room state
  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/room/${roomId}`);
      if (!res.ok) {
        if (res.status === 404) router.push('/');
        return;
      }
      const data: RoomData = await res.json();
      setRoom(data);
      setIsOnline(true);

      // If OA is active, redirect to candidate's test session
      if (data.status === 'active') {
        const me = data.members.find((m) => m.email === myEmail);
        if (me?.sessionId) {
          router.push(`/oa/${me.sessionId}`);
        }
      }
    } catch {
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  }, [roomId, myEmail, router]);

  // Fetch authentic user credits from DB
  const fetchUserCredits = useCallback(async () => {
    try {
      const state = await fetchUserCreditsFromDB(myEmail || undefined);
      const hasUnlimited =
        state.isUnlimited &&
        (!state.unlimitedExpiry || new Date(state.unlimitedExpiry).getTime() > Date.now());
      const hasCredit = hasUnlimited || state.credits > 0;

      setCredits({
        loading: false,
        success: hasCredit,
        isUnlimited: hasUnlimited,
        message: hasUnlimited
          ? '3 Months Unlimited Pass Active'
          : `${state.credits} Credit${state.credits === 1 ? '' : 's'} Available`,
        remainingCredits: hasUnlimited ? 999 : state.credits,
      });
    } catch {
      const fallback = checkOACredit();
      setCredits({
        loading: false,
        success: fallback.success,
        isUnlimited: fallback.isUnlimited,
        message: fallback.message,
        remainingCredits: fallback.remainingCredits,
      });
    }
  }, [myEmail]);

  useEffect(() => {
    fetchRoom();
    fetchUserCredits();
    const interval = setInterval(fetchRoom, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchRoom, fetchUserCredits]);

  // Listen to credits updates across tabs/windows
  useEffect(() => {
    const onCreditsUpdated = () => {
      const current = checkOACredit();
      setCredits({
        loading: false,
        success: current.success,
        isUnlimited: current.isUnlimited,
        message: current.message,
        remainingCredits: current.remainingCredits,
      });
    };
    window.addEventListener('roundzero_credits_updated', onCreditsUpdated);
    return () => window.removeEventListener('roundzero_credits_updated', onCreditsUpdated);
  }, []);

  // Load stats for config panel
  useEffect(() => {
    if (!showConfig) return;
    fetch('/api/questions?mode=stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [showConfig]);

  // Fetch matching questions when config changes
  useEffect(() => {
    if (!showConfig) return;
    const timer = setTimeout(async () => {
      setLoadingQuestions(true);
      try {
        const params = new URLSearchParams({
          difficulties: difficulties.join(','),
          tags: selectedTags.join(','),
          search: searchQuestionTerm,
          pageSize: '100',
        });
        const res = await fetch(`/api/questions?${params}`);
        const data = await res.json();
        setMatchingQuestions(data.questions || []);
      } catch {}
      setLoadingQuestions(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [showConfig, difficulties, selectedTags, searchQuestionTerm]);

  const buildConfig = (): OAFilterConfig => ({
    difficulties,
    tags: selectedTags,
    questionCount,
    mode,
    selectedQuestionIds,
    timeLimitMinutes,
    pointsConfig,
    title: (title || room?.title || 'Room OA').trim(),
  });

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    await fetch(`/api/room/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_config', oaConfig: buildConfig() }),
    });
    setIsSavingConfig(false);
    setShowConfig(false);
    fetchRoom();
  };

  const handleStartOA = async () => {
    // Check credits before firing start request
    const current = checkOACredit();
    if (!current.isUnlimited && current.remainingCredits <= 0) {
      setStartError('You have 0 OA credits remaining. Purchase ₹99 Unlimited Pass or contribute 3 questions to unlock!');
      return;
    }

    setIsStarting(true);
    setStartError('');

    try {
      const res = await fetch(`/api/room/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_oa', oaConfig: buildConfig() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStartError(data.error || 'Failed to start OA');
        setIsStarting(false);
      }
      // Redirect is handled automatically by poll
    } catch {
      setStartError('Network error starting assessment. Please try again.');
      setIsStarting(false);
    }
  };

  const handleLeave = async () => {
    await fetch(`/api/room/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave' }),
    });
    router.push('/');
  };

  const handleToggleReady = async () => {
    try {
      await fetch(`/api/room/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_ready' }),
      });
      fetchRoom();
    } catch {}
  };

  const handleSetRoomType = async (type: '1v1_duel' | 'group_mock') => {
    try {
      await fetch(`/api/room/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_room_type', roomType: type }),
      });
      fetchRoom();
    } catch {}
  };

  const copyInviteCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteLink = () => {
    if (!room) return;
    navigator.clipboard.writeText(`${window.location.origin}/join?code=${room.inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddPeople = async () => {
    const emails = inviteEmails
      .split(/[\s,;]+/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      setInviteError('Enter at least one email address.');
      setInviteSuccess('');
      return;
    }

    setIsAddingPeople(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      const res = await fetch(`/api/room/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_members', emails }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || 'Could not add people.');
        return;
      }

      setInviteEmails('');
      setInviteSuccess(
        data.added === 0
          ? 'All participants are already in this room.'
          : `${data.added} participant${data.added === 1 ? '' : 's'} added. Share the invite code so they can join.`
      );
      fetchRoom();
    } catch {
      setInviteError('Could not add people. Please try again.');
    } finally {
      setIsAddingPeople(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#181818] text-white">
        <div className="flex items-center gap-3 font-mono text-sm">
          <RefreshCw className="h-5 w-5 animate-spin" style={{ color: ORANGE }} />
          <span>Loading room environment...</span>
        </div>
      </div>
    );
  }

  if (!room) return null;

  const filteredTagCounts =
    stats?.tagCounts.filter((tc) =>
      tc.name.toLowerCase().includes(tagSearch.toLowerCase())
    ) || [];

  return (
    <div className="min-h-screen bg-[#181818] text-white relative overflow-x-hidden">
      {/* Background with subtle LeetCode orange glow */}
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

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Unified Room & Duel Header */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#202020] p-5 sm:p-6 shadow-xl space-y-5">
          {/* Top Status & Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-2.5">
              {isCreator ? (
                <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-xl border border-white/[0.07]">
                  <button
                    type="button"
                    onClick={() => handleSetRoomType('1v1_duel')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      (room.roomType || '1v1_duel') === '1v1_duel'
                        ? 'bg-[#ffa116] text-black shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Swords className="h-3.5 w-3.5" />
                    <span>1v1 Code Duel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetRoomType('group_mock')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      room.roomType === 'group_mock'
                        ? 'bg-[#ffa116] text-black shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Group Mock OA</span>
                  </button>
                </div>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg bg-[#282828] border border-white/[0.08] px-3 py-1 text-xs font-bold text-amber-400 font-mono">
                  {(room.roomType || '1v1_duel') === '1v1_duel' ? (
                    <>
                      <Swords className="h-3.5 w-3.5" />
                      <span>1v1 Code Duel</span>
                    </>
                  ) : (
                    <>
                      <Users className="h-3.5 w-3.5" />
                      <span>Group Mock OA</span>
                    </>
                  )}
                </span>
              )}

              {isOnline ? (
                <span className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[11px] text-rose-400 font-medium">
                  <WifiOff className="h-3 w-3" />
                  Reconnecting...
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Invite code & copy */}
              <div className="flex items-center gap-2 bg-[#181818] border border-white/[0.08] px-3 py-1 rounded-xl">
                <span className="text-[10px] uppercase font-mono tracking-wider text-white/40">CODE:</span>
                <span className="font-mono text-sm font-bold tracking-widest text-[#ffa116]">
                  {room.inviteCode}
                </span>
                <button
                  type="button"
                  onClick={copyInviteCode}
                  className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition"
                  title="Copy code"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <button
                type="button"
                onClick={copyInviteLink}
                className="hidden sm:inline-flex text-xs text-[#ffa116] hover:underline transition font-mono"
              >
                Copy Link
              </button>

              {!isCreator && (
                <button
                  type="button"
                  onClick={handleLeave}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#282828] px-2.5 py-1 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Leave
                </button>
              )}
            </div>
          </div>

          {/* Head-to-Head 1v1 Battle Arena */}
          {(room.roomType || '1v1_duel') === '1v1_duel' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-2 font-bold text-amber-400">
                  <Swords className="h-4 w-4 text-amber-400" />
                  HEAD-TO-HEAD DUEL ARENA
                </span>
                <span className="text-zinc-400">
                  {room.oaConfig ? `${room.oaConfig.questionCount || 2} Problems • ${room.oaConfig.timeLimitMinutes || 45} Mins` : '1st to Solve Wins'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
                {/* Player 1 (You) */}
                {(() => {
                  const me = room.members.find((m) => m.email.toLowerCase() === myEmail.toLowerCase());
                  return (
                    <div className="rounded-xl border border-zinc-700 bg-[#252525] p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-amber-500 text-black font-bold flex items-center justify-center text-sm shadow">
                          {(me?.name || myEmail)[0]?.toUpperCase() || 'Y'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white flex items-center gap-1.5">
                            <span className="truncate">{me?.name || 'You'}</span>
                            <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] text-zinc-400 font-mono flex-shrink-0">
                              You
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono truncate">{me?.email}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleToggleReady}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition flex-shrink-0 ${
                          me?.isReady
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-zinc-800 text-amber-400 border-amber-500/30 hover:border-amber-400'
                        }`}
                      >
                        {me?.isReady ? '✓ Ready' : 'Ready Up'}
                      </button>
                    </div>
                  );
                })()}

                {/* VS Badge */}
                <div className="flex flex-col items-center justify-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 border border-amber-500/40 text-amber-400 font-extrabold text-xs shadow-lg shadow-amber-500/10">
                    VS
                  </div>
                </div>

                {/* Player 2 (Challenger) */}
                {(() => {
                  const opponent = room.members.find((m) => m.email.toLowerCase() !== myEmail.toLowerCase());
                  if (!opponent) {
                    return (
                      <div className="rounded-xl border border-dashed border-zinc-700 bg-[#1c1c1c] p-4 flex items-center justify-center text-center">
                        <div className="space-y-1">
                          <div className="text-xs text-zinc-400 font-mono">Awaiting Challenger...</div>
                          <div className="text-[11px] text-amber-400 font-mono font-bold">Share code: {room.inviteCode}</div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="rounded-xl border border-zinc-700 bg-[#252525] p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-purple-500 text-white font-bold flex items-center justify-center text-sm shadow flex-shrink-0">
                          {(opponent.name || opponent.email)[0]?.toUpperCase() || 'O'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">{opponent.name || 'Opponent'}</div>
                          <div className="text-[11px] text-zinc-400 font-mono truncate">{opponent.email}</div>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border flex-shrink-0 ${
                          opponent.isReady
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {opponent.isReady ? '✓ Ready' : 'Preparing...'}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-white">{room.title}</h1>
              <p className="text-xs text-white/40">
                {room.members.length} participant{room.members.length !== 1 ? 's' : ''} connected • Synchronized group assessment
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Members list */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#202020] p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-white/50" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
                Participants ({room.members.length})
              </h2>
            </div>

            <div className="space-y-2">
              {room.members.map((member) => (
                <div
                  key={member.email}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#282828] px-4 py-3"
                >
                  {/* Avatar */}
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-black"
                    style={{ backgroundColor: ORANGE }}
                  >
                    {(member.name || member.email)[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {member.name || member.email}
                      </span>
                      {member.email === room.creatorEmail && (
                        <span title="Room Creator">
                          <Crown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: ORANGE }} />
                        </span>
                      )}
                      {member.email === myEmail && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white/50">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-white/30 truncate block">{member.email}</span>
                  </div>

                  <div className="h-2 w-2 rounded-full bg-emerald-400" title="Online" />
                </div>
              ))}
            </div>

            {/* Invite hint */}
            <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] py-3 px-4 text-center text-xs text-white/35">
              Share code{' '}
              <span className="font-mono font-bold" style={{ color: ORANGE }}>
                {room.inviteCode}
              </span>{' '}
              with friends to invite them
            </div>

            {isCreator && (
              <div className="mt-5 border-t border-white/[0.07] pt-5">
                <div className="mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-white/50" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                    Add people by email
                  </h3>
                </div>
                <p className="mb-3 text-[11px] leading-relaxed text-white/35">
                  Add one or more email addresses separated by commas or spaces. They can use the invite code to enter this room.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={inviteEmails}
                    onChange={(event) => setInviteEmails(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleAddPeople();
                    }}
                    placeholder="alex@example.com, sam@example.com"
                    className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-[#282828] px-3 py-2.5 text-xs text-white placeholder-white/25 focus:border-[#ff9f0a] focus:outline-none"
                    disabled={isAddingPeople || room.status !== 'waiting'}
                  />
                  <button
                    type="button"
                    onClick={handleAddPeople}
                    disabled={isAddingPeople || room.status !== 'waiting'}
                    className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: ORANGE }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {isAddingPeople ? 'Adding...' : 'Add people'}
                  </button>
                </div>
                {inviteError && <p className="mt-2 text-xs text-rose-400">{inviteError}</p>}
                {inviteSuccess && <p className="mt-2 text-xs text-emerald-400">{inviteSuccess}</p>}
              </div>
            )}
          </div>

          {/* Right panel: OA config summary + start */}
          <div className="space-y-4">
            {/* Config summary card */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#202020] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/60 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Assessment Config
                </h2>
                {isCreator && (
                  <button
                    onClick={() => setShowConfig(true)}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-white/[0.1] bg-[#282828] text-white/50 hover:text-white transition"
                  >
                    Edit
                  </button>
                )}
              </div>

              {room.oaConfig ? (
                <div className="space-y-2 text-xs font-mono">
                  <Row
                    label="Questions"
                    value={
                      room.oaConfig.mode === 'manual'
                        ? `${room.oaConfig.selectedQuestionIds?.length || 0} (manual)`
                        : `${room.oaConfig.questionCount} (random)`
                    }
                  />
                  <Row label="Time Limit" value={`${room.oaConfig.timeLimitMinutes} min`} />
                  <Row label="Mode" value={room.oaConfig.mode} />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {room.oaConfig.difficulties?.map((d: string) => (
                      <DifficultyBadge key={d} difficulty={d as Difficulty} size="sm" />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/30 leading-relaxed">
                  {isCreator
                    ? 'Configure the assessment settings before starting.'
                    : 'Waiting for the room creator to configure the assessment.'}
                </p>
              )}

              {isCreator && !room.oaConfig && (
                <button
                  onClick={() => setShowConfig(true)}
                  className="w-full py-2.5 rounded-xl border border-white/[0.1] bg-[#282828] text-xs font-medium text-white/60 hover:text-white transition"
                >
                  Set Up Assessment →
                </button>
              )}
            </div>

            {/* Start button (creator only) */}
            {isCreator && (
              <div className="space-y-2">
                {startError && (
                  <p className="text-xs text-rose-400 text-center">{startError}</p>
                )}
                <button
                  onClick={handleStartOA}
                  disabled={isStarting || room.members.length < 1}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-black transition disabled:opacity-50 shadow-lg hover:brightness-105"
                  style={{ backgroundColor: ORANGE }}
                >
                  {isStarting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-black" />
                      <span>Starting OA...</span>
                    </>
                  ) : (
                    <>
                      {(room.roomType || '1v1_duel') === '1v1_duel' ? (
                        <>
                          <Swords className="h-4 w-4 text-black" />
                          <span>Start 1v1 Code Duel</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 text-black" />
                          <span>Start OA for Everyone</span>
                        </>
                      )}
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] text-white/35">
                  {credits.isUnlimited
                    ? 'Unlimited Pass Active • No credits deducted'
                    : '1 OA credit will be deducted from your account'}
                </p>
              </div>
            )}

            {!isCreator && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#202020] p-4 text-center space-y-2">
                <RefreshCw className="h-5 w-5 mx-auto animate-spin text-white/30" />
                <p className="text-xs text-white/40">
                  Waiting for {room.creatorEmail.split('@')[0]} to start the assessment...
                </p>
              </div>
            )}

            {/* Clock hint */}
            {room.oaConfig && (
              <div className="flex items-center gap-2 text-[11px] text-white/25 px-1">
                <Clock className="h-3.5 w-3.5" />
                Timer starts the moment the OA begins for all members.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Config Panel Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-[#1e1e1e] shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
              <h2 className="text-base font-bold text-white">Configure Assessment</h2>
              <button
                onClick={() => setShowConfig(false)}
                className="text-white/40 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Title + time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={room.title}
                    className="w-full rounded-lg border border-white/[0.1] bg-[#282828] px-3 py-2 text-xs text-white placeholder-white/25 focus:border-[#ff9f0a] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Duration</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[30, 45, 60, 90, 120].map((m) => (
                      <button
                        key={m}
                        onClick={() => setTimeLimitMinutes(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
                          timeLimitMinutes === m
                            ? 'bg-[#ff9f0a] text-black border-[#ff9f0a] font-bold'
                            : 'bg-[#282828] text-white/50 border-white/[0.1] hover:text-white'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Difficulties */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">Difficulties</label>
                <div className="flex gap-2">
                  {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() =>
                        setDifficulties((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                        )
                      }
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                        difficulties.includes(d)
                          ? 'border-[#ff9f0a]/40 bg-[#ff9f0a]/10 text-[#ff9f0a]'
                          : 'border-white/[0.08] bg-[#282828] text-white/40 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topics / Tags */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">Topics</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search topics..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.1] bg-[#282828] pl-9 pr-3 py-2 text-xs text-white placeholder-white/25 focus:border-[#ff9f0a] focus:outline-none"
                  />
                </div>
                <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
                  {filteredTagCounts.slice(0, 40).map((tc) => {
                    const active = selectedTags.includes(tc.name);
                    return (
                      <button
                        key={tc.name}
                        onClick={() =>
                          setSelectedTags((prev) =>
                            active ? prev.filter((t) => t !== tc.name) : [...prev, tc.name]
                          )
                        }
                        className={`px-2.5 py-1 rounded-md text-xs border transition ${
                          active
                            ? 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30 font-medium'
                            : 'bg-[#282828] text-white/40 border-white/[0.08] hover:text-white/70'
                        }`}
                      >
                        {tc.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode + count */}
              <div>
                <div className="flex gap-2 mb-3">
                  {(['random', 'manual'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                        mode === m
                          ? 'bg-[#ff9f0a] text-black border-[#ff9f0a]'
                          : 'bg-[#282828] text-white/50 border-white/[0.1] hover:text-white'
                      }`}
                    >
                      {m === 'random' ? '🎲 Random' : '📋 Manual'}
                    </button>
                  ))}
                </div>

                {mode === 'random' ? (
                  <div className="flex gap-1.5 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => setQuestionCount(n)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
                          questionCount === n
                            ? 'bg-[#ff9f0a] text-black border-[#ff9f0a] font-bold'
                            : 'bg-[#282828] text-white/50 border-white/[0.1] hover:text-white'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/30" />
                      <input
                        type="text"
                        placeholder="Filter questions..."
                        value={searchQuestionTerm}
                        onChange={(e) => setSearchQuestionTerm(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.1] bg-[#282828] pl-9 pr-3 py-2 text-xs text-white placeholder-white/25 focus:border-[#ff9f0a] focus:outline-none"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-white/[0.08] rounded-lg bg-[#282828] divide-y divide-white/[0.05]">
                      {loadingQuestions ? (
                        <div className="p-4 text-center text-xs text-white/30">Loading...</div>
                      ) : (
                        matchingQuestions.slice(0, 30).map((q) => {
                          const checked = selectedQuestionIds.includes(q.id);
                          return (
                            <div
                              key={q.id}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04] cursor-pointer"
                              onClick={() =>
                                setSelectedQuestionIds((prev) =>
                                  checked ? prev.filter((id) => id !== q.id) : [...prev, q.id]
                                )
                              }
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {}}
                                className="accent-[#ff9f0a]"
                              />
                              <span className="text-[10px] text-white/30 font-mono">#{q.id}</span>
                              <span className="flex-1 text-xs text-white/70 truncate">{q.title}</span>
                              <DifficultyBadge difficulty={q.difficulty} size="sm" />
                            </div>
                          );
                        })
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-white/25">{selectedQuestionIds.length} selected</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/[0.07] px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 text-xs rounded-lg text-white/40 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold text-black transition hover:brightness-105"
                style={{ backgroundColor: ORANGE }}
              >
                {isSavingConfig ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save Config
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-white/[0.05]">
      <span className="text-white/40">{label}</span>
      <span className="text-white/70 font-medium">{value}</span>
    </div>
  );
}
