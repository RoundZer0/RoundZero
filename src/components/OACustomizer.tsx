'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Difficulty,
  OAFilterConfig,
  Question,
  DatasetStats,
} from '@/types/oa';
import DifficultyBadge from './DifficultyBadge';
import {
  SlidersHorizontal,
  Shuffle,
  CheckSquare,
  Search,
  Clock,
  Award,
  Layers,
  RefreshCw,
  Eye,
  X,
  FileCode,
  ArrowRight,
} from 'lucide-react';
import { saveSessionLocal } from '@/lib/sessionStore';
import { consumeOACredit, getUserCredits, fetchUserCreditsFromDB } from '@/lib/userCredits';
import RazorpayPayButton from './RazorpayPayButton';
import { useSession } from 'next-auth/react';
import { CreditCard, FilePlus, AlertCircle, Sparkles } from 'lucide-react';
import { UserPlus, UsersRound } from 'lucide-react';

export default function OACustomizer() {
  const router = useRouter();
  const { data: session } = useSession();
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);

  // Dataset statistics
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Form State
  const [difficulties, setDifficulties] = useState<Difficulty[]>([
    'Easy',
    'Medium',
    'Hard',
  ]);
  const [selectedTags, setSelectedTags] = useState<string[]>([
    'Array',
    'Dynamic Programming',
    'String',
    'Tree',
  ]);
  const [tagSearch, setTagSearch] = useState('');
  const [mode, setMode] = useState<'random' | 'manual'>('random');
  const [questionCount, setQuestionCount] = useState<number>(3);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(60);
  const [title, setTitle] = useState<string>('Custom Technical Assessment');

  // Custom Points per Difficulty
  const [pointsConfig, setPointsConfig] = useState({
    Easy: 100,
    Medium: 200,
    Hard: 400,
  });

  // Manual Selection & Random Preview State
  const [matchingQuestions, setMatchingQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [searchQuestionTerm, setSearchQuestionTerm] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);

  // Creating Session State
  const [isCreating, setIsCreating] = useState(false);
  const [roomTitle, setRoomTitle] = useState('Competitive OA Room');
  const [inviteCode, setInviteCode] = useState('');
  const [roomAction, setRoomAction] = useState<'create' | 'join' | null>(null);
  const [roomError, setRoomError] = useState('');

  // Fetch Stats on mount
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/questions?mode=stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to load dataset stats', err);
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, []);

  // Sync authentic credits state from DB
  useEffect(() => {
    if (session?.user?.email) {
      fetchUserCreditsFromDB(session.user.email);
    }
  }, [session?.user?.email]);

  // Fetch matching questions whenever filters change
  useEffect(() => {
    async function fetchMatching() {
      setLoadingQuestions(true);
      try {
        const params = new URLSearchParams({
          difficulties: difficulties.join(','),
          tags: selectedTags.join(','),
          search: searchQuestionTerm,
          pageSize: '100',
        });
        const res = await fetch(`/api/questions?${params.toString()}`);
        const data = await res.json();
        setMatchingQuestions(data.questions || []);
      } catch (e) {
        console.error('Failed to fetch matching questions', e);
      } finally {
        setLoadingQuestions(false);
      }
    }

    const timer = setTimeout(() => {
      fetchMatching();
    }, 200);

    return () => clearTimeout(timer);
  }, [difficulties, selectedTags, searchQuestionTerm]);

  const toggleDifficulty = (diff: Difficulty) => {
    setDifficulties((prev) =>
      prev.includes(diff) ? prev.filter((d) => d !== diff) : [...prev, diff]
    );
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  const toggleQuestionSelection = (qId: number) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const selectPopularTopics = (topics: string[]) => {
    setSelectedTags(topics);
  };

  const estimatedMaxScore =
    mode === 'manual'
      ? selectedQuestionIds.reduce((sum, id) => {
          const q = matchingQuestions.find((mq) => mq.id === id);
          if (!q) return sum;
          return sum + (pointsConfig[q.difficulty] || q.points);
        }, 0)
      : questionCount * 200;

  const handleStartOA = async () => {
    if (difficulties.length === 0) {
      alert('Please select at least one difficulty level.');
      return;
    }

    if (mode === 'manual' && selectedQuestionIds.length === 0) {
      alert('Please select at least one question for manual mode.');
      return;
    }

    // Check OA Credit before initiating request (if not unlimited)
    const userState = getUserCredits();
    const hasUnlimited =
      userState.isUnlimited &&
      (!userState.unlimitedExpiry || new Date(userState.unlimitedExpiry).getTime() > Date.now());

    if (!hasUnlimited && userState.credits <= 0) {
      setShowNoCreditsModal(true);
      return;
    }

    // Deduct local credit only for unauthenticated guest sessions (logged in users are deducted atomically on the server)
    if (!hasUnlimited && !session?.user?.email) {
      const creditCheck = consumeOACredit();
      if (!creditCheck.success) {
        setShowNoCreditsModal(true);
        return;
      }
    }

    setIsCreating(true);

    const config: OAFilterConfig = {
      difficulties,
      tags: selectedTags,
      questionCount,
      mode,
      selectedQuestionIds,
      timeLimitMinutes,
      pointsConfig,
      title: title.trim() || 'Online Assessment',
    };

    try {
      const res = await fetch('/api/oa/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setShowNoCreditsModal(true);
        } else {
          alert(data.error || 'Failed to create OA session');
        }
        setIsCreating(false);
        return;
      }

      if (session?.user?.email) {
        fetchUserCreditsFromDB(session.user.email);
      }

      if (data.session) {
        saveSessionLocal(data.session);
      }

      router.push(`/oa/${data.sessionId}`);
    } catch (e) {
      console.error('Error starting OA', e);
      alert('An error occurred starting the assessment.');
      setIsCreating(false);
    }
  };

  const handleCreateRoom = async () => {
    setRoomAction('create');
    setRoomError('');
    try {
      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: roomTitle.trim() || 'Competitive OA Room' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRoomError(data.error || 'Failed to create room.');
        return;
      }
      router.push(`/room/${data.roomId}`);
    } catch {
      setRoomError('Could not create the room. Please try again.');
    } finally {
      setRoomAction(null);
    }
  };

  const handleJoinRoom = async () => {
    const code = inviteCode.trim();
    if (!code) {
      setRoomError('Enter the invite code shared by the room creator.');
      return;
    }

    setRoomAction('join');
    setRoomError('');
    try {
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRoomError(data.error || 'Failed to join room.');
        return;
      }
      router.push(`/room/${data.roomId}`);
    } catch {
      setRoomError('Could not join the room. Please try again.');
    } finally {
      setRoomAction(null);
    }
  };

  const filteredTagCounts =
    stats?.tagCounts.filter((tc) =>
      tc.name.toLowerCase().includes(tagSearch.toLowerCase())
    ) || [];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Collaborative room entry point */}
      <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <UsersRound className="h-4 w-4" />
              Collaborative rooms
            </div>
            <h2 className="text-lg font-bold text-white">Practice with your team</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Create a shared assessment room or join one with an invite code. Room creators can add participants by email.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                New room
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomTitle}
                  onChange={(event) => setRoomTitle(event.target.value)}
                  placeholder="Room name"
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={roomAction !== null}
                  className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {roomAction === 'create' ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Join a room
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleJoinRoom();
                  }}
                  placeholder="Invite code"
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs font-mono uppercase tracking-wider text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleJoinRoom}
                  disabled={roomAction !== null}
                  className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-bold text-white transition hover:border-amber-500/50 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  {roomAction === 'join' ? 'Joining...' : 'Join'}
                </button>
              </div>
            </div>
          </div>
        </div>
        {roomError && <p className="mt-3 text-xs text-rose-400">{roomError}</p>}
      </section>

      {/* Professional Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-300">
          Dataset: 2,800+ Algorithm Problems
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Online Assessment Generator
        </h1>
        <p className="text-zinc-400 max-w-2xl text-xs sm:text-sm leading-relaxed">
          Configure question difficulty levels, target topics, time limits, and custom scoring rules. Build randomized assessments or manually curate problem sets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Filter Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assessment Info */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
              <SlidersHorizontal className="h-4 w-4 text-amber-400" />
              1. General Parameters
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Assessment Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Frontend Engineering OA"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Duration Limit
                </label>
                <div className="flex items-center gap-1.5">
                  {[30, 45, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setTimeLimitMinutes(mins)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-medium border transition ${
                        timeLimitMinutes === mins
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Difficulty & Points Customization */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                <Award className="h-4 w-4 text-amber-400" />
                2. Difficulties & Points Assignment
              </h2>
              <span className="text-[11px] text-zinc-400 font-mono">
                Toggle level to include
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((diff) => {
                const isSelected = difficulties.includes(diff);
                const count = stats?.difficultyCounts[diff] || 0;
                return (
                  <div
                    key={diff}
                    className={`rounded-lg border p-3.5 transition ${
                      isSelected
                        ? 'border-zinc-700 bg-zinc-950'
                        : 'border-zinc-800/60 bg-zinc-950/40 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <button
                        type="button"
                        onClick={() => toggleDifficulty(diff)}
                        className="flex items-center gap-2"
                      >
                        <DifficultyBadge difficulty={diff} size="sm" />
                        <span className="text-[11px] font-mono text-zinc-400">
                          ({count})
                        </span>
                      </button>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDifficulty(diff)}
                        className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Score Allocation
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="10"
                          max="1000"
                          step="10"
                          value={pointsConfig[diff]}
                          onChange={(e) =>
                            setPointsConfig({
                              ...pointsConfig,
                              [diff]: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-mono font-bold text-amber-400 focus:border-amber-500 focus:outline-none"
                        />
                        <span className="text-[11px] font-mono text-zinc-400">pts</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Topic Selector */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                  <Layers className="h-4 w-4 text-amber-400" />
                  3. Topic Selection ({selectedTags.length} Active)
                </h2>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedTags(stats?.tagCounts.map((t) => t.name) || [])
                  }
                  className="text-amber-400 hover:underline font-medium"
                >
                  Select All
                </button>
                <span className="text-zinc-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Popular Topic Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1 border-t border-zinc-800/60">
              <span className="text-zinc-400 font-medium mr-1 text-[11px]">Presets:</span>
              <button
                type="button"
                onClick={() => selectPopularTopics(['Array', 'String', 'Hash Table'])}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 border border-zinc-700/60"
              >
                Arrays & Strings
              </button>
              <button
                type="button"
                onClick={() =>
                  selectPopularTopics(['Dynamic Programming', 'Greedy', 'Backtracking'])
                }
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 border border-zinc-700/60"
              >
                DP & Greedy
              </button>
              <button
                type="button"
                onClick={() =>
                  selectPopularTopics(['Tree', 'Binary Tree', 'Depth-First Search', 'Graph'])
                }
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 border border-zinc-700/60"
              >
                Trees & Graphs
              </button>
            </div>

            {/* Tag Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search topics (e.g. Binary Search, Dynamic Programming)..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-sans"
              />
            </div>

            {/* Topic Pills Grid */}
            <div className="max-h-48 overflow-y-auto pr-1 flex flex-wrap gap-1.5 scrollbar-thin scrollbar-thumb-zinc-700">
              {loadingStats ? (
                <div className="py-4 text-xs text-zinc-500 font-mono">
                  Loading topics dataset...
                </div>
              ) : (
                filteredTagCounts.map((tc) => {
                  const isSelected = selectedTags.includes(tc.name);
                  return (
                    <button
                      key={tc.name}
                      type="button"
                      onClick={() => toggleTag(tc.name)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition border ${
                        isSelected
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 font-semibold'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <span>{tc.name}</span>
                      <span className="rounded bg-zinc-900 px-1 py-0.2 text-[10px] font-mono text-zinc-400">
                        {tc.count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Question Selection Strategy */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                <Shuffle className="h-4 w-4 text-amber-400" />
                4. Problem Selection Mode
              </h2>

              <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
                <button
                  type="button"
                  onClick={() => setMode('random')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
                    mode === 'random'
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Auto-Randomize
                </button>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
                    mode === 'manual'
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Manual Selection ({selectedQuestionIds.length})
                </button>
              </div>
            </div>

            {mode === 'random' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400">
                    Questions Count
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {questionCount} Questions Selected
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition ${
                        questionCount === num
                          ? 'bg-amber-500 text-zinc-950 border-amber-400'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-zinc-400 pt-1">
                  Questions will be randomly sampled from {matchingQuestions.length} matching candidate problems.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Filter candidate questions..."
                      value={searchQuestionTerm}
                      onChange={(e) => setSearchQuestionTerm(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">
                    {matchingQuestions.length} Eligible
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto border border-zinc-800 rounded-lg bg-zinc-950 divide-y divide-zinc-800/60">
                  {loadingQuestions ? (
                    <div className="p-6 text-center text-xs text-zinc-500 font-mono">
                      Filtering problems...
                    </div>
                  ) : matchingQuestions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-400">
                      No questions match current filters.
                    </div>
                  ) : (
                    matchingQuestions.slice(0, 50).map((q) => {
                      const isChecked = selectedQuestionIds.includes(q.id);
                      return (
                        <div
                          key={q.id}
                          className={`flex items-center justify-between p-2.5 transition hover:bg-zinc-900 ${
                            isChecked ? 'bg-zinc-900/90' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleQuestionSelection(q.id)}
                              className="h-4 w-4 rounded accent-amber-500"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-zinc-500">
                                  #{q.id}
                                </span>
                                <span className="font-medium text-xs text-zinc-200 truncate">
                                  {q.title}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <DifficultyBadge
                              difficulty={q.difficulty}
                              points={pointsConfig[q.difficulty] || q.points}
                              size="sm"
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewQuestion(q)}
                              className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Assessment Summary Card */}
        <div className="space-y-6">
          <div className="sticky top-20 rounded-xl border border-zinc-800 bg-zinc-900/90 p-6 space-y-6 shadow-xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2 uppercase tracking-wider">
              <Award className="h-4 w-4 text-amber-400" />
              Summary Overview
            </h2>

            <div className="space-y-3.5 text-xs font-mono divide-y divide-zinc-800/80">
              <div className="pt-2 flex items-center justify-between">
                <span className="text-zinc-400">Total Questions:</span>
                <span className="font-bold text-white text-sm">
                  {mode === 'manual' ? selectedQuestionIds.length : questionCount}
                </span>
              </div>

              <div className="pt-3.5 flex items-center justify-between">
                <span className="text-zinc-400">Allocated Time:</span>
                <span className="font-bold text-white">
                  {timeLimitMinutes} Mins
                </span>
              </div>

              <div className="pt-3.5 flex items-center justify-between">
                <span className="text-zinc-400">Maximum Points:</span>
                <span className="font-bold text-amber-400 text-sm">
                  {estimatedMaxScore} pts
                </span>
              </div>

              <div className="pt-3.5 space-y-2 font-sans">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Active Difficulties
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {difficulties.map((diff) => (
                    <DifficultyBadge
                      key={diff}
                      difficulty={diff}
                      points={pointsConfig[diff]}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartOA}
              disabled={isCreating || matchingQuestions.length === 0}
              className="w-full py-3 px-4 rounded-lg bg-amber-500 font-bold text-zinc-950 border border-amber-400/40 hover:bg-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creating Session...
                </>
              ) : (
                <>
                  <span>Start Assessment</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <DifficultyBadge
                  difficulty={previewQuestion.difficulty}
                  points={pointsConfig[previewQuestion.difficulty] || previewQuestion.points}
                />
                <h3 className="text-base font-bold text-white">
                  #{previewQuestion.id}. {previewQuestion.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="p-1 rounded text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {previewQuestion.problemDescription}
            </div>
          </div>
        </div>
      )}
      {/* Out of Credits Modal */}
      {showNoCreditsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-400" />
                OA Credits Exhausted
              </h3>
              <button
                type="button"
                onClick={() => setShowNoCreditsModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <p>
                You have used your 1 free initial OA assessment credit. Choose how you&apos;d like to unlock your next assessment:
              </p>

              <div className="space-y-3 pt-2">
                {/* Option 1: Buy Passes */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-amber-400" />
                      Option A: 3 Months Unlimited Pass
                    </span>
                    <span className="text-amber-400">₹99</span>
                  </div>
                  <p className="text-zinc-400 text-[11px]">
                    Instant activation for 3 months unlimited assessment creation.
                  </p>
                  <RazorpayPayButton
                    planId="unlimited_3months_99"
                    amount={99}
                    credits={999}
                    planName="3 Months Unlimited Pro Pass"
                    buttonText="Pay ₹99 & Unlock 3 Months Pass"
                    className="w-full mt-1 py-2.5 rounded-lg bg-[#ffa116] hover:bg-[#ffa116]/90 text-[#1a1a1a] font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
                  />
                </div>

                {/* Option 2: Contribute 3 Questions */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <FilePlus className="h-4 w-4 text-amber-400" />
                      Option B: Contribute 3 Questions (FREE)
                    </span>
                    <span className="text-emerald-400 font-mono text-xs">Free</span>
                  </div>
                  <p className="text-zinc-400 text-[11px]">
                    Submit 3 algorithm questions with problem descriptions, test cases & edge cases.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNoCreditsModal(false);
                      router.push('/contribute');
                    }}
                    className="w-full mt-1 py-2.5 rounded-lg bg-[#1e1e1e] hover:bg-[#282828] border border-amber-500/30 text-[#ffa116] font-bold text-xs transition"
                  >
                    Contribute Questions (+1 Free OA)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
