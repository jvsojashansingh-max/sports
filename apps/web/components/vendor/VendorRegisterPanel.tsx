'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { DEFAULT_CITY_ID, getCityLabel } from '@/lib/indiaCities';

type RegisterVendorResponse = {
  id: string;
  status: string;
  businessName: string;
};

type MeResponse = {
  id: string;
  role: string;
  vendorId: string | null;
  defaultCityId: string | null;
};

export function VendorRegisterPanel() {
  const [businessName, setBusinessName] = useState('CHD Test Sports');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    apiRequest<MeResponse>('/me', { authenticated: true })
      .then(setMe)
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load account'));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const response = await apiRequest<RegisterVendorResponse>('/vendor/register', {
        method: 'POST',
        authenticated: true,
        idempotency: true,
        body: JSON.stringify({ businessName }),
      });
      setMessage(
        response.status === 'APPROVED'
          ? `Vendor ready: ${response.businessName}. Opening setup.`
          : `Vendor submitted: ${response.businessName} (${response.status}).`,
      );
      const profile = await apiRequest<MeResponse>('/me', { authenticated: true });
      setMe(profile);
      if (response.status === 'APPROVED') {
        window.location.href = '/vendor/settings';
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Vendor registration failed');
    } finally {
      setBusy(false);
    }
  }

  if (me?.role === 'VENDOR_OWNER' || me?.vendorId) {
    return (
      <section className="page-card" style={{ display: 'grid', gap: 12 }}>
        <h1 className="page-title">Vendor Onboarding</h1>
        <p className="page-subtitle">Your vendor is active. Continue setup from the links below.</p>
        <p className="page-subtitle">Current city: {getCityLabel(me.defaultCityId ?? DEFAULT_CITY_ID)}</p>
        <div style={{ display: 'grid', gap: 8 }}>
          <a href="/vendor/settings" style={linkStyle}>Create venues and resources</a>
          <a href="/vendor/formats" style={linkStyle}>Create formats</a>
          <a href="/vendor/challenges" style={linkStyle}>Handle challenges and requests</a>
          <a href="/vendor/schedule" style={linkStyle}>Manage schedule</a>
          <a href="/vendor/tournaments" style={linkStyle}>Create tournaments</a>
        </div>
        {message ? <p>{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Vendor Onboarding</h1>
      <p className="page-subtitle">Demo mode auto-approves vendor signup so you can start onboarding immediately.</p>
      <p className="page-subtitle">Default test city is {getCityLabel(me?.defaultCityId ?? DEFAULT_CITY_ID)}.</p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
        <label htmlFor="businessName">Business name</label>
        <input
          id="businessName"
          value={businessName}
          onChange={(event) => setBusinessName(event.target.value)}
          style={inputStyle}
          required
        />
        <button style={buttonStyle} type="submit" disabled={busy}>
          Submit for Approval
        </button>
      </form>

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

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
  fontWeight: 700,
};
