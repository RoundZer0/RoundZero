import { TestCase } from '@/types/oa';
import { parseInputString, toJavaLiteral, toJavaDeclaration, toCppLiteral, toCppDeclaration, toGoLiteral, toGoDeclaration } from './harnessHelpers';

const JUDGE0_BASE_URL = (process.env.JUDGE0_URL || 'http://localhost:2358').replace(/\/+$/, '');

export const LANGUAGE_IDS: Record<string, number> = {
  python: 71,       // Python 3.8.1
  javascript: 63,   // Node.js 12.14.0
  typescript: 74,   // TypeScript 3.7.4
  ruby: 72,         // Ruby 2.7.0
  cpp: 54,          // C++ (GCC 9.2.0)
  java: 62,         // Java (OpenJDK 13.0.1)
  go: 60,           // Go (1.13.5)
};

export interface TestResultItem {
  id: number;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface RunResult {
  status: 'PASSED' | 'FAILED' | 'ERROR' | 'COMPILE_ERROR' | 'RUNTIME_ERROR' | 'TIME_LIMIT_EXCEEDED' | string;
  results: TestResultItem[];
  runtime: string;
  memory: string;
  error?: string;
}

export function decodeBase64(str: string | null | undefined): string {
  if (!str) return '';
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return str;
  }
}

export function stripAnsi(text: string): string {
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

export function cleanCompilerError(
  rawError: string,
  language: string,
  _userCode: string = ''
): string {
  if (!rawError) return '';

  // 1. Strip ANSI escape sequences (colors, cursor positioning)
  let cleaned = stripAnsi(rawError).trim();

  // 2. Strip container / box paths
  cleaned = cleaned.replace(/\/(?:tmp|judge|box|isolate)[^:\s]*\//g, '');

  const lang = (language || '').toLowerCase();

  if (lang === 'cpp') {
    const lines = cleaned.split('\n');
    const outLines: string[] = [];
    for (const l of lines) {
      if (l.includes('Harness.cpp')) continue;
      // Convert "Solution.cpp:5:10: error:" to "Line 5: Char 10: error:"
      const formatted = l.replace(/(?:Solution\.cpp|prog\.cpp|main\.cpp):(\d+):(\d+):/g, 'Line $1: Char $2:');
      outLines.push(formatted);
    }
    cleaned = outLines.join('\n').trim();
  } else if (lang === 'python') {
    const PYTHON_HEADER_LINES = 81;
    const lines = cleaned.split('\n');
    const outLines: string[] = [];
    let skip = false;

    for (const l of lines) {
      if (
        l.includes('run_tests') ||
        l.includes('__kwargs') ||
        l.includes('output_payload') ||
        l.includes('__OAFORGE_RESULT__')
      ) {
        skip = true;
        continue;
      }
      if (skip && l.trim().startsWith('File ') && !l.includes('solution.py') && !l.includes('<string>')) {
        continue;
      }
      skip = false;

      const m = l.match(/File ".*?", line (\d+)(.*)/);
      if (m) {
        const rawLine = parseInt(m[1], 10);
        const adjLine = rawLine > PYTHON_HEADER_LINES ? rawLine - PYTHON_HEADER_LINES : rawLine;
        outLines.push(`  Line ${adjLine}${m[2]}`);
      } else {
        outLines.push(l);
      }
    }
    cleaned = outLines.join('\n').trim();
  } else if (lang === 'java') {
    const JAVA_HEADER_LINES = 28;
    cleaned = cleaned.replace(/Main\.java:(\d+):/g, (_, lineStr) => {
      const rawLine = parseInt(lineStr, 10);
      const adjLine = rawLine > JAVA_HEADER_LINES ? rawLine - JAVA_HEADER_LINES : rawLine;
      return `Line ${adjLine}:`;
    });
  } else if (lang === 'javascript' || lang === 'typescript') {
    const JS_HEADER_LINES = 108;
    cleaned = cleaned.replace(/:(\d+):(\d+)/g, (full, lineStr, charStr) => {
      const rawLine = parseInt(lineStr, 10);
      if (rawLine > JS_HEADER_LINES) {
        return `:${rawLine - JS_HEADER_LINES}:${charStr}`;
      }
      return full;
    });
  } else if (lang === 'go') {
    const lines = cleaned.split('\n');
    const outLines: string[] = [];
    for (const l of lines) {
      if (l.includes('harness.go')) continue;
      const formatted = l.replace(/(?:solution\.go|main\.go):(\d+):(\d+):/g, 'Line $1: Char $2:');
      outLines.push(formatted);
    }
    cleaned = outLines.join('\n').trim();
  }

  return cleaned;
}

export function generatePythonHarness(
  userCode: string,
  entryPoint: string,
  testCases: TestCase[]
): string {
  const testCasesJson = JSON.stringify(testCases);

  return `
import sys, os, json, math, collections, heapq, bisect, itertools, functools, re, random, string, operator
from collections import *
from heapq import *
from bisect import *
from itertools import *
from functools import *
from math import *
from typing import *

null = None
true = True
false = False
inf = float('inf')

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def to_list_node(data):
    if not isinstance(data, list) or len(data) == 0:
        return None
    dummy = ListNode(0)
    cur = dummy
    for v in data:
        cur.next = ListNode(v)
        cur = cur.next
    return dummy.next

def from_list_node(node):
    res = []
    cur = node
    visited = set()
    while cur and id(cur) not in visited:
        visited.add(id(cur))
        res.append(cur.val)
        cur = cur.next
    return res

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def to_tree_node(data):
    if not isinstance(data, list) or len(data) == 0 or data[0] is None:
        return None
    root = TreeNode(data[0])
    q = [root]
    i = 1
    while q and i < len(data):
        node = q.pop(0)
        if i < len(data) and data[i] is not None:
            node.left = TreeNode(data[i])
            q.append(node.left)
        i += 1
        if i < len(data) and data[i] is not None:
            node.right = TreeNode(data[i])
            q.append(node.right)
        i += 1
    return root

def from_tree_node(root):
    if not root:
        return []
    res = []
    q = [root]
    while q:
        node = q.pop(0)
        if node:
            res.append(node.val)
            q.append(node.left)
            q.append(node.right)
        else:
            res.append(None)
    while res and res[-1] is None:
        res.pop()
    return res

# --- USER CODE START ---
${userCode}
# --- USER CODE END ---

def run_tests():
    raw_cases = ${testCasesJson}
    results = []
    all_passed = True

    for idx, tc in enumerate(raw_cases):
        case_id = idx + 1
        inp_str = tc.get('input', '')
        exp_str = tc.get('output', '')

        try:
            locs = {}
            try:
                exec(f"__kwargs = dict({inp_str})", globals(), locs)
                kwargs = locs.get('__kwargs', {})
                for k, v in list(kwargs.items()):
                    k_low = k.lower()
                    if isinstance(v, list):
                        if any(s in k_low for s in ['head', 'l1', 'l2', 'list1', 'list2', 'node', 'cur', 'first', 'second', 'heada', 'headb']):
                            kwargs[k] = to_list_node(v)
                        elif any(s in k_low for s in ['root', 'subroot', 'tree', 'p', 'q', 't1', 't2', 'node']):
                            kwargs[k] = to_tree_node(v)
                actual_val = eval(f"${entryPoint}(**__kwargs)", globals(), {'__kwargs': kwargs})
            except Exception:
                call_expr = f"${entryPoint}({inp_str})"
                actual_val = eval(call_expr)

            if isinstance(actual_val, ListNode):
                actual_val = from_list_node(actual_val)
            elif isinstance(actual_val, TreeNode):
                actual_val = from_tree_node(actual_val)

            try:
                expected_val = eval(exp_str) if exp_str.strip() else ""
            except Exception:
                expected_val = exp_str.strip()

            def are_equiv(act, exp, raw_exp):
                if act == exp or str(act).strip() == str(exp).strip():
                    return True
                s_a = str(act).strip().lower()
                s_b = str(raw_exp).strip().lower()
                if s_a == s_b:
                    return True
                # Quote & spacing normalization (e.g. ['x'] vs [x] or ["a","b"] vs [a, b])
                norm_a = re.sub(r"['\"\s]", "", s_a)
                norm_b = re.sub(r"['\"\s]", "", s_b)
                if norm_a and norm_b and norm_a == norm_b:
                    return True
                empties = {'none', 'null', 'nil', '[]', '()', '{}', '""', "''", 'nullptr'}
                if s_a in empties and s_b in empties:
                    return True
                if (act is None or act == [] or act == "") and s_b in empties:
                    return True
                try:
                    if abs(float(act) - float(exp)) < 1e-5:
                        return True
                except Exception:
                    pass
                return False

            passed = are_equiv(actual_val, expected_val, exp_str)
            if not passed:
                all_passed = False

            results.append({
                "id": case_id,
                "input": inp_str,
                "expected": exp_str,
                "actual": "[]" if actual_val is None else str(actual_val),
                "passed": passed
            })
        except Exception as e:
            all_passed = False
            results.append({
                "id": case_id,
                "input": inp_str,
                "expected": exp_str,
                "actual": f"{type(e).__name__}: {str(e)}",
                "passed": False
            })

    output_payload = {
        "status": "PASSED" if all_passed else "FAILED",
        "results": results
    }
    print("__OAFORGE_RESULT__" + json.dumps(output_payload) + "__END__")

if __name__ == '__main__':
    run_tests()
`;
}

export function generateJavaScriptHarness(
  userCode: string,
  entryPoint: string,
  testCases: TestCase[]
): string {
  const match = entryPoint.match(/\.([a-zA-Z0-9_]+)/);
  const methodName = match ? match[1] : 'solve';
  const testCasesJson = JSON.stringify(testCases);

  return `
function ListNode(val, next) {
    this.val = (val===undefined ? 0 : val);
    this.next = (next===undefined ? null : next);
}

function TreeNode(val, left, right) {
    this.val = (val===undefined ? 0 : val);
    this.left = (left===undefined ? null : left);
    this.right = (right===undefined ? null : right);
}

class PriorityQueue {
    constructor(options = {}) {
        this._compare = options.compare || ((a, b) => a - b);
        this._heap = [];
    }
    enqueue(val, priority) {
        const item = priority !== undefined ? { element: val, priority } : val;
        this._heap.push(item);
        this._heap.sort((a, b) => {
            const pa = a && a.priority !== undefined ? a.priority : a;
            const pb = b && b.priority !== undefined ? b.priority : b;
            return this._compare(pa, pb);
        });
    }
    dequeue() {
        return this._heap.shift();
    }
    front() {
        return this._heap[0];
    }
    back() {
        return this._heap[this._heap.length - 1];
    }
    size() {
        return this._heap.length;
    }
    isEmpty() {
        return this._heap.length === 0;
    }
    clear() {
        this._heap = [];
    }
    toArray() {
        return [...this._heap];
    }
}

class MinPriorityQueue extends PriorityQueue {
    constructor(options = {}) {
        const compare = options.compare || ((a, b) => {
            const pa = a && a.priority !== undefined ? a.priority : a;
            const pb = b && b.priority !== undefined ? b.priority : b;
            return pa - pb;
        });
        super({ compare });
    }
}

class MaxPriorityQueue extends PriorityQueue {
    constructor(options = {}) {
        const compare = options.compare || ((a, b) => {
            const pa = a && a.priority !== undefined ? a.priority : a;
            const pb = b && b.priority !== undefined ? b.priority : b;
            return pb - pa;
        });
        super({ compare });
    }
}

class Deque {
    constructor(items = []) { this._items = [...items]; }
    push(v) { this._items.push(v); }
    pushBack(v) { this._items.push(v); }
    pushFront(v) { this._items.unshift(v); }
    pop() { return this._items.pop(); }
    popBack() { return this._items.pop(); }
    popFront() { return this._items.shift(); }
    shift() { return this._items.shift(); }
    unshift(v) { this._items.unshift(v); }
    front() { return this._items[0]; }
    back() { return this._items[this._items.length - 1]; }
    size() { return this._items.length; }
    isEmpty() { return this._items.length === 0; }
    clear() { this._items = []; }
    toArray() { return [...this._items]; }
}

${userCode}

function __to_list_node(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    let dummy = new ListNode(0);
    let cur = dummy;
    for (const v of arr) { cur.next = new ListNode(v); cur = cur.next; }
    return dummy.next;
}

function __from_list_node(node) {
    const res = [];
    let cur = node;
    const visited = new Set();
    while (cur && !visited.has(cur)) {
        visited.add(cur);
        res.push(cur.val);
        cur = cur.next;
    }
    return res;
}

function __to_tree_node(arr) {
    if (!Array.isArray(arr) || arr.length === 0 || arr[0] === null) return null;
    const root = new TreeNode(arr[0]);
    const queue = [root];
    let i = 1;
    while (queue.length > 0 && i < arr.length) {
        const node = queue.shift();
        if (i < arr.length && arr[i] !== null) {
            node.left = new TreeNode(arr[i]);
            queue.push(node.left);
        }
        i++;
        if (i < arr.length && arr[i] !== null) {
            node.right = new TreeNode(arr[i]);
            queue.push(node.right);
        }
        i++;
    }
    return root;
}

function __from_tree_node(root) {
    if (!root) return [];
    const res = [];
    const queue = [root];
    while (queue.length > 0) {
        const node = queue.shift();
        if (node) {
            res.push(node.val);
            queue.push(node.left);
            queue.push(node.right);
        } else {
            res.push(null);
        }
    }
    while (res.length > 0 && res[res.length - 1] === null) {
        res.pop();
    }
    return res;
}

function runTests() {
    const rawCases = ${testCasesJson};
    const results = [];
    let allPassed = true;

    let solInstance = null;
    try {
        if (typeof Solution === 'function') {
            solInstance = new Solution();
        }
    } catch (e) {}

    for (let idx = 0; idx < rawCases.length; idx++) {
        const tc = rawCases[idx];
        const caseId = idx + 1;
        const inpStr = tc.input || '';
        const expStr = tc.output || '';

        try {
            const argsObj = {};
            const tokens = inpStr.split(/,\\s*(?=[a-zA-Z0-9_]+\\s*=)/);
            for (const tok of tokens) {
                const eqIdx = tok.indexOf('=');
                if (eqIdx !== -1) {
                    const key = tok.slice(0, eqIdx).trim();
                    const valStr = tok.slice(eqIdx + 1).trim();
                    try {
                        argsObj[key] = eval('(' + valStr + ')');
                    } catch (e) {
                        argsObj[key] = valStr;
                    }
                }
            }

            for (const [k, v] of Object.entries(argsObj)) {
                const kLow = k.toLowerCase();
                if (Array.isArray(v)) {
                    if (['head', 'l1', 'l2', 'list1', 'list2', 'node', 'cur', 'first', 'second', 'heada', 'headb'].some(s => kLow.includes(s))) {
                        argsObj[k] = __to_list_node(v);
                    } else if (['root', 'subroot', 'tree', 'p', 'q', 't1', 't2', 'node'].some(s => kLow.includes(s))) {
                        argsObj[k] = __to_tree_node(v);
                    }
                }
            }

            const argValues = Object.values(argsObj);
            let actualVal;
            if (solInstance && typeof solInstance['${methodName}'] === 'function') {
                actualVal = solInstance['${methodName}'](...argValues);
            } else if (typeof ${methodName} === 'function') {
                actualVal = ${methodName}(...argValues);
            } else {
                throw new Error("Function '${methodName}' not found in Solution or global scope.");
            }

            if (actualVal && typeof actualVal === 'object') {
                if ('val' in actualVal && 'next' in actualVal) {
                    actualVal = __from_list_node(actualVal);
                } else if ('val' in actualVal && ('left' in actualVal || 'right' in actualVal)) {
                    actualVal = __from_tree_node(actualVal);
                }
            }

            let expectedVal;
            try {
                expectedVal = eval('(' + expStr + ')');
            } catch (e) {
                expectedVal = expStr.trim();
            }

            function areEquiv(a, b, rawExp) {
                if (a === b) return true;
                if (JSON.stringify(a) === JSON.stringify(b)) return true;
                const sA = (a === null || a === undefined ? 'null' : (Array.isArray(a) && a.length === 0 ? '[]' : JSON.stringify(a))).replace(/\\s+/g, '').toLowerCase();
                const sB = (rawExp || '').replace(/\\s+/g, '').replace(/'/g, '"').toLowerCase();
                if (sA === sB) return true;

                // Quote & spacing normalization (e.g. ['x'] vs [x] or ["a","b"] vs [a, b])
                const normA = sA.replace(/['"]/g, '');
                const normB = sB.replace(/['"]/g, '');
                if (normA && normB && normA === normB) return true;

                const empties = ['[]', 'null', 'none', 'nil', 'nullptr', 'undefined', '""', "''"];
                if (empties.includes(sA) && empties.includes(sB)) return true;
                if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
                return false;
            }

            const passed = areEquiv(actualVal, expectedVal, expStr);
            if (!passed) allPassed = false;

            results.push({
                id: caseId,
                input: inpStr,
                expected: expStr,
                actual: actualVal === null || actualVal === undefined ? '[]' : JSON.stringify(actualVal),
                passed
            });
        } catch (err) {
            allPassed = false;
            results.push({
                id: caseId,
                input: inpStr,
                expected: expStr,
                actual: err.name + ': ' + err.message,
                passed: false
            });
        }
    }

    console.log("__OAFORGE_RESULT__" + JSON.stringify({
        status: allPassed ? "PASSED" : "FAILED",
        results
    }) + "__END__");
}

runTests();
`;
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/^_/, '');
}

export function generateRubyHarness(
  userCode: string,
  entryPoint: string,
  testCases: TestCase[]
): string {
  const match = entryPoint.match(/\.([a-zA-Z0-9_]+)/);
  const rawMethodName = match ? match[1] : 'solve';
  const snakeCaseMethodName = toSnakeCase(rawMethodName);

  const userMethods = Array.from(userCode.matchAll(/def\s+([a-zA-Z0-9_]+)/g)).map(
    (m) => m[1]
  );

  const casesData = testCases.map((tc, idx) => {
    const parsed = parseInputString(tc.input);
    return {
      id: idx + 1,
      input: tc.input,
      output: tc.output,
      paramNames: Object.keys(parsed),
      args: Object.values(parsed),
    };
  });

  const testCasesJson = JSON.stringify(casesData);

  return `
require 'json'
require 'set'
require 'matrix'
require 'prime'

class ListNode
  attr_accessor :val, :next
  def initialize(val = 0, _next = nil)
    @val = val
    @next = _next
  end
end unless defined?(ListNode)

class TreeNode
  attr_accessor :val, :left, :right
  def initialize(val = 0, left = nil, right = nil)
    @val = val
    @left = left
    @right = right
  end
end unless defined?(TreeNode)

def to_list_node(arr)
  return nil if !arr.is_a?(Array) || arr.empty?
  dummy = ListNode.new(0)
  cur = dummy
  arr.each do |v|
    cur.next = ListNode.new(v)
    cur = cur.next
  end
  dummy.next
end

def list_node_to_arr(head)
  arr = []
  cur = head
  while cur
    arr << cur.val
    cur = cur.next
  end
  arr
end

def to_tree_node(arr)
  return nil if !arr.is_a?(Array) || arr.empty? || arr[0].nil?
  root = TreeNode.new(arr[0])
  queue = [root]
  i = 1
  while !queue.empty? && i < arr.length
    node = queue.shift
    if i < arr.length && !arr[i].nil?
      node.left = TreeNode.new(arr[i])
      queue << node.left
    end
    i += 1
    if i < arr.length && !arr[i].nil?
      node.right = TreeNode.new(arr[i])
      queue << node.right
    end
    i += 1
  end
  root
end

def tree_node_to_arr(root)
  return [] if root.nil?
  res = []
  queue = [root]
  while !queue.empty?
    node = queue.shift
    if node
      res << node.val
      queue << node.left
      queue << node.right
    else
      res << nil
    end
  end
  while !res.empty? && res.last.nil?
    res.pop
  end
  res
end

def serialize_result(res)
  if res.nil?
    nil
  elsif res.is_a?(ListNode)
    list_node_to_arr(res)
  elsif res.is_a?(TreeNode)
    tree_node_to_arr(res)
  else
    res
  end
end

${userCode}

def find_target_method(sol, candidate_names)
  if sol
    candidate_names.each do |name|
      sym = name.to_sym
      return [sol, sym] if sol.respond_to?(sym)
    end
    custom_methods = sol.public_methods(false)
    return [sol, custom_methods.first] if !custom_methods.empty?
  end

  candidate_names.each do |name|
    sym = name.to_sym
    return [self, sym] if respond_to?(sym, true)
  end

  candidate_names.each do |name|
    sym = name.to_sym
    return [:main, sym] if Kernel.respond_to?(sym, true)
  end

  [nil, nil]
end

def run_tests
  cases_data = JSON.parse(${JSON.stringify(testCasesJson)})
  results = []
  all_passed = true

  sol = defined?(Solution) ? Solution.new : nil

  candidate_names = ${JSON.stringify([
    ...userMethods,
    snakeCaseMethodName,
    rawMethodName,
    'solve',
  ])}

  target_obj, target_method = find_target_method(sol, candidate_names)

  cases_data.each do |tc|
    case_id = tc['id']
    inp_str = tc['input']
    exp_str = tc['output']
    raw_args = tc['args'] || []
    param_names = tc['paramNames'] || []

    args = raw_args.each_with_index.map do |arg, idx|
      pname = (param_names[idx] || '').downcase
      if pname =~ /head|l1|l2|list|node|cur|first|second/ && arg.is_a?(Array)
        to_list_node(arg)
      elsif pname =~ /root|subroot|tree|p|q|t1|t2|node/ && arg.is_a?(Array)
        to_tree_node(arg)
      else
        arg
      end
    end

    begin
      if target_obj.nil? || target_method.nil?
        raise "Method not found. Candidates searched: #{candidate_names.join(', ')}"
      end

      actual_raw = if target_obj == :main
        send(target_method, *args)
      else
        target_obj.send(target_method, *args)
      end

      actual_val = serialize_result(actual_raw)

      expected_val = begin
        JSON.parse(exp_str)
      rescue
        exp_str.strip
      end

      actual_json = JSON.generate(actual_val) rescue actual_val.to_s
      expected_json = JSON.generate(expected_val) rescue expected_val.to_s

      empties = ['[]', 'null', 'none', 'nil', 'nullptr', '""', "''"]
      s_a = actual_json.gsub(/\\s+/, '').downcase
      s_b = (exp_str || '').gsub(/\\s+/, '').downcase
      norm_a = s_a.gsub(/['"]/, '')
      norm_b = s_b.gsub(/['"]/, '')

      passed = (actual_val == expected_val) || 
               (actual_json == expected_json) ||
               (s_a == s_b) ||
               (!norm_a.empty? && norm_a == norm_b) ||
               (empties.include?(s_a) && empties.include?(s_b)) ||
               (actual_val.nil? && empties.include?(s_b))

      all_passed = false unless passed

      actual_display = actual_val.nil? ? "[]" : actual_json
      results << {
        id: case_id,
        input: inp_str,
        expected: exp_str,
        actual: actual_display,
        passed: passed
      }
    rescue => e
      all_passed = false
      results << {
        id: case_id,
        input: inp_str,
        expected: exp_str,
        actual: "#{e.class}: #{e.message}",
        passed: false
      }
    end
  end

  output = {
    status: all_passed ? "PASSED" : "FAILED",
    results: results
  }
  puts "__OAFORGE_RESULT__" + JSON.generate(output) + "__END__"
end

run_tests
`;
}


export function generateJavaHarness(
  userCode: string,
  entryPoint: string,
  testCases: TestCase[]
): string {
  const match = entryPoint.match(/\.([a-zA-Z0-9_]+)/);
  const methodName = match ? match[1] : 'solve';

  const testCalls = testCases
    .map((tc, idx) => {
      const caseId = idx + 1;
      const parsedArgs = parseInputString(tc.input);
      const decls: string[] = [];
      const varNames: string[] = [];

      Object.entries(parsedArgs).forEach(([key, val], i) => {
        const varName = `_arg_${caseId}_${i}`;
        decls.push(toJavaDeclaration(varName, val, key));
        varNames.push(varName);
      });

      return `
        try {
            ${decls.join('\n            ')}
            var res = sol.${methodName}(${varNames.join(', ')});
            System.out.println("__OAFORGE_CASE__${caseId}__VAL__" + formatResult(res));
        } catch (Throwable e) {
            System.out.println("__OAFORGE_CASE__${caseId}__ERR__" + e.getClass().getSimpleName() + ": " + e.getMessage());
        }
      `;
    })
    .join('\n');

  return `
import java.util.*;
import java.io.*;
import java.math.*;
import java.util.stream.*;
import java.util.function.*;
import java.util.concurrent.*;

class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}

${userCode}

public class Main {
    static ListNode toListNode(int[] arr) {
        if (arr == null || arr.length == 0) return null;
        ListNode dummy = new ListNode(0);
        ListNode cur = dummy;
        for (int v : arr) { cur.next = new ListNode(v); cur = cur.next; }
        return dummy.next;
    }

    static List<Integer> listNodeToList(ListNode head) {
        List<Integer> list = new ArrayList<>();
        ListNode cur = head;
        int limit = 0;
        while (cur != null && limit++ < 10000) {
            list.add(cur.val);
            cur = cur.next;
        }
        return list;
    }

    static TreeNode toTreeNode(Integer[] arr) {
        if (arr == null || arr.length == 0 || arr[0] == null) return null;
        TreeNode root = new TreeNode(arr[0]);
        Queue<TreeNode> q = new LinkedList<>();
        q.offer(root);
        int i = 1;
        while (!q.isEmpty() && i < arr.length) {
            TreeNode cur = q.poll();
            if (i < arr.length && arr[i] != null) {
                cur.left = new TreeNode(arr[i]);
                q.offer(cur.left);
            }
            i++;
            if (i < arr.length && arr[i] != null) {
                cur.right = new TreeNode(arr[i]);
                q.offer(cur.right);
            }
            i++;
        }
        return root;
    }

    static List<Integer> treeNodeToList(TreeNode root) {
        List<Integer> list = new ArrayList<>();
        if (root == null) return list;
        Queue<TreeNode> q = new LinkedList<>();
        q.offer(root);
        while (!q.isEmpty()) {
            TreeNode cur = q.poll();
            if (cur != null) {
                list.add(cur.val);
                q.offer(cur.left);
                q.offer(cur.right);
            } else {
                list.add(null);
            }
        }
        while (!list.isEmpty() && list.get(list.size() - 1) == null) {
            list.remove(list.size() - 1);
        }
        return list;
    }

    static String formatResult(Object obj) {
        if (obj == null) return "[]";
        if (obj instanceof ListNode) return listNodeToList((ListNode) obj).toString();
        if (obj instanceof TreeNode) return treeNodeToList((TreeNode) obj).toString();
        if (obj instanceof int[]) return Arrays.toString((int[]) obj);
        if (obj instanceof long[]) return Arrays.toString((long[]) obj);
        if (obj instanceof double[]) return Arrays.toString((double[]) obj);
        if (obj instanceof boolean[]) return Arrays.toString((boolean[]) obj);
        if (obj instanceof Object[]) return Arrays.deepToString((Object[]) obj);
        return String.valueOf(obj);
    }

    public static void main(String[] args) {
        Solution sol = new Solution();
        ${testCalls}
    }
}
`;
}

export function generateCppHarness(
  userCode: string,
  entryPoint: string,
  testCases: TestCase[]
): string {
  const match = entryPoint.match(/\.([a-zA-Z0-9_]+)/);
  const methodName = match ? match[1] : 'solve';

  const testCalls = testCases
    .map((tc, idx) => {
      const caseId = idx + 1;
      const parsedArgs = parseInputString(tc.input);
      const decls: string[] = [];
      const varNames: string[] = [];

      Object.entries(parsedArgs).forEach(([key, val], i) => {
        const varName = `_arg_${caseId}_${i}`;
        decls.push(toCppDeclaration(varName, val, key));
        varNames.push(varName);
      });

      return `
    try {
        ${decls.join('\n        ')}
        auto res = sol.${methodName}(${varNames.join(', ')});
        cout << "__OAFORGE_CASE__${caseId}__VAL__";
        printResult(res);
        cout << "\\n";
    } catch (const exception& e) {
        cout << "__OAFORGE_CASE__${caseId}__ERR__" << e.what() << "\\n";
    }
      `;
    })
    .join('\n');

  return `
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <queue>
#include <deque>
#include <stack>
#include <list>
#include <algorithm>
#include <numeric>
#include <cmath>
#include <climits>
#include <sstream>
#include <functional>
#include <tuple>
#include <bitset>
#include <utility>
#include <memory>
#include <cstring>
#include <cstdio>
#include <cassert>
#include <cctype>
#include <iomanip>
#include <random>
#include <iterator>

using namespace std;

struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

ListNode* toListNode(const vector<int>& vals) {
    if (vals.empty()) return nullptr;
    ListNode dummy(0);
    ListNode* cur = &dummy;
    for (int v : vals) {
        cur->next = new ListNode(v);
        cur = cur->next;
    }
    return dummy.next;
}

TreeNode* toTreeNode(const vector<int>& vals) {
    if (vals.empty() || vals[0] == INT_MIN) return nullptr;
    TreeNode* root = new TreeNode(vals[0]);
    queue<TreeNode*> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < vals.size()) {
        TreeNode* cur = q.front();
        q.pop();
        if (i < vals.size() && vals[i] != INT_MIN) {
            cur->left = new TreeNode(vals[i]);
            q.push(cur->left);
        }
        i++;
        if (i < vals.size() && vals[i] != INT_MIN) {
            cur->right = new TreeNode(vals[i]);
            q.push(cur->right);
        }
        i++;
    }
    return root;
}

template<typename T>
void printResult(const T& val) {
    cout << val;
}

void printResult(bool val) {
    cout << (val ? "true" : "false");
}

void printResult(nullptr_t) {
    cout << "[]";
}

template<typename T>
void printResult(const vector<T>& vec) {
    cout << "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        if (i > 0) cout << ", ";
        printResult(vec[i]);
    }
    cout << "]";
}

void printResult(ListNode* head) {
    cout << "[";
    ListNode* cur = head;
    bool first = true;
    while (cur) {
        if (!first) cout << ", ";
        cout << cur->val;
        first = false;
        cur = cur->next;
    }
    cout << "]";
}

void printResult(TreeNode* root) {
    if (!root) {
        cout << "[]";
        return;
    }
    vector<string> res;
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode* cur = q.front();
        q.pop();
        if (cur) {
            res.push_back(to_string(cur->val));
            q.push(cur->left);
            q.push(cur->right);
        } else {
            res.push_back("null");
        }
    }
    while (!res.empty() && res.back() == "null") {
        res.pop_back();
    }
    cout << "[";
    for (size_t i = 0; i < res.size(); ++i) {
        if (i > 0) cout << ", ";
        cout << res[i];
    }
    cout << "]";
}

#line 1 "Solution.cpp"
${userCode}
#line 1 "Harness.cpp"

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    Solution sol;
    ${testCalls}
    return 0;
}
`;
}

export function generateGoHarness(
  userCode: string,
  entryPoint: string,
  testCases: TestCase[]
): string {
  const fallbackMatch = entryPoint.match(/\.([a-zA-Z0-9_]+)/);
  const targetName = fallbackMatch ? fallbackMatch[1] : 'solve';

  // Find exact function name and signature in userCode
  const nameRegex = new RegExp(`func\\s+(${targetName})\\s*\\(([^)]*)\\)\\s*([^{\\n]*)`, 'i');
  const exactMatch = userCode.match(nameRegex);
  const anyFuncMatch = exactMatch || userCode.match(/func\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*([^{\n]*)/);

  const methodName = exactMatch ? exactMatch[1] : (anyFuncMatch ? anyFuncMatch[1] : targetName);
  const returnType = (exactMatch ? exactMatch[3] : (anyFuncMatch ? anyFuncMatch[3] : '')).trim();
  const isVoid = !returnType || returnType === '';

  // Clean userCode: remove package line
  const cleanUserCode = userCode.replace(/^\s*package\s+[a-zA-Z0-9_]+/m, '');

  const hasListNode = /\btype\s+ListNode\s+struct\b/.test(userCode);
  const hasTreeNode = /\btype\s+TreeNode\s+struct\b/.test(userCode);

  const neededImports = ['"fmt"', '"encoding/json"'];
  const importsToInject = neededImports.filter((imp) => !userCode.includes(imp));

  const testCalls = testCases
    .map((tc, idx) => {
      const caseId = idx + 1;
      const parsedArgs = parseInputString(tc.input);
      const decls: string[] = [];
      const varNames: string[] = [];

      Object.entries(parsedArgs).forEach(([key, val], i) => {
        const varName = `_arg_${caseId}_${i}`;
        decls.push(toGoDeclaration(varName, val, key));
        varNames.push(varName);
      });

      const callCode = isVoid
        ? `${methodName}(${varNames.join(', ')})
        printCaseOutput(${caseId}, ${varNames[0] || 'nil'})`
        : `res := ${methodName}(${varNames.join(', ')})
        printCaseOutput(${caseId}, res)`;

      return `
    runCase(${caseId}, func() {
        ${decls.join('\n        ')}
        ${callCode}
    })
      `;
    })
    .join('\n');

  return `
package main

import (
    ${importsToInject.join('\n    ')}
)

${!hasListNode ? `
type ListNode struct {
    Val  int
    Next *ListNode
}
` : ''}

${!hasTreeNode ? `
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}
` : ''}

func toListNode(vals []int) *ListNode {
    if len(vals) == 0 {
        return nil
    }
    dummy := &ListNode{}
    cur := dummy
    for _, v := range vals {
        cur.Next = &ListNode{Val: v}
        cur = cur.Next
    }
    return dummy.Next
}

func listNodeToSlice(head *ListNode) []int {
    res := []int{}
    for head != nil {
        res = append(res, head.Val)
        head = head.Next
    }
    return res
}

func toTreeNode(vals []int) *TreeNode {
    if len(vals) == 0 || vals[0] == -1000000000 {
        return nil
    }
    root := &TreeNode{Val: vals[0]}
    queue := []*TreeNode{root}
    i := 1
    for len(queue) > 0 && i < len(vals) {
        node := queue[0]
        queue = queue[1:]
        if i < len(vals) && vals[i] != -1000000000 {
            node.Left = &TreeNode{Val: vals[i]}
            queue = append(queue, node.Left)
        }
        i++
        if i < len(vals) && vals[i] != -1000000000 {
            node.Right = &TreeNode{Val: vals[i]}
            queue = append(queue, node.Right)
        }
        i++
    }
    return root
}

func treeNodeToSlice(root *TreeNode) []interface{} {
    if root == nil {
        return []interface{}{}
    }
    res := []interface{}{}
    queue := []*TreeNode{root}
    for len(queue) > 0 {
        node := queue[0]
        queue = queue[1:]
        if node != nil {
            res = append(res, node.Val)
            queue = append(queue, node.Left)
            queue = append(queue, node.Right)
        } else {
            res = append(res, nil)
        }
    }
    for len(res) > 0 && res[len(res)-1] == nil {
        res = res[:len(res)-1]
    }
    return res
}

func printCaseOutput(caseId int, val interface{}) {
    if val == nil {
        fmt.Printf("__OAFORGE_CASE__%d__VAL__[]\\n", caseId)
        return
    }
    if ln, ok := val.(*ListNode); ok {
        if ln == nil {
            fmt.Printf("__OAFORGE_CASE__%d__VAL__[]\\n", caseId)
            return
        }
        b, _ := json.Marshal(listNodeToSlice(ln))
        fmt.Printf("__OAFORGE_CASE__%d__VAL__%s\\n", caseId, string(b))
        return
    }
    if tn, ok := val.(*TreeNode); ok {
        if tn == nil {
            fmt.Printf("__OAFORGE_CASE__%d__VAL__[]\\n", caseId)
            return
        }
        b, _ := json.Marshal(treeNodeToSlice(tn))
        fmt.Printf("__OAFORGE_CASE__%d__VAL__%s\\n", caseId, string(b))
        return
    }
    b, err := json.Marshal(val)
    if err == nil {
        fmt.Printf("__OAFORGE_CASE__%d__VAL__%s\\n", caseId, string(b))
    } else {
        fmt.Printf("__OAFORGE_CASE__%d__VAL__%v\\n", caseId, val)
    }
}

func runCase(caseId int, f func()) {
    defer func() {
        if r := recover(); r != nil {
            fmt.Printf("__OAFORGE_CASE__%d__ERR__panic: %v\\n", caseId, r)
        }
    }()
    f()
}

//line solution.go:1
${cleanUserCode}
//line harness.go:1

func main() {
    ${testCalls}
}
`;
}

export function areOutputsEquivalent(actualRaw: string, expectedRaw: string): boolean {
  if (actualRaw === expectedRaw) return true;
  const sA = (actualRaw || '').trim();
  const sB = (expectedRaw || '').trim();
  if (sA === sB) return true;

  const empties = new Set(['[]', 'null', 'none', 'nil', 'nullptr', '()', '{}', '""', "''", 'undefined']);

  const normA = sA.replace(/\s+/g, '').replace(/'/g, '"').toLowerCase();
  const normB = sB.replace(/\s+/g, '').replace(/'/g, '"').toLowerCase();
  if (normA === normB) return true;

  if (empties.has(normA) && empties.has(normB)) return true;

  // Quote-stripped comparison: handles ['x'] vs [x], ["a","b"] vs [a, b], or unquoted character arrays
  const strippedA = normA.replace(/['"]/g, '');
  const strippedB = normB.replace(/['"]/g, '');
  if (strippedA && strippedB && strippedA === strippedB) return true;

  const subA = normA.replace(/\bnone\b/g, 'null').replace(/\bnil\b/g, 'null').replace(/\bnullptr\b/g, 'null');
  const subB = normB.replace(/\bnone\b/g, 'null').replace(/\bnil\b/g, 'null').replace(/\bnullptr\b/g, 'null');
  if (subA === subB) return true;
  if (empties.has(subA) && empties.has(subB)) return true;

  // Booleans
  if ((normA === 'true' && normB === 'true') || (normA === 'false' && normB === 'false')) return true;

  // JSON deep equality
  try {
    const jsonA = JSON.parse(subA);
    const jsonB = JSON.parse(subB);
    if (JSON.stringify(jsonA) === JSON.stringify(jsonB)) return true;
  } catch {}

  // Numeric equivalence with floating point tolerance
  try {
    const numA = Number(sA);
    const numB = Number(sB);
    if (!isNaN(numA) && !isNaN(numB) && Math.abs(numA - numB) < 1e-5) return true;
  } catch {}

  return false;
}

export async function executeOnJudge0(
  userCode: string,
  entryPoint: string,
  testCases: TestCase[],
  language: string = 'python'
): Promise<RunResult> {
  const normalizedLang = language.toLowerCase();
  const languageId = LANGUAGE_IDS[normalizedLang] || LANGUAGE_IDS.python;

  const validTestCases = (testCases || []).filter(
    (tc) => tc && tc.input && !tc.input.includes('...') && !tc.output?.includes('...')
  );

  let sourceCode = userCode;

  if (normalizedLang === 'python') {
    sourceCode = generatePythonHarness(userCode, entryPoint, validTestCases);
  } else if (normalizedLang === 'javascript' || normalizedLang === 'typescript') {
    sourceCode = generateJavaScriptHarness(userCode, entryPoint, validTestCases);
  } else if (normalizedLang === 'ruby') {
    sourceCode = generateRubyHarness(userCode, entryPoint, validTestCases);
  } else if (normalizedLang === 'java') {
    if (!userCode.includes('static void main')) {
      sourceCode = generateJavaHarness(userCode, entryPoint, validTestCases);
    }
  } else if (normalizedLang === 'cpp') {
    if (!userCode.includes('main(')) {
      sourceCode = generateCppHarness(userCode, entryPoint, validTestCases);
    }
  } else if (normalizedLang === 'go') {
    if (!userCode.includes('func main(')) {
      sourceCode = generateGoHarness(userCode, entryPoint, validTestCases);
    }
  }

  const endpoint = `${JUDGE0_BASE_URL}/submissions?base64_encoded=true&wait=true`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const authToken = process.env.JUDGE0_AUTH_TOKEN || 'e40515c62071ceaf660b59f74b12d5e1';
  if (authToken) {
    headers['X-Auth-Token'] = authToken;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source_code: Buffer.from(sourceCode).toString('base64'),
      language_id: languageId,
      cpu_time_limit: 5,
      memory_limit: 128000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      status: 'ERROR',
      results: [],
      runtime: '0 ms',
      memory: '0 MB',
      error: `Judge0 Server Error (${response.status}): ${errorText}`,
    };
  }

  const initialData = await response.json().catch(() => ({}));
  let result: any = initialData;

  // If Judge0 did not finish synchronously (status 1 = In Queue, 2 = Processing), poll with progressive fast backoff
  if (!result || !result.status || result.status.id < 3) {
    const token = result?.token;
    if (token) {
      const delays = [150, 300, 500, 800, 1000];
      for (let i = 0; i < 35; i++) {
        const delay = delays[Math.min(i, delays.length - 1)];
        await new Promise((r) => setTimeout(r, delay));
        const res = await fetch(
          `${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=true`,
          { headers }
        );
        if (!res.ok) {
          return {
            status: 'ERROR',
            results: [],
            runtime: '0 ms',
            memory: '0 MB',
            error: `Judge0 poll error (${res.status}): ${await res.text()}`,
          };
        }
        result = await res.json();
        if (result.status?.id >= 3) break;
      }
    }
  }

  if (!result || !result.status || result.status.id < 3) {
    return {
      status: 'ERROR',
      results: [],
      runtime: '0 ms',
      memory: '0 MB',
      error: 'Timed out waiting for Judge0 to finish.',
    };
  }

  const stdout = decodeBase64(result.stdout);
  const rawStderr = decodeBase64(result.stderr);
  const rawCompileOutput = decodeBase64(result.compile_output);
  const rawMessage = decodeBase64(result.message);

  const compileOutput = cleanCompilerError(rawCompileOutput, normalizedLang, userCode);
  const stderr = cleanCompilerError(rawStderr, normalizedLang, userCode);
  const message = cleanCompilerError(rawMessage, normalizedLang, userCode);

  const runtimeStr = result.time ? `${Math.round(parseFloat(result.time) * 1000)} ms` : '0 ms';
  const memoryStr = result.memory ? `${(result.memory / 1024).toFixed(1)} MB` : '0 MB';

  // 1. Compilation Error (Status ID 6 or compile_output present)
  if (result.status?.id === 6 || compileOutput) {
    return {
      status: 'COMPILE_ERROR',
      results: [],
      runtime: runtimeStr,
      memory: memoryStr,
      error: compileOutput || stderr || 'Compilation Error: Check syntax and typing.',
    };
  }

  // 2. Time Limit Exceeded (Status ID 5)
  if (result.status?.id === 5) {
    return {
      status: 'TIME_LIMIT_EXCEEDED',
      results: [],
      runtime: runtimeStr,
      memory: memoryStr,
      error: 'Time Limit Exceeded: Your solution exceeded the 5.0s CPU time limit.',
    };
  }

  // 3. Runtime Error (Status ID 7..12 or stderr without stdout)
  if ((result.status?.id >= 7 && result.status?.id <= 12) || (stderr && !stdout)) {
    return {
      status: 'RUNTIME_ERROR',
      results: [],
      runtime: runtimeStr,
      memory: memoryStr,
      error: stderr || message || result.status?.description || 'Runtime Error: Program crashed during execution.',
    };
  }

  // 4. JSON report format (__OAFORGE_RESULT__)
  const match = stdout.match(/__OAFORGE_RESULT__([\s\S]*?)__END__/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      const enrichedResults = (parsed.results || []).map((r: any) => {
        const passed = Boolean(r.passed) || areOutputsEquivalent(String(r.actual ?? ''), String(r.expected ?? ''));
        return {
          ...r,
          passed,
        };
      });
      const allPassed = enrichedResults.length > 0 && enrichedResults.every((r: any) => r.passed);
      return {
        status: allPassed ? 'PASSED' : 'FAILED',
        results: enrichedResults,
        runtime: runtimeStr,
        memory: memoryStr,
      };
    } catch {
      // Fallback
    }
  }

  // 5. Case marker format (__OAFORGE_CASE__)
  if (stdout.includes('__OAFORGE_CASE__')) {
    const results: TestResultItem[] = validTestCases.map((tc, idx) => {
      const caseId = idx + 1;
      const valRegex = new RegExp(`__OAFORGE_CASE__${caseId}__VAL__(.*)`);
      const errRegex = new RegExp(`__OAFORGE_CASE__${caseId}__ERR__(.*)`);

      const valMatch = stdout.match(valRegex);
      const errMatch = stdout.match(errRegex);

      if (errMatch) {
        return {
          id: caseId,
          input: tc.input,
          expected: tc.output,
          actual: errMatch[1].trim(),
          passed: false,
        };
      }

      if (valMatch) {
        const actual = valMatch[1].trim();
        const expected = tc.output.trim();
        const passed = areOutputsEquivalent(actual, expected);

        return {
          id: caseId,
          input: tc.input,
          expected: tc.output,
          actual,
          passed,
        };
      }

      return {
        id: caseId,
        input: tc.input,
        expected: tc.output,
        actual: '(no output)',
        passed: false,
      };
    });

    const allPassed = results.length > 0 && results.every((r) => r.passed);
    return {
      status: allPassed ? 'PASSED' : 'FAILED',
      results,
      runtime: runtimeStr,
      memory: memoryStr,
    };
  }

  return {
    status: 'RUNTIME_ERROR',
    results: [],
    runtime: runtimeStr,
    memory: memoryStr,
    error: stderr || result.stderr || result.message || 'Execution failed without test case output.',
  };
}

