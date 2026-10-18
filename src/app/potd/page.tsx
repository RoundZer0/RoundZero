'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Question } from '@/types/oa';
import DifficultyBadge from '@/components/DifficultyBadge';
import CodeEditor from '@/components/CodeEditor';
import { getStarterTemplate } from '@/lib/starterTemplates';
import { fetchUserCreditsFromDB } from '@/lib/userCredits';
import {
  Flame,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Terminal,
  FileText,
  Sparkles,
  Check,
  X,
  RefreshCw,
  Lock,
  Copy,
  Code2,
  ChevronUp,
  ChevronDown,
  CloudUpload,
  Trophy,
  Zap,
  ArrowRight,
} from 'lucide-react';

type OutputState = 'passed' | 'failed' | 'error';

type TestResult = {
  id?: string | number;
  passed?: boolean;
  input?: string;
  expected?: string;
  actual?: string;
  error?: unknown;
};

type TestOutput = {
  error?: unknown;
  status?: string;
  runtime?: string | number;
  memory?: string | number;
  results?: TestResult[];
  totalTests?: number;
  totalPassed?: number;
  hiddenStats?: {
    total: number;
    passed: number;
    allPassed: boolean;
  };
};

type SubmissionRecord = {
  output: TestOutput;
  code: string;
  language: string;
  at: string;
  passed: boolean;
};

const getOutputState = (o: TestOutput | null, passed?: boolean): OutputState => {
  if (passed) return 'passed';
  if (!o) return 'failed';
  if (o.status === 'Accepted' || o.status === 'passed') return 'passed';
  if (o.error || o.status === 'ERROR' || /error/i.test(String(o.status || ''))) {
    return 'error';
  }
  const allSample =
    Array.isArray(o.results) &&
    o.results.length > 0 &&
    o.results.every((r) => r.passed);
  const allHidden = o.hiddenStats ? o.hiddenStats.allPassed : true;
  return allSample && allHidden ? 'passed' : 'failed';
};

const formatError = (err: unknown): string => {
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
};

const getStatusMeta = (o: TestOutput, passed?: boolean) => {
  if (passed || o?.status === 'Accepted' || o?.status === 'passed') {
    return { label: 'Accepted', color: 'text-emerald-400' };
  }
  if (o?.status === 'COMPILE_ERROR')
    return { label: 'Compile Error', color: 'text-rose-400' };
  if (o?.status === 'RUNTIME_ERROR')
    return { label: 'Runtime Error', color: 'text-rose-400' };
  if (o?.status === 'TIME_LIMIT_EXCEEDED')
    return { label: 'Time Limit Exceeded', color: 'text-amber-400' };
  const state = getOutputState(o, passed);
  if (state === 'passed') return { label: 'Accepted', color: 'text-emerald-400' };
  if (state === 'error') return { label: 'Error', color: 'text-amber-400' };
  return { label: 'Wrong Answer', color: 'text-rose-400' };
};

export default function POTDPage() {
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [dateStr, setDateStr] = useState<string>('');
  const [userStatus, setUserStatus] = useState<{
    isAuthenticated: boolean;
    streak: number;
    isSolvedToday: boolean;
    credits: number;
  }>({
    isAuthenticated: false,
    streak: 0,
    isSolvedToday: false,
    credits: 1,
  });

  // Countdown timer to next reset
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // Code state
  const [language, setLanguage] = useState<string>('python');
  const [code, setCode] = useState<string>('');

  // Execution & Console state
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testOutput, setTestOutput] = useState<TestOutput | null>(null);
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);
  const lastExecutionTimeRef = useRef<number>(0);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<'testcase' | 'result'>('testcase');
  const [leftTab, setLeftTab] = useState<'description' | 'submission'>('description');
  const [selectedSampleTab, setSelectedSampleTab] = useState<number>(0);
  const [selectedCaseTab, setSelectedCaseTab] = useState<number>(0);

  // Submissions state
  const [submissionLog, setSubmissionLog] = useState<SubmissionRecord[]>([]);
  const [selectedSubIdx, setSelectedSubIdx] = useState<number>(0);

  // Celebration Modal
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{ newStreak: number; creditAdded: boolean } | null>(null);

  // Splitter state
  const [leftWidth, setLeftWidth] = useState<number>(45);
  const [isDragging, setIsDragging] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  // Purge any legacy unscoped keys on mount that cause cross-account leaks
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (
            k &&
            (k.startsWith('roundzero_potd_subs_') ||
              k.startsWith('roundzero_potd_code_') ||
              k === 'roundzero_oa_sessions')
          ) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch {}
  }, []);

  // Fetch today's POTD data (guarded against NextAuth loading state)
  useEffect(() => {
    if (status === 'loading') return;

    let isMounted = true;
    async function loadPOTD() {
      try {
        setLoading(true);
        const res = await fetch('/api/potd');
        if (!res.ok) throw new Error('Failed to fetch Problem of the Day');
        const data = await res.json();
        if (!isMounted) return;

        setQuestion(data.question);
        setDateStr(data.dateStr);
        setCountdown(data.timeUntilReset);
        setUserStatus(data.userStatus);

        // Submissions strictly from authenticated MongoDB query for THIS user
        const authenticSubs: SubmissionRecord[] = Array.isArray(data.submissions) ? data.submissions : [];
        setSubmissionLog(authenticSubs);

        // Code: If user already submitted today, restore their authentic code from MongoDB.
        // Otherwise, check user-scoped draft (if any), or starter template
        const userEmailKey = session?.user?.email ? encodeURIComponent(session.user.email.toLowerCase().trim()) : null;
        let initialCode = '';
        if (data.latestCode && data.latestCode.code) {
          initialCode = data.latestCode.code;
          if (data.latestCode.language) {
            setLanguage(data.latestCode.language);
          }
        } else if (userEmailKey) {
          const userDraft = localStorage.getItem(`rz_draft_${userEmailKey}_${data.dateStr}_${data.question.id}_${language}`);
          initialCode = userDraft !== null ? userDraft : getStarterTemplate(data.question, language);
        } else {
          initialCode = getStarterTemplate(data.question, language);
        }
        setCode(initialCode);
      } catch (err) {
        console.error('Error loading POTD:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPOTD();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.email, status]);

  // Live countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Drag to resize split workspace
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const rect = splitRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(70, Math.max(30, pct)));
    };
    const onUp = () => setIsDragging(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  const handleLanguageChange = (newLang: string) => {
    if (!question) return;
    setLanguage(newLang);
    if (session?.user?.email) {
      const userEmailKey = encodeURIComponent(session.user.email.toLowerCase().trim());
      const saved = localStorage.getItem(`rz_draft_${userEmailKey}_${dateStr}_${question.id}_${newLang}`);
      if (saved !== null) {
        setCode(saved);
        return;
      }
    }
    setCode(getStarterTemplate(question, newLang));
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (question && session?.user?.email) {
      const userEmailKey = encodeURIComponent(session.user.email.toLowerCase().trim());
      try {
        localStorage.setItem(`rz_draft_${userEmailKey}_${dateStr}_${question.id}_${language}`, newCode);
      } catch {}
    }
  };

  const showResultTab = () => {
    setBottomTab('result');
    setConsoleOpen(true);
  };

  const checkExecutionCooldown = (): boolean => {
    const now = Date.now();
    const elapsedSeconds = (now - lastExecutionTimeRef.current) / 1000;
    if (elapsedSeconds < 5) {
      const remaining = Math.max(1, Math.ceil(5 - elapsedSeconds));
      setRateLimitWarning(
        `You are submitting too frequently. Please wait ${remaining} second${remaining > 1 ? 's' : ''} before trying again.`
      );
      setBottomTab('result');
      setConsoleOpen(true);
      return false;
    }
    setRateLimitWarning(null);
    lastExecutionTimeRef.current = now;
    return true;
  };

  // Run Sample Test Cases
  const handleRunSampleTests = async () => {
    if (!question) return;
    if (!checkExecutionCooldown()) return;
    setIsRunningTests(true);
    showResultTab();

    try {
      const res = await fetch('/api/potd/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          code,
          language,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setRateLimitWarning(data.error || 'You are submitting too frequently. Please wait a few seconds before trying again.');
        return;
      }

      if (!res.ok) {
        setTestOutput({
          status: 'ERROR',
          error: data.details || data.error || `Run failed (${res.status})`,
          results: [],
        });
        return;
      }

      setTestOutput(data);
      setSelectedCaseTab(0);
    } catch (e: any) {
      setTestOutput({
        status: 'ERROR',
        error: e?.message || 'Network error while executing tests.',
        results: [],
      });
      setSelectedCaseTab(0);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Submit Code for Problem of the Day
  const handleSubmitQuestion = async () => {
    if (!question) return;
    if (!session?.user?.email) {
      alert('Please sign in via the top bar to record your solution, save your daily streak, and earn +1 OA credit!');
      return;
    }
    if (!checkExecutionCooldown()) return;

    setIsSubmitting(true);
    showResultTab();

    try {
      const res = await fetch('/api/potd/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          code,
          language,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setRateLimitWarning(data.error || 'You are submitting too frequently. Please wait a few seconds before trying again.');
        return;
      }

      if (!res.ok) {
        setTestOutput({
          status: 'ERROR',
          error: data.details || data.error || `Submit failed (${res.status})`,
          results: [],
        });
        setSelectedCaseTab(0);
        return;
      }

      if (data.execution) {
        const exec: TestOutput = data.execution;
        const passed = getOutputState(exec) === 'passed';

        setTestOutput(exec);
        setSelectedCaseTab(0);

        const newRec: SubmissionRecord = {
          output: exec,
          code,
          language,
          at: new Date().toISOString(),
          passed,
        };

        const updatedSubs = [newRec, ...submissionLog];
        setSubmissionLog(updatedSubs);
        setSelectedSubIdx(0);

        if (passed) {
          setLeftTab('submission');
          setUserStatus((prev) => ({
            ...prev,
            isSolvedToday: true,
            streak: data.newStreak,
            credits: data.credits,
          }));
          setCelebrationData({
            newStreak: data.newStreak,
            creditAdded: data.creditAdded,
          });
          setShowCelebration(true);

          if (session?.user?.email) {
            fetchUserCreditsFromDB(session.user.email);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('roundzero_credits_updated'));
          }
        }
      }
    } catch (e: any) {
      console.error('Error submitting POTD:', e);
      setTestOutput({
        status: 'ERROR',
        error: e?.message || 'Network error while submitting.',
        results: [],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-57px)] w-full items-center justify-center bg-[#1a1a1a] text-white font-mono text-sm">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-[#ffa116]" />
          <span>Loading Problem of the Day...</span>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex h-[calc(100vh-57px)] w-full flex-col items-center justify-center bg-[#1a1a1a] text-white p-4 space-y-4 text-center">
        <XCircle className="h-12 w-12 text-rose-500" />
        <h1 className="text-xl font-bold">Problem of the Day Not Found</h1>
        <p className="text-zinc-400 text-xs max-w-md">Could not load today&apos;s daily challenge.</p>
        <Link href="/" className="px-4 py-2 rounded-lg bg-[#ffa116] text-[#1a1a1a] font-bold text-xs">
          Return to OA Builder
        </Link>
      </div>
    );
  }

  const outputState = getOutputState(testOutput);
  let statusLabel = 'Wrong Answer';
  let statusColor = 'text-rose-400';
  if (testOutput) {
    if (testOutput.status === 'COMPILE_ERROR') statusLabel = 'Compile Error';
    else if (testOutput.status === 'RUNTIME_ERROR') statusLabel = 'Runtime Error';
    else if (testOutput.status === 'TIME_LIMIT_EXCEEDED') {
      statusLabel = 'Time Limit Exceeded';
      statusColor = 'text-amber-400';
    } else if (outputState === 'passed') {
      statusLabel = 'Accepted';
      statusColor = 'text-emerald-400';
    } else if (outputState === 'error') {
      statusLabel = 'Execution Error';
      statusColor = 'text-amber-400';
    }
  }

  const sampleExamples = question.inputOutput ?? [];
  const activeSub = submissionLog[selectedSubIdx] ?? submissionLog[0];
  const activeSubMeta = activeSub ? getStatusMeta(activeSub.output, activeSub.passed) : null;
  const activeFailedCase = activeSub?.output.results?.find((r) => !r.passed);

  const panelClass =
    'rounded-lg border border-[#383838] bg-[#1e1e1e] overflow-hidden flex flex-col min-h-0';
  const panelHeaderClass =
    'flex items-center h-10 shrink-0 bg-[#282828] border-b border-[#383838] px-2';

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] w-full bg-[#1a1a1a] text-zinc-100 overflow-hidden select-none">
      {/* ===================== Top POTD Header Bar ===================== */}
      <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[#383838] bg-[#282828] px-3">
        {/* Left: POTD Badge & Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs font-mono font-bold text-amber-400 shrink-0">
            <Flame className="h-3.5 w-3.5 fill-amber-400" />
            <span>POTD</span>
          </div>

          <div className="h-4 w-px bg-[#383838]" />

          <span className="font-bold text-xs sm:text-sm text-white truncate">
            {question.id}. {question.title}
          </span>
        </div>

        {/* Center: Run & Submit buttons (LeetCode style) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunSampleTests}
            disabled={isRunningTests || isSubmitting}
            className="flex items-center gap-1.5 rounded-md bg-[#383838] px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-[#444] hover:text-white transition disabled:opacity-50"
          >
            {isRunningTests ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#ffa116]" />
            ) : (
              <Play className="h-3.5 w-3.5 text-[#ffa116]" />
            )}
            Run
          </button>

          <button
            type="button"
            onClick={handleSubmitQuestion}
            disabled={isSubmitting || isRunningTests}
            className="flex items-center gap-1.5 rounded-md bg-[#ffa116] px-4 py-1.5 text-xs font-bold text-[#1a1a1a] hover:bg-[#ffa116]/90 transition disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Submitting
              </>
            ) : (
              <>
                <CloudUpload className="h-3.5 w-3.5" />
                Submit
              </>
            )}
          </button>
        </div>

        {/* Right: Streak & Reset Counter */}
        <div className="flex items-center justify-end gap-3 text-xs font-mono">
          {/* Streak pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1e1e1e] border border-[#383838] text-amber-400">
            <Flame className="h-3.5 w-3.5 fill-amber-400" />
            <span className="font-bold">{userStatus.streak}</span>
            <span className="text-[11px] text-zinc-400 hidden sm:inline">Streak</span>
          </div>

          {/* Reset countdown */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1e1e1e] border border-[#383838] text-zinc-300 text-[11px]">
            <Clock className="h-3 w-3 text-[#ffa116]" />
            <span>
              {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:
              {String(countdown.seconds).padStart(2, '0')}
            </span>
          </div>

          {userStatus.isSolvedToday && (
            <span className="hidden lg:flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
              <CheckCircle2 className="h-3 w-3" />
              Solved Today
            </span>
          )}
        </div>
      </header>

      {/* ===================== Split Workspace ===================== */}
      <div ref={splitRef} className="flex flex-1 min-h-0 p-2 gap-2">
        {/* ---------- Left: Description / Submissions Card ---------- */}
        <section
          style={{ width: `${leftWidth}%` }}
          className={`${panelClass} shrink-0 ${isDragging ? 'pointer-events-none' : ''}`}
        >
          <div className={`${panelHeaderClass} gap-1`}>
            <button
              type="button"
              onClick={() => setLeftTab('description')}
              className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition ${
                leftTab === 'description'
                  ? 'bg-[#1e1e1e] text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-[#ffa116]" />
              Description
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('submission')}
              className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition ${
                leftTab === 'submission'
                  ? 'bg-[#1e1e1e] text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-[#ffa116]" />
              Submissions
              {submissionLog.length > 0 && (
                <span className="rounded-full bg-[#383838] px-1.5 text-[10px] text-zinc-300">
                  {submissionLog.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800">
            {leftTab === 'description' ? (
              <>
                {/* Title */}
                <h1 className="text-xl font-semibold text-white">
                  {question.id}. {question.title}
                </h1>

                {/* Difficulty + tags */}
                <div className="flex items-center gap-2 flex-wrap">
                  <DifficultyBadge
                    difficulty={question.difficulty}
                    points={question.points}
                    size="md"
                  />
                  {question.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#282828] px-2.5 py-0.5 text-[11px] text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* POTD Reward Banner */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-amber-300 font-medium">
                    <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>
                      {userStatus.isSolvedToday
                        ? 'You solved today\'s daily challenge! Streak recorded.'
                        : 'Solve today\'s POTD to increase your streak and earn +1 free OA credit!'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-400 font-mono">
                    {userStatus.isSolvedToday ? '✓ +1 Earned' : '+1 Credit'}
                  </span>
                </div>

                {/* Problem Description */}
                <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">
                  {question.problemDescription}
                </div>

                {/* Sample Test Cases */}
                {sampleExamples.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-semibold text-zinc-200">
                      Example Test Cases
                    </span>
                    {sampleExamples.map((io, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-[#383838] bg-[#282828] p-3 text-xs font-mono space-y-1.5"
                      >
                        <div className="text-[11px] font-bold text-[#ffa116]">
                          Example {idx + 1}:
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-200">Input: </span>
                          <span className="text-zinc-300 whitespace-pre-wrap break-all">
                            {io.input}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-200">Output: </span>
                          <span className="text-zinc-300 whitespace-pre-wrap break-all">
                            {io.output}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : submissionLog.length === 0 || !activeSub || !activeSubMeta ? (
              <div className="py-16 text-center text-xs text-zinc-500">
                No submissions yet for today&apos;s POTD. Click Submit to run your code!
              </div>
            ) : (
              <>
                {/* Verdict */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {activeSub.passed ? (
                      <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                    ) : (
                      <XCircle className="h-7 w-7 text-rose-400" />
                    )}
                    <span className={`text-2xl font-semibold ${activeSubMeta.color}`}>
                      {activeSubMeta.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                    {(activeSub.output.totalTests ?? 0) > 0 && (
                      <span>
                        {activeSub.output.totalPassed ?? 0} / {activeSub.output.totalTests ?? 0} testcases passed
                      </span>
                    )}
                    <span>Submitted at {new Date(activeSub.at).toLocaleTimeString()}</span>
                    <span className="capitalize">{activeSub.language}</span>
                  </div>
                </div>

                {/* Runtime / Memory */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#282828] p-3">
                    <div className="text-[11px] text-zinc-400">Runtime</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {activeSub.output.runtime ?? 'N/A'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#282828] p-3">
                    <div className="text-[11px] text-zinc-400">Memory</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {activeSub.output.memory ?? 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Hidden Test Cases Stats */}
                {activeSub.output.hiddenStats && activeSub.output.hiddenStats.total > 0 && (
                  <div className="rounded-lg bg-[#282828] px-3 py-2 text-xs flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-zinc-500" />
                      Hidden Test Cases
                    </span>
                    <span
                      className={`font-bold ${
                        activeSub.output.hiddenStats.allPassed ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {activeSub.output.hiddenStats.passed} / {activeSub.output.hiddenStats.total} passed
                    </span>
                  </div>
                )}

                {/* Failure details */}
                {!activeSub.passed && (
                  <div className="space-y-3 font-mono">
                    {Boolean(activeSub.output.error) && (
                      <pre className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-[11.5px] leading-relaxed text-rose-300 whitespace-pre-wrap overflow-x-auto max-h-48 select-text">
                        {formatError(activeSub.output.error)}
                      </pre>
                    )}
                    {activeFailedCase && (
                      <>
                        <div>
                          <span className="mb-1 block text-[11px] text-zinc-400">Input</span>
                          <div className="rounded-lg bg-[#282828] p-3 text-xs text-zinc-200 whitespace-pre-wrap break-all select-text">
                            {formatError(activeFailedCase.input)}
                          </div>
                        </div>
                        <div>
                          <span className="mb-1 block text-[11px] text-zinc-400">Output</span>
                          <div className="rounded-lg bg-[#282828] p-3 text-xs text-rose-400 whitespace-pre-wrap break-all select-text">
                            {formatError(activeFailedCase.actual)}
                          </div>
                        </div>
                        <div>
                          <span className="mb-1 block text-[11px] text-zinc-400">Expected</span>
                          <div className="rounded-lg bg-[#282828] p-3 text-xs text-zinc-200 whitespace-pre-wrap break-all select-text">
                            {formatError(activeFailedCase.expected)}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Submitted code */}
                <div className="rounded-lg border border-[#383838] overflow-hidden">
                  <div className="flex items-center justify-between bg-[#282828] px-3 py-1.5 text-[11px] text-zinc-400">
                    <span className="capitalize">Code | {activeSub.language}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(activeSub.code)}
                      className="flex items-center gap-1 rounded bg-[#383838] px-2 py-0.5 text-zinc-300 hover:bg-[#444] hover:text-white transition"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  </div>
                  <pre className="p-3 font-mono text-[11.5px] leading-relaxed text-zinc-300 whitespace-pre overflow-x-auto max-h-80 select-text">
                    {activeSub.code}
                  </pre>
                </div>

                {/* Submissions History List */}
                {submissionLog.length > 1 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-zinc-300">Submission History</div>
                    <div className="rounded-lg border border-[#383838] overflow-hidden divide-y divide-[#383838]">
                      {submissionLog.map((s, i) => {
                        const m = getStatusMeta(s.output, s.passed);
                        return (
                          <button
                            key={s.at}
                            type="button"
                            onClick={() => setSelectedSubIdx(i)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-xs transition ${
                              i === selectedSubIdx ? 'bg-[#282828]' : 'hover:bg-[#202020]'
                            }`}
                          >
                            <span className={`font-semibold ${m.color}`}>{m.label}</span>
                            <span className="flex items-center gap-3 text-zinc-400 font-mono">
                              <span className="capitalize">{s.language}</span>
                              <span>{s.output.runtime ?? 'N/A'}</span>
                              <span>{new Date(s.at).toLocaleTimeString()}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Resizable Divider */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          className="group flex w-1.5 shrink-0 cursor-col-resize items-center justify-center"
        >
          <div
            className={`h-10 w-0.5 rounded-full transition ${
              isDragging ? 'bg-[#ffa116]' : 'bg-[#383838] group-hover:bg-[#ffa116]'
            }`}
          />
        </div>

        {/* ---------- Right: Editor card + Console Drawer ---------- */}
        <div className={`flex flex-1 min-w-0 flex-col gap-2 ${isDragging ? 'pointer-events-none' : ''}`}>
          {/* Code editor card */}
          <section className={`${panelClass} flex-1`}>
            <div className={`${panelHeaderClass} justify-between`}>
              <div className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-white">Code</span>
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="rounded-md border border-[#383838] bg-[#1e1e1e] px-2 py-0.5 text-xs font-mono text-zinc-200 outline-none focus:border-[#ffa116]"
                >
                  <option value="python">Python 3</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="cpp">C++ 17</option>
                  <option value="java">Java 11</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Reset code to starter template?')) {
                    handleCodeChange(getStarterTemplate(question, language));
                  }
                }}
                className="flex items-center gap-1 rounded bg-[#383838] px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-[#444] hover:text-white transition"
              >
                <RefreshCw className="h-3 w-3" />
                Reset
              </button>
            </div>

            <div className="flex-1 min-h-0">
              <CodeEditor
                value={code}
                onChange={handleCodeChange}
                starterCode={getStarterTemplate(question, language)}
                language={language}
              />
            </div>
          </section>

          {/* Console Drawer (Testcase | Test Result) */}
          <section className={`${panelClass} shrink-0 ${consoleOpen ? 'h-[40%]' : 'h-10'}`}>
            <div className={`${panelHeaderClass} justify-between`}>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setBottomTab('testcase');
                    setConsoleOpen(true);
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                    bottomTab === 'testcase' && consoleOpen
                      ? 'bg-[#1e1e1e] text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Testcase
                </button>
                <button
                  type="button"
                  onClick={showResultTab}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                    bottomTab === 'result' && consoleOpen
                      ? 'bg-[#1e1e1e] text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                  Test Result
                  {testOutput && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        outputState === 'passed'
                          ? 'bg-emerald-400'
                          : outputState === 'error'
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`}
                    />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setConsoleOpen((o) => !o)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-[#383838] hover:text-white"
                aria-label={consoleOpen ? 'Collapse console' : 'Expand console'}
              >
                {consoleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>

            {consoleOpen && (
              <div className="flex-1 overflow-y-auto p-4 font-mono scrollbar-thin scrollbar-thumb-zinc-800">
                {bottomTab === 'testcase' ? (
                  sampleExamples.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500">
                      No sample test cases for this question.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        {sampleExamples.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedSampleTab(idx)}
                            className={`rounded-lg px-3 py-1 text-xs transition ${
                              selectedSampleTab === idx
                                ? 'bg-[#383838] text-white font-semibold'
                                : 'text-zinc-400 hover:bg-[#282828] hover:text-zinc-200'
                            }`}
                          >
                            Case {idx + 1}
                          </button>
                        ))}
                      </div>

                      <div>
                        <span className="mb-1 block text-[11px] text-zinc-400">Input</span>
                        <div className="rounded-lg bg-[#282828] p-3 text-xs text-zinc-200 whitespace-pre-wrap break-all">
                          {(sampleExamples[selectedSampleTab] ?? sampleExamples[0]).input}
                        </div>
                      </div>

                      <div>
                        <span className="mb-1 block text-[11px] text-zinc-400">Expected Output</span>
                        <div className="rounded-lg bg-[#282828] p-3 text-xs text-zinc-200 whitespace-pre-wrap break-all">
                          {(sampleExamples[selectedSampleTab] ?? sampleExamples[0]).output}
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <>
                    {rateLimitWarning ? (
                      <div className="h-full min-h-[140px] flex items-center justify-center p-6 text-center select-text">
                        <p className="text-xs sm:text-[13px] text-[#f87171] font-sans tracking-wide">
                          {rateLimitWarning}
                        </p>
                      </div>
                    ) : isRunningTests || isSubmitting ? (
                      <div className="py-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-[#ffa116]" />
                        {isSubmitting
                          ? 'Judging your solution...'
                          : 'Running sample test cases...'}
                      </div>
                    ) : !testOutput ? (
                      <div className="py-8 text-center text-xs text-zinc-500">
                        Click &ldquo;Run&rdquo; to test your code against sample cases or &ldquo;Submit&rdquo; to evaluate against all test cases.
                      </div>
                    ) : (
                      <div className="space-y-4">
                    {/* Big LeetCode status line */}
                    <div>
                      <div className={`text-xl font-bold ${statusColor}`}>{statusLabel}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-4 text-[11.5px] text-zinc-400">
                        {testOutput.totalTests !== undefined && (
                          <span>
                            {testOutput.totalPassed ?? 0} / {testOutput.totalTests} testcases passed
                          </span>
                        )}
                        {testOutput.runtime && (
                          <span>
                            Runtime: <strong className="text-zinc-200">{testOutput.runtime}</strong>
                          </span>
                        )}
                        {testOutput.memory && (
                          <span>
                            Memory: <strong className="text-zinc-200">{testOutput.memory}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Compile / runtime error output */}
                    {Boolean(testOutput.error) && (
                      <pre className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-[11.5px] leading-relaxed text-rose-300 whitespace-pre-wrap overflow-x-auto max-h-48 select-text">
                        {formatError(testOutput.error)}
                      </pre>
                    )}

                    {/* Sample test cases breakdown */}
                    {Array.isArray(testOutput.results) && testOutput.results.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 overflow-x-auto">
                          {testOutput.results.map((r, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedCaseTab(idx)}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs transition ${
                                selectedCaseTab === idx
                                  ? 'bg-[#383838] text-white font-semibold'
                                  : 'text-zinc-400 hover:bg-[#282828] hover:text-zinc-200'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  r.passed ? 'bg-emerald-400' : 'bg-rose-400'
                                }`}
                              />
                              Case {idx + 1}
                            </button>
                          ))}
                        </div>

                        {(() => {
                          const cr = testOutput.results[selectedCaseTab] ?? testOutput.results[0];
                          if (!cr) return null;
                          return (
                            <div className="space-y-2 text-xs">
                              <div>
                                <span className="mb-1 block text-[11px] text-zinc-400">Input</span>
                                <div className="rounded-lg bg-[#282828] p-3 text-zinc-200 whitespace-pre-wrap break-all select-text">
                                  {formatError(cr.input)}
                                </div>
                              </div>
                              <div>
                                <span className="mb-1 block text-[11px] text-zinc-400">Output</span>
                                <div
                                  className={`rounded-lg bg-[#282828] p-3 whitespace-pre-wrap break-all select-text ${
                                    cr.passed ? 'text-zinc-200' : 'text-rose-400'
                                  }`}
                                >
                                  {formatError(cr.actual)}
                                </div>
                              </div>
                              <div>
                                <span className="mb-1 block text-[11px] text-zinc-400">Expected</span>
                                <div className="rounded-lg bg-[#282828] p-3 text-zinc-200 whitespace-pre-wrap break-all select-text">
                                  {formatError(cr.expected)}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Celebration Modal on POTD Pass! */}
      {showCelebration && celebrationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-zinc-950 p-6 space-y-6 shadow-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 to-[#ffa116]/30 border border-[#ffa116]/40 text-[#ffa116]">
              <Trophy className="h-8 w-8 animate-bounce text-amber-400" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-white">Problem of the Day Solved!</h3>
              <p className="text-xs text-zinc-300">
                Congratulations! You cracked today&apos;s challenge and kept your daily streak alive.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                <div className="flex items-center justify-center gap-1 text-amber-400">
                  <Flame className="h-4 w-4 fill-amber-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Streak</span>
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  {celebrationData.newStreak} {celebrationData.newStreak === 1 ? 'Day' : 'Days'}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
                <div className="flex items-center justify-center gap-1 text-emerald-400">
                  <Zap className="h-4 w-4 fill-emerald-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Reward</span>
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  {celebrationData.creditAdded ? '+1 Credit' : 'Solved'}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/"
                className="w-full rounded-xl bg-[#ffa116] py-3 text-center text-xs font-bold text-[#1a1a1a] shadow-lg hover:bg-[#ffa116]/90 transition flex items-center justify-center gap-2"
              >
                <span>Customize Full Technical Assessment</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <button
                type="button"
                onClick={() => setShowCelebration(false)}
                className="w-full rounded-xl border border-[#383838] bg-[#282828] py-2.5 text-center text-xs font-semibold text-zinc-300 hover:text-white transition"
              >
                Continue Reviewing Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
