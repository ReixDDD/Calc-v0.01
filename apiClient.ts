import { API_URL, isLoopbackHostname } from './constants';

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  json?: unknown;
  body?: BodyInit | null;
  skipAuthRedirect?: boolean;
}

export type UnauthorizedListener = (invalidToken: string, path: string) => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export function subscribeUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function normalizeBearerToken(rawToken?: string | null): string {
  if (!rawToken) return '';
  return rawToken.trim().replace(/^Bearer\s+/i, '').trim();
}

export function resolveApiUrl(path: string, baseUrl: string = API_URL): string {
  let resolved: string;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    resolved = path.trim();
  } else {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    resolved = `${baseUrl.replace(/\/+$/, '')}${normalizedPath}`;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(resolved)) {
    let parsed: URL;
    try {
      parsed = new URL(resolved);
    } catch {
      throw new Error('Некорректный URL запроса API');
    }
    if (parsed.protocol === 'https:') {
      return resolved;
    }
    if (parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname)) {
      return resolved;
    }
    throw new Error('Небезопасный HTTP URL запрещён: используйте HTTPS');
  }

  return resolved;
}

export async function apiFetch(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const { token, json, headers: rawHeaders, body: rawBody, skipAuthRedirect, ...rest } = options;

  const headers = new Headers(rawHeaders || undefined);
  let explicitBearer = normalizeBearerToken(token);
  if (!explicitBearer && headers.has('Authorization')) {
    explicitBearer = normalizeBearerToken(headers.get('Authorization'));
  }
  if (explicitBearer) {
    headers.set('Authorization', `Bearer ${explicitBearer}`);
  }

  let body: BodyInit | null | undefined = rawBody;
  if (json !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    body = JSON.stringify(json);
  }

  const url = resolveApiUrl(path);
  const response = await fetch(url, {
    ...rest,
    headers,
    body,
  });

  const cleanPath = path.split('?')[0] || '';
  if (
    response.status === 401 &&
    explicitBearer &&
    !skipAuthRedirect &&
    cleanPath !== '/auth/login' &&
    cleanPath !== '/auth/register'
  ) {
    unauthorizedListeners.forEach((listener) => {
      try {
        listener(explicitBearer, cleanPath);
      } catch {
        // Ignore listener errors so fetch resolution is unaffected
      }
    });
  }

  return response;
}

export interface ApiJsonResult<T> {
  ok: boolean;
  status: number;
  data: T;
  response: Response;
}

export async function apiJson<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
  fallbackData: T = {} as T
): Promise<ApiJsonResult<T>> {
  const response = await apiFetch(path, options);
  const data = (await response.json().catch(() => fallbackData)) as T;
  return {
    ok: response.ok,
    status: response.status,
    data,
    response,
  };
}
