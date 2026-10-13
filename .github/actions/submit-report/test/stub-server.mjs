// Stands in for the API's `POST /api/v1/reports` (AC-30 integration test): records exactly one
// request to `requestFile`, replies 202, then exits. Avoids a real server/Testcontainers Postgres
// since the test only needs to see what submit.sh sent.
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';

const [, , portFile, requestFile] = process.argv;

const server = createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    writeFileSync(
      requestFile,
      JSON.stringify({
        method: req.method,
        url: req.url,
        headers: req.headers,
        bodyLength: Buffer.concat(chunks).length,
      }),
    );
    res.writeHead(202, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'stub-report-id', processingState: 'pending', duplicate: false }));
    server.close();
  });
});

server.listen(0, '127.0.0.1', () => {
  writeFileSync(portFile, String(server.address().port));
});
