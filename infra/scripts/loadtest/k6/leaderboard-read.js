import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:4000/api';
const accessToken = __ENV.ACCESS_TOKEN;
const sportId = __ENV.SPORT_ID;
const scope = __ENV.SCOPE || 'ALL';
const windowName = __ENV.WINDOW || 'ALL_TIME';
const geoId = __ENV.GEO_ID || '';

if (!accessToken || !sportId) {
  throw new Error('ACCESS_TOKEN and SPORT_ID are required');
}

export const options = {
  vus: Number(__ENV.VUS || 60),
  duration: __ENV.DURATION || '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
};

export default function run() {
  const geoParam = geoId ? `&geoId=${encodeURIComponent(geoId)}` : '';
  const url =
    `${baseUrl}/leaderboards?sportId=${encodeURIComponent(sportId)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&window=${encodeURIComponent(windowName)}` +
    geoParam;

  const response = http.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  check(response, {
    'leaderboard status 200': (res) => res.status === 200,
  });

  sleep(Number(__ENV.SLEEP_SECONDS || 0.15));
}
