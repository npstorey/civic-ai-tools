// Several routes to the same data (the route-identity design §2.6; the
// conventions ADR, ADR-0039).
//
// Every inventory entry states the API it reads, `api`: a `platform`, and a
// `host` and a `dataset` where it reads one host or one dataset of it. Entry
// A *contains* entry B when their platforms are equal, A states no `host` or
// B's, and A states no `dataset` or B's. Two entries are routes to the same
// data when one contains the other.
//
// `routesByApi(inventory)` gives those groups and decides nothing: which
// route is offered is the router's own rule (the reference router offers
// every configured route and lets the model choose). One group per distinct
// `api` some entry states that contains another entry: the `api`, and the
// `sourceId` of every entry it contains, its own holders included, in the
// file's order. A group is left out when it has one member, or when
// it lists the same entries as an earlier group.
//
// Pure: it reads nothing but its argument.

/** The API an inventory entry reads. */
export interface ApiStatement {
  readonly platform: string;
  readonly host?: string;
  readonly dataset?: string;
}

/** One group of routes to the same data. */
export interface ApiRouteGroup {
  /** The containing API. */
  readonly api: ApiStatement;
  /** Every entry whose API it contains, by `sourceId`, in the file's order. */
  readonly sourceIds: readonly string[];
}

/** Whether `a` contains `b`. */
export function apiContains(a: ApiStatement, b: ApiStatement): boolean {
  return a.platform === b.platform && (a.host === undefined || a.host === b.host) && (a.dataset === undefined || a.dataset === b.dataset);
}

const text = (value: unknown): value is string => typeof value === 'string' && value !== '';

function apiOf(entry: { readonly alias?: unknown; readonly api?: unknown }, i: number): ApiStatement {
  const label = text(entry.alias) ? entry.alias : `entries[${i}]`;
  const api = entry.api as { platform?: unknown; host?: unknown; dataset?: unknown } | undefined;
  if (api === null || typeof api !== 'object' || Array.isArray(api) || !text(api.platform)) {
    throw new TypeError(`routesByApi: ${label}: api: an entry states its api, with a platform`);
  }
  for (const member of ['host', 'dataset'] as const) {
    if (api[member] !== undefined && !text(api[member])) throw new TypeError(`routesByApi: ${label}: api.${member}: is not a non-empty string`);
  }
  if (api.dataset !== undefined && api.host === undefined) throw new TypeError(`routesByApi: ${label}: api.dataset: a dataset is stated only with its host`);
  return {
    platform: api.platform,
    ...(api.host !== undefined ? { host: api.host as string } : {}),
    ...(api.dataset !== undefined ? { dataset: api.dataset as string } : {}),
  };
}

/** The groups of routes to the same data in `inventory`, in the file's
 *  order. Throws `TypeError` for an entry with no well-formed `api`. */
export function routesByApi(inventory: { readonly entries: readonly { readonly sourceId: string; readonly alias?: unknown; readonly api?: unknown }[] }): ApiRouteGroup[] {
  const entries = inventory.entries.map((entry, i) => ({ sourceId: entry.sourceId, api: apiOf(entry, i) }));
  const groups: ApiRouteGroup[] = [];
  const seen = new Set<string>();
  for (const { api } of entries) {
    const sourceIds = entries.filter((other) => apiContains(api, other.api)).map((other) => other.sourceId);
    const key = JSON.stringify(sourceIds);
    if (sourceIds.length < 2 || seen.has(key)) continue;
    seen.add(key);
    groups.push({ api, sourceIds });
  }
  return groups;
}
