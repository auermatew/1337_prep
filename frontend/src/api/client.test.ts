import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, cancelTask, createTask, taskEvents } from './client';

function stubFetch(status: number, body: string) {
  const fn = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('createTask POSTs JSON and returns the body', async () => {
    const task = { id: 'a', name: 'n' };
    const fn = stubFetch(201, JSON.stringify(task));
    const result = await createTask({ name: 'n', durationSeconds: 5 });
    expect(result).toEqual(task);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/tasks');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBe(
      'application/json',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'n',
      durationSeconds: 5,
    });
  });

  it('throws ApiError with validation messages on 400', async () => {
    const messages = ['name must be longer than or equal to 1 characters'];
    stubFetch(
      400,
      JSON.stringify({
        message: messages,
        error: 'Bad Request',
        statusCode: 400,
      }),
    );
    const err = await createTask({ name: '', durationSeconds: 1 }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.messages).toEqual(messages);
  });

  it('wraps a string message on 409', async () => {
    stubFetch(
      409,
      JSON.stringify({ message: 'Task is not running', statusCode: 409 }),
    );
    const err = await cancelTask('x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.messages).toEqual(['Task is not running']);
  });

  it('falls back to HTTP status for non-JSON error bodies', async () => {
    stubFetch(502, '<html>Bad Gateway</html>');
    const err = await taskEvents('x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.messages).toEqual(['HTTP 502']);
  });

  it('cancelTask POSTs to the cancel route', async () => {
    const fn = stubFetch(200, '{}');
    await cancelTask('x');
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/tasks/x/cancel');
    expect(init.method).toBe('POST');
  });

  it('taskEvents GETs the events route', async () => {
    const fn = stubFetch(200, '[]');
    await expect(taskEvents('x')).resolves.toEqual([]);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit?];
    expect(url).toBe('/api/tasks/x/events');
    expect(init?.method ?? 'GET').toBe('GET');
  });
});
