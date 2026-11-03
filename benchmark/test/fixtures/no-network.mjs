// Loaded with `node --import` by the benchmark's tests (A0.2), after the
// website's scripts/fixtures/eval-models/no-network.mjs: any network attempt,
// a fetch or a socket opened by anything else, throws, naming what was
// attempted. The dry run is run under it and must still exit 0.

import net from 'node:net';

function refuse(what) {
  throw new Error(`no-network preload: ${what} was attempted`);
}

globalThis.fetch = async (input) => refuse(`fetch ${typeof input === 'string' ? input : input?.url ?? input}`);
net.Socket.prototype.connect = function connect() {
  refuse('a socket connect');
};
