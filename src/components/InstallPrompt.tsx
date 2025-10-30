import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-card border rounded-lg shadow-lg p-4 z-50 flex items-center gap-3">
      <Download className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-sm">تثبيت التطبيق</p>
        <p className="text-xs text-muted-foreground">استخدم التطبيق دون اتصال بالإنترنت</p>
      </div>
      <Button onClick={handleInstall} size="sm">
        تثبيت
      </Button>
      <Button 
        onClick={() => setShowPrompt(false)} 
        variant="ghost" 
        size="sm"
        className="p-2"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
