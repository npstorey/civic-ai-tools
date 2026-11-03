#!/usr/bin/env python3
"""S1 G0-6(2): read the MCP Registry for P1 (hub #302). Owner-run: every sandbox refuses the host.
Written by CAT PLAN (Opus 5.5) on 2026-11-03 from ORCH S1's G0 report (#302 comment 6591723725) and the registry's
published OpenAPI (docs/reference/api/openapi.yaml: `cursor` takes metadata.nextCursor; null or empty means no more).
Writes only OUT (default ~/code/civic-ai-tools/benchmark/_local/registry): one file per page, and fetch-log.tsv.
  Q1 list-NNN.json       version=latest&limit=100, following metadata.nextCursor, at most 1,000 pages
  Q2 versions-001.json   limit=100, one page, no version filter
  Q3 search-<term>-NNN   search=<term>&version=latest&limit=100, following cursors, at most 1,000 pages, ten terms
Stops on any status other than 200, a body that is not JSON, a cursor that repeats, a page with no entries that still
names a next cursor, or a chain past 1,000 pages (the first run, 2026-11-03, found the list longer than 100 pages:
10,000 distinct servers by "com.l"). One second between
requests. No key, nothing sent but the GET. Run: python3 <this file>"""
import datetime, hashlib, json, os, sys, time, urllib.error, urllib.parse, urllib.request

BASE = os.environ.get('REGFETCH_BASE', 'https://registry.modelcontextprotocol.io/v0.1/servers')
OUT = os.environ.get('OUT', os.path.expanduser('~/code/civic-ai-tools/benchmark/_local/registry'))
FIX = os.environ.get('REGFETCH_FIXTURES')  # the seat's tests only: bodies read from files, no network
SLEEP = float(os.environ.get('REGFETCH_SLEEP', '1'))
MAXPAGES = int(os.environ.get('REGFETCH_MAXPAGES', '1000'))
TERMS = ['gov', 'city', 'civic', 'open-data', 'opendata', 'socrata', 'ckan', 'census', 'municipal', 'public-data']


def stop(msg):
    print('STOPPED: ' + msg + '. Pages saved so far are kept under ' + OUT + '. Tell the seat.')
    sys.exit(1)


def get(url):
    if FIX:
        p = os.path.join(FIX, hashlib.sha256(url.encode()).hexdigest()[:16])
        if not os.path.exists(p + '.json'):
            return 404, b'{"fixture": "missing"}'
        status = int(open(p + '.status').read()) if os.path.exists(p + '.status') else 200
        return status, open(p + '.json', 'rb').read()
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        stop(url + ' failed: ' + repr(e)[:200])


if os.path.exists(OUT):
    print('STOPPED: ' + OUT + ' already exists; nothing fetched. Tell the seat.')
    sys.exit(1)
os.makedirs(OUT)
log = open(os.path.join(OUT, 'fetch-log.tsv'), 'w', encoding='utf-8')
log.write('query\tpage\turl\tstatus\ttime_utc\tbytes\tsha256\tfile\n')
state = {'requests': 0}


def run(name, params, follow):
    cursor, page, servers, seen = None, 0, 0, set()
    while True:
        page += 1
        if page > MAXPAGES:
            stop(name + ' still had a next cursor after ' + str(MAXPAGES) + ' pages')
        q = dict(params)
        if cursor:
            q['cursor'] = cursor
        url = BASE + '?' + urllib.parse.urlencode(q)
        if state['requests']:
            time.sleep(SLEEP)
        state['requests'] += 1
        status, body = get(url)
        when = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        fn = '%s-%03d.json' % (name, page)
        ok = status == 200
        log.write('\t'.join([name, str(page), url, str(status), when, str(len(body)),
                             hashlib.sha256(body).hexdigest(), fn if ok else '-']) + '\n')
        log.flush()
        if not ok:
            stop(url + ' returned HTTP ' + str(status))
        try:
            d = json.loads(body)
        except ValueError:
            stop(url + ' returned a body that is not JSON')
        open(os.path.join(OUT, fn), 'wb').write(body)
        n = len(d.get('servers') or [])
        servers += n
        nxt = (d.get('metadata') or {}).get('nextCursor')
        if not follow or not nxt:
            return page, servers
        if nxt in seen:
            stop(name + ' page ' + str(page) + ' repeated an earlier cursor')
        if n == 0:
            stop(name + ' page ' + str(page) + ' had no entries but named a next cursor')
        seen.add(nxt)
        cursor = nxt


summary = []
summary.append(('list',) + run('list', {'version': 'latest', 'limit': '100'}, True))
summary.append(('versions',) + run('versions', {'limit': '100'}, False))
for t in TERMS:
    summary.append(('search-' + t,) + run('search-' + t, {'search': t, 'version': 'latest', 'limit': '100'}, True))
log.close()
logsha = hashlib.sha256(open(os.path.join(OUT, 'fetch-log.tsv'), 'rb').read()).hexdigest()
print('OK: %d requests, all HTTP 200, saved under %s' % (state['requests'], OUT))
for name, pages, servers in summary:
    print('  %-20s %3d page(s), %5d server entries' % (name, pages, servers))
print('  fetch-log.tsv sha256 ' + logsha)
