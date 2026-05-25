'use client';

import { useAppStore } from '@/store/useAppStore';
import FreeKeysSelector from '@/components/FreeKeysSelector';
import ModelSelector from '@/components/ModelSelector';
import ChatView from '@/components/ChatView';

export default function Home() {
  const appState = useAppStore((s) => s.appState);

  return (
    <main className="min-h-screen">
      {appState === 'freeKeys' && <FreeKeysSelector />}
      {appState === 'selectModel' && <ModelSelector />}
      {appState === 'chat' && <ChatView />}
    </main>
  );
}
