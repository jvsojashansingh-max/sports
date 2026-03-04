export function deriveChallengeTimes(params: {
  startTs: Date;
  joinDeadlineMinutes: number;
  checkinOpenMinutes: number;
}) {
  return {
    joinDeadlineTs: new Date(params.startTs.getTime() - params.joinDeadlineMinutes * 60_000),
    checkinOpenTs: new Date(params.startTs.getTime() - params.checkinOpenMinutes * 60_000),
  };
}
