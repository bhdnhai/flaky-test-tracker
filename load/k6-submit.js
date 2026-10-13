// `npm run perf:load` (AC-34, NFR-01, design §2, §11). Run via `load/run-k6.sh`, which creates
// the Project and passes BASE_URL/TOKEN in. 10 requests/s for 60 s against the Compose stack,
// each submitting a ~1 MB Report with a fresh commit (so none hit the duplicate fast path).
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    submissions: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate==0'],
  },
};

const TARGET_BYTES = 1024 * 1024;

function buildReportBody() {
  const closing = '</testsuite></testsuites>';
  const parts = ['<testsuites><testsuite name="k6-load">'];
  let size = parts[0].length;
  let i = 0;
  while (size < TARGET_BYTES - closing.length) {
    const testcase = `<testcase classname="k6.load.Suite" name="case_${i}"/>`;
    parts.push(testcase);
    size += testcase.length;
    i++;
  }
  parts.push(closing);
  return parts.join('');
}

function randomCommitSha() {
  let sha = '';
  for (let i = 0; i < 40; i++) sha += Math.floor(Math.random() * 16).toString(16);
  return sha;
}

export function setup() {
  return { body: buildReportBody() };
}

export default function (data) {
  const url = `${__ENV.BASE_URL}/api/v1/reports?commit=${randomCommitSha()}&runId=k6&runAttempt=1&job=perf-load`;
  const res = http.post(url, data.body, {
    headers: {
      'Content-Type': 'application/xml',
      Authorization: `Bearer ${__ENV.TOKEN}`,
    },
  });
  check(res, { 'AC-34: status is 2xx': (r) => r.status >= 200 && r.status < 300 });
}
