import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFullPOTDQuestion, getTodayDateStr, recordPOTDSolve } from '@/lib/potd';
import { executeOnJudge0 } from '@/lib/judge0';
import { getQuestionByIdFromDB } from '@/lib/questions';
import POTDSubmissionModel from '@/models/POTDSubmissionModel';
import { normalizeEmail } from '@/lib/dbServices';

const potdSubmitCooldownMap = new Map<string, number>();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Please sign in to submit your solution and record your streak.' },
        { status: 401 }
      );
    }

    const normEmail = normalizeEmail(session.user.email);
    const now = Date.now();
    const lastSubmit = potdSubmitCooldownMap.get(normEmail) || 0;
    if (now - lastSubmit < 5000) {
      const remaining = Math.max(1, Math.ceil((5000 - (now - lastSubmit)) / 1000));
      return NextResponse.json(
        { error: `You are submitting too frequently. Please wait ${remaining} second${remaining > 1 ? 's' : ''} before trying again.` },
        { status: 429 }
      );
    }
    potdSubmitCooldownMap.set(normEmail, now);

    if (potdSubmitCooldownMap.size > 5000) {
      for (const [k, v] of potdSubmitCooldownMap.entries()) {
        if (now - v > 30000) potdSubmitCooldownMap.delete(k);
      }
    }

    const { questionId, code, language = 'python' } = await request.json();

    if (!questionId || !code) {
      return NextResponse.json(
        { error: 'Question ID and code are required.' },
        { status: 400 }
      );
    }

    const dateStr = getTodayDateStr();

    // Fetch full question with all hidden test cases
    let question = await getFullPOTDQuestion(dateStr);
    if (!question || question.id !== Number(questionId)) {
      question = await getQuestionByIdFromDB(Number(questionId)) || null;
    }

    if (!question) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }

    const allTestCases = question.inputOutput || [];
    const execResult = await executeOnJudge0(code, question.entryPoint, allTestCases, language);

    const testResults = execResult.results || [];
    const passedCount = testResults.filter((r) => r.passed).length;
    const totalTests = allTestCases.length || 1;
    const allPassed = passedCount === totalTests && execResult.status !== 'COMPILE_ERROR' && execResult.status !== 'ERROR';

    const SAMPLE_LIMIT = 3;
    const sampleResults = testResults.slice(0, SAMPLE_LIMIT);
    const hiddenResults = testResults.slice(SAMPLE_LIMIT);
    const hiddenTotal = hiddenResults.length;
    const hiddenPassed = hiddenResults.filter((r) => r.passed).length;

    if (allPassed) {
      const solveResult = await recordPOTDSolve(
        normEmail,
        question.id,
        code,
        language,
        execResult.runtime,
        execResult.memory,
        dateStr
      );

      return NextResponse.json({
        passed: true,
        message: solveResult.alreadySolved
          ? 'Solution accepted! You already solved today\'s POTD.'
          : 'Accepted! Problem of the Day solved! +1 OA credit added to your account.',
        newStreak: solveResult.newStreak,
        creditAdded: solveResult.creditAdded,
        credits: solveResult.credits,
        execution: {
          status: 'Accepted',
          runtime: execResult.runtime,
          memory: execResult.memory,
          results: sampleResults,
          hiddenStats: {
            total: hiddenTotal,
            passed: hiddenPassed,
            allPassed: true,
          },
          totalTests,
          totalPassed: passedCount,
        },
      });
    }

    // Record failed submission document
    try {
      await POTDSubmissionModel.create({
        userEmail: normEmail,
        questionId: question.id,
        dateStr,
        code,
        language,
        status: 'failed',
        runtime: execResult.runtime,
        memory: execResult.memory,
        submittedAt: new Date(),
      });
    } catch {}

    return NextResponse.json({
      passed: false,
      message: 'Some test cases failed. Review test results and refine your solution.',
      execution: {
        status: execResult.status,
        error: execResult.error,
        runtime: execResult.runtime,
        memory: execResult.memory,
        results: sampleResults,
        hiddenStats: {
          total: hiddenTotal,
          passed: hiddenPassed,
          allPassed: false,
        },
        totalTests,
        totalPassed: passedCount,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/potd/submit:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit POTD solution.' },
      { status: 500 }
    );
  }
}
