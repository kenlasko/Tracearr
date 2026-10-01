import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import type { Server, ServerConnectionStatus } from '@tracearr/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ISSUE_KEYS = {
  blocked: 'servers.realtimeDialog.issueBlocked',
  restart_required: 'servers.realtimeDialog.issueRestartRequired',
  malfunctioned: 'servers.realtimeDialog.issueMalfunctioned',
} as const;

export function RealtimeSetupDialog({
  server,
  open,
  onClose,
  mode = 'setup',
  connectionStatus,
}: {
  server: Server;
  open: boolean;
  onClose: () => void;
  mode?: 'setup' | 'update';
  connectionStatus?: ServerConnectionStatus;
}) {
  const { t } = useTranslation(['settings', 'common']);
  const repoUrl = t('servers.realtimeDialog.jellyfinRepoUrl');
  const issueKey =
    connectionStatus?.pluginIssue && connectionStatus.pluginIssue in ISSUE_KEYS
      ? ISSUE_KEYS[connectionStatus.pluginIssue as keyof typeof ISSUE_KEYS]
      : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'update'
              ? t('servers.realtimeDialog.updateTitle')
              : t('servers.realtimeDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {server.type === 'jellyfin'
              ? mode === 'update'
                ? t('servers.realtimeDialog.jellyfinUpdateDescription')
                : t('servers.realtimeDialog.jellyfinDescription')
              : mode === 'update'
                ? t('servers.realtimeDialog.embyUpdateDescription')
                : t('servers.realtimeDialog.embyDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="text-muted-foreground space-y-3 text-sm">
          {issueKey && (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertDescription>
                <span>{t(issueKey)}</span>
                {connectionStatus?.error && (
                  <code className="text-muted-foreground block truncate text-xs">
                    {connectionStatus.error}
                  </code>
                )}
              </AlertDescription>
            </Alert>
          )}
          {server.type === 'jellyfin' ? (
            <>
              <ol className="list-decimal space-y-2 pl-4">
                <li>In your Jellyfin dashboard, go to Plugins &rarr; Repositories.</li>
                <li>
                  Add a repository named <strong>Tracearr</strong> with the URL below.
                </li>
                <li>
                  Open the Catalog tab and install <strong>Tracearr SSE</strong>.
                </li>
                <li>Restart Jellyfin, and Tracearr will detect it automatically.</li>
              </ol>
              <div className="space-y-1">
                <p className="text-foreground text-xs font-medium">
                  {t('servers.realtimeDialog.repositoryUrl')}
                </p>
                <div className="flex items-center gap-2">
                  <code className="bg-muted flex-1 truncate rounded px-2 py-1 text-xs">
                    {repoUrl}
                  </code>
                  <CopyButton
                    value={repoUrl}
                    label={t('servers.realtimeDialog.copyUrl')}
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                  />
                </div>
              </div>
            </>
          ) : (
            <ol className="list-decimal space-y-2 pl-4">
              <li>In your Emby dashboard, go to Plugins &rarr; Catalog.</li>
              <li>
                Find <strong>Tracearr SSE</strong> in the Notifications row and install it.
              </li>
              <li>Restart Emby, and Tracearr will detect it automatically.</li>
            </ol>
          )}
          <p className="text-xs">{t('servers.realtimeDialog.autoDetectNote')}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common:actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
