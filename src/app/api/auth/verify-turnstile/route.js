import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing captcha token' },
        { status: 400 }
      );
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      console.error('TURNSTILE_SECRET_KEY is not set');
      return NextResponse.json(
        { success: false, error: 'Captcha not configured' },
        { status: 500 }
      );
    }

    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);

    const verifyRes = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await verifyRes.json();

    if (!data.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Captcha verification failed',
          codes: data['error-codes'] || [],
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Turnstile verify error:', err);
    return NextResponse.json(
      { success: false, error: 'Verification error' },
      { status: 500 }
    );
  }
}
