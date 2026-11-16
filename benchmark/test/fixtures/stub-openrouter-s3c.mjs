// Loaded with `node --import` by the S3-C run tests (s3c-plan.test.mjs): S1's
// OpenRouter stub (stub-openrouter.mjs, unchanged), with two more replies so
// a stub row reaches its end through the runner:
//   - a request that carries no `tools` (the answering request) is answered
//     with a text;
//   - a request after the stub's result (a tool message holding it) is
//     answered with a text that says what could not be checked, on a
//     question about the Public Advocate; on any other question the loaded
//     source's tool is called again, so that row runs to the loop's bound.
// Every other request goes to S1's stub as before.

import './stub-openrouter.mjs';

const STUB_RESULT = 'The call ran and returned no rows.';
const s1Fetch = globalThis.fetch;
const reply = (body, message) =>
  new Response(
    JSON.stringify({
      id: 'stub-s3c',
      model: body.model,
      provider: 'StubProvider',
      choices: [{ index: 0, message: { role: 'assistant', content: null, ...message }, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }],
      usage: { prompt_tokens: Math.ceil(JSON.stringify(body).length / 4), completion_tokens: 20, total_tokens: 0, cost: 0.00001 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.pathname === '/api/v1/chat/completions' && init.method === 'POST') {
    const body = JSON.parse(init.body);
    const question = body.messages.find((m) => m.role === 'user')?.content ?? '';
    if (!body.tools) {
      if (process.env.STUB_LOG) (await import('node:fs')).appendFileSync(process.env.STUB_LOG, `${JSON.stringify(body)}\n`);
      return reply(body, { content: 'The data collected does not cover the question.' });
    }
    if (body.messages.some((m) => m.role === 'tool' && m.content === STUB_RESULT)) {
      if (process.env.STUB_LOG) (await import('node:fs')).appendFileSync(process.env.STUB_LOG, `${JSON.stringify(body)}\n`);
      if (/Public Advocate/.test(question)) return reply(body, { content: 'The records could not be checked: the call returned no rows.' });
      const loaded = body.tools.map((t) => t.function.name).find((n) => n.includes('__'));
      return reply(body, { tool_calls: [{ id: `again${body.messages.length}`, type: 'function', function: { name: loaded, arguments: '{}' } }] });
    }
  }
  return s1Fetch(input, init);
};
