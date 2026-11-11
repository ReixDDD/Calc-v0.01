import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiFetch,
  apiJson,
  normalizeBearerToken,
  resolveApiUrl,
  subscribeUnauthorized,
} from './apiClient';

test('normalizeBearerToken strips redundant Bearer prefix and whitespace', () => {
  assert.equal(normalizeBearerToken('  Bearer   abc.123  '), 'abc.123');
  assert.equal(normalizeBearerToken('bearer xyz'), 'xyz');
  assert.equal(normalizeBearerToken('plain-token'), 'plain-token');
  assert.equal(normalizeBearerToken('   '), '');
  assert.equal(normalizeBearerToken(undefined), '');
});

test('resolveApiUrl joins relative API paths cleanly and blocks non-loopback HTTP URLs', () => {
  assert.equal(resolveApiUrl('/catalog', '/api'), '/api/catalog');
  assert.equal(resolveApiUrl('orders/my', '/api/'), '/api/orders/my');
  assert.equal(
    resolveApiUrl('https://example.com/custom', '/api'),
    'https://example.com/custom'
  );
  assert.equal(
    resolveApiUrl('/catalog', 'http://localhost:5000/api'),
    'http://localhost:5000/api/catalog'
  );
  assert.equal(
    resolveApiUrl('/catalog', 'http://127.0.0.1:5000/api'),
    'http://127.0.0.1:5000/api/catalog'
  );
  assert.throws(
    () => resolveApiUrl('http://example.com/api/orders', '/api'),
    /HTTPS/
  );
  assert.throws(
    () => resolveApiUrl('/orders', 'http://example.com/api'),
    /HTTPS/
  );
});

test('apiFetch serializes json, sets Authorization Bearer, and preserves custom headers', async (t) => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const res = await apiFetch('/orders', {
    method: 'POST',
    token: 'Bearer my-secret-token',
    headers: { 'Idempotency-Key': 'idem-42' },
    json: { client_name: 'Иван', items: [1, 2] },
  });

  assert.equal(res.status, 200);
  assert.equal(capturedUrl, '/api/orders');
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get('Authorization'), 'Bearer my-secret-token');
  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.equal(headers.get('Idempotency-Key'), 'idem-42');
  assert.equal(capturedInit?.body, JSON.stringify({ client_name: 'Иван', items: [1, 2] }));
});

test('apiFetch preserves FormData without forcing application/json Content-Type', async (t) => {
  const originalFetch = globalThis.fetch;
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedInit = init;
    return new Response(JSON.stringify({ urls: ['/uploads/a.png'] }), { status: 200 });
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const formData = new FormData();
  formData.append('field', 'value');

  await apiFetch('/admin/upload', {
    method: 'POST',
    token: 'adm-token',
    body: formData,
  });

  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get('Authorization'), 'Bearer adm-token');
  assert.equal(headers.get('Content-Type'), null);
  assert.equal(capturedInit?.body, formData);
});

test('apiFetch notifies subscribeUnauthorized only for authenticated 401 responses', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const events: Array<{ token: string; path: string }> = [];
  const unsubscribe = subscribeUnauthorized((token, path) => {
    events.push({ token, path });
  });
  t.after(unsubscribe);

  // 1) Anonymous 401 -> should NOT fire
  await apiFetch('/orders/my');
  assert.equal(events.length, 0);

  // 2) Login 401 even if header passed -> should NOT fire
  await apiFetch('/auth/login', { method: 'POST', token: 'old-tok', json: {} });
  assert.equal(events.length, 0);

  // 3) skipAuthRedirect: true -> should NOT fire
  await apiFetch('/auth/me', { token: 'startup-tok', skipAuthRedirect: true });
  assert.equal(events.length, 0);

  // 4) Authenticated protected endpoint returning 401 -> MUST fire with normalized token
  await apiFetch('/crm/orders?limit=10', { token: 'Bearer expired-jwt-token' });
  assert.deepEqual(events, [{ token: 'expired-jwt-token', path: '/crm/orders' }]);
});

test('apiJson parses JSON payload and falls back gracefully on invalid body', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('not-json', { status: 502 })) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await apiJson<{ items: string[] }>('/broken', {}, { items: [] });
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.deepEqual(result.data, { items: [] });
});
