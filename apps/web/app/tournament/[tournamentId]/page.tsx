import { TournamentDetailPanel } from '@/components/tournaments/TournamentDetailPanel';

type TournamentPageProps = {
  params: Promise<{ tournamentId: string }>;
};

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { tournamentId } = await params;
  return <TournamentDetailPanel tournamentId={tournamentId} />;
}
