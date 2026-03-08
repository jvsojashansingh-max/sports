'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { DEFAULT_CITY_ID, getCityLabel } from '@/lib/indiaCities';
import { VendorRegisterPanel } from './VendorRegisterPanel';

type MeResponse = {
  id: string;
  role: 'PLAYER' | 'VENDOR_OWNER' | 'VENDOR_STAFF' | 'ADMIN';
  vendorId: string | null;
  defaultCityId: string | null;
};

type VenueRow = {
  id: string;
};

type ResourceRow = {
  id: string;
};

type VendorChallengeRow = {
  id: string;
  status: string;
  paymentStatus: string;
  joinDeadlineTs: string;
  booking: {
    startTs: string;
    resource: {
      venue: {
        name: string;
      };
    };
  };
  match: {
    id: string;
    status: string;
  } | null;
};

type TournamentRow = {
  id: string;
  status: string;
  venue: {
    id: string;
  };
};

export function VendorDashboardPanel() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [challenges, setChallenges] = useState<VendorChallengeRow[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const profile = await apiRequest<MeResponse>('/me', { authenticated: true });
        if (!active) {
          return;
        }
        setMe(profile);

        const isVendor = profile.role === 'VENDOR_OWNER' || profile.role === 'VENDOR_STAFF' || Boolean(profile.vendorId);
        if (!isVendor) {
          return;
        }

        const [vendorVenues, vendorResources, vendorChallenges, allTournaments] = await Promise.all([
          apiRequest<VenueRow[]>('/vendor/venues', { authenticated: true }),
          apiRequest<ResourceRow[]>('/vendor/resources', { authenticated: true }),
          apiRequest<VendorChallengeRow[]>('/vendor/challenges', { authenticated: true }),
          apiRequest<TournamentRow[]>('/tournaments', { authenticated: true }),
        ]);
        if (!active) {
          return;
        }

        const venueIds = new Set(vendorVenues.map((venue) => venue.id));
        setVenues(vendorVenues);
        setResources(vendorResources);
        setChallenges(vendorChallenges);
        setTournaments(allTournaments.filter((tournament) => venueIds.has(tournament.venue.id)));
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Failed to load vendor dashboard');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const isVendor = me?.role === 'VENDOR_OWNER' || me?.role === 'VENDOR_STAFF' || Boolean(me?.vendorId);

  const counts = useMemo(() => ({
    openRequests: challenges.filter((row) => row.status === 'WAITING_OPPONENT' || row.status === 'OPPONENT_REQUESTED').length,
    confirmed: challenges.filter((row) => row.status === 'CONFIRMED').length,
    liveMatches: challenges.filter((row) => row.match !== null).length,
    tournaments: tournaments.filter((row) => row.status !== 'CANCELLED').length,
  }), [challenges, tournaments]);

  const recentChallenges = useMemo(() => {
    return [...challenges]
      .sort((left, right) => new Date(left.booking.startTs).getTime() - new Date(right.booking.startTs).getTime())
      .slice(0, 4);
  }, [challenges]);

  if (loading) {
    return <section className="page-card">Loading vendor workspace...</section>;
  }

  if (error && !me) {
    return (
      <section className="page-card" style={{ display: 'grid', gap: 12 }}>
        <h1 className="page-title">Vendor Workspace</h1>
        <p className="page-subtitle">Sign in first, then convert the test user into a vendor owner.</p>
        <p>{error}</p>
        <a href="/auth" style={linkStyle}>Open sign-in</a>
      </section>
    );
  }

  if (!isVendor) {
    return <VendorRegisterPanel />;
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 className="page-title">Vendor Workspace</h1>
        <p className="page-subtitle">
          Signed in as vendor owner for {getCityLabel(me?.defaultCityId ?? DEFAULT_CITY_ID)}. Use this page to reach setup,
          formats, challenge requests, and match-day controls.
        </p>
      </div>

      <div style={statsGridStyle}>
        <StatCard label="Venues" value={String(venues.length)} detail="Create and keep them live." />
        <StatCard label="Resources" value={String(resources.length)} detail="Courts, tables, and slots." />
        <StatCard label="Open Requests" value={String(counts.openRequests)} detail="Waiting or opponent-requested challenges." />
        <StatCard label="Confirmed" value={String(counts.confirmed)} detail="Confirmed challenge bookings." />
        <StatCard label="Live Matches" value={String(counts.liveMatches)} detail="Challenges with match records." />
        <StatCard label="Tournaments" value={String(counts.tournaments)} detail="Vendor-owned tournament rows." />
      </div>

      <div style={quickGridStyle}>
        <QuickLink href="/vendor/settings" title="Setup Venues" body="Create venues and resources for CHD and the other demo cities." />
        <QuickLink href="/vendor/formats" title="Challenge Formats" body="Create vendor-owned formats for badminton, tennis, pickleball, and more." />
        <QuickLink href="/vendor/challenges" title="Challenge Requests" body="View all challenges happening on your venues and jump into match ops." />
        <QuickLink href="/vendor/schedule" title="Schedule + Match Ops" body="Manage availability, blocks, check-ins, forfeits, disputes, and payment status." />
        <QuickLink href="/vendor/tournaments" title="Tournaments" body="Create tournaments and generate brackets for your venues." />
        <QuickLink href="/vendor/inbox" title="Vendor Inbox" body="Open challenge and tournament conversations." />
      </div>

      <section style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>How Vendor Flow Works</h2>
        <div style={infoCardStyle}>
          <strong>1. Sign in</strong>
          <span>Use /auth with the test phone, then open /vendor.</span>
          <strong>2. Convert to vendor</strong>
          <span>Submit vendor registration once. Stub mode auto-approves it.</span>
          <strong>3. Configure supply</strong>
          <span>Create venues/resources, then add formats and availability.</span>
          <strong>4. Handle requests</strong>
          <span>Players create challenges from booking. Vendors manage the resulting requests and match ops.</span>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Next Challenge Rows</h2>
          <a href="/vendor/challenges" style={linkStyle}>Open full challenge board</a>
        </div>
        {recentChallenges.length === 0 ? (
          <p className="page-subtitle">No vendor-linked challenges yet. Players can create them from the booking flow.</p>
        ) : null}
        {recentChallenges.map((row) => (
          <article key={row.id} style={infoCardStyle}>
            <strong>{row.booking.resource.venue.name}</strong>
            <span>Start: {new Date(row.booking.startTs).toLocaleString()}</span>
            <span>Status: {row.status}</span>
            <span>Payment: {row.paymentStatus}</span>
            <span>Join deadline: {new Date(row.joinDeadlineTs).toLocaleString()}</span>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`/challenge/${row.id}`} style={linkStyle}>Open challenge</a>
              {row.match ? <a href={`/vendor/schedule?matchId=${row.match.id}`} style={linkStyle}>Open match ops</a> : null}
            </div>
          </article>
        ))}
      </section>

      {error ? <p>{error}</p> : null}
    </section>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article style={statCardStyle}>
      <strong style={{ fontSize: 28 }}>{value}</strong>
      <span style={{ fontWeight: 700 }}>{label}</span>
      <span>{detail}</span>
    </article>
  );
}

function QuickLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <a href={href} style={quickLinkStyle}>
      <strong>{title}</strong>
      <span>{body}</span>
    </a>
  );
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
};

const statCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  borderRadius: 14,
  padding: 14,
  border: '1px solid rgba(92,224,255,0.28)',
  background: 'rgba(5,22,26,0.6)',
};

const quickGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};

const quickLinkStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  borderRadius: 14,
  padding: 14,
  border: '1px solid rgba(92,224,255,0.35)',
  background: 'rgba(5,22,26,0.7)',
  color: 'var(--text)',
  textDecoration: 'none',
};

const infoCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  borderRadius: 12,
  padding: 12,
  border: '1px solid rgba(92,224,255,0.25)',
  background: 'rgba(5,22,26,0.55)',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
  fontWeight: 700,
};
