import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normalizeEmail, recordPaymentToDB } from '@/lib/dbServices';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { planId, amount, currency = 'INR', credits, userEmail: bodyEmail } = await request.json();
    const userEmail = normalizeEmail(session?.user?.email || bodyEmail);

    const key_id = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      console.error('Razorpay credentials are not configured.');
      return NextResponse.json(
        { error: 'Payment is temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const instance = new Razorpay({
      key_id,
      key_secret,
    });

    const order = await instance.orders.create({
      amount: Math.round(amount * 100), // Amount in paise
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        planId,
        credits: credits ? credits.toString() : '999',
      },
    });

    await recordPaymentToDB({
      orderId: order.id,
      userEmail,
      planId: planId || 'unlimited_3months_99',
      amount,
      credits: credits || 999,
      status: 'created',
    });

    return NextResponse.json({
      id: order.id,
      currency: order.currency,
      amount: order.amount,
      keyId: key_id,
      isTest: false,
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { error: 'Failed to create payment order.' },
      { status: 500 }
    );
  }
}
