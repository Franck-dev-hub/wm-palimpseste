import { vi } from 'vitest';

export type Reply =
  Response | Error | ((url: URL, init: RequestInit) => Response | Promise<Response>);

export const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

export const status = (code: number, headers: Record<string, string> = {}): Response =>
  new Response('', { status: code, headers });

export interface Call {
  url: URL;
  init: RequestInit;
}

// Replies in order; the last one repeats. Pass a function to answer by URL.
export function stubFetch(...replies: Reply[]): { calls: Call[] } {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL | string, init: RequestInit = {}) => {
      const url = new URL(input);
      calls.push({ url, init });
      if (init.signal?.aborted) throw init.signal.reason;
      const reply = replies[Math.min(calls.length, replies.length) - 1];
      if (reply === undefined) throw new Error('no reply stubbed');
      if (reply instanceof Error) throw reply;
      return typeof reply === 'function' ? reply(url, init) : reply.clone();
    }),
  );
  return { calls };
}
