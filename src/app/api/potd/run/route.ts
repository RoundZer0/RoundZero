import { NextRequest, NextResponse } from 'next/server';
import { getQuestionByIdFromDB } from '@/lib/questions';
import { executeOnJudge0 } from '@/lib/judge0';

const potdRunCooldownMap = new Map<string, number>();

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'default_client';
    const now = Date.now();
    const lastRun = potdRunCooldownMap.get(clientIp) || 0;
    if (now - lastRun < 5000) {
      const remaining = Math.max(1, Math.ceil((5000 - (now - lastRun)) / 1000));
      return NextResponse.json(
        { error: `You are submitting too frequently. Please wait ${remaining} second${remaining > 1 ? 's' : ''} before trying again.` },
        { status: 429 }
      );
    }
    potdRunCooldownMap.set(clientIp, now);

    if (potdRunCooldownMap.size > 5000) {
      for (const [k, v] of potdRunCooldownMap.entries()) {
        if (now - v > 30000) potdRunCooldownMap.delete(k);
      }
    }

    const { questionId, code, language = 'python' } = await request.json();

    if (!questionId || !code) {
      return NextResponse.json(
        { error: 'Question ID and code are required.' },
        { status: 400 }
      );
    }

    const question = await getQuestionByIdFromDB(Number(questionId));
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Run only the visible sample test cases for quick feedback
    const sampleCases = (question.inputOutput || []).slice(0, 3);
    const execution = await executeOnJudge0(code, question.entryPoint, sampleCases, language);

    return NextResponse.json(execution);
  } catch (error: any) {
    console.error('Error in POST /api/potd/run:', error);
    return NextResponse.json(
      { error: error?.message || 'Execution error' },
      { status: 500 }
    );
  }
}
