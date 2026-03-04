'use client';

import { FormEvent, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type RegisterVendorResponse = {
  id: string;
  status: string;
  businessName: string;
};

export function VendorRegisterPanel() {
  const [businessName, setBusinessName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setMessage(`Vendor submitted: ${response.businessName} (${response.status}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Vendor registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Vendor Onboarding</h1>
      <p className="page-subtitle">Register your business for admin approval.</p>

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
