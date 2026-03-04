'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { clearSessionTokens } from '@/lib/auth/session';

type MeResponse = {
  id: string;
  role: string;
  vendorId: string | null;
  defaultCityId: string | null;
};

export function ProfilePanel() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cityId, setCityId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<MeResponse>('/me', { authenticated: true })
      .then((res) => {
        setMe(res);
        setCityId(res.defaultCityId ?? '');
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load profile';
        setError(message);
      });
  }, []);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Profile</h1>
      <p className="page-subtitle">City switch UI starts here; persistent profile editing expands in Sprint 1.</p>

      {error ? <p>{error}</p> : null}
      {me ? (
        <>
          <p>User ID: {me.id}</p>
          <p>Role: {me.role}</p>
          <label htmlFor="cityId">Default city ID</label>
          <input
            id="cityId"
            value={cityId}
            onChange={(event) => setCityId(event.target.value)}
            style={inputStyle}
            placeholder="Set city id"
          />
          <button
            type="button"
            style={buttonStyle}
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                const updated = await apiRequest<MeResponse>('/me', {
                  method: 'PATCH',
                  authenticated: true,
                  idempotency: true,
                  body: JSON.stringify({
                    defaultCityId: cityId || undefined,
                  }),
                });
                setMe(updated);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save profile');
              } finally {
                setSaving(false);
              }
            }}
          >
            Save Profile
          </button>
        </>
      ) : (
        <p className="page-subtitle">Loading profile...</p>
      )}

      <button
        type="button"
        onClick={() => {
          clearSessionTokens();
          setMe(null);
          setError('Signed out locally.');
        }}
        style={buttonStyle}
      >
        Sign Out (Local)
      </button>
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
  height: 48,
  borderRadius: 10,
  border: '1px solid rgba(92, 224, 255, 0.5)',
  background: 'transparent',
  color: 'var(--text)',
  fontWeight: 700,
  cursor: 'pointer',
};
