// Asserts the request stub-server.mjs captured matches AC-30: the request was built from only
// GITHUB_* variables and the token input, with no other configuration.
import { readFileSync } from 'node:fs';

const [, , requestFile] = process.argv;
const request = JSON.parse(readFileSync(requestFile, 'utf8'));
const url = new URL(request.url, 'http://stub.invalid');

const expected = {
  method: 'POST',
  path: '/api/v1/reports',
  commit: process.env.GITHUB_SHA,
  branch: process.env.GITHUB_REF_NAME,
  runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  job: process.env.GITHUB_JOB,
  authorization: `Bearer ${process.env.INPUT_TOKEN}`,
  contentType: 'application/xml',
};

const actual = {
  method: request.method,
  path: url.pathname,
  commit: url.searchParams.get('commit'),
  branch: url.searchParams.get('branch'),
  runId: url.searchParams.get('runId'),
  runAttempt: url.searchParams.get('runAttempt'),
  job: url.searchParams.get('job'),
  authorization: request.headers['authorization'],
  contentType: request.headers['content-type'],
};

const failures = Object.keys(expected).filter((key) => actual[key] !== expected[key]);
if (request.bodyLength === 0) failures.push('bodyLength');

if (failures.length > 0) {
  console.error('AC-30: FAIL — mismatched fields:', failures.join(', '));
  console.error('expected:', expected);
  console.error('actual:', actual);
  process.exit(1);
}

console.log('AC-30: ok — submitted using only GITHUB_* variables and the token secret');
