'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type DisputeRow = {
  id: string;
  matchId: string;
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED';
  reason: string;
};

export function AdminDisputesPanel() {
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [winnerSide, setWinnerSide] = useState<'A' | 'B'>('A');
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const disputes = await apiRequest<DisputeRow[]>('/admin/disputes', { authenticated: true });
    setRows(disputes);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load disputes'));
  }, []);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Admin Disputes</h1>
      <p className="page-subtitle">Resolve or escalate disputed matches.</p>
      <select value={winnerSide} onChange={(event) => setWinnerSide(event.target.value as 'A' | 'B')} style={inputStyle}>
        <option value="A">Winner A</option>
        <option value="B">Winner B</option>
      </select>
      {rows.map((row) => (
        <article key={row.id} style={cardStyle}>
          <strong>Dispute review</strong>
          <span>Status: {row.status}</span>
          <span>Reason: {row.reason}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={buttonStyle}
              onClick={async () => {
                try {
                  await apiRequest(`/admin/disputes/${row.id}/resolve`, {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({
                      winnerSide,
                    }),
                  });
                  setMessage('Dispute resolved.');
                  await refresh();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Resolve failed');
                }
              }}
            >
              Resolve
            </button>
            <button
              style={buttonStyle}
              onClick={async () => {
                try {
                  await apiRequest(`/admin/disputes/${row.id}/escalate`, {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({
                      winnerSide,
                    }),
                  });
                  setMessage('Dispute escalated.');
                  await refresh();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Escalate failed');
                }
              }}
            >
              Escalate
            </button>
          </div>
        </article>
      ))}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: '1px solid rgba(92,224,255,0.35)',
  background: 'rgba(5,22,26,0.75)',
  color: 'var(--text)',
  padding: '0 10px',
};

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 10,
};

const buttonStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: '1px solid rgba(92,224,255,0.5)',
  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
  color: '#02161a',
  fontWeight: 700,
  padding: '0 12px',
};
