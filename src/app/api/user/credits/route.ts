import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserFromDB, updateUserCreditStatusInDB, syncUserWithMongoDB } from '@/lib/dbServices';
import PaymentModel from '@/models/PaymentModel';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const emailParam = request.nextUrl.searchParams.get('email');
    const rawEmail = session?.user?.email || emailParam;
    const userEmail = rawEmail ? rawEmail.trim().toLowerCase() : '';

    if (!userEmail) {
      return NextResponse.json({
        email: '',
        credits: 1,
        isUnlimited: false,
        contributedCount: 0,
      });
    }

    // Ensure user document exists in MongoDB with normalized email
    await syncUserWithMongoDB(
      userEmail,
      session?.user?.name || undefined,
      session?.user?.image || undefined
    );
    let user = await getUserFromDB(userEmail);

    if (!user) {
      return NextResponse.json({
        email: userEmail,
        credits: 1,
        isUnlimited: false,
        contributedCount: 0,
      });
    }

    let isUnlimited = !!user.isUnlimited;

    // Check pass expiration
    if (isUnlimited && user.unlimitedExpiry && new Date(user.unlimitedExpiry).getTime() < Date.now()) {
      isUnlimited = false;
      await updateUserCreditStatusInDB(userEmail, { isUnlimited: false });
      user = await getUserFromDB(userEmail);
    }

    // Auto-heal from verified payments if not marked unlimited (case-insensitive lookup)
    if (!isUnlimited) {
      try {
        const verifiedPayment = await PaymentModel.findOne({
          userEmail: userEmail.toLowerCase().trim(),
          status: 'verified',
          $or: [{ planId: /unlimited/ }, { credits: { $gte: 900 } }],
        }).sort({ createdAt: -1 });

        if (verifiedPayment) {
          const purchaseDate = new Date(verifiedPayment.createdAt);
          const expiry = new Date(purchaseDate);
          expiry.setMonth(expiry.getMonth() + 3);
          if (expiry.getTime() > Date.now()) {
            isUnlimited = true;
            await updateUserCreditStatusInDB(userEmail, {
              isUnlimited: true,
              unlimitedExpiry: expiry.toISOString(),
              credits: 999,
            });
            user = await getUserFromDB(userEmail);
          }
        }
      } catch (err) {
        console.warn('Could not verify payments against payment collection:', err);
      }
    }

    return NextResponse.json({
      email: user?.email || userEmail,
      credits: isUnlimited ? Math.max(user?.credits ?? 1, 999) : (user?.credits ?? 1),
      isUnlimited,
      unlimitedExpiry: user?.unlimitedExpiry ? new Date(user.unlimitedExpiry).toISOString() : undefined,
      contributedCount: user?.contributedCount ?? 0,
    });
  } catch (error: any) {
    console.error('Error fetching user credits status from DB:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user credits from DB.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json().catch(() => ({}));
    const rawEmail = session?.user?.email || body.email;
    const userEmail = rawEmail ? rawEmail.trim().toLowerCase() : '';

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized: User email required' }, { status: 401 });
    }

    await syncUserWithMongoDB(userEmail, session?.user?.name || undefined, session?.user?.image || undefined);
    const currentUser = await getUserFromDB(userEmail);

    const isCurrentlyUnlimited = !!(
      currentUser?.isUnlimited &&
      (!currentUser?.unlimitedExpiry || new Date(currentUser.unlimitedExpiry).getTime() > Date.now())
    );

    let allowUnlimited = isCurrentlyUnlimited;
    let verifiedExpiry: string | undefined = currentUser?.unlimitedExpiry
      ? new Date(currentUser.unlimitedExpiry).toISOString()
      : undefined;

    // Check payment history with case-insensitive match
    try {
      const verifiedPayment = await PaymentModel.findOne({
        userEmail: { $regex: new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        status: 'verified',
        $or: [{ planId: /unlimited/ }, { credits: { $gte: 900 } }],
      }).sort({ createdAt: -1 });

      if (verifiedPayment) {
        const purchaseDate = new Date(verifiedPayment.createdAt);
        const expiry = new Date(purchaseDate);
        expiry.setMonth(expiry.getMonth() + 3);
        if (expiry.getTime() > Date.now()) {
          allowUnlimited = true;
          verifiedExpiry = expiry.toISOString();
        }
      }
    } catch {}

    const currentCredits = currentUser?.credits ?? 1;
    let nextCredits = currentCredits;

    if (allowUnlimited) {
      nextCredits = 999;
    } else if (typeof body.credits === 'number') {
      // If user is decreasing credits or claiming contribution reward
      nextCredits = Math.max(0, body.credits);
    }

    const updatedUser = await updateUserCreditStatusInDB(userEmail, {
      isUnlimited: allowUnlimited,
      unlimitedExpiry: verifiedExpiry,
      credits: nextCredits,
      contributedCount:
        body.contributedCount !== undefined
          ? Math.max(currentUser?.contributedCount ?? 0, body.contributedCount)
          : currentUser?.contributedCount,
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error updating user credits in DB:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user credits in DB.' },
      { status: 500 }
    );
  }
}
