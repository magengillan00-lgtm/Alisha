'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Live2DViewerProps {
  avatarState: AvatarState;
  modelPath: string;
}

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
        const breathY = Math.sin(Date.now() / 1000) * 2;
        const breathX = Math.sin(Date.now() / 2000) * 0.5;
        model.y = ((canvasRef.current?.width || 400) / 2) + model.height * model.scale.x * 0.1 + breathY;
        model.x = (canvasRef.current?.width || 400) / 2 + breathX;
        if (coreModel.setParameterValueById) {
          coreModel.setParameterValueById('ParamMouthOpenY', 0);
        }
        break;
      }
      case 'listening': {
        const listenX = Math.sin(Date.now() / 500) * 3;
        const listenY = Math.sin(Date.now() / 800) * 1;
        model.x = (canvasRef.current?.width || 400) / 2 + listenX;
        model.y = ((canvasRef.current?.height || 600) / 2) + model.height * model.scale.x * 0.1 + listenY;
        if (coreModel.setParameterValueById) {
          coreModel.setParameterValueById('ParamMouthOpenY', 0.1);
        }
        break;
      }
      case 'thinking': {
        const thinkAngle = Math.sin(Date.now() / 1200) * 15;
        if (coreModel.setParameterValueById) {
          coreModel.setParameterValueById('ParamAngleX', thinkAngle);
          coreModel.setParameterValueById('ParamAngleY', Math.sin(Date.now() / 800) * 5);
          coreModel.setParameterValueById('ParamMouthOpenY', 0);
        }
        break;
      }
      case 'speaking': {
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
  const avatarStateRef = useRef(avatarState);
  const initAttemptedRef = useRef(false);

  // Keep avatarState in a ref so the animation loop always uses latest value
  useEffect(() => {
    avatarStateRef.current = avatarState;
  }, [avatarState]);

  const initLive2D = useCallback(async () => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    try {
      const maxWait = 30000; // Increased to 30s for slower connections
      const startTime = Date.now();

      // Wait for all required SDK scripts to load
      while (startTime + maxWait > Date.now()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (w.PIXI && w.PIXI.live2d && w.Live2DCubismCore) break;
        await new Promise((r) => setTimeout(r, 300));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (!w.PIXI || !w.PIXI.live2d || !w.Live2DCubismCore) {
        console.error('Live2D SDK not loaded after waiting. PIXI:', !!w.PIXI, 'live2d:', !!w.PIXI?.live2d, 'CubismCore:', !!w.Live2DCubismCore);
        setLoadError('فشل تحميل Live2D SDK. تحقق من اتصالك بالإنترنت.');
        return;
      }

      const PIXI = w.PIXI;
      const { Live2DModel } = PIXI.live2d;

      const canvas = canvasRef.current;
      if (!canvas) return;

      if (appRef.current) {
        (appRef.current as { destroy: (v?: boolean) => void }).destroy(true);
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

      const model = await Live2DModel.from(modelPath, { autoInteract: false });
      modelRef.current = model;

      const scaleX = (canvas.width || 400) / model.width * 0.8;
      const scaleY = (canvas.height || 600) / model.height * 0.8;
      const scale = Math.min(scaleX, scaleY, 0.5);
      model.scale.set(scale);
      model.anchor.set(0.5, 0.5);
      model.x = (canvas.width || 400) / 2;
      model.y = (canvas.height || 600) / 2 + model.height * scale * 0.1;

      app.stage.addChild(model);

      const animate = () => {
        updateModelMotion(model, avatarStateRef.current, canvasRef);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);

      setIsLoaded(true);
      setLoadError(null);
      console.log('Live2D: Avatar loaded successfully');
    } catch (err) {
      console.error('Live2D init error:', err);
      setLoadError('فشل تحميل الأفاتار. حاول إعادة تحميل الصفحة.');
      initAttemptedRef.current = false; // Allow retry
    }
  }, [modelPath]);

  useEffect(() => {
    initLive2D();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (appRef.current) {
        (appRef.current as { destroy: (v?: boolean) => void }).destroy(true);
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
          <p className="text-sm text-gray-400">جاري تحميل الأفاتار...</p>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm text-red-400 text-center px-4">{loadError}</p>
          <button
            onClick={() => {
              setLoadError(null);
              initAttemptedRef.current = false;
              initLive2D();
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
    </div>
  );
}
