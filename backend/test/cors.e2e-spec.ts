import { INestApplication } from '@nestjs/common';
import { createApp } from './helpers/app.js';

describe('CORS (e2e)', () => {
  const saved = process.env.FRONTEND_ORIGIN;
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    if (saved === undefined) delete process.env.FRONTEND_ORIGIN;
    else process.env.FRONTEND_ORIGIN = saved;
  });

  async function allowOrigin(): Promise<string | null> {
    const created = await createApp();
    app = created.app;
    const res = await fetch(`${created.url}/api`, {
      headers: { Origin: 'http://evil.example' },
    });
    return res.headers.get('access-control-allow-origin');
  }

  it('sends no Access-Control-Allow-Origin when FRONTEND_ORIGIN is unset', async () => {
    delete process.env.FRONTEND_ORIGIN;
    expect(await allowOrigin()).toBeNull();
  });

  it('allows only FRONTEND_ORIGIN when it is set', async () => {
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    expect(await allowOrigin()).toBe('http://localhost:5173');
  });
});
