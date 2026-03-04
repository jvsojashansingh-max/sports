'use client';

import { FormEvent, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { setSessionTokens } from '@/lib/auth/session';

type RequestOtpResponse = {
  requestId: string;
  devOtp?: string;
};

type VerifyOtpResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    role: string;
    defaultCityId: string | null;
  };
};

export function OtpAuthPanel() {
  const [phone, setPhone] = useState('+919999999999');
  const [requestId, setRequestId] = useState('');
  const [otp, setOtp] = useState('123456');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canVerify = useMemo(() => Boolean(requestId.trim() && otp.trim()), [requestId, otp]);

  async function onRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const res = await apiRequest<RequestOtpResponse>('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
        idempotency: true,
      });
      setRequestId(res.requestId);
      setDevOtp(res.devOtp ?? null);
      setMessage('OTP requested. Continue with verify.');
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Request OTP failed';
      setMessage(err);
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canVerify) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const res = await apiRequest<VerifyOtpResponse>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          otp,
          deviceId: 'web-browser',
        }),
        idempotency: true,
      });
      setSessionTokens(res.accessToken, res.refreshToken);
      setMessage(`Signed in as ${res.user.id}.`);
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Verify OTP failed';
      setMessage(err);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleStart() {
    setBusy(true);
    setMessage(null);

    try {
      const res = await apiRequest<{ url: string; state: string }>('/auth/google/start?deviceId=web-browser', {
        method: 'GET',
      });
      setGoogleUrl(res.url);
      setMessage('Google login start created. In Sprint 1, this will redirect to consent.');
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Google start failed';
      setMessage(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 16 }}>
      <h1 className="page-title">Sign In</h1>
      <p className="page-subtitle">Phone OTP sign-in (Google account linking begins in Sprint 1).</p>

      <form onSubmit={onRequestOtp} style={{ display: 'grid', gap: 8 }}>
        <label htmlFor="phone">Phone (+country code)</label>
        <input
          id="phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          style={inputStyle}
          required
        />
        <button type="submit" style={buttonStyle} disabled={busy}>
          Request OTP
        </button>
      </form>

      <form onSubmit={onVerifyOtp} style={{ display: 'grid', gap: 8 }}>
        <label htmlFor="requestId">Request ID</label>
        <input
          id="requestId"
          value={requestId}
          onChange={(event) => setRequestId(event.target.value)}
          style={inputStyle}
          required
        />

        <label htmlFor="otp">OTP</label>
        <input
          id="otp"
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
          style={inputStyle}
          required
        />

        <button type="submit" style={buttonStyle} disabled={busy || !canVerify}>
          Verify OTP
        </button>
      </form>

      <button type="button" style={buttonStyle} disabled={busy} onClick={onGoogleStart}>
        Continue with Google
      </button>

      {devOtp ? <p className="page-subtitle">Dev OTP: {devOtp}</p> : null}
      {googleUrl ? <p className="page-subtitle">Google callback URL: {googleUrl}</p> : null}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 10,
  border: '1px solid rgba(92, 224, 255, 0.4)',
  background: 'rgba(5, 22, 26, 0.75)',
  color: 'var(--text)',
  padding: '0 12px',
};

const buttonStyle: React.CSSProperties = {
  height: 52,
  borderRadius: 12,
  border: '1px solid rgba(92, 224, 255, 0.5)',
  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
  color: '#02161a',
  fontWeight: 700,
  cursor: 'pointer',
};
