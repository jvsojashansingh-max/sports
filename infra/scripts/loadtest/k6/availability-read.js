import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:4000/api';
const accessToken = __ENV.ACCESS_TOKEN;
const venueId = __ENV.VENUE_ID;
const date = __ENV.DATE;

if (!accessToken || !venueId || !date) {
  throw new Error('ACCESS_TOKEN, VENUE_ID, and DATE are required');
}

export const options = {
  vus: Number(__ENV.VUS || 40),
  duration: __ENV.DURATION || '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function run() {
  const url = `${baseUrl}/venues/${encodeURIComponent(venueId)}/availability?date=${encodeURIComponent(date)}`;
  const response = http.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  check(response, {
    'availability status 200': (res) => res.status === 200,
  });

  sleep(Number(__ENV.SLEEP_SECONDS || 0.25));
}
