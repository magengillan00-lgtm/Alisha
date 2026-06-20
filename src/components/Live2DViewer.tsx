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
        model.y = ((canvasRef.current?.height || 600) / 2) + model.height * model.scale.x * 0.1 + breathY;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<unknown>(null);
  const modelRef = useRef<unknown>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const animFrameRef = useRef<number>(0);
  const avatarStateRef = useRef(avatarState);

  // Keep avatarState in a ref so the animation loop always uses latest value
  useEffect(() => {
    avatarStateRef.current = avatarState;
  }, [avatarState]);

  const initLive2D = useCallback(async () => {
    try {
      setIsLoaded(false);
      setLoadError(null);

      // انتظار تحميل SDK
      const maxWait = 15000;
      const startTime = Date.now();

      while (startTime + maxWait > Date.now()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (w.PIXI && w.PIXI.live2d && w.Live2DCubismCore) break;
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

      // ✅ تنظيف أي app سابق
      if (appRef.current) {
        try {
          (appRef.current as { destroy: (v?: boolean) => void }).destroy(true);
        } catch (_e) { /* ignore */ }
        appRef.current = null;
      }

      // ✅ إلغاء أي animation frame سابق
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }

      // ✅ إنشاء canvas جديد في كل مرة (يتجنب مشاكل إعادة استخدام canvas)
      const container = containerRef.current;
      if (!container) return;

      // إزالة canvas القديم
      const oldCanvas = container.querySelector('canvas');
      if (oldCanvas) {
        oldCanvas.remove();
      }

      // إنشاء canvas جديد
      const canvas = document.createElement('canvas');
      canvas.width = 500;
      canvas.height = 650;
      canvas.className = 'max-w-full max-h-full';
      canvas.style.touchAction = 'none';
      container.appendChild(canvas);
      canvasRef.current = canvas;

      // ✅ إنشاء PIXI Application
      const app = new PIXI.Application({
        view: canvas,
        transparent: true,
        autoStart: true,
        backgroundAlpha: 0,
        antialias: false,
        forceFXAA: false,
        powerPreference: 'default',
        width: 500,
        height: 650,
      });
      appRef.current = app;

      // ✅ تحميل النموذج
      const model = await Live2DModel.from(modelPath, { autoInteract: false });
      modelRef.current = model;

      // ✅ ضبط حجم النموذج
      const containerW = container.clientWidth || 400;
      const containerH = container.clientHeight || 600;
      const scaleX = containerW / model.width * 0.7;
      const scaleY = containerH / model.height * 0.7;
      const scale = Math.min(scaleX, scaleY, 0.4);
      model.scale.set(scale);
      model.anchor.set(0.5, 0.5);
      model.x = 500 / 2;
      model.y = 650 / 2 + model.height * scale * 0.1;

      app.stage.addChild(model);

      // ✅ بدء animation loop
      const animate = () => {
        updateModelMotion(model, avatarStateRef.current, canvasRef);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);

      setIsLoaded(true);
      setLoadError(null);
    } catch (err) {
      console.error('Live2D init error:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to load model';

      if (errMsg.includes('checkMaxIfStatementsInShader') || errMsg.includes('Invalid value')) {
        setLoadError('هذا الأفاتار معقد جداً للمتصفح. جرب أفاتاراً آخر.');
      } else if (errMsg.includes('NetworkError') || errMsg.includes('Failed to fetch')) {
        setLoadError('فشل تحميل ملفات الأفاتار. تأكد من اتصال الإنترنت.');
      } else {
        setLoadError('فشل تحميل الأفاتار: ' + errMsg.substring(0, 80));
      }
    }
  }, [modelPath]);

  useEffect(() => {
    initLive2D();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
      if (appRef.current) {
        try {
          (appRef.current as { destroy: (v?: boolean) => void }).destroy(true);
        } catch (_e) { /* ignore */ }
        appRef.current = null;
      }
    };
  }, [initLive2D]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
      {/* Canvas يُنشأ ديناميكياً في initLive2D */}
      {!isLoaded && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">جاري تحميل الأفاتار...</p>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm text-red-400 text-center">{loadError}</p>
        </div>
      )}
    </div>
  );
}
