export async function verifyTurnstileToken(token) {
  const res = await fetch('/api/auth/verify-turnstile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Captcha verification failed');
  }
  return true;
}
