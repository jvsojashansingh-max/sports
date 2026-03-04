import { startJobs, stopJobs } from './jobs';

async function bootstrap() {
  await startJobs();
  process.on('SIGINT', async () => {
    await stopJobs();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await stopJobs();
    process.exit(0);
  });
  // eslint-disable-next-line no-console
  console.log('worker started');
}

bootstrap();
