import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:4000/api';
const accessToken = __ENV.ACCESS_TOKEN;
const venueId = __ENV.VENUE_ID;
const resourceId = __ENV.RESOURCE_ID;
const sportId = __ENV.SPORT_ID;
const formatId = __ENV.FORMAT_ID;
const startTs = __ENV.START_TS;

if (!accessToken || !venueId || !resourceId || !sportId || !formatId || !startTs) {
  throw new Error('ACCESS_TOKEN, VENUE_ID, RESOURCE_ID, SPORT_ID, FORMAT_ID, and START_TS are required');
}

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || '2m',
  thresholds: {
    http_req_failed: ['rate<0.4'],
    http_req_duration: ['p(95)<600'],
  },
};

export default function run() {
  const payload = JSON.stringify({
    venueId,
    resourceId,
    sportId,
    formatId,
    startTs,
    teamMode: __ENV.TEAM_MODE || 'OWN_TEAM',
  });

  const response = http.post(`${baseUrl}/challenges`, payload, {
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      'idempotency-key': `${__VU}-${__ITER}-${Date.now()}`,
    },
  });

  check(response, {
    'challenge status 200|409': (res) => res.status === 200 || res.status === 409,
  });

  sleep(Number(__ENV.SLEEP_SECONDS || 0.5));
}
