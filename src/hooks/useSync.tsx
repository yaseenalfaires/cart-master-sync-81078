import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';
import { getSyncQueue, clearSyncQueueItem } from '@/lib/offlineStorage';
import { useToast } from '@/hooks/use-toast';

export const useSync = () => {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const syncData = async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    const queue = await getSyncQueue();
    
    if (queue.length === 0) {
      setIsSyncing(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const item of queue) {
      try {
        if (item.operation === 'insert') {
          await (supabase as any).from(item.table).insert(item.data);
        } else if (item.operation === 'update') {
          await (supabase as any).from(item.table).update(item.data).eq('id', item.data.id);
        } else if (item.operation === 'delete') {
          await (supabase as any).from(item.table).delete().eq('id', item.data.id);
        }
        
        await clearSyncQueueItem(item.id!);
        successCount++;
      } catch (error) {
        console.error('Sync error:', error);
        errorCount++;
      }
    }

    setIsSyncing(false);

    if (successCount > 0) {
      toast({
        title: 'تم المزامنة',
        description: `تم مزامنة ${successCount} عملية بنجاح`,
      });
    }

    if (errorCount > 0) {
      toast({
        title: 'خطأ في المزامنة',
        description: `فشلت ${errorCount} عملية`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (isOnline) {
      syncData();
    }
  }, [isOnline]);

  return { isSyncing, syncData };
};
