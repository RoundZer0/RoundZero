'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Question, Difficulty, DatasetStats } from '@/types/oa';
import DifficultyBadge from '@/components/DifficultyBadge';
import CodeEditor from '@/components/CodeEditor';
import {
  BookOpen,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Flame,
} from 'lucide-react';

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter & Pagination State
  const [search, setSearch] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);

  // Question Preview Modal
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/questions?mode=stats');
        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error('Failed to load dataset stats', e);
      }
    }
    fetchStats();
  }, []);

  useEffect(() => {
    async function fetchQuestions() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: '25',
          search,
        });

        if (selectedDifficulty !== 'All') {
          params.append('difficulties', selectedDifficulty);
        }

        if (selectedTag !== 'All') {
          params.append('tags', selectedTag);
        }

        const res = await fetch(`/api/questions?${params.toString()}`);
        const data = await res.json();

        setQuestions(data.questions || []);
        setTotalPages(data.totalPages || 1);
        setTotalMatches(data.totalMatches || 0);
      } catch (e) {
        console.error('Failed to fetch questions', e);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      fetchQuestions();
    }, 200);

    return () => clearTimeout(timer);
  }, [page, search, selectedDifficulty, selectedTag]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 space-y-2">
        <div className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-300">
          <BookOpen className="h-3.5 w-3.5 text-amber-400" />
          Algorithm Dataset Explorer
        </div>
        <h1 className="text-2xl font-bold text-white">
          Question Bank ({stats?.totalQuestions || 2869} Problems)
        </h1>
        <p className="text-zinc-400 text-xs max-w-2xl">
          Browse and search algorithm questions complete with difficulty levels, topic tags, starter templates, and sample test cases.
        </p>
      </div>

      {/* POTD Spotlight Banner */}
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-zinc-900/40 to-transparent p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-[#ffa116]">
            <Flame className="h-6 w-6 fill-amber-500/30" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm sm:text-base">Today&apos;s Problem of the Day</span>
              <span className="rounded bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 font-bold font-mono">+1 OA Credit</span>
            </div>
            <p className="text-zinc-400 text-xs mt-0.5">Solve today&apos;s daily challenge in our assessment workspace to build your streak and earn free credits.</p>
          </div>
        </div>

        <Link
          href="/potd"
          className="w-full sm:w-auto rounded-lg bg-[#ffa116] hover:bg-[#ffa116]/90 px-4 py-2 text-center font-bold text-[#1a1a1a] text-xs transition whitespace-nowrap shadow-md"
        >
          View Today&apos;s POTD →
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by title, question #, tag..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto text-xs">
          {/* Difficulty Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 font-medium">Difficulty:</span>
            <select
              value={selectedDifficulty}
              onChange={(e) => {
                setSelectedDifficulty(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
            >
              <option value="All">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          {/* Topic Tag Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 font-medium">Topic:</span>
            <select
              value={selectedTag}
              onChange={(e) => {
                setSelectedTag(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none max-w-[180px]"
            >
              <option value="All">All Topics</option>
              {stats?.tagCounts.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.count})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Questions Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3">Topics</th>
               
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400 font-mono">
                    Loading questions...
                  </td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    No questions found matching criteria.
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr key={q.id} className="hover:bg-zinc-900 transition">
                    <td className="px-4 py-3 font-mono text-zinc-400">#{q.id}</td>
                    <td className="px-4 py-3 font-semibold text-white">{q.title}</td>
                    <td className="px-4 py-3">
                      <DifficultyBadge difficulty={q.difficulty} size="sm" />
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-amber-400">
                      {q.points} pts
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {q.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700/50"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950 px-4 py-3 text-xs">
          <span className="text-zinc-400 font-mono">
            Showing {questions.length} of {totalMatches} questions
          </span>

          <div className="flex items-center gap-2 font-mono">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded bg-zinc-900 text-zinc-300 disabled:opacity-40 hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 rounded bg-zinc-900 text-zinc-300 disabled:opacity-40 hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Question Details Modal */}
      {activeQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <DifficultyBadge difficulty={activeQuestion.difficulty} points={activeQuestion.points} />
                <h3 className="text-base font-bold text-white">
                  #{activeQuestion.id}. {activeQuestion.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveQuestion(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {activeQuestion.problemDescription}
              </div>

              {activeQuestion.starterCode && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Starter Code Template
                  </h4>
                  <div className="h-48 rounded-lg overflow-hidden border border-zinc-800">
                    <CodeEditor
                      value={activeQuestion.starterCode}
                      onChange={() => {}}
                      readOnly={true}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
