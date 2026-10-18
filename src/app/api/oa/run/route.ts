import { NextRequest, NextResponse } from 'next/server';
import { getQuestionByIdFromDB } from '@/lib/questions';
import { executeOnJudge0 } from '@/lib/judge0';

const runCooldownMap = new Map<string, number>();

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'default_client';
    const now = Date.now();
    const lastRun = runCooldownMap.get(clientIp) || 0;
    if (now - lastRun < 5000) {
      const remaining = Math.max(1, Math.ceil((5000 - (now - lastRun)) / 1000));
      return NextResponse.json(
        { error: `You are submitting too frequently. Please wait ${remaining} second${remaining > 1 ? 's' : ''} before trying again.` },
        { status: 429 }
      );
    }
    runCooldownMap.set(clientIp, now);

    if (runCooldownMap.size > 5000) {
      for (const [k, v] of runCooldownMap.entries()) {
        if (now - v > 30000) runCooldownMap.delete(k);
      }
    }

    const { questionId, code, language = 'python', customInput } = await request.json();

    const question = await getQuestionByIdFromDB(Number(questionId));
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Run only the visible sample test cases for fast feedback, or custom test case
    let testCasesToRun = (question.inputOutput || []).slice(0, 3);
    if (typeof customInput === 'string' && customInput.trim()) {
      testCasesToRun = [{ input: customInput.trim(), output: '' }];
    }

    const execution = await executeOnJudge0(code, question.entryPoint, testCasesToRun, language);

    return NextResponse.json(execution);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal execution error' },
      { status: 500 }
    );
  }
}