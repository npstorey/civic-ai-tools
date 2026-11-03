// The contact ledger (design §2.6, item 6): every host a run contacts and
// every request refused, written as the run goes. A `.md` file, because the
// hub ignores `*.log`. It records the method, the host and path, the status
// and the time; never a body, a header or the key.

import { appendFileSync, existsSync, writeFileSync } from 'node:fs';

export function openLedger(path, runId) {
  if (!existsSync(path)) {
    writeFileSync(
      path,
      [
        `# Contact ledger: ${runId}`,
        '',
        'Every request this run sent, as it was sent: the time it ended (UTC), the method, the host and path, and the',
        'HTTP status, or the error when no status came back. A status other than 2xx is a refused request. No body,',
        'header or key is recorded.',
        '',
        '| Ended (UTC) | Method | Host and path | Status |',
        '|---|---|---|---|',
        '',
      ].join('\n'),
      { flag: 'wx' },
    );
  }
  return {
    path,
    record(method, url, status) {
      const { host, pathname } = new URL(url);
      const cell = String(status).replaceAll('|', '/').replace(/\s+/g, ' ').slice(0, 160);
      appendFileSync(path, `| ${new Date().toISOString()} | ${method} | ${host}${pathname} | ${cell} |\n`);
    },
  };
}
