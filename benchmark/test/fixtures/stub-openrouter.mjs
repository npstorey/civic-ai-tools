// Loaded with `node --import` by the run tests, or imported by a test that
// drives the engine in its own process: OpenRouter, stubbed in the process.
// `fetch` answers the paths the runner calls (the model list, each model's
// endpoints list, the key check, chat completions) with canned replies and
// refuses anything else; no socket is opened. Each chat request body is
// appended to the file STUB_LOG names, so a test can read what was sent.
//
// The canned replies exercise every configuration's path:
//   - a first request with `load_source` alone: a question about the Public
//     Advocate loads `nyc_charter` (or the enum's first alias when it is not
//     listed); any other question loads `boston` (outside baseline-7's
//     directory) and `data_commons` (or the enum's first alias);
//   - with `find_source` beside it: the first request searches; the next
//     loads the first alias the search returned (or the enum's first);
//   - with `select_sources` (the builder): two aliases of the inventory and
//     one that is not;
//   - a request after a load: a tool call, valid on the Public Advocate
//     question and schema-invalid otherwise;
//   - a baseline that returns no usage at one token;
//   - a cost float with a long digit run, and a long digit run inside the
//     model's text (made by `repeat`, so none is written here).
// Markers in a question's text drive the A3.2 tests: `[stub:no-usage]` (a
// reply with no usage), `[stub:status=<n>]` (that HTTP status, every time),
// `[stub:billed=<n>]` (that many billed prompt tokens).
//
// STUB_PERTURB=1 perturbs the replies the way a real run's rows differ from
// the stub's, keyed on the question's id (its number n: q07 is 7), which the
// stub reads from benchmark/questions/7.json by the question's text; no
// question text carries a marker and no input file changes. Under it:
//   - n % 20 = 3:  HTTP 500 on the row's first request, every attempt (an
//                  error row; the builder's request is a first request);
//   - n % 20 = 7:  HTTP 500 on the request after a load (an error row after
//                  a charged first request);
//   - n % 20 = 13: every reply with no usage (charged at its reservation);
//   - n % 20 = 17: usage with no reported cost (the dearest endpoint's);
//   - every question's reply: billed prompt tokens at 3.5 to 4.1 characters
//                  a token by n, completion tokens 15 to 314 by n, reasoning
//                  tokens on every third question, and OpenRouter's usage
//                  details, with a reported cost that is a float.
// The probes' question ids (q11, q34, q39) fall in no failing class. The
// engine's waits between attempts (2 s, 8 s) are cut to none, so a 500's
// three attempts take no time; a request's own timeout is AbortSignal's, not
// setTimeout, and is untouched.

import { appendFileSync, readFileSync } from 'node:fs';

const KEY = 'stub-not-a-credential';
const LONG_COST = 0.1 + 0.2;
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const toolCall = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });

const PARAMS = ['max_tokens', 'reasoning', 'reasoning_effort', 'tool_choice', 'tools'];
const HAIKU_PRICING = { prompt: '0.0000001', completion: '0.0000005', input_cache_read: '0.00000001', overrides: [{ min_prompt_tokens: 100000, prompt: '0.0000005', completion: '0.0000025', input_cache_read: '0.00000005' }] };
const MODELS = [
  { id: 'anthropic/claude-haiku-5.5', context_length: 1000000, pricing: HAIKU_PRICING, supported_parameters: ['max_completion_tokens', ...PARAMS], reasoning: { supported_efforts: ['low', 'medium', 'high'] } },
  { id: 'z-ai/glm-5.3-flash', context_length: 1048576, pricing: { prompt: '0.0000000313', completion: '0.0000000846' }, supported_parameters: PARAMS, reasoning: { mandatory: true, supported_efforts: ['max', 'high', 'low'] } },
  { id: 'deepseek/deepseek-v4-flash-0731', context_length: 1048576, pricing: { prompt: '0.000000059', completion: '0.0000003' }, supported_parameters: PARAMS, reasoning: { supported_efforts: ['max', 'high', 'low', 'none'] } },
  { id: 'xiaomi/mimo-v2.6-flash', context_length: 1050000, pricing: { prompt: '0.00000014', completion: '0.00000028' }, supported_parameters: PARAMS.filter((p) => p !== 'reasoning_effort'), reasoning: { mandatory: false } },
  { id: 'qwen/qwen3.8-flash', context_length: 1000000, pricing: { prompt: '0.00000015', completion: '0.00000047' }, supported_parameters: PARAMS.filter((p) => p !== 'reasoning_effort'), reasoning: { mandatory: false } },
];
const endpoint = (m, tag, pricing) => ({ provider_name: tag, tag, quantization: 'unknown', status: 0, context_length: m.context_length, max_completion_tokens: 131072, pricing: { ...pricing, discount: 0 }, supported_parameters: m.supported_parameters });
const ENDPOINTS = Object.fromEntries(
  MODELS.map((m) => [
    m.id,
    m.id.startsWith('anthropic/')
      ? [endpoint(m, 'anthropic', HAIKU_PRICING), endpoint(m, 'regional', { prompt: '0.00000011', completion: '0.00000055', overrides: [{ min_prompt_tokens: 100000, prompt: '0.00000055', completion: '0.00000275' }] })]
      : [endpoint(m, 'cheap', m.pricing), endpoint(m, 'dear', { prompt: '0.0000002', completion: '0.0000009' })],
  ]),
);

const PERTURB = process.env.STUB_PERTURB === '1';
const QUESTIONS = PERTURB ? JSON.parse(readFileSync(new URL('../../questions/7.json', import.meta.url), 'utf8')).questions : [];
const ID_OF_TEXT = new Map(QUESTIONS.map((q) => [q.text, q.id]));
/** The number of the question a request's user message carries: the
 *  message itself, or (the builder's) a message that holds it. */
const questionNumber = (content) => {
  const id = ID_OF_TEXT.get(content) ?? QUESTIONS.filter((q) => content.includes(q.text)).sort((a, b) => b.text.length - a.text.length)[0]?.id;
  return id ? Number(id.slice(1)) : null;
};
if (PERTURB) {
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, ms >= 1000 ? 0 : ms, ...args);
}
/** A perturbed reply's usage for question number `n`, or null for none. */
const perturbedUsage = (body, n) => {
  if (n % 20 === 13) return null;
  const prompt = Math.ceil(JSON.stringify(body).length / (3.5 + (n % 7) / 10));
  const completion = 15 + ((n * 37) % 300);
  const reasoning = n % 3 === 0 ? (n * 11) % completion : 0;
  const promptCost = prompt * 1.3e-7;
  const completionCost = completion * 4.1e-7;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
    ...(n % 20 === 17 ? {} : { cost: promptCost + completionCost }),
    is_byok: false,
    prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 0, audio_tokens: 0, video_tokens: 0 },
    ...(n % 20 === 17 ? {} : { cost_details: { upstream_inference_cost: promptCost + completionCost, upstream_inference_prompt_cost: promptCost, upstream_inference_completions_cost: completionCost } }),
    completion_tokens_details: { reasoning_tokens: reasoning, image_tokens: 0, audio_tokens: 0 },
  };
};

const marker = (text, name) => new RegExp(`\\[stub:${name}(?:=(\\d+))?\\]`).exec(text);
const completion = (body, message, question, n = null) => {
  const billed = marker(question, 'billed');
  const usage = n !== null
    ? perturbedUsage(body, n)
    : marker(question, 'no-usage')
      ? null
      : { prompt_tokens: billed ? Number(billed[1]) : Math.ceil(JSON.stringify(body).length / 4), completion_tokens: 20, total_tokens: 0, cost: LONG_COST / 1000 };
  return {
    id: 'stub',
    model: body.model,
    choices: [{ index: 0, message: { role: 'assistant', content: null, ...message }, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }],
    ...(usage ? { usage } : {}),
  };
};

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.host !== 'openrouter.ai') throw new Error(`stub: refused ${url.host}`);
  if (url.pathname === '/api/v1/models') return reply(200, { data: MODELS });
  const ep = /^\/api\/v1\/models\/(.+)\/endpoints$/.exec(url.pathname);
  if (ep) return ENDPOINTS[ep[1]] ? reply(200, { data: { id: ep[1], endpoints: ENDPOINTS[ep[1]] } }) : reply(404, { error: { message: 'no such model' } });
  const auth = new Headers(init.headers ?? {}).get('authorization');
  if (url.pathname === '/api/v1/key') return auth === `Bearer ${KEY}` ? reply(200, { data: { limit_remaining: null } }) : reply(401, { error: { message: 'bad key' } });
  if (url.pathname !== '/api/v1/chat/completions' || init.method !== 'POST') return reply(404, { error: { message: 'no such path' } });
  if (auth !== `Bearer ${KEY}`) return reply(401, { error: { message: 'bad key' } });
  const body = JSON.parse(init.body);
  if (process.env.STUB_LOG) appendFileSync(process.env.STUB_LOG, `${JSON.stringify(body)}\n`);
  const question = body.messages.find((m) => m.role === 'user')?.content ?? '';
  const status = marker(question, 'status');
  if (status) return reply(Number(status[1]), { error: { message: `stub status ${status[1]}` } });
  const names = (body.tools ?? []).map((t) => t.function.name);
  const n = PERTURB && question !== 'Hello.' ? questionNumber(question) : null;
  const firstRequest = !body.messages.some((m) => m.role === 'tool');
  const afterLoad = names.some((x) => x.includes('__'));
  if (n !== null && ((n % 20 === 3 && firstRequest) || (n % 20 === 7 && afterLoad))) return reply(500, { error: { message: 'stub status 500 (perturbed)' } });
  const done = (message) => reply(200, completion(body, message, question, n));
  if (question === 'Hello.') {
    const oneToken = (body.max_completion_tokens ?? body.max_tokens) === 1;
    return reply(200, completion(body, { content: 'Hi' }, oneToken ? '[stub:no-usage]' : ''));
  }
  if (names.includes('select_sources')) {
    return done({ tool_calls: [toolCall('b1', 'select_sources', { aliases: ['socrata', 'nyc_charter', 'not_an_alias', 'socrata'] })] });
  }
  const enumOf = () => body.tools.find((t) => t.function.name === 'load_source')?.function.parameters.properties.alias.enum ?? [];
  const toolResults = body.messages.filter((m) => m.role === 'tool');
  const hasLoadedTools = names.some((n) => n.includes('__'));
  if (!hasLoadedTools && names.includes('find_source')) {
    if (!toolResults.length) return done({ tool_calls: [toolCall('s1', 'find_source', { query: question })] });
    const found = /`([a-z0-9_]+)`/.exec(toolResults.at(-1).content);
    const alias = found && enumOf().includes(found[1]) ? found[1] : enumOf()[0];
    return done({ tool_calls: [toolCall('l1', 'load_source', { alias })] });
  }
  if (!hasLoadedTools) {
    const e = enumOf();
    if (/Public Advocate/.test(question)) return done({ tool_calls: [toolCall('c1', 'load_source', { alias: e.includes('nyc_charter') ? 'nyc_charter' : e[0] })] });
    return done({ tool_calls: [toolCall('c1', 'load_source', { alias: 'boston' }), toolCall('c2', 'load_source', { alias: e.includes('data_commons') ? 'data_commons' : e[0] })] });
  }
  const digits = `CT${'4'.repeat(5)}${'7'.repeat(10)}`;
  if (names.includes('nyc_charter__search')) return done({ content: `Looking up ${digits}.`, tool_calls: [toolCall('d1', 'nyc_charter__search', { query: 'Public Advocate' })] });
  return done({ tool_calls: [toolCall('d1', 'data_commons__search_indicators', {}), toolCall('d2', 'get_observations', {})] });
};
