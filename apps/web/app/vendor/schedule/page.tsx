import { VendorSchedulePanel } from '@/components/vendor/VendorSchedulePanel';

type VendorSchedulePageProps = {
  searchParams: Promise<{ matchId?: string }>;
};

export default async function VendorSchedulePage({ searchParams }: VendorSchedulePageProps) {
  const { matchId } = await searchParams;
  return <VendorSchedulePanel initialMatchId={matchId} />;
}
