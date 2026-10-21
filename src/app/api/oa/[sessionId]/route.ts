import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSessionServer, saveSessionServer } from '@/lib/sessionStore';
import { OASession, Submission } from '@/types/oa';
import { executeOnJudge0 } from '@/lib/judge0';
import { getOASessionFromDB, saveOASessionToDB, normalizeEmail } from '@/lib/dbServices';
import { getQuestionByIdFromDB } from '@/lib/questions';
import { recordContestSubmission } from '@/lib/contest';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  let session = getSessionServer(sessionId);

  // If not found in memory, try to fetch from database
  if (!session) {
    const dbSession = await getOASessionFromDB(sessionId);
    if (dbSession) {
      session = dbSession;
      // Cache it in memory for future requests
      saveSessionServer(session);
    }
  }

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Return client-safe copy hiding hidden test cases beyond first 3 samples
  const clientSafeQuestions = session.questions.map((q) => ({
    ...q,
    inputOutput: (q.inputOutput || []).slice(0, 3),
  }));

  return NextResponse.json({
    ...session,
    questions: clientSafeQuestions,
  });
}

const submitCooldownMap = new Map<string, number>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json();
  const { action, questionId, submission, finishAssessment } = body;

  let session = getSessionServer(sessionId);

  // If not found in memory, try to fetch from database
  if (!session) {
    const dbSession = await getOASessionFromDB(sessionId);
    if (dbSession) {
      session = dbSession;
      // Cache it in memory for future requests
      saveSessionServer(session);
    }
  }

  if (!session) {
    if (body.sessionData) {
      session = body.sessionData as OASession;
    } else {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
  }

  if (action === 'submit_question') {
    const clientKey = `${session.id}_${questionId}`;
    const now = Date.now();
    const lastSubmit = submitCooldownMap.get(clientKey) || 0;
    if (now - lastSubmit < 5000) {
      const remaining = Math.max(1, Math.ceil((5000 - (now - lastSubmit)) / 1000));
      return NextResponse.json(
        { error: `You are submitting too frequently. Please wait ${remaining} second${remaining > 1 ? 's' : ''} before trying again.` },
        { status: 429 }
      );
    }
    submitCooldownMap.set(clientKey, now);

    if (submitCooldownMap.size > 5000) {
      for (const [k, v] of submitCooldownMap.entries()) {
        if (now - v > 30000) submitCooldownMap.delete(k);
      }
    }

    const question = session.questions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 400 });
    }

    const code = submission.code || '';
    const lang = submission.language || 'python';
    let testCases = question.inputOutput || [];
    if (testCases.length <= 3) {
      const fullQ = await getQuestionByIdFromDB(Number(questionId));
      if (fullQ?.inputOutput && fullQ.inputOutput.length > testCases.length) {
        testCases = fullQ.inputOutput;
      }
    }

    const execResult = await executeOnJudge0(code, question.entryPoint, testCases, lang);

    const testResults = execResult.results || [];
    const passedCount = testResults.filter((r) => r.passed).length;
    const totalTests = testCases.length || 1;
    const scoreFraction = passedCount / totalTests;
    const score = Math.round(question.points * scoreFraction);

    const SAMPLE_LIMIT = 3;
    const sampleResults = testResults.slice(0, SAMPLE_LIMIT);
    const hiddenResults = testResults.slice(SAMPLE_LIMIT);
    const hiddenTotal = hiddenResults.length;
    const hiddenPassed = hiddenResults.filter((r) => r.passed).length;

    const fullSubmission: Submission = {
      code,
      language: submission.language || 'python',
      submittedAt: new Date().toISOString(),
      status: 'submitted',
      score,
      testResults: [
        ...sampleResults.map((r) => ({
          passed: r.passed,
          input: r.input,
          expected: r.expected,
          actual: r.actual,
        })),
        ...hiddenResults.map((r) => ({
          passed: r.passed,
          input: '[Hidden Test Case]',
          expected: '[Hidden Output]',
          actual: r.passed ? '[Passed]' : '[Failed]',
        })),
      ],
    };

    session.submissions[questionId] = fullSubmission;

    session.totalScore = Object.values(session.submissions).reduce(
      (sum, sub) => sum + (sub.score || 0),
      0
    );

    saveSessionServer(session);

    const authSession = await getServerSession(authOptions);
    const userEmail = normalizeEmail(authSession?.user?.email || session.userEmail);
    let potdResult: any = null;
    if (userEmail) {
      session.userEmail = userEmail;
      await saveOASessionToDB(session, userEmail);

      // If this OA session is a POTD and all test cases passed, record POTD solve and reward

      if (session.config?.isPOTD && passedCount === totalTests) {
        try {
          const { recordPOTDSolve, getTodayDateStr } = await import('@/lib/potd');
          potdResult = await recordPOTDSolve(
            userEmail,
            questionId,
            code,
            lang,
            execResult.runtime,
            execResult.memory,
            getTodayDateStr()
          );
        } catch (potdErr) {
          console.warn('Error recording POTD solve:', potdErr);
        }
      }

      // If this OA session is part of a Contest, update live leaderboard
      if ((session.config as any)?.isContest && (session.config as any)?.contestId) {
        try {
          await recordContestSubmission(
            (session.config as any).contestId,
            userEmail,
            questionId,
            passedCount === totalTests,
            score,
            new Date()
          );
        } catch (contestErr) {
          console.warn('Error recording contest submission:', contestErr);
        }
      }
    }

    const clientExecution = {
      status: execResult.status,
      runtime: execResult.runtime,
      memory: execResult.memory,
      error: execResult.error,
      results: sampleResults,
      hiddenStats: {
        total: hiddenTotal,
        passed: hiddenPassed,
        allPassed: hiddenPassed === hiddenTotal,
      },
      totalTests,
      totalPassed: passedCount,
    };

    const clientSafeQuestions = session.questions.map((q) => ({
      ...q,
      inputOutput: (q.inputOutput || []).slice(0, 3),
    }));

    return NextResponse.json({
      message: 'Question submitted successfully',
      submission: fullSubmission,
      execution: clientExecution,
      potdResult,
      session: {
        ...session,
        questions: clientSafeQuestions,
      },
    });
  }

  if (finishAssessment) {
    // 1. Fetch latest session from MongoDB to merge any previously saved submissions
    const dbSession = await getOASessionFromDB(sessionId);

    // 2. Defensively merge submissions across DB, memory session, and incoming payload
    const mergedSubmissions = {
      ...(dbSession?.submissions || {}),
      ...(session.submissions || {}),
      ...(body.sessionData?.submissions || {}),
    };

    session.submissions = mergedSubmissions;
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    
    // Calculate final score across all questions
    session.totalScore = Object.values(session.submissions).reduce(
      (sum, sub) => sum + (sub.score || 0),
      0
    );

    const authSession = await getServerSession(authOptions);
    const userEmail = normalizeEmail(authSession?.user?.email || session.userEmail || dbSession?.userEmail);
    if (userEmail) {
      session.userEmail = userEmail;
    }

    saveSessionServer(session);

    if (userEmail) {
      await saveOASessionToDB(session, userEmail);
    } else {
      await saveOASessionToDB(session);
    }

    const clientSafeQuestions = session.questions.map((q) => ({
      ...q,
      inputOutput: (q.inputOutput || []).slice(0, 3),
    }));

    return NextResponse.json({
      message: 'Assessment completed successfully',
      session: {
        ...session,
        questions: clientSafeQuestions,
      },
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
