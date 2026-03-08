'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type Format = {
  id: string;
  name: string;
  sportId: string;
  teamSize: number;
  durationMinutes: number;
  refereeAllowed: boolean;
};

export function VendorFormatsPanel() {
  const [rows, setRows] = useState<Format[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [sportId, setSportId] = useState('BADMINTON');
  const [name, setName] = useState('1v1 Classic 60m');
  const [teamSize, setTeamSize] = useState('1');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [rulesText, setRulesText] = useState('Standard rules');
  const [refereeAllowed, setRefereeAllowed] = useState(false);
  const [noShowGraceMinutes, setNoShowGraceMinutes] = useState('10');

  const refresh = useCallback(async () => {
    const res = await apiRequest<Format[]>(`/formats?sportId=${encodeURIComponent(sportId)}`, {
      authenticated: true,
    });
    setRows(res);
  }, [sportId]);

  useEffect(() => {
    refresh().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load formats'));
  }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiRequest('/vendor/formats', {
        method: 'POST',
        authenticated: true,
        idempotency: true,
        body: JSON.stringify({
          sportId,
          name,
          teamSize: Number(teamSize),
          durationMinutes: Number(durationMinutes),
          rulesText,
          refereeAllowed,
          noShowGraceMinutes: Number(noShowGraceMinutes),
        }),
      });
      setMessage('Format created.');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create format');
    }
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Vendor Formats</h1>
      <p className="page-subtitle">Create and manage challenge formats.</p>

      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <select value={sportId} onChange={(e) => setSportId(e.target.value)} style={inputStyle}>
          <option value="BADMINTON">BADMINTON</option>
          <option value="PICKLEBALL">PICKLEBALL</option>
          <option value="TENNIS">TENNIS</option>
          <option value="BASKETBALL">BASKETBALL</option>
          <option value="TABLE_TENNIS">TABLE_TENNIS</option>
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Format name" required />
        <input value={teamSize} onChange={(e) => setTeamSize(e.target.value)} style={inputStyle} placeholder="Team size" required />
        <input value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} style={inputStyle} placeholder="Duration minutes" required />
        <input value={noShowGraceMinutes} onChange={(e) => setNoShowGraceMinutes(e.target.value)} style={inputStyle} placeholder="No-show grace minutes" required />
        <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} style={textareaStyle} placeholder="Rules" required />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={refereeAllowed} onChange={(e) => setRefereeAllowed(e.target.checked)} />
          Referee allowed
        </label>
        <button style={buttonStyle} type="submit">Create Format</button>
      </form>

      {message ? <p>{message}</p> : null}

      {rows.map((row) => (
        <article key={row.id} style={cardStyle}>
          <strong>{row.name}</strong>
          <span>{row.sportId}</span>
          <span>{row.teamSize}v{row.teamSize} / {row.durationMinutes}m</span>
        </article>
      ))}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 10,
  border: '1px solid rgba(92,224,255,0.35)',
  background: 'rgba(5,22,26,0.75)',
  color: 'var(--text)',
  padding: '0 10px',
};

const textareaStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid rgba(92,224,255,0.35)',
  background: 'rgba(5,22,26,0.75)',
  color: 'var(--text)',
  padding: 10,
  minHeight: 90,
};

const buttonStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 10,
  border: '1px solid rgba(92,224,255,0.5)',
  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
  color: '#02161a',
  fontWeight: 700,
};

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 10,
};
