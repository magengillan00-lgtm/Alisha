'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Live2DViewerProps {
  avatarState: AvatarState;
  modelPath: string;
}

// Move updateModelMotion outside the component as a standalone function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateModelMotion(
  model: any,
  state: AvatarState,
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  if (!model) return;

  try {
    const coreModel = model.internalModel?.coreModel;
    if (!coreModel) return;

    switch (state) {
      case 'idle': {
        // Gentle body sway
        const breathY = Math.sin(Date.now() / 1000) * 2;
        const breathX = Math.sin(Date.now() / 2000) * 0.5;
        model.y = ((canvasRef.current?.width || 400) / 2) + model.height * model.scale.x * 0.1 + breathY;
        model.x = (canvasRef.current?.width || 400) / 2 + breathX;

        // Reset mouth
        if (coreModel.setParameterValueById) {
          coreModel.setParameterValueById('ParamMouthOpenY', 0);
        }
        break;
      }
      case 'listening': {
        // Subtle head movement
        const listenX = Math.sin(Date.now() / 500) * 3;
        const listenY = Math.sin(Date.now() / 800) * 1;
        model.x = (canvasRef.current?.width || 400) / 2 + listenX;
        model.y = ((canvasRef.current?.height || 600) / 2) + model.height * model.scale.x * 0.1 + listenY;

        // Slight mouth open (like listening)
        if (coreModel.setParameterValueById) {
          coreModel.setParameterValueById('ParamMouthOpenY', 0.1);
        }
        break;
      }
      case 'thinking': {
        // Head tilts
        const thinkAngle = Math.sin(Date.now() / 1200) * 15;
        if (coreModel.setParameterValueById) {
          coreModel.setParameterValueById('ParamAngleX', thinkAngle);
          coreModel.setParameterValueById('ParamAngleY', Math.sin(Date.now() / 800) * 5);
          coreModel.setParameterValueById('ParamMouthOpenY', 0.05);
        }
        break;
      }
      case 'speaking': {
        // Lip sync animation
        if (coreModel.setParameterValueById) {
          const mouthValue = Math.abs(Math.sin(Date.now() / 150)) * 0.8 + 0.1;
          coreModel.setParameterValueById('ParamMouthOpenY', mouthValue);
          coreModel.setParameterValueById('ParamMouthForm', Math.sin(Date.now() / 300) * 0.3);
        }
        break;
      }
    }
  } catch (_e) {
    // Silently handle parameter errors
  }
}

export default function Live2DViewer({ avatarState, modelPath }: Live2DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<unknown>(null);
  const modelRef = useRef<unknown>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const avatarStateRef = useRef(avatarState);

  // Keep avatarState in a ref so the animation loop always uses latest value
  useEffect(() => {
    avatarStateRef.current = avatarState;
  }, [avatarState]);

  const initLive2D = useCallback(async () => {
    try {
      // Wait for PIXI and Live2D to be available
      const maxWait = 15000;
      const startTime = Date.now();

      while (startTime + maxWait > Date.now()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (w.PIXI && w.PIXI.live2d && w.Live2DCubismCore) {
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (!w.PIXI || !w.PIXI.live2d || !w.Live2DCubismCore) {
        setLoadError('Live2D SDK not loaded');
        return;
      }

      const PIXI = w.PIXI;
      const { Live2DModel } = PIXI.live2d;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Destroy existing app
      if (appRef.current) {
        (appRef.current as { destroy: (removeView?: boolean) => void }).destroy(true);
        appRef.current = null;
      }

      const app = new PIXI.Application({
        view: canvas,
        transparent: true,
        autoStart: true,
        resizeTo: canvas.parentElement || undefined,
        backgroundAlpha: 0,
      });
      appRef.current = app;

      // Load model
      const model = await Live2DModel.from(modelPath, { autoInteract: false });
      modelRef.current = model;

      // Scale model to fit
      const scaleX = (canvas.width || 400) / model.width * 0.8;
      const scaleY = (canvas.height || 600) / model.height * 0.8;
      const scale = Math.min(scaleX, scaleY, 0.5);
      model.scale.set(scale);
      model.anchor.set(0.5, 0.5);
      model.x = (canvas.width || 400) / 2;
      model.y = (canvas.height || 600) / 2 + model.height * scale * 0.1;

      app.stage.addChild(model);

      // Start animation loop for avatar states
      timeRef.current = Date.now();
      const animate = () => {
        updateModelMotion(model, avatarStateRef.current, canvasRef);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);

      setIsLoaded(true);
      setLoadError(null);
    } catch (err) {
      console.error('Live2D init error:', err);
      setLoadError('Failed to load Live2D model');
    }
  }, [modelPath]);

  useEffect(() => {
    initLive2D();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (appRef.current) {
        (appRef.current as { destroy: (removeView?: boolean) => void }).destroy(true);
        appRef.current = null;
      }
    };
  }, [initLive2D]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={500}
        height={650}
        className="max-w-full max-h-full"
      />
      {!isLoaded && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">جاري تحميل الأفاتار...</p>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm text-destructive">{loadError}</p>
        </div>
      )}
      {isLoaded && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <StatusBadge state={avatarState} />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ state }: { state: AvatarState }) {
  const config: Record<AvatarState, { label: string; color: string; icon: string }> = {
    idle: { label: 'في انتظارك', color: 'bg-gray-500', icon: '😴' },
    listening: { label: 'أستمع...', color: 'bg-emerald-500', icon: '🎤' },
    thinking: { label: 'أفكر...', color: 'bg-amber-500', icon: '🤔' },
    speaking: { label: 'أتكلم...', color: 'bg-rose-500', icon: '🔊' },
  };

  const c = config[state];

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${c.color} text-white text-sm font-medium shadow-lg backdrop-blur-sm`}>
      <span>{c.icon}</span>
      <span>{c.label}</span>
      {state === 'listening' && (
        <span className="flex gap-0.5">
          <span className="w-1 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
        </span>
      )}
    </div>
  );
}
