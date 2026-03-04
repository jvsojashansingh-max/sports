import { ChallengePanel } from '@/components/challenge/ChallengePanel';

type ChallengePageProps = {
  params: Promise<{ challengeId: string }>;
};

export default async function ChallengePage({ params }: ChallengePageProps) {
  const { challengeId } = await params;
  return <ChallengePanel challengeId={challengeId} />;
}
