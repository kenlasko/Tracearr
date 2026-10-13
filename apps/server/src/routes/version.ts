/**
 * Version API Routes
 *
 * Provides version information and update status.
 */

import type { FastifyPluginAsync } from 'fastify';
import { isNewerVersion, isPrerelease, type VersionInfo } from '@tracearr/shared';
import {
  getCurrentVersion,
  getCurrentTag,
  getCurrentCommit,
  getBuildDate,
  getCachedLatestVersion,
  forceVersionCheck,
} from '../jobs/versionCheckQueue.js';

export const versionRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /version
   * Get current version info and update status
   * Public endpoint - no auth required (useful for health checks)
   */
  app.get<{
    Reply: VersionInfo;
  }>('/', async () => {
    const currentVersion = getCurrentVersion();
    const currentTag = getCurrentTag();
    const currentCommit = getCurrentCommit();
    const buildDate = getBuildDate();

    // Get cached latest version info
    const latestData = await getCachedLatestVersion();

    // Determine if update is available
    const updateAvailable = latestData ? isNewerVersion(latestData.version, currentVersion) : false;

    return {
      current: {
        version: currentVersion,
        tag: currentTag,
        commit: currentCommit,
        buildDate,
        isPrerelease: isPrerelease(currentVersion),
      },
      latest: latestData
        ? {
            version: latestData.version,
            tag: latestData.tag,
            releaseUrl: latestData.releaseUrl,
            publishedAt: latestData.publishedAt,
            isPrerelease: latestData.isPrerelease,
            releaseName: latestData.releaseName,
            releaseNotes: latestData.releaseNotes,
            upgradeWarnings: latestData.upgradeWarnings.filter((w) =>
              isNewerVersion(w.version, currentVersion)
            ),
          }
        : null,
      updateAvailable,
      lastChecked: latestData?.checkedAt ?? null,
    };
  });

  /**
   * POST /version/check
   * Force an immediate version check (admin only)
   */
  app.post('/check', {
    preHandler: [app.requirePermission('settings', 'read')],
    handler: async () => {
      await forceVersionCheck();

      return { message: 'Version check queued' };
    },
  });
};
