'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { RotateCcw, Code, Copy, Check } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  starterCode?: string;
  language?: string;
  onLanguageChange?: (lang: string) => void;
  readOnly?: boolean;
  borderless?: boolean;
  height?: string;
}

export default function CodeEditor({
  value,
  onChange,
  starterCode,
  language = 'python',
  onLanguageChange,
  readOnly = false,
  borderless = false,
  height,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    if (starterCode && confirm('Reset code to starter template? Your current changes will be cleared.')) {
      onChange(starterCode);
    }
  };

  const monacoLanguageMap: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    cpp: 'cpp',
    java: 'java',
    go: 'go',
    ruby: 'ruby',
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${
      borderless ? 'bg-[#1e1e1e]' : 'rounded-xl border border-[#383838] bg-[#282828] shadow-xl'
    }`}>
      {/* Editor Top Bar */}
      <div className="flex items-center justify-between border-b border-[#383838] bg-[#242424] px-3 sm:px-4 py-2 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Code className="h-4 w-4 text-[#ffa116]" />
            <span className="font-semibold text-zinc-200">Solution Editor</span>
          </div>

          {onLanguageChange && (
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="rounded border border-[#383838] bg-[#282828] px-2.5 py-1 text-xs text-zinc-200 focus:border-[#ffa116] focus:outline-none"
            >
              <option value="python">Python 3</option>
              <option value="cpp">C++ (GCC 9.2)</option>
              <option value="java">Java (OpenJDK 13)</option>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="typescript">TypeScript</option>
              <option value="go">Go (1.13)</option>
              <option value="ruby">Ruby (2.7)</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded px-2 py-1 transition hover:bg-[#383838] hover:text-zinc-200 text-zinc-400"
            title="Copy code"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {starterCode && !readOnly && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 rounded px-2 py-1 text-zinc-400 hover:bg-[#383838] hover:text-[#ffa116] transition"
              title="Reset code"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 min-h-[350px] w-full relative">
        <Editor
          height="100%"
          language={monacoLanguageMap[language] || 'python'}
          value={value}
          onChange={(val) => onChange(val || '')}
          theme="vs-dark"
          options={{
            readOnly,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            tabSize: 4,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
          }}
          loading={
            <div className="flex h-full items-center justify-center bg-[#1a1a1a] text-sm text-zinc-400">
              Loading Code Editor...
            </div>
          }
        />
      </div>
    </div>
  );
}
