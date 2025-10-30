import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSync } from '@/hooks/useSync';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const OnlineStatus = () => {
  const isOnline = useOnlineStatus();
  const { isSyncing } = useSync();

  return (
    <div className="flex items-center gap-2 text-sm">
      {isSyncing ? (
        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
      ) : isOnline ? (
        <Wifi className="h-4 w-4 text-green-500" />
      ) : (
        <WifiOff className="h-4 w-4 text-orange-500" />
      )}
      <span className="text-muted-foreground">
        {isSyncing ? 'جاري المزامنة...' : isOnline ? 'متصل' : 'غير متصل'}
      </span>
    </div>
  );
};
