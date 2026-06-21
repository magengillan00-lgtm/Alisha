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
  // logical stage dimensions (CSS pixels), NOT canvas.width/height which include DPR
  stageW: number,
  stageH: number,
  centerX: number,
  centerY: number
) {
  if (!model) return;

  try {
    const coreModel = model.internalModel?.coreModel;
    if (!coreModel) return;

    // ✅ الحفاظ على مركز النموذج ثابتاً - فقط حركات طفيفة للتنفس
    // نستخدم centerX/centerY (الإحداثيات المنطقية) وليس canvas.width/height
    switch (state) {
      case 'idle': {
        const breathY = Math.sin(Date.now() / 1000) * 2;
        const breathX = Math.sin(Date.now() / 2000) * 0.5;
        model.x = centerX + breathX;
        model.y = centerY + breathY;
        if (coreModel.setParameterValueById) {
          coreModel.setParameterValueById('ParamMouthOpenY', 0);
          coreModel.setParameterValueById('ParamBreath', (Math.sin(Date.now() / 2000) + 1) / 2);
        }
        break;
      }
      case 'listening': {
        const listenX = Math.sin(Date.now() / 500) * 3;
        model.x = centerX + listenX;
        model.y = centerY;
        if (coreModel.setParameterValueById) {
          coreModel.setParameterValueById('ParamMouthOpenY', 0.1);
          coreModel.setParameterValueById('ParamAngleZ', Math.sin(Date.now() / 600) * 5);
        }
        break;
      }
      case 'thinking': {
        const thinkAngle = Math.sin(Date.now() / 1200) * 15;
        if (coreModel.setParameterValueById) {
          coreModel.setParameterValueById('ParamAngleX', thinkAngle);
          coreModel.setParameterValueById('ParamAngleY', Math.sin(Date.now() / 800) * 5);
          coreModel.setParameterValueById('ParamMouthOpenY', 0);
          coreModel.setParameterValueById('ParamEyeLOpen', 0.5);
          coreModel.setParameterValueById('ParamEyeROpen', 0.5);
        }
        break;
      }
      case 'speaking': {
        if (coreModel.setParameterValueById) {
          const mouthValue = Math.abs(Math.sin(Date.now() / 150)) * 0.8 + 0.1;
          coreModel.setParameterValueById('ParamMouthOpenY', mouthValue);
          coreModel.setParameterValueById('ParamMouthForm', Math.sin(Date.now() / 300) * 0.3);
          coreModel.setParameterValueById('ParamEyeLOpen', 1);
          coreModel.setParameterValueById('ParamEyeROpen', 1);
        }
        break;
      }
    }
  } catch (_e) {
    // Silently handle parameter errors
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void stageW; void stageH;
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

  useEffect(() => {
    avatarStateRef.current = avatarState;
  }, [avatarState]);

  const initLive2D = useCallback(async () => {
    try {
      setIsLoaded(false);
      setLoadError(null);

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

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }

      const container = containerRef.current;
      if (!container) return;

      // ✅ إزالة canvas القديم
      const oldCanvas = container.querySelector('canvas');
      if (oldCanvas) oldCanvas.remove();

      // ✅ إنشاء canvas بحجم الحاوية بالضبط
      const containerW = container.clientWidth || 390;
      const containerH = container.clientHeight || 700;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // استخدام أبعاد الحاوية مباشرة (لا حد أدنى اصطناعي)
      const canvasW = containerW;
      const canvasH = containerH;

      const canvas = document.createElement('canvas');
      canvas.width = canvasW * dpr;
      canvas.height = canvasH * dpr;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.touchAction = 'none';
      canvas.style.cursor = 'grab';
      container.appendChild(canvas);
      canvasRef.current = canvas;

      // ✅ إنشاء PIXI Application
      const app = new PIXI.Application({
        view: canvas,
        transparent: true,
        autoStart: true,
        backgroundAlpha: 0,
        antialias: true,
        resolution: dpr,
        autoDensity: true,
        width: canvasW,
        height: canvasH,
      });
      appRef.current = app;

      // ✅ تحميل النموذج
      const model = await Live2DModel.from(modelPath, { autoInteract: false });
      modelRef.current = model;

      // ✅ ضبط حجم النموذج ليملأ الشاشة بالكامل
      const modelW = model.width;
      const modelH = model.height;
      // ✅ ملء ارتفاع الشاشة بالكامل (قد يقطع الأطراف الأفقية)
      // هذا يجعل الأفاتار كبيراً وواضحاً على الموبايل
      // نماذج Live2D لها هوامش آمنة يمكن قطعها
      let scale = canvasH / modelH;  // ملء 100% من الارتفاع
      scale = Math.max(scale, 0.05);
      console.log('Live2D dimensions:', { canvasW, canvasH, modelW, modelH, scale, renderedW: modelW*scale, renderedH: modelH*scale });
      model.scale.set(scale);
      model.anchor.set(0.5, 0.5);
      // توسيط النموذج مع إزاحة طفيفة للأسفل
      model.x = canvasW / 2;
      model.y = canvasH / 2;

      app.stage.addChild(model);

      // ✅ تفعيل تفاعل اللمس (Touch following)
      // الأفاتار يتبع حركة الإصبع/الماوس بعينه
      const onPointerMove = (event: PointerEvent) => {
        try {
          const rect = canvas.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1; // -1 to 1
          const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1); // -1 to 1

          const coreModel = (model as any).internalModel?.coreModel;
          if (coreModel && coreModel.setParameterValueById) {
            // العينان تتبعان المؤشر
            coreModel.setParameterValueById('ParamAngleX', x * 30);
            coreModel.setParameterValueById('ParamAngleY', y * 30);
            coreModel.setParameterValueById('ParamEyeBallX', x);
            coreModel.setParameterValueById('ParamEyeBallY', y);
            coreModel.setParameterValueById('ParamBodyAngleX', x * 10);
          }
        } catch (_e) { /* ignore */ }
      };

      // ✅ تفعيل النقر على النموذج (تعبيرات تفاعلية)
      const onPointerDown = (event: PointerEvent) => {
        try {
          const coreModel = (model as any).internalModel?.coreModel;
          if (coreModel && coreModel.setParameterValueById) {
            // تعبير مفاجأة عند النقر
            coreModel.setParameterValueById('ParamEyeLOpen', 1.2);
            coreModel.setParameterValueById('ParamEyeROpen', 1.2);
            coreModel.setParameterValueById('ParamMouthOpenY', 0.5);
            setTimeout(() => {
              try {
                coreModel.setParameterValueById('ParamEyeLOpen', 1);
                coreModel.setParameterValueById('ParamEyeROpen', 1);
                coreModel.setParameterValueById('ParamMouthOpenY', 0);
              } catch (_e) { /* ignore */ }
            }, 300);
          }
        } catch (_e) { /* ignore */ }
      };

      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerdown', onPointerDown);

      // ✅ بدء animation loop
      // نستخدم الأبعاد المنطقية (canvasW, canvasH) - وهي نفس أبعاد stage في PIXI
      // مهم: لا نستخدم canvas.width/height لأنها تشمل DPR وتسبب ظهور الأفاتار في أسفل يمين
      const centerX = canvasW / 2;
      const centerY = canvasH / 2;
      const animate = () => {
        updateModelMotion(model, avatarStateRef.current, canvasW, canvasH, centerX, centerY);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);

      setIsLoaded(true);
      setLoadError(null);

      // تنظيف event listeners عند الإزالة
      return () => {
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerdown', onPointerDown);
      };
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
    let cleanupFn: (() => void) | undefined;

    initLive2D().then((fn) => {
      if (fn) cleanupFn = fn;
    });

    return () => {
      if (cleanupFn) cleanupFn();
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
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden">
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
