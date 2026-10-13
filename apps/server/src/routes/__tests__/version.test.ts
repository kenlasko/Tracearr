import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';

vi.mock('../../jobs/versionCheckQueue.js', () => ({
  getCurrentVersion: vi.fn(),
  getCurrentTag: vi.fn(),
  getCurrentCommit: vi.fn(),
  getBuildDate: vi.fn(),
  getCachedLatestVersion: vi.fn(),
  forceVersionCheck: vi.fn(),
}));

import {
  getCurrentVersion,
  getCurrentTag,
  getCurrentCommit,
  getBuildDate,
  getCachedLatestVersion,
} from '../../jobs/versionCheckQueue.js';
import { versionRoutes } from '../version.js';
import { permissionGuard } from '../../lib/scope.js';

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  app.decorate('authenticate', async () => {});
  app.decorate('requirePermission', permissionGuard(app));
  await app.register(versionRoutes, { prefix: '/version' });
  return app;
}

describe('version routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
    vi.clearAllMocks();
  });

  it('drops cached upgrade warnings for versions already installed', async () => {
    vi.mocked(getCurrentVersion).mockReturnValue('2.3.1');
    vi.mocked(getCurrentTag).mockReturnValue('v2.3.1');
    vi.mocked(getCurrentCommit).mockReturnValue(null);
    vi.mocked(getBuildDate).mockReturnValue(null);
    vi.mocked(getCachedLatestVersion).mockResolvedValue({
      version: '2.4.0',
      tag: 'v2.4.0',
      releaseUrl: 'https://example.test/releases/v2.4.0',
      publishedAt: '2026-01-01T00:00:00.000Z',
      checkedAt: '2026-01-01T00:00:00.000Z',
      isPrerelease: false,
      releaseName: null,
      releaseNotes: null,
      upgradeWarnings: [
        { version: '2.3.0', text: 'already installed' },
        { version: '2.4.0', text: 'still pending' },
      ],
    });

    app = await buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/version' });

    expect(response.statusCode).toBe(200);
    expect(response.json().latest.upgradeWarnings).toEqual([
      { version: '2.4.0', text: 'still pending' },
    ]);
  });
});
