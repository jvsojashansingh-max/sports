'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type VenueRow = {
  id: string;
  name: string;
  status: string;
};

type ResourceRow = {
  id: string;
  venueId: string;
  sportId: string;
  name: string;
  status: string;
};

type TournamentRow = {
  id: string;
  sportId: string;
  status: string;
  startTs: string;
  registrationDeadline: string;
  bracketVersion: number;
  venue: {
    id: string;
    name: string;
    cityId: string;
  };
};

export function VendorTournamentsPanel() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [venueId, setVenueId] = useState('');
  const [sportId, setSportId] = useState('BADMINTON');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [startTs, setStartTs] = useState('');
  const [slotMinutes, setSlotMinutes] = useState('60');
  const [selectedCreateResourceIds, setSelectedCreateResourceIds] = useState<string[]>([]);
  const [selectedGenerateResourceIds, setSelectedGenerateResourceIds] = useState<Record<string, string[]>>({});

  const refresh = useCallback(async () => {
    const [vendorVenues, vendorResources, tournaments] = await Promise.all([
      apiRequest<VenueRow[]>('/vendor/venues', { authenticated: true }),
      apiRequest<ResourceRow[]>('/vendor/resources', { authenticated: true }),
      apiRequest<TournamentRow[]>('/tournaments', { authenticated: true }),
    ]);
    setVenues(vendorVenues);
    setResources(vendorResources);
    setRows(tournaments);
    if (!venueId && vendorVenues.length > 0) {
      setVenueId(vendorVenues[0].id);
    }
  }, [venueId]);

  useEffect(() => {
    refresh().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load tournaments'));
  }, [refresh]);

  const vendorTournamentRows = useMemo(() => {
    const venueIds = new Set(venues.map((venue) => venue.id));
    return rows.filter((row) => venueIds.has(row.venue.id));
  }, [rows, venues]);

  const resourcesForVenue = useMemo(() => {
    return resources.filter((resource) => resource.venueId === venueId);
  }, [resources, venueId]);

  const resourcesByVenueId = useMemo(() => {
    const map = new Map<string, ResourceRow[]>();
    for (const resource of resources) {
      const current = map.get(resource.venueId) ?? [];
      current.push(resource);
      map.set(resource.venueId, current);
    }
    return map;
  }, [resources]);

  useEffect(() => {
    setSelectedCreateResourceIds([]);
  }, [venueId]);

  async function createTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const registrationIso = localDateTimeToIso(registrationDeadline);
    const startIso = localDateTimeToIso(startTs);

    if (!registrationIso || !startIso) {
      setMessage('Provide valid registration and start times.');
      return;
    }
    if (!venueId) {
      setMessage('Select a venue first.');
      return;
    }

    try {
      await apiRequest('/vendor/tournaments', {
        method: 'POST',
        authenticated: true,
        idempotency: true,
        body: JSON.stringify({
          venueId,
          sportId,
          registrationDeadline: registrationIso,
          startTs: startIso,
          slotMinutes: Number(slotMinutes),
          resourceIds: selectedCreateResourceIds,
        }),
      });
      setMessage('Tournament created.');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Create tournament failed');
    }
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Vendor Tournaments</h1>
      <p className="page-subtitle">Create single elimination tournaments and generate fixtures without resource IDs.</p>

      <form onSubmit={createTournament} style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Create Tournament</h2>
        <select value={venueId} onChange={(event) => setVenueId(event.target.value)} style={inputStyle} required>
          <option value="">Select venue</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name} ({venue.status})
            </option>
          ))}
        </select>
        <select value={sportId} onChange={(event) => setSportId(event.target.value)} style={inputStyle}>
          <option value="BADMINTON">BADMINTON</option>
          <option value="PICKLEBALL">PICKLEBALL</option>
          <option value="TENNIS">TENNIS</option>
          <option value="BASKETBALL">BASKETBALL</option>
          <option value="TABLE_TENNIS">TABLE_TENNIS</option>
        </select>
        <input
          type="datetime-local"
          value={registrationDeadline}
          onChange={(event) => setRegistrationDeadline(event.target.value)}
          style={inputStyle}
          required
        />
        <input
          type="datetime-local"
          value={startTs}
          onChange={(event) => setStartTs(event.target.value)}
          style={inputStyle}
          required
        />
        <input
          value={slotMinutes}
          onChange={(event) => setSlotMinutes(event.target.value)}
          style={inputStyle}
          placeholder="Slot minutes"
        />
        <ResourceMultiSelect
          title="Resources used for scheduling"
          resources={resourcesForVenue}
          selectedIds={selectedCreateResourceIds}
          onToggle={(resourceId) => {
            setSelectedCreateResourceIds((current) =>
              current.includes(resourceId)
                ? current.filter((value) => value !== resourceId)
                : [...current, resourceId],
            );
          }}
          emptyMessage="No resources found for this venue yet."
        />
        <button type="submit" style={buttonStyle}>
          Create Tournament
        </button>
      </form>

      <h2 style={{ margin: 0 }}>Your Tournaments</h2>
      {vendorTournamentRows.length === 0 ? <p className="page-subtitle">No tournaments yet.</p> : null}
      {vendorTournamentRows.map((row) => {
        const tournamentResources = resourcesByVenueId.get(row.venue.id) ?? [];
        const selectedIds = selectedGenerateResourceIds[row.id] ?? [];

        return (
          <article key={row.id} style={cardStyle}>
            <strong>{row.sportId}</strong>
            <span>Venue: {row.venue.name}</span>
            <span>Status: {row.status}</span>
            <span>Start: {new Date(row.startTs).toLocaleString()}</span>
            <span>Registration deadline: {new Date(row.registrationDeadline).toLocaleString()}</span>
            <span>Bracket version: {row.bracketVersion}</span>
            <ResourceMultiSelect
              title="Bracket scheduling resources"
              resources={tournamentResources}
              selectedIds={selectedIds}
              onToggle={(resourceId) => {
                setSelectedGenerateResourceIds((current) => {
                  const next = current[row.id] ?? [];
                  return {
                    ...current,
                    [row.id]: next.includes(resourceId)
                      ? next.filter((value) => value !== resourceId)
                      : [...next, resourceId],
                  };
                });
              }}
              emptyMessage="No resources available for this venue."
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={`/tournament/${row.id}`} style={linkStyle}>
                Open
              </a>
              <button
                style={buttonStyle}
                onClick={async () => {
                  try {
                    await apiRequest(`/vendor/tournaments/${row.id}/generate-bracket`, {
                      method: 'POST',
                      authenticated: true,
                      idempotency: true,
                      body: JSON.stringify({
                        resourceIds: selectedIds,
                      }),
                    });
                    setMessage('Bracket generated.');
                    await refresh();
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : 'Bracket generation failed');
                  }
                }}
              >
                Generate Bracket
              </button>
            </div>
          </article>
        );
      })}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

function ResourceMultiSelect({
  title,
  resources,
  selectedIds,
  onToggle,
  emptyMessage,
}: {
  title: string;
  resources: ResourceRow[];
  selectedIds: string[];
  onToggle: (resourceId: string) => void;
  emptyMessage: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <strong style={{ fontSize: 14 }}>{title}</strong>
      {resources.length === 0 ? <p className="page-subtitle">{emptyMessage}</p> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {resources.map((resource) => {
          const selected = selectedIds.includes(resource.id);
          return (
            <button
              key={resource.id}
              type="button"
              onClick={() => onToggle(resource.id)}
              style={{
                ...chipStyle,
                borderColor: selected ? 'rgba(92,224,255,0.8)' : 'rgba(92,224,255,0.25)',
                background: selected ? 'rgba(92,224,255,0.18)' : 'rgba(5,22,26,0.75)',
              }}
            >
              {resource.name} · {resource.sportId}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function localDateTimeToIso(value: string): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
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
  gap: 8,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 10,
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

const chipStyle: React.CSSProperties = {
  minHeight: 36,
  borderRadius: 999,
  border: '1px solid rgba(92,224,255,0.3)',
  color: 'var(--text)',
  padding: '8px 12px',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
};
