import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:4000/api';
const accessToken = __ENV.ACCESS_TOKEN;
const cityId = __ENV.CITY_ID;
const sportId = __ENV.SPORT_ID;
const fromTs = __ENV.FROM_TS;
const toTs = __ENV.TO_TS;

if (!accessToken || !cityId || !sportId || !fromTs || !toTs) {
  throw new Error('ACCESS_TOKEN, CITY_ID, SPORT_ID, FROM_TS, and TO_TS are required');
}

export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
};

export default function run() {
  const url =
    `${baseUrl}/lobby/challenges?cityId=${encodeURIComponent(cityId)}` +
    `&sportId=${encodeURIComponent(sportId)}` +
    `&fromTs=${encodeURIComponent(fromTs)}` +
    `&toTs=${encodeURIComponent(toTs)}`;
  const response = http.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  check(response, {
    'lobby status 200': (res) => res.status === 200,
  });

  sleep(Number(__ENV.SLEEP_SECONDS || 0.2));
}
