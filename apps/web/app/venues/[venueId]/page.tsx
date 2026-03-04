import { VenueDetailsPanel } from '@/components/venues/VenueDetailsPanel';

type VenuePageProps = {
  params: Promise<{ venueId: string }>;
};

export default async function VenuePage({ params }: VenuePageProps) {
  const { venueId } = await params;
  return <VenueDetailsPanel venueId={venueId} />;
}
