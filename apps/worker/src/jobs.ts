import { closeExpireHoldsJob, runExpireHoldsJob } from './jobs/expireHolds.job';
import {
  closeLeaderboardSnapshotJob,
  runLeaderboardSnapshotJob,
} from './jobs/leaderboardSnapshot.job';

let expireIntervalHandle: NodeJS.Timeout | null = null;
let hourlyLeaderboardHandle: NodeJS.Timeout | null = null;
let dailyLeaderboardHandle: NodeJS.Timeout | null = null;

export async function startJobs(): Promise<void> {
  await runExpireHoldsJob();
  await runLeaderboardSnapshotJob();

  expireIntervalHandle = setInterval(async () => {
    try {
      const expired = await runExpireHoldsJob();
      if (expired > 0) {
        // eslint-disable-next-line no-console
        console.log(`[worker] expired held bookings: ${expired}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[worker] expire holds failed', error);
    }
  }, 60_000);

  hourlyLeaderboardHandle = setInterval(async () => {
    try {
      const written = await runLeaderboardSnapshotJob();
      // eslint-disable-next-line no-console
      console.log(`[worker] leaderboard snapshots (hourly) written: ${written}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[worker] leaderboard snapshot hourly failed', error);
    }
  }, 60 * 60 * 1000);

  dailyLeaderboardHandle = setInterval(async () => {
    try {
      const written = await runLeaderboardSnapshotJob();
      // eslint-disable-next-line no-console
      console.log(`[worker] leaderboard snapshots (daily) written: ${written}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[worker] leaderboard snapshot daily failed', error);
    }
  }, 24 * 60 * 60 * 1000);
}

export async function stopJobs(): Promise<void> {
  if (expireIntervalHandle) {
    clearInterval(expireIntervalHandle);
    expireIntervalHandle = null;
  }
  if (hourlyLeaderboardHandle) {
    clearInterval(hourlyLeaderboardHandle);
    hourlyLeaderboardHandle = null;
  }
  if (dailyLeaderboardHandle) {
    clearInterval(dailyLeaderboardHandle);
    dailyLeaderboardHandle = null;
  }
  await closeExpireHoldsJob();
  await closeLeaderboardSnapshotJob();
}
