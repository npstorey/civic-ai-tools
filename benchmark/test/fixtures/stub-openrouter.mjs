// Loaded with `node --import` by run-path.test.mjs: OpenRouter, stubbed in the
// process. `fetch` answers the three paths the runner calls (the model list,
// the key check, chat completions) with canned replies and refuses anything
// else; no socket is opened. Each chat request body is appended to the file
// STUB_LOG names, so the test can read what the runner sent.
//
// The canned replies exercise the run path: a load of a listed source, a load
// of an alias the directory does not list, a second request's tool call
// (valid on one question, schema-invalid on the other), a baseline that
// returns no usage at one token, a cost float with a long digit run, and a
// long digit run inside the model's text (made by `repeat`, so none is
// written here).

import { appendFileSync } from 'node:fs';

const KEY = 'stub-not-a-credential';
const LONG_COST = 0.1 + 0.2;
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const toolCall = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const completion = (body, message, usage = true) => ({
  id: 'stub',
  model: body.model,
  choices: [{ index: 0, message: { role: 'assistant', content: null, ...message }, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }],
  ...(usage ? { usage: { prompt_tokens: Math.ceil(JSON.stringify(body).length / 4), completion_tokens: 20, total_tokens: 0, cost: LONG_COST / 1000 } } : {}),
});

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.host !== 'openrouter.ai') throw new Error(`stub: refused ${url.host}`);
  if (url.pathname === '/api/v1/models') {
    return reply(200, {
      data: [
        {
          id: 'anthropic/claude-haiku-5.5',
          pricing: { prompt: '0.0000001', completion: '0.0000005', input_cache_read: '0.00000001', overrides: [{ min_prompt_tokens: 100000, prompt: '0.0000005', completion: '0.0000025', input_cache_read: '0.00000005' }] },
          supported_parameters: ['max_completion_tokens', 'max_tokens', 'reasoning_effort', 'tool_choice', 'tools'],
          reasoning: { supported_efforts: ['low', 'medium', 'high'] },
        },
      ],
    });
  }
  const auth = new Headers(init.headers ?? {}).get('authorization');
  if (url.pathname === '/api/v1/key') return auth === `Bearer ${KEY}` ? reply(200, { data: { limit_remaining: null } }) : reply(401, { error: { message: 'bad key' } });
  if (url.pathname !== '/api/v1/chat/completions' || init.method !== 'POST') return reply(404, { error: { message: 'no such path' } });
  if (auth !== `Bearer ${KEY}`) return reply(401, { error: { message: 'bad key' } });
  const body = JSON.parse(init.body);
  if (process.env.STUB_LOG) appendFileSync(process.env.STUB_LOG, `${JSON.stringify(body)}\n`);
  const question = body.messages.find((m) => m.role === 'user')?.content ?? '';
  const names = (body.tools ?? []).map((t) => t.function.name);
  if (question === 'Hello.') {
    const oneToken = (body.max_completion_tokens ?? body.max_tokens) === 1;
    return reply(200, completion(body, { content: 'Hi' }, !oneToken));
  }
  if (names.length === 1 && names[0] === 'load_source') {
    if (/Public Advocate/.test(question)) return reply(200, completion(body, { tool_calls: [toolCall('c1', 'load_source', { alias: 'nyc_charter' })] }));
    return reply(200, completion(body, { tool_calls: [toolCall('c1', 'load_source', { alias: 'boston' }), toolCall('c2', 'load_source', { alias: 'data_commons' })] }));
  }
  const digits = `CT${'4'.repeat(5)}${'7'.repeat(10)}`;
  if (names.includes('nyc_charter__search')) {
    return reply(200, completion(body, { content: `Looking up ${digits}.`, tool_calls: [toolCall('d1', 'nyc_charter__search', { query: 'Public Advocate' })] }));
  }
  return reply(200, completion(body, { tool_calls: [toolCall('d1', 'data_commons__search_indicators', {}), toolCall('d2', 'get_observations', {})] }));
};
