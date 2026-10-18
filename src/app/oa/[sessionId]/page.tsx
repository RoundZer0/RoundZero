"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { OASession } from "@/types/oa";
import { getSessionLocal, saveSessionLocal } from "@/lib/sessionStore";
import { getStarterTemplate } from "@/lib/starterTemplates";
import DifficultyBadge from "@/components/DifficultyBadge";
import CodeEditor from "@/components/CodeEditor";
import Timer from "@/components/Timer";
import {
  CheckCircle2,
  AlertCircle,
  Play,
  Send,
  ArrowRight,
  ArrowLeft,
  Terminal,
  FileText,
  Sparkles,
  Check,
  X,
  RefreshCw,
  Lock,
  Maximize,
  Clock,
  Copy,
  XCircle,
  Code2,
  ChevronUp,
  ChevronDown,
  CloudUpload,
  Flame,
  Swords,
  Trophy,
} from "lucide-react";

type OutputState = "passed" | "failed" | "error";

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

// Normalizes any execution outcome (Judge0 status strings, API errors, etc.)
const getOutputState = (o: TestOutput | null): OutputState => {
  if (!o) return "failed";
  if (
    o.error ||
    o.status === "ERROR" ||
    /error/i.test(String(o.status || ""))
  ) {
    return "error";
  }
  const allSample =
    Array.isArray(o.results) &&
    o.results.length > 0 &&
    o.results.every((r) => r.passed);
  const allHidden = o.hiddenStats ? o.hiddenStats.allPassed : true;
  return allSample && allHidden ? "passed" : "failed";
};

const formatError = (err: unknown): string => {
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
};

type SubmissionRecord = {
  output: TestOutput;
  code: string;
  language: string;
  at: string;
  passed: boolean;
};

const getStatusMeta = (o: TestOutput) => {
  const state = getOutputState(o);
  if (o.status === "COMPILE_ERROR")
    return { label: "Compile Error", color: "text-rose-400" };
  if (o.status === "RUNTIME_ERROR")
    return { label: "Runtime Error", color: "text-rose-400" };
  if (o.status === "TIME_LIMIT_EXCEEDED")
    return { label: "Time Limit Exceeded", color: "text-amber-400" };
  if (state === "passed")
    return { label: "Accepted", color: "text-emerald-400" };
  if (state === "error")
    return { label: "Execution Error", color: "text-amber-400" };
  return { label: "Wrong Answer", color: "text-rose-400" };
};

export default function TakeOAPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const { data: authSession } = useSession();

  const [session, setSession] = useState<OASession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // User Code state per question
  const [codeMap, setCodeMap] = useState<Record<number, string>>({});
  const [languageMap, setLanguageMap] = useState<Record<number, string>>({});

  // Bottom console (LeetCode style: Testcase | Test Result)
  const [bottomTab, setBottomTab] = useState<"testcase" | "result">(
    "testcase",
  );
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [selectedSampleTab, setSelectedSampleTab] = useState(0);

  // Left card tabs (Description | Submissions) + per-question submission history
  const [leftTab, setLeftTab] = useState<"description" | "submission">(
    "description",
  );
  const [submissionLog, setSubmissionLog] = useState<
    Record<number, SubmissionRecord[]>
  >({});
  const [selectedSubIdx, setSelectedSubIdx] = useState(0);

  // Resizable split
  const splitRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(46);
  const [isDragging, setIsDragging] = useState(false);

  // Execution & Submission feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testOutput, setTestOutput] = useState<TestOutput | null>(null);
  const [selectedCaseTab, setSelectedCaseTab] = useState<number>(0);

  // Finish Confirmation Modal & Fullscreen State
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false);
  const hasEnteredFullscreenRef = useRef(false);
  const [fsSupported, setFsSupported] = useState(false);
  const [fsError, setFsError] = useState("");
  const isFinishedRef = useRef(false);
  const [isFinished, setIsFinished] = useState(false);
  const [duelRoom, setDuelRoom] = useState<any>(null);
  const duelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [matchConcluding, setMatchConcluding] = useState<{
    show: boolean;
    title: string;
    message: string;
    isWinner: boolean;
  }>({ show: false, title: "", message: "", isWinner: false });

  const myEmail = (session?.userEmail || authSession?.user?.email || "").toLowerCase();

  useEffect(() => {
    if (!session?.roomId || isFinishedRef.current) return;
    const fetchDuelRoom = async () => {
      if (isFinishedRef.current) return;
      try {
        const res = await fetch(`/api/room/${session.roomId}`);
        if (res.ok) {
          const data = await res.json();
          setDuelRoom(data);

          // In 1v1 duel, if match concluded and winner crowned:
          if (data.status === "completed" && data.winnerEmail && !isFinishedRef.current) {
            const isWinner = myEmail && data.winnerEmail.toLowerCase() === myEmail;
            if (!isWinner) {
              // Opponent won! Conclude match and redirect to results with DEFEAT
              isFinishedRef.current = true;
              setIsFinished(true);

              if (duelIntervalRef.current) {
                clearInterval(duelIntervalRef.current);
                duelIntervalRef.current = null;
              }

              setMatchConcluding({
                show: true,
                title: "⚔️ MATCH CONCLUDED",
                message: "Your opponent submitted the accepted solution first. Finalizing duel results...",
                isWinner: false,
              });

              // Complete session in background
              await fetch(`/api/oa/${session.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  finishAssessment: true,
                }),
              }).catch(() => {});

              if (typeof document !== "undefined" && document.fullscreenElement) {
                try {
                  await document.exitFullscreen();
                } catch {}
              }

              setTimeout(() => {
                router.push(`/oa/results/${session.id}`);
              }, 400);
            }
          }
        }
      } catch {}
    };

    fetchDuelRoom();
    duelIntervalRef.current = setInterval(fetchDuelRoom, 1500);
    return () => {
      if (duelIntervalRef.current) {
        clearInterval(duelIntervalRef.current);
        duelIntervalRef.current = null;
      }
    };
  }, [session?.roomId, session?.id, myEmail, router]);

  const enterFullscreen = async () => {
    setFsError("");
    try {
      if (
        typeof document !== "undefined" &&
        document.documentElement.requestFullscreen
      ) {
        setFsSupported(true);
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        setHasEnteredFullscreen(true);
        hasEnteredFullscreenRef.current = true;
      } else {
        setFsSupported(false);
        setFsError("Fullscreen is not supported by this browser.");
      }
    } catch (error) {
      setFsError(
        error instanceof Error
          ? error.message
          : "Could not enter fullscreen mode.",
      );
      console.warn(
        "Fullscreen request prevented by browser security policy:",
        error,
      );
    }
  };

  const handleFinishAssessment = useCallback(async (isForfeit = false) => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;
    setIsFinished(true);

    if (duelIntervalRef.current) {
      clearInterval(duelIntervalRef.current);
      duelIntervalRef.current = null;
    }

    setMatchConcluding({
      show: true,
      title: isForfeit ? "⚔️ DUEL FORFEITED" : "COMPLETING ASSESSMENT",
      message: isForfeit
        ? "Exited fullscreen or test session. Recording forfeit and finalizing results..."
        : "Saving your submissions and calculating your final performance report...",
      isWinner: false,
    });

    try {
      if (!session?.id) return;

      const finishPromises: Promise<any>[] = [];

      // Notify duel room of match completion or forfeit
      if (session?.roomId) {
        finishPromises.push(
          fetch(`/api/room/${session.roomId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: isForfeit ? "forfeit_duel" : "update_progress",
              isFinished: true,
              totalScore: session.totalScore,
            }),
          }).catch(() => {})
        );
      }

      finishPromises.push(
        fetch(`/api/oa/${session.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finishAssessment: true,
            sessionData: session,
          }),
        }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (data?.session) {
            saveSessionLocal(data.session);
          }
        }).catch(() => {})
      );

      await Promise.allSettled(finishPromises);

      // Purge temporary session drafts from localStorage
      try {
        if (typeof window !== "undefined") {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.includes(session.id)) {
              localStorage.removeItem(k);
            }
          }
        }
      } catch {}

      if (typeof document !== "undefined" && document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {}
      }

      setTimeout(() => {
        router.push(`/oa/results/${session.id}`);
      }, 350);
    } catch (error) {
      console.error("Error completing assessment", error);
      if (session?.id) {
        setTimeout(() => {
          router.push(`/oa/results/${session.id}`);
        }, 350);
      }
    }
  }, [router, session]);

  useEffect(() => {
    async function loadSession() {
      let sess: OASession | null = null;
      try {
        const res = await fetch(`/api/oa/${sessionId}`);
        if (res.ok) {
          sess = await res.json();
        }
      } catch (e) {
        console.error("Failed to fetch session from API", e);
      }

      // Offline fallback only if network fails
      if (!sess) {
        sess = getSessionLocal(sessionId) || null;
      }

      if (sess) {
        setSession(sess);
        const initialCode: Record<number, string> = {};
        const initialLang: Record<number, string> = {};

        sess.questions.forEach((q) => {
          const existing = sess.submissions[q.id];
          const savedLang =
            typeof window !== "undefined"
              ? localStorage.getItem(`oaforge_lang_${sessionId}_${q.id}`)
              : null;
          const lang = savedLang || (existing ? existing.language : "python");
          initialLang[q.id] = lang;

          const savedCode =
            typeof window !== "undefined"
              ? localStorage.getItem(
                  `oaforge_code_${sessionId}_${q.id}_${lang}`,
                )
              : null;

          if (savedCode !== null) {
            initialCode[q.id] = savedCode;
          } else if (existing && existing.language === lang) {
            initialCode[q.id] = existing.code;
          } else {
            initialCode[q.id] = getStarterTemplate(q, lang);
          }
        });

        setCodeMap(initialCode);
        setLanguageMap(initialLang);
      }
      setLoading(false);
    }

    loadSession();
  }, [sessionId]);

  // Fullscreen Enforcement & Screen Exit effect (ESC key, fullscreen change, visibility change, beforeunload)
  useEffect(() => {
    if (!session || loading) return;
    if (session.config?.isPOTD) return;

    // Defer the request so the effect only subscribes to browser events
    const fullscreenRequest = window.setTimeout(() => {
      void enterFullscreen();
    }, 0);

    const handleFullscreenChange = () => {
      if (isFinishedRef.current) return;
      const isFS =
        typeof document !== "undefined" && !!document.fullscreenElement;
      setIsFullscreen(isFS);

      if (isFS) {
        hasEnteredFullscreenRef.current = true;
        setHasEnteredFullscreen(true);
      } else if (hasEnteredFullscreenRef.current && !isFinishedRef.current) {
        console.warn("User exited fullscreen mode. Forfeiting duel / ending assessment.");
        handleFinishAssessment(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinishedRef.current) return;
      if (e.key === "Escape" && !isFinishedRef.current) {
        console.warn("User pressed Escape. Forfeiting duel / ending assessment.");
        handleFinishAssessment(true);
      }
    };

    const handleVisibilityChange = () => {
      if (isFinishedRef.current) return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden" &&
        hasEnteredFullscreenRef.current &&
        !isFinishedRef.current
      ) {
        console.warn("User switched tab / minimized window. Forfeiting duel / ending assessment.");
        handleFinishAssessment(true);
      }
    };

    const handleBeforeUnload = () => {
      if (!isFinishedRef.current && session?.roomId) {
        try {
          navigator.sendBeacon(
            `/api/room/${session.roomId}`,
            new Blob(
              [
                JSON.stringify({
                  action: "forfeit_duel",
                  userEmail: myEmail,
                }),
              ],
              { type: "application/json" }
            )
          );
        } catch {}
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearTimeout(fullscreenRequest);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [session, loading, handleFinishAssessment, myEmail]);

  // Drag-to-resize for the vertical splitter
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const rect = splitRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(70, Math.max(30, pct)));
    };
    const onUp = () => setIsDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#1a1a1a] text-white font-mono text-sm">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-[#ffa116]" />
          <span>Loading Assessment Environment...</span>
        </div>
      </div>
    );
  }

  if (!session || !session.questions || session.questions.length === 0) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#1a1a1a] text-white p-4 space-y-4 text-center">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <h1 className="text-2xl font-bold">Assessment Questions Unavailable</h1>
        <p className="text-zinc-400 max-w-md text-sm">
          No questions could be found for this assessment session.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-lg bg-[#ffa116] text-[#1a1a1a] font-bold text-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentQuestion = session.questions[activeQuestionIndex] || session.questions[0];
  if (!currentQuestion) {
    return null;
  }
  const currentCode = codeMap[currentQuestion.id] || "";
  const currentLanguage = languageMap[currentQuestion.id] || "python";
  const currentSubmission = session.submissions[currentQuestion.id];

  const showResultTab = () => {
    setBottomTab("result");
    setConsoleOpen(true);
  };

  const handleCodeChange = (val: string) => {
    setCodeMap((prev) => ({ ...prev, [currentQuestion.id]: val }));
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          `oaforge_code_${sessionId}_${currentQuestion.id}_${currentLanguage}`,
          val,
        );
      } catch {}
    }
  };

  const handleLanguageChange = (newLang: string) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          `oaforge_code_${sessionId}_${currentQuestion.id}_${currentLanguage}`,
          currentCode,
        );
        localStorage.setItem(
          `oaforge_lang_${sessionId}_${currentQuestion.id}`,
          newLang,
        );
      } catch {}
    }

    let nextCode: string | null = null;
    if (typeof window !== "undefined") {
      nextCode = localStorage.getItem(
        `oaforge_code_${sessionId}_${currentQuestion.id}_${newLang}`,
      );
    }

    if (nextCode === null) {
      if (currentSubmission && currentSubmission.language === newLang) {
        nextCode = currentSubmission.code;
      } else {
        nextCode = getStarterTemplate(currentQuestion, newLang);
      }
    }

    setLanguageMap((prev) => ({ ...prev, [currentQuestion.id]: newLang }));
    setCodeMap((prev) => ({ ...prev, [currentQuestion.id]: nextCode! }));
  };

  const switchQuestion = (newIdx: number) => {
    if (newIdx === activeQuestionIndex) return;

    if (typeof window !== "undefined" && currentQuestion) {
      try {
        localStorage.setItem(
          `oaforge_code_${sessionId}_${currentQuestion.id}_${currentLanguage}`,
          currentCode,
        );
      } catch {}
    }

    const destQuestion = session?.questions[newIdx];
    if (destQuestion) {
      const savedLang =
        typeof window !== "undefined"
          ? localStorage.getItem(`oaforge_lang_${sessionId}_${destQuestion.id}`)
          : null;
      const targetLang =
        savedLang ||
        languageMap[destQuestion.id] ||
        session?.submissions[destQuestion.id]?.language ||
        "python";

      const savedCode =
        typeof window !== "undefined"
          ? localStorage.getItem(
              `oaforge_code_${sessionId}_${destQuestion.id}_${targetLang}`,
            )
          : null;

      let targetCode: string;
      if (savedCode !== null) {
        targetCode = savedCode;
      } else if (
        session?.submissions[destQuestion.id] &&
        session.submissions[destQuestion.id].language === targetLang
      ) {
        targetCode = session.submissions[destQuestion.id].code;
      } else if (
        codeMap[destQuestion.id] &&
        languageMap[destQuestion.id] === targetLang
      ) {
        targetCode = codeMap[destQuestion.id];
      } else {
        targetCode = getStarterTemplate(destQuestion, targetLang);
      }

      setLanguageMap((prev) => ({ ...prev, [destQuestion.id]: targetLang }));
      setCodeMap((prev) => ({ ...prev, [destQuestion.id]: targetCode }));
    }

    setActiveQuestionIndex(newIdx);
    setTestOutput(null);
    setSelectedSampleTab(0);
    setSelectedCaseTab(0);
    setSelectedSubIdx(0);
    setLeftTab("description");
    setBottomTab("testcase");
  };

  // Run Sample Test Cases
  const handleRunSampleTests = async () => {
    setIsRunningTests(true);
    showResultTab();

    try {
      const res = await fetch("/api/oa/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          code: currentCode,
          language: currentLanguage,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setTestOutput({
          status: "ERROR",
          error: data.details || data.error || `Request failed (${res.status})`,
          results: [],
        });
        return;
      }

      setTestOutput(data);
      setSelectedCaseTab(0);
    } catch (e) {
      setTestOutput({
        status: "ERROR",
        error:
          e instanceof Error
            ? e.message
            : "Network error: could not reach the code runner.",
        results: [],
      });
      setSelectedCaseTab(0);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Submit Code for Current Question
  const handleSubmitQuestion = async () => {
    setIsSubmitting(true);
    showResultTab();
    try {
      const payload = {
        action: "submit_question",
        questionId: currentQuestion.id,
        submission: {
          code: currentCode,
          language: currentLanguage,
        },
        sessionData: session,
      };

      const res = await fetch(`/api/oa/${session.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setTestOutput({
          status: "ERROR",
          error: data.details || data.error || `Submit failed (${res.status})`,
          results: [],
        });
        setSelectedCaseTab(0);
        return;
      }

      if (data.session) {
        setSession(data.session);
        saveSessionLocal(data.session);
      }

      if (data.execution) {
        const exec: TestOutput = data.execution;
        const passed = getOutputState(exec) === "passed";
        const qid = currentQuestion.id;

        setTestOutput(exec);
        setSelectedCaseTab(0);
        setSubmissionLog((prev) => ({
          ...prev,
          [qid]: [
            {
              output: exec,
              code: currentCode,
              language: currentLanguage,
              at: new Date().toISOString(),
              passed,
            },
            ...(prev[qid] ?? []),
          ],
        }));
        setSelectedSubIdx(0);

        // All tests passed -> jump to the Submissions tab
        if (passed) {
          setLeftTab("submission");
          if (session?.roomId) {
            // In 1v1 duel, solution accepted means immediate VICTORY!
            isFinishedRef.current = true;
            setIsFinished(true);

            if (duelIntervalRef.current) {
              clearInterval(duelIntervalRef.current);
              duelIntervalRef.current = null;
            }

            // Immediately display high-performance Victory overlay
            setMatchConcluding({
              show: true,
              title: "⚔️ VICTORY! Solution Accepted",
              message: "Congratulations! You submitted first. Saving your score and victory record...",
              isWinner: true,
            });

            // The updated session returned by submit_question contains the newly submitted code and score
            const freshSession: OASession = data.session || {
              ...session,
              submissions: {
                ...(session.submissions || {}),
                [qid]: data.submission,
              },
              totalScore: (session.totalScore || 0) + (currentQuestion.points || 100),
            };

            saveSessionLocal(freshSession);

            // Parallelize victory calls
            await Promise.allSettled([
              fetch(`/api/room/${session.roomId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "finish_duel",
                  solutionAccepted: true,
                  isFinished: true,
                  problemsSolved: 1,
                  totalScore: freshSession.totalScore,
                }),
              }),
              fetch(`/api/oa/${session.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  finishAssessment: true,
                  sessionData: {
                    ...freshSession,
                    status: "completed",
                  },
                }),
              }),
            ]);

            // Exit fullscreen cleanly while overlay is displayed
            if (typeof document !== "undefined" && document.fullscreenElement) {
              try {
                await document.exitFullscreen();
              } catch {}
            }

            // Small delay to allow browser native fullscreen exit animation to settle before route unmount
            setTimeout(() => {
              router.push(`/oa/results/${session.id}`);
            }, 350);
            return;
          }
        }
      }
    } catch (e) {
      console.error("Error submitting code", e);
      setTestOutput({
        status: "ERROR",
        error:
          e instanceof Error ? e.message : "Network error while submitting.",
        results: [],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const answeredCount = Object.keys(session.submissions).length;
  const totalQuestions = session.questions.length;
  const outputState = getOutputState(testOutput);

  // ---- Result status label / color (LeetCode style big status text) ----
  let statusLabel = "Wrong Answer";
  let statusColor = "text-rose-400";
  if (testOutput) {
    if (testOutput.status === "COMPILE_ERROR") {
      statusLabel = "Compile Error";
    } else if (testOutput.status === "RUNTIME_ERROR") {
      statusLabel = "Runtime Error";
    } else if (testOutput.status === "TIME_LIMIT_EXCEEDED") {
      statusLabel = "Time Limit Exceeded";
      statusColor = "text-amber-400";
    } else if (outputState === "passed") {
      statusLabel = "Accepted";
      statusColor = "text-emerald-400";
    } else if (outputState === "error") {
      statusLabel = "Execution Error";
      statusColor = "text-amber-400";
    }
  }

  const sampleExamples = currentQuestion.inputOutput ?? [];

  const questionSubs = submissionLog[currentQuestion.id] ?? [];
  const activeSub = questionSubs[selectedSubIdx] ?? questionSubs[0];
  const activeSubMeta = activeSub ? getStatusMeta(activeSub.output) : null;
  const activeFailedCase = activeSub?.output.results?.find((r) => !r.passed);

  // ---- Panel chrome shared by every card ----
  const panelClass =
    "rounded-lg border border-[#383838] bg-[#1e1e1e] overflow-hidden flex flex-col min-h-0";
  const panelHeaderClass =
    "flex items-center h-10 shrink-0 bg-[#282828] border-b border-[#383838] px-2";

  return (
    <div className="flex flex-col h-screen w-full bg-[#1a1a1a] text-zinc-100 overflow-hidden select-none">
      {/* ===================== Top Navbar ===================== */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#383838] bg-[#242424] px-3 sm:px-4 gap-2 sm:gap-4 select-none">
        {/* Left: title + question switcher */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
          {session.config?.isPOTD && (
            <Link
              href="/potd"
              className="flex items-center gap-1 text-zinc-400 hover:text-white text-xs font-semibold px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#383838] border border-[#383838] transition shrink-0"
              title="Return to Problem of the Day"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#ffa116]" />
              <span className="hidden sm:inline">POTD</span>
            </Link>
          )}

          <div className="flex items-center gap-1.5 min-w-0 shrink truncate">
            {session.roomId ? (
              <Swords className="h-4 w-4 shrink-0 text-[#ffa116]" />
            ) : session.config?.isPOTD ? (
              <Flame className="h-4 w-4 shrink-0 text-[#ffa116] fill-[#ffa116]/20" />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0 text-[#ffa116]" />
            )}
            <span className="font-bold text-xs sm:text-sm text-white truncate">
              {session.title}
            </span>
          </div>

          <div className="h-4 w-px bg-[#383838] shrink-0 hidden sm:block" />

          {/* Question navigator */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => switchQuestion(Math.max(0, activeQuestionIndex - 1))}
              disabled={activeQuestionIndex === 0}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-[#383838] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous question"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>

            {session.questions.map((q, idx) => {
              const sub = session.submissions[q.id];
              const isSubmitted = sub && sub.status === "submitted";
              const isActive = idx === activeQuestionIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => switchQuestion(idx)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-mono font-medium transition ${
                    isActive
                      ? "bg-[#ffa116] text-[#1a1a1a] font-bold shadow-sm"
                      : isSubmitted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-[#1e1e1e] text-zinc-400 hover:text-white border border-[#383838]"
                  }`}
                >
                  <span>Q{idx + 1}</span>
                  {isSubmitted && <Check className="h-3 w-3" />}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => switchQuestion(Math.min(session.questions.length - 1, activeQuestionIndex + 1))}
              disabled={activeQuestionIndex === session.questions.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-[#383838] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Next question"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Run / Submit + 1v1 Telemetry HUD */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRunSampleTests}
            disabled={isRunningTests || isSubmitting}
            className="flex items-center gap-1.5 rounded-md bg-[#333333] px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-[#444] hover:text-white transition disabled:opacity-50"
          >
            {isRunningTests ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#ffa116]" />
            ) : (
              <Play className="h-3.5 w-3.5 text-[#ffa116]" />
            )}
            <span className="hidden sm:inline">Run</span>
          </button>

          <button
            type="button"
            onClick={handleSubmitQuestion}
            disabled={isSubmitting || isRunningTests}
            className="flex items-center gap-1.5 rounded-md bg-[#ffa116] px-3.5 py-1.5 text-xs font-bold text-[#1a1a1a] hover:bg-[#ffa116]/90 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Submitting</span>
              </>
            ) : (
              <>
                <CloudUpload className="h-3.5 w-3.5" />
                <span>Submit</span>
              </>
            )}
          </button>

          {/* 1v1 Live Duel Opponent Telemetry HUD */}
          {duelRoom && (
            <div className="flex items-center gap-2 rounded-md bg-[#1e1e1e] border border-amber-500/40 px-2.5 py-1 font-mono text-xs shadow-sm">
              <Swords className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
                <span className="text-zinc-400 font-semibold hidden md:inline">1v1:</span>
                <span className="text-emerald-400 font-bold">
                  You {Object.values(session.submissions || {}).filter((s: any) => s && s.score > 0).length}/{session.questions.length}
                </span>
                <span className="text-zinc-600 font-bold">vs</span>
                {(() => {
                  const opp = duelRoom.members?.find(
                    (m: any) => m.email?.toLowerCase() !== (session.userEmail || myEmail).toLowerCase()
                  );
                  return (
                    <span className="text-purple-400 font-bold">
                      {opp ? `${opp.name?.split(' ')[0] || 'Opp'}: ${opp.problemsSolved || 0}/${session.questions.length}` : 'Waiting'}
                    </span>
                  );
                })()}
              </div>
              {duelRoom.winnerEmail && (
                <span className="rounded bg-amber-500/20 text-amber-400 px-1.5 py-0.5 text-[10px] font-bold">
                  {duelRoom.winnerEmail.toLowerCase() === (session.userEmail || myEmail).toLowerCase()
                    ? '🏆 Won!'
                    : '⚡ Ended'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Fullscreen status / warning, Timer, Score, Finish button */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
          {session.roomId ? (
            <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] font-mono text-rose-300">
              <Maximize className="h-3 w-3 text-rose-400" />
              <span>Fullscreen Locked</span>
              <span className="text-rose-400/80 text-[10px] font-sans">
                (ESC / Exit forfeits)
              </span>
            </div>
          ) : session.config?.isPOTD ? (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-400">
              <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-400/20" />
              <span>Problem of the Day</span>
            </div>
          ) : (
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1e1e1e] border border-[#383838] text-[11px] font-mono text-zinc-400">
              <Maximize className="h-3 w-3 text-[#ffa116]" />
              <span>Fullscreen</span>
              <span className="text-rose-400 text-[10px] ml-1 font-sans">
                (ESC Ends OA)
              </span>
            </div>
          )}

          <Timer
            timeLimitMinutes={session.timeLimitMinutes}
            startedAt={session.startedAt}
            onTimeUp={() => handleFinishAssessment(false)}
          />

          {!session.roomId && (
            <div className="text-xs font-mono text-zinc-400 hidden lg:block">
              <span className="text-[#ffa116] font-bold">
                {session.totalScore}
              </span>{" "}
              / {session.maxScore} pts
            </div>
          )}

          <button
            onClick={() => setShowFinishModal(true)}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Finish</span>
          </button>
        </div>
      </header>

      {/* ===================== Split Workspace ===================== */}
      <div ref={splitRef} className="flex flex-1 min-h-0 p-2">
        {/* ---------- Left: Description card ---------- */}
        <section
          style={{ width: `${leftWidth}%` }}
          className={`${panelClass} shrink-0 ${isDragging ? "pointer-events-none" : ""}`}
        >
          <div className={`${panelHeaderClass} gap-1`}>
            <button
              type="button"
              onClick={() => setLeftTab("description")}
              className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition ${
                leftTab === "description"
                  ? "bg-[#1e1e1e] text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-[#ffa116]" />
              Description
            </button>
            <button
              type="button"
              onClick={() => setLeftTab("submission")}
              className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition ${
                leftTab === "submission"
                  ? "bg-[#1e1e1e] text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-[#ffa116]" />
              Submissions
              {questionSubs.length > 0 && (
                <span className="rounded-full bg-[#383838] px-1.5 text-[10px] text-zinc-300">
                  {questionSubs.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800">
            {leftTab === "description" ? (
              <>
            {/* Title */}
            <h1 className="text-xl font-semibold text-white">
              {currentQuestion.id}. {currentQuestion.title}
            </h1>

            {/* Difficulty + tags */}
            <div className="flex items-center gap-2 flex-wrap">
              <DifficultyBadge
                difficulty={currentQuestion.difficulty}
                points={currentQuestion.points}
                size="md"
              />
              {currentQuestion.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#282828] px-2.5 py-0.5 text-[11px] text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Submission banner */}
            {currentSubmission && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-300 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Submitted ({currentSubmission.score} /{" "}
                  {currentQuestion.points} pts)
                </div>
                <span className="text-emerald-400/80 font-mono">
                  {new Date(currentSubmission.submittedAt).toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Description body */}
            <div className="text-[13.5px] text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">
              {currentQuestion.problemDescription}
            </div>

            {/* Examples (LeetCode style left-border blocks) */}
            {sampleExamples.length > 0 && (
              <div className="space-y-5">
                {sampleExamples.map((io, i) => (
                  <div key={i} className="space-y-2">
                    <div className="text-sm font-semibold text-white">
                      Example {i + 1}:
                    </div>
                    <div className="border-l-2 border-[#383838] pl-4 space-y-1 font-mono text-xs leading-relaxed">
                      <div>
                        <span className="font-semibold text-zinc-200">
                          Input:{" "}
                        </span>
                        <span className="text-zinc-300 whitespace-pre-wrap break-all">
                          {io.input}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-200">
                          Output:{" "}
                        </span>
                        <span className="text-zinc-300 whitespace-pre-wrap break-all">
                          {io.output}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
              </>
            ) : questionSubs.length === 0 || !activeSub || !activeSubMeta ? (
              <div className="py-16 text-center text-xs text-zinc-500">
                No submissions yet. Submit your solution to see the result here.
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
                    <span
                      className={`text-2xl font-semibold ${activeSubMeta.color}`}
                    >
                      {activeSubMeta.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                    {(activeSub.output.totalTests ?? 0) > 0 && (
                      <span>
                        {activeSub.output.totalPassed ?? 0} /{" "}
                        {activeSub.output.totalTests ?? 0} testcases passed
                      </span>
                    )}
                    <span>
                      Submitted at{" "}
                      {new Date(activeSub.at).toLocaleTimeString()}
                    </span>
                    <span className="capitalize">{activeSub.language}</span>
                  </div>
                </div>

                {/* Runtime / Memory / Hidden tests */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#282828] p-3">
                    <div className="text-[11px] text-zinc-400">Runtime</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {activeSub.output.runtime ?? "N/A"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#282828] p-3">
                    <div className="text-[11px] text-zinc-400">Memory</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {activeSub.output.memory ?? "N/A"}
                    </div>
                  </div>
                </div>

                {activeSub.output.hiddenStats &&
                  activeSub.output.hiddenStats.total > 0 && (
                    <div className="rounded-lg bg-[#282828] px-3 py-2 text-xs flex items-center justify-between">
                      <span className="text-zinc-400 flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-zinc-500" />
                        Hidden Test Cases
                      </span>
                      <span
                        className={`font-bold ${
                          activeSub.output.hiddenStats.allPassed
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {activeSub.output.hiddenStats.passed} /{" "}
                        {activeSub.output.hiddenStats.total} passed
                      </span>
                    </div>
                  )}

                {/* Score for the latest accepted submission */}
                {activeSub.passed && currentSubmission && selectedSubIdx === 0 && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 font-medium">
                    Score earned: {currentSubmission.score} /{" "}
                    {currentQuestion.points} pts
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
                          <span className="mb-1 block text-[11px] text-zinc-400">
                            Input
                          </span>
                          <div className="rounded-lg bg-[#282828] p-3 text-xs text-zinc-200 whitespace-pre-wrap break-all select-text">
                            {formatError(activeFailedCase.input)}
                          </div>
                        </div>
                        <div>
                          <span className="mb-1 block text-[11px] text-zinc-400">
                            Output
                          </span>
                          <div className="rounded-lg bg-[#282828] p-3 text-xs text-rose-400 whitespace-pre-wrap break-all select-text">
                            {formatError(activeFailedCase.actual)}
                          </div>
                        </div>
                        <div>
                          <span className="mb-1 block text-[11px] text-zinc-400">
                            Expected
                          </span>
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
                      onClick={() =>
                        navigator.clipboard.writeText(activeSub.code)
                      }
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

                {/* Next question after an accepted submission */}
                {activeSub.passed &&
                  activeQuestionIndex < session.questions.length - 1 && (
                    <button
                      type="button"
                      onClick={() => switchQuestion(activeQuestionIndex + 1)}
                      className="flex items-center gap-1.5 rounded-md bg-[#ffa116] px-4 py-2 text-xs font-bold text-[#1a1a1a] hover:bg-[#ffa116]/90 transition"
                    >
                      Next Question
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}

                {/* History */}
                {questionSubs.length > 1 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-zinc-300">
                      Submission History
                    </div>
                    <div className="rounded-lg border border-[#383838] overflow-hidden divide-y divide-[#383838]">
                      {questionSubs.map((s, i) => {
                        const m = getStatusMeta(s.output);
                        return (
                          <button
                            key={s.at}
                            type="button"
                            onClick={() => setSelectedSubIdx(i)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-xs transition ${
                              i === selectedSubIdx
                                ? "bg-[#282828]"
                                : "hover:bg-[#202020]"
                            }`}
                          >
                            <span className={`font-semibold ${m.color}`}>
                              {m.label}
                            </span>
                            <span className="flex items-center gap-3 text-zinc-400 font-mono">
                              <span className="capitalize">{s.language}</span>
                              <span>{s.output.runtime ?? "N/A"}</span>
                              <span>
                                {new Date(s.at).toLocaleTimeString()}
                              </span>
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

        {/* ---------- Drag handle ---------- */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center"
        >
          <div
            className={`h-10 w-0.5 rounded-full transition ${
              isDragging ? "bg-[#ffa116]" : "bg-[#383838] group-hover:bg-[#ffa116]"
            }`}
          />
        </div>

        {/* ---------- Right: Editor card + Console card ---------- */}
        <div
          className={`flex flex-1 min-w-0 flex-col gap-2 ${isDragging ? "pointer-events-none" : ""}`}
        >
          {/* Code editor card */}
          <section className={`${panelClass} flex-1`}>
            <div className={panelHeaderClass}>
              <span className="flex items-center gap-2 px-2 text-xs font-medium text-white">
                <Code2 className="h-3.5 w-3.5 text-emerald-400" />
                Code
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <CodeEditor
                value={currentCode}
                onChange={handleCodeChange}
                starterCode={currentQuestion.starterCode}
                language={currentLanguage}
                onLanguageChange={handleLanguageChange}
              />
            </div>
          </section>

          {/* Console card (Testcase | Test Result) */}
          <section
            className={`${panelClass} shrink-0 ${
              consoleOpen ? "h-[40%]" : "h-10"
            }`}
          >
            <div className={`${panelHeaderClass} justify-between`}>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setBottomTab("testcase");
                    setConsoleOpen(true);
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                    bottomTab === "testcase" && consoleOpen
                      ? "bg-[#1e1e1e] text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Testcase
                </button>
                <button
                  type="button"
                  onClick={showResultTab}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                    bottomTab === "result" && consoleOpen
                      ? "bg-[#1e1e1e] text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                  Test Result
                  {testOutput && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        outputState === "passed"
                          ? "bg-emerald-400"
                          : outputState === "error"
                            ? "bg-amber-400"
                            : "bg-rose-400"
                      }`}
                    />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setConsoleOpen((o) => !o)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-[#383838] hover:text-white"
                aria-label={consoleOpen ? "Collapse console" : "Expand console"}
              >
                {consoleOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </button>
            </div>

            {consoleOpen && (
              <div className="flex-1 overflow-y-auto p-4 font-mono scrollbar-thin scrollbar-thumb-zinc-800">
                {bottomTab === "testcase" ? (
                  /* ---------------- Testcase tab ---------------- */
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
                                ? "bg-[#383838] text-white font-semibold"
                                : "text-zinc-400 hover:bg-[#282828] hover:text-zinc-200"
                            }`}
                          >
                            Case {idx + 1}
                          </button>
                        ))}
                      </div>

                      <div>
                        <span className="mb-1 block text-[11px] text-zinc-400">
                          Input
                        </span>
                        <div className="rounded-lg bg-[#282828] p-3 text-xs text-zinc-200 whitespace-pre-wrap break-all">
                          {(sampleExamples[selectedSampleTab] ??
                            sampleExamples[0]).input}
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  /* ---------------- Test Result tab ---------------- */
                  <>
                    {isRunningTests || isSubmitting ? (
                      <div className="py-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-[#ffa116]" />
                        {isSubmitting
                          ? "Judging your solution..."
                          : "Running sample test cases..."}
                      </div>
                    ) : !testOutput ? (
                      <div className="py-8 text-center text-xs text-zinc-500">
                        You must run your code first.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Big status line */}
                        <div className="flex items-end flex-wrap gap-x-4 gap-y-1">
                          <span
                            className={`text-xl font-semibold font-sans ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                          {testOutput.runtime && (
                            <span className="text-xs text-zinc-400 pb-0.5">
                              Runtime:{" "}
                              <span className="text-zinc-200">
                                {testOutput.runtime}
                              </span>
                            </span>
                          )}
                          {testOutput.memory && (
                            <span className="text-xs text-zinc-400 pb-0.5">
                              Memory:{" "}
                              <span className="text-zinc-200">
                                {testOutput.memory}
                              </span>
                            </span>
                          )}
                          {(testOutput.totalTests ?? 0) > 0 &&
                            testOutput.status !== "COMPILE_ERROR" && (
                              <span className="text-xs text-zinc-400 pb-0.5">
                                {testOutput.totalPassed ?? 0} /{" "}
                                {testOutput.totalTests ?? 0} testcases passed
                              </span>
                            )}
                        </div>

                        {/* Compile error */}
                        {testOutput.status === "COMPILE_ERROR" ? (
                          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-rose-500/20 text-[11px]">
                              <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                                <Terminal className="h-3.5 w-3.5" />
                                Compiler Message
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (testOutput.error) {
                                    navigator.clipboard.writeText(
                                      formatError(testOutput.error),
                                    );
                                  }
                                }}
                                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-[#282828] hover:bg-[#383838] transition"
                              >
                                <Copy className="h-3 w-3" />
                                Copy
                              </button>
                            </div>
                            <pre className="p-3 text-[11.5px] leading-relaxed text-rose-300 whitespace-pre-wrap overflow-x-auto max-h-64 select-text">
                              {formatError(testOutput.error)}
                            </pre>
                          </div>
                        ) : testOutput.status === "RUNTIME_ERROR" &&
                          (!testOutput.results ||
                            testOutput.results.length === 0) ? (
                          /* Runtime error before any test ran */
                          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 overflow-hidden">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-rose-500/20 text-[11px] font-semibold text-rose-400">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Runtime Exception
                            </div>
                            <pre className="p-3 text-[11.5px] leading-relaxed text-rose-300 whitespace-pre-wrap overflow-x-auto max-h-64 select-text">
                              {formatError(testOutput.error)}
                            </pre>
                          </div>
                        ) : testOutput.status === "TIME_LIMIT_EXCEEDED" ? (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1.5">
                            <div className="text-amber-400 font-semibold flex items-center gap-1.5">
                              <Clock className="h-4 w-4" />
                              Time Limit Exceeded
                            </div>
                            <p className="text-zinc-400 text-[11px] leading-relaxed">
                              Your solution took longer than 5.0 seconds to
                              finish. Check for infinite loops or inefficient
                              algorithms.
                            </p>
                          </div>
                        ) : null}

                        {/* Generic / server error */}
                        {testOutput.status === "ERROR" &&
                          Boolean(testOutput.error) && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1.5">
                              <div className="text-amber-400 font-semibold flex items-center gap-1.5">
                                <AlertCircle className="h-4 w-4" />
                                Execution Warning
                              </div>
                              <pre className="text-amber-300/90 whitespace-pre-wrap text-[11px] leading-relaxed max-h-40 overflow-y-auto select-text">
                                {formatError(testOutput.error)}
                              </pre>
                            </div>
                          )}

                        {/* Per-case results */}
                        {testOutput.results && testOutput.results.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5 overflow-x-auto">
                              {testOutput.results.map((res, idx) => {
                                const isSelected =
                                  (selectedCaseTab ?? 0) === idx;
                                return (
                                  <button
                                    key={res.id ?? idx}
                                    type="button"
                                    onClick={() => setSelectedCaseTab(idx)}
                                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs transition ${
                                      isSelected
                                        ? "bg-[#383838] text-white font-semibold"
                                        : "text-zinc-400 hover:bg-[#282828] hover:text-zinc-200"
                                    }`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${
                                        res.passed
                                          ? "bg-emerald-400"
                                          : "bg-rose-400"
                                      }`}
                                    />
                                    Case {res.id ?? idx + 1}
                                  </button>
                                );
                              })}
                            </div>

                            {(() => {
                              const currentRes =
                                testOutput.results[selectedCaseTab] ||
                                testOutput.results[0];
                              if (!currentRes) return null;

                              return (
                                <div className="space-y-3">
                                  <div>
                                    <span className="mb-1 block text-[11px] text-zinc-400">
                                      Input
                                    </span>
                                    <div className="rounded-lg bg-[#282828] p-3 text-xs text-zinc-200 whitespace-pre-wrap break-all select-text">
                                      {formatError(currentRes.input)}
                                    </div>
                                  </div>

                                  <div>
                                    <span className="mb-1 block text-[11px] text-zinc-400">
                                      Output
                                    </span>
                                    <div
                                      className={`rounded-lg bg-[#282828] p-3 text-xs whitespace-pre-wrap break-all select-text ${
                                        currentRes.passed
                                          ? "text-emerald-400"
                                          : "text-rose-400"
                                      }`}
                                    >
                                      {formatError(currentRes.actual)}
                                    </div>
                                  </div>

                                  <div>
                                    <span className="mb-1 block text-[11px] text-zinc-400">
                                      Expected
                                    </span>
                                    <div className="rounded-lg bg-[#282828] p-3 text-xs text-zinc-200 whitespace-pre-wrap break-all select-text">
                                      {formatError(currentRes.expected)}
                                    </div>
                                  </div>

                                  {Boolean(currentRes.error) && (
                                    <div>
                                      <span className="mb-1 block text-[11px] text-rose-400">
                                        Runtime Error
                                      </span>
                                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-rose-300 text-xs whitespace-pre-wrap select-text">
                                        {formatError(currentRes.error)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Hidden test stats (after Submit only) */}
                        {testOutput.hiddenStats &&
                          testOutput.hiddenStats.total > 0 && (
                            <div className="rounded-lg bg-[#282828] px-3 py-2 text-xs flex items-center justify-between">
                              <span className="text-zinc-400 flex items-center gap-1.5">
                                <Lock className="h-3.5 w-3.5 text-zinc-500" />
                                Hidden Test Cases
                              </span>
                              <span
                                className={`font-bold ${
                                  testOutput.hiddenStats.allPassed
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {testOutput.hiddenStats.passed} /{" "}
                                {testOutput.hiddenStats.total} passed
                              </span>
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

      {/* ===================== Finish Assessment Modal ===================== */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#383838] bg-[#282828] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#383838] pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="h-5 w-5 text-[#ffa116]" />
                Complete Assessment?
              </h3>
              <button
                onClick={() => setShowFinishModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-zinc-300">
              <p>
                Are you sure you want to finish and submit your entire
                assessment?
              </p>
              <div className="rounded-xl bg-[#1e1e1e] border border-[#383838] p-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Answered Questions:</span>
                  <span className="font-bold text-emerald-400">
                    {answeredCount} / {totalQuestions}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Current Earned Score:</span>
                  <span className="font-bold text-[#ffa116]">
                    {session.totalScore} / {session.maxScore} pts
                  </span>
                </div>
              </div>
              {answeredCount < totalQuestions && (
                <p className="text-rose-400 text-xs flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="h-4 w-4" />
                  Warning: You have {totalQuestions - answeredCount} unsubmitted
                  question(s).
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Continue Writing
              </button>
              <button
                type="button"
                onClick={() => handleFinishAssessment(false)}
                className="px-5 py-2 rounded-lg bg-emerald-600 font-bold text-xs text-white shadow-md hover:bg-emerald-500"
              >
                {session?.roomId ? "Conclude Duel" : "Finalize & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== Fullscreen Required Overlay ===================== */}
      {!session?.config?.isPOTD && !isFullscreen && !isFinished && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fs-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/95 backdrop-blur-md p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#383838] bg-[#282828] p-6 space-y-6 text-center shadow-2xl">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ffa116]/10 border border-[#ffa116]/30">
                {session?.roomId ? (
                  <Swords className="h-6 w-6 text-[#ffa116]" />
                ) : (
                  <Maximize className="h-6 w-6 text-[#ffa116]" />
                )}
              </div>
              <h2 id="fs-title" className="text-xl font-bold text-white">
                {session?.roomId ? "1v1 Duel Arena Locked" : "Fullscreen Mode Required"}
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {session?.roomId ? (
                  <>
                    1v1 Code Duels run in strict locked Fullscreen Mode.
                    Exiting fullscreen, pressing{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-[#1e1e1e] border border-[#383838] text-[#ffa116] font-mono">
                      ESC
                    </kbd>
                    , or switching windows will automatically forfeit the duel and award victory to your opponent.
                  </>
                ) : (
                  <>
                    This online assessment runs in mandatory Fullscreen Mode.
                    Exiting fullscreen or pressing{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-[#1e1e1e] border border-[#383838] text-[#ffa116] font-mono">
                      ESC
                    </kbd>{" "}
                    will automatically finalize and submit your assessment.
                  </>
                )}
              </p>
            </div>

            {!fsSupported ? (
              <p className="text-xs text-rose-400">
                Your browser doesn&apos;t support fullscreen. Please use a
                desktop browser such as Chrome, Edge, or Firefox.
              </p>
            ) : (
              <button
                type="button"
                autoFocus
                onClick={enterFullscreen}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#ffa116] px-4 py-3 text-xs font-bold text-[#1a1a1a] hover:bg-[#ffa116]/90 transition shadow-md"
              >
                {session?.roomId ? (
                  <>
                    <Swords className="h-4 w-4" />
                    Enter 1v1 Duel Fullscreen Arena
                  </>
                ) : (
                  <>
                    <Maximize className="h-4 w-4" />
                    Click to Enter Fullscreen Assessment
                  </>
                )}
              </button>
            )}

            {fsError && <p className="text-xs text-rose-400">{fsError}</p>}
          </div>
        </div>
      )}

      {/* Smooth Match Concluding / Victory Transition Overlay */}
      {matchConcluding.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-[#1e1e1e] p-8 text-center space-y-5 shadow-2xl">
            <div className={`mx-auto h-16 w-16 rounded-2xl flex items-center justify-center border shadow-xl ${
              matchConcluding.isWinner
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                : "bg-amber-500/20 border-amber-500/50 text-amber-400"
            }`}>
              {matchConcluding.isWinner ? (
                <Swords className="h-8 w-8 animate-pulse text-emerald-400" />
              ) : (
                <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
              )}
            </div>

            <div className="space-y-2">
              <h2 className={`text-xl font-bold font-mono tracking-tight ${
                matchConcluding.isWinner ? "text-emerald-400" : "text-white"
              }`}>
                {matchConcluding.title}
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                {matchConcluding.message}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 text-xs font-mono text-zinc-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
              <span>Redirecting to performance summary...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}