'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type ThresholdRow = {
  id: string;
  sportId: 'BADMINTON' | 'PICKLEBALL' | 'TENNIS' | 'BASKETBALL' | 'TABLE_TENNIS';
  level: number;
  winsRequired: number;
};

export function AdminLevelsPanel() {
  const [sportId, setSportId] = useState<ThresholdRow['sportId']>('BADMINTON');
  const [level, setLevel] = useState('1');
  const [winsRequired, setWinsRequired] = useState('1');
  const [rows, setRows] = useState<ThresholdRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await apiRequest<ThresholdRow[]>(`/admin/level-thresholds?sportId=${sportId}`, {
      authenticated: true,
    });
    setRows(response);
  }, [sportId]);

  useEffect(() => {
    refresh().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load thresholds'));
  }, [refresh]);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 10 }}>
      <h1 className="page-title">Admin Levels</h1>
      <p className="page-subtitle">Configure wins required per level and sport.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={sportId} onChange={(e) => setSportId(e.target.value as ThresholdRow['sportId'])} style={inputStyle}>
          <option value="BADMINTON">BADMINTON</option>
          <option value="PICKLEBALL">PICKLEBALL</option>
          <option value="TENNIS">TENNIS</option>
          <option value="BASKETBALL">BASKETBALL</option>
          <option value="TABLE_TENNIS">TABLE_TENNIS</option>
        </select>
        <input value={level} onChange={(e) => setLevel(e.target.value)} style={inputStyle} placeholder="Level" />
        <input value={winsRequired} onChange={(e) => setWinsRequired(e.target.value)} style={inputStyle} placeholder="Wins required" />
        <button
          style={buttonStyle}
          onClick={async () => {
            try {
              await apiRequest('/admin/level-thresholds', {
                method: 'POST',
                authenticated: true,
                body: JSON.stringify({
                  sportId,
                  level: Number(level),
                  winsRequired: Number(winsRequired),
                }),
              });
              setMessage('Threshold upserted.');
              await refresh();
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Failed to save threshold');
            }
          }}
        >
          Save
        </button>
      </div>
      {rows.map((row) => (
        <article key={row.id} style={cardStyle}>
          <span>L{row.level}</span>
          <span>Wins required: {row.winsRequired}</span>
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

const buttonStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 8,
  border: '1px solid rgba(92,224,255,0.5)',
  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
  color: '#02161a',
  fontWeight: 700,
  padding: '0 12px',
};

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 10,
};
