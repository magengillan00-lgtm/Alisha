'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AssemblyAISTreamingSTT } from '@/lib/assemblyai-stt';
import { STTProviderManager, STTProviderType } from '@/lib/stt-providers';
import { getTTSService, TTSProvider } from '@/lib/tts-service';
import {
  LLM_PROVIDERS,
  LLMProviderId,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_LLM_MODEL,
  CustomAPIKeys,
  loadCustomAPIKeys,
  saveCustomAPIKeys,
  PROVIDER_LIST,
} from '@/lib/llm-providers';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Settings,
  Bot,
  User,
  Loader2,
  Sparkles,
  MessageCircle,
  X,
  Key,
  Cpu,
  Globe,
  ChevronDown,
  Eye,
  EyeOff,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  provider?: string;
  model?: string;
}

export default function AlishaChat() {
  // API base URL - works for both web server and Capacitor native
  const getApiBase = useCallback(() => {
    if (typeof window !== 'undefined') {
      // Check if running in Capacitor native app
      const cap = (window as any).Capacitor;
      if (cap?.isNativePlatform?.()) {
        // In native app, use remote server for API calls
        return 'https://alisha.dpdns.org';
      }
    }
    return ''; // Relative URL for web server
  }, []);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [interimText, setInterimText] = useState('');

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [sttProvider, setSttProvider] = useState<STTProviderType>('assemblyai');
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>('google');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [sttStatus, setSttStatus] = useState<string>('disconnected');

  // LLM Provider State
  const [llmProvider, setLlmProvider] = useState<LLMProviderId>(DEFAULT_LLM_PROVIDER);
  const [llmModel, setLlmModel] = useState<string>(DEFAULT_LLM_MODEL);
  const [customKeys, setCustomKeys] = useState<CustomAPIKeys>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sttManagerRef = useRef<STTProviderManager | null>(null);
  const ttsRef = useRef(getTTSService());
  const chatHistoryRef = useRef<Array<{ role: string; content: string }>>([]);

  // Load custom API keys from localStorage
  useEffect(() => {
    setCustomKeys(loadCustomAPIKeys());
  }, []);

  // Initialize STT Manager
  useEffect(() => {
    const assemblyaiSTT = new AssemblyAISTreamingSTT({
      tokenEndpoint: `${getApiBase()}/api/aai-token`,
      customApiKey: customKeys.assemblyai || undefined,
    });

    const manager = new STTProviderManager();
    manager.setAssemblyAI(assemblyaiSTT);
    manager.setCallbacks(
      (result) => {
        if (result.isFinal) {
          setInterimText('');
          if (result.text.trim()) {
            sendMessage(result.text.trim());
          }
        } else {
          setInterimText(result.text);
        }
      },
      (error) => {
        console.error('STT Error:', error.message);
        setIsRecording(false);
      },
      (status) => {
        setSttStatus(status);
      }
    );

    sttManagerRef.current = manager;

    return () => {
      manager.stop();
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimText]);

  // Update STT provider
  useEffect(() => {
    sttManagerRef.current?.setProvider(sttProvider);
  }, [sttProvider]);

  // Update TTS provider
  useEffect(() => {
    ttsRef.current.setProvider(ttsProvider);
  }, [ttsProvider]);

  // Update model when provider changes
  useEffect(() => {
    const providerConfig = LLM_PROVIDERS[llmProvider];
    if (providerConfig) {
      setLlmModel(providerConfig.defaultModel);
    }
  }, [llmProvider]);

  // Send message to LLM
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isThinking) return; // Guard against concurrent calls

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    chatHistoryRef.current.push({ role: 'user', content: text });
    // Keep history bounded to prevent memory issues
    if (chatHistoryRef.current.length > 50) {
      chatHistoryRef.current = chatHistoryRef.current.slice(-30);
    }

    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatHistoryRef.current.slice(-20),
          systemPrompt: `أنت أليشا، مساعدة ذكية ودودة. تتحدثين بالعربية والإنجليزية بطلاقة. أنتِ مساعدة شخصية تساعد المستخدم في أي شيء يحتاجه. كوني ودودة ومحترمة ومفيدة. ردودك يجب أن تكون واضحة ومختصرة. استخدمي العاطفة المناسبة والتعابير اللطيفة.`,
          provider: llmProvider,
          model: llmModel,
          customApiKey: getCustomKeyForProvider(llmProvider),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const reply = data.reply || 'عذراً، لم أتمكن من الرد.';

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
        provider: data.provider,
        model: data.model,
      };

      setMessages(prev => [...prev, assistantMsg]);
      chatHistoryRef.current.push({ role: 'assistant', content: reply });

      if (ttsEnabled) {
        // Detect language of response for correct TTS pronunciation
        const detectedLang = /[\u0600-\u06FF]/.test(reply) ? 'ar' : 'en';
        ttsRef.current.speak(reply, detectedLang);
      }
    } catch (error: any) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `عذراً، حدث خطأ: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  }, [llmProvider, llmModel, customKeys, ttsEnabled, isThinking]);

  // Get custom API key for a provider
  const getCustomKeyForProvider = useCallback((provider: LLMProviderId): string | undefined => {
    // ZAI doesn't use custom API keys
    if (provider === 'zai') return undefined;
    const keyMap: Record<LLMProviderId, keyof CustomAPIKeys | undefined> = {
      zai: undefined,
      openrouter: 'openrouter',
      google: 'google',
      nvidia: 'nvidia',
      abliteration: 'abliteration',
      huggingface: 'huggingface',
    };
    const key = keyMap[provider];
    return key ? customKeys[key] : undefined;
  }, [customKeys]);

  // Update a custom API key
  const updateCustomKey = useCallback((providerKey: keyof CustomAPIKeys, value: string) => {
    setCustomKeys(prev => {
      const updated = { ...prev, [providerKey]: value };
      saveCustomAPIKeys(updated);
      return updated;
    });
  }, []);

  // Toggle recording
  const toggleRecording = useCallback(async () => {
    const manager = sttManagerRef.current;
    if (!manager) return;

    if (isRecording) {
      await manager.stop();
      setIsRecording(false);
      setInterimText('');
    } else {
      try {
        setIsRecording(true);
        await manager.start();
      } catch (error: any) {
        console.error('Failed to start recording:', error);
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  // Handle text submit
  const handleTextSubmit = useCallback(() => {
    if (inputText.trim()) {
      sendMessage(inputText.trim());
    }
  }, [inputText, sendMessage]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  }, [handleTextSubmit]);

  // Stop TTS
  const toggleTTS = useCallback(() => {
    if (ttsRef.current.getIsSpeaking()) {
      ttsRef.current.stop();
      setIsSpeaking(false);
    }
    setTtsEnabled(prev => !prev);
  }, []);

  // Get recording status
  const getStatusColor = () => {
    if (sttStatus.includes('listening') || sttStatus.includes('connected')) return 'bg-green-500';
    if (sttStatus.includes('connecting') || sttStatus.includes('processing')) return 'bg-yellow-500';
    if (sttStatus.includes('error')) return 'bg-red-500';
    return 'bg-gray-400';
  };

  const getStatusText = () => {
    if (sttStatus.includes('listening')) return ' يستمع...';
    if (sttStatus.includes('connecting')) return ' يتصل...';
    if (sttStatus.includes('processing')) return ' يعالج...';
    if (sttStatus.includes('error')) return ' خطأ';
    return ' غير متصل';
  };

  // Get current LLM provider display name
  const getCurrentProviderName = () => {
    return LLM_PROVIDERS[llmProvider]?.nameAr || LLM_PROVIDERS[llmProvider]?.name || 'Z-AI';
  };

  const getCurrentModelName = () => {
    const provider = LLM_PROVIDERS[llmProvider];
    const modelObj = provider?.models.find(m => m.id === llmModel);
    return modelObj?.name || llmModel;
  };

  // API key field definitions
  const apiKeyFields: Array<{ key: keyof CustomAPIKeys; label: string; placeholder: string }> = [
    { key: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-v1-...' },
    { key: 'google', label: 'Google AI Studio', placeholder: 'AIzaSy...' },
    { key: 'nvidia', label: 'NVIDIA NIM', placeholder: 'nvapi-...' },
    { key: 'abliteration', label: 'Abliteration AI', placeholder: 'ak_...' },
    { key: 'huggingface', label: 'HuggingFace', placeholder: 'hf_...' },
    { key: 'alchemy', label: 'Alchemy (Web3)', placeholder: 'Ql-...' },
    { key: 'assemblyai', label: 'AssemblyAI (STT)', placeholder: 'Your key...' },
  ];

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 text-white" dir="rtl">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              أليشا
            </h1>
            <p className="text-xs text-slate-400">مساعدتك الذكية</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <Badge variant="destructive" className="animate-pulse text-xs">
              <span className={`w-2 h-2 rounded-full ${getStatusColor()} ml-1 inline-block`} />
              {getStatusText()}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-white/10 bg-black/30 backdrop-blur-xl max-h-[60vh] overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">الإعدادات</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} className="h-6 w-6 text-slate-400">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <Accordion type="multiple" defaultValue={['llm', 'voice', 'keys']} className="space-y-2">
              {/* LLM Provider Settings */}
              <AccordionItem value="llm" className="border border-white/10 rounded-lg px-3">
                <AccordionTrigger className="text-xs font-semibold text-slate-300 hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-violet-400" />
                    مزود الذكاء الاصطناعي
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  {/* Provider Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-400">المزود</Label>
                    <Select
                      value={llmProvider}
                      onValueChange={(v) => setLlmProvider(v as LLMProviderId)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_LIST.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nameAr} - {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Model Selection */}
                  {LLM_PROVIDERS[llmProvider]?.models.length > 1 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-400">النموذج</Label>
                      <Select
                        value={llmModel}
                        onValueChange={setLlmModel}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LLM_PROVIDERS[llmProvider]?.models.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Provider Info */}
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-slate-400">{LLM_PROVIDERS[llmProvider]?.description}</p>
                    <p className="text-[10px] text-slate-500 mt-1">النموذج الحالي: {getCurrentModelName()}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Voice Settings */}
              <AccordionItem value="voice" className="border border-white/10 rounded-lg px-3">
                <AccordionTrigger className="text-xs font-semibold text-slate-300 hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-fuchsia-400" />
                    إعدادات الصوت
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* STT Provider */}
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-400">التعرف على الكلام</Label>
                      <Select
                        value={sttProvider}
                        onValueChange={(v) => setSttProvider(v as STTProviderType)}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="assemblyai">AssemblyAI (افتراضي)</SelectItem>
                          <SelectItem value="web-speech">Web Speech API</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* TTS Provider */}
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-400">تحويل النص لصوت</Label>
                      <Select
                        value={ttsProvider}
                        onValueChange={(v) => setTtsProvider(v as TTSProvider)}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="google">Google TTS</SelectItem>
                          <SelectItem value="web-speech">Web Speech API</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* TTS Toggle */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="tts-toggle" className="text-xs text-slate-400">تشغيل الردود الصوتية</Label>
                    <Switch
                      id="tts-toggle"
                      checked={ttsEnabled}
                      onCheckedChange={(checked) => {
                        setTtsEnabled(checked);
                        if (!checked) ttsRef.current.stop();
                      }}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* API Keys */}
              <AccordionItem value="keys" className="border border-white/10 rounded-lg px-3">
                <AccordionTrigger className="text-xs font-semibold text-slate-300 hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    مفاتيح API
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 mr-2">
                      إدخال يدوي
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <p className="text-[10px] text-slate-500">
                    أدخل مفاتيح API الخاصة بك هنا. يتم تخزينها محلياً على جهازك فقط.
                    إذا تركت الحقل فارغاً، سيتم استخدام المفتاح الافتراضي.
                  </p>

                  {apiKeyFields.map(field => (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-xs text-slate-400">{field.label}</Label>
                      <div className="relative">
                        <Input
                          type={showApiKeys[field.key] ? 'text' : 'password'}
                          value={customKeys[field.key] || ''}
                          onChange={(e) => updateCustomKey(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="bg-white/5 border-white/10 text-sm pl-10 pr-3 font-mono text-xs"
                          dir="ltr"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-500 hover:text-white"
                          onClick={() => setShowApiKeys(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                        >
                          {showApiKeys[field.key] ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Clear all keys */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 mt-2"
                    onClick={() => {
                      setCustomKeys({});
                      saveCustomAPIKeys({});
                    }}
                  >
                    حذف جميع المفاتيح المحفوظة
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome Message */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-violet-500/20">
              <Sparkles className="w-12 h-12 text-violet-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                مرحباً! أنا أليشا 👋
              </h2>
              <p className="text-slate-400 text-sm max-w-md">
                مساعدتك الذكية الشخصية. يمكنني التحدث بالعربية والإنجليزية.
                اضغط على زر الميكروفون للتكلم أو اكتب رسالتك أدناه.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {['مرحباً أليشا', 'ماذا يمكنك أن تفعلي؟', 'أخبريني نكتة', 'ساعديني في شيء'].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
                  onClick={() => sendMessage(suggestion)}
                >
                  <MessageCircle className="w-3 h-3 ml-1" />
                  {suggestion}
                </Button>
              ))}
            </div>

            {/* Provider Info */}
            <div className="flex items-center gap-2 mt-4">
              <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400">
                <Cpu className="w-3 h-3 ml-1" />
                {getCurrentProviderName()}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-fuchsia-500/30 text-fuchsia-400">
                {getCurrentModelName()}
              </Badge>
            </div>
          </div>
        )}

        {/* Message List */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
            }`}>
              {msg.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>
            <Card className={`max-w-[80%] px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-blue-600/20 border-blue-500/20 text-blue-50'
                : 'bg-violet-600/20 border-violet-500/20 text-violet-50'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <div className={`flex items-center gap-2 mt-1 ${
                msg.role === 'user' ? 'text-blue-300/50' : 'text-violet-300/50'
              }`}>
                <p className="text-[10px]">
                  {msg.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {msg.provider && msg.role === 'assistant' && (
                  <p className="text-[10px]">
                    via {msg.provider}/{msg.model}
                  </p>
                )}
              </div>
            </Card>
          </div>
        ))}

        {/* Interim transcription */}
        {interimText && (
          <div className="flex gap-3 flex-row-reverse">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-cyan-500">
              <User className="w-4 h-4 text-white" />
            </div>
            <Card className="max-w-[80%] px-4 py-3 bg-blue-600/10 border-blue-500/10 text-blue-200 border-dashed">
              <p className="text-sm leading-relaxed italic">{interimText}...</p>
            </Card>
          </div>
        )}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <Card className="px-4 py-3 bg-violet-600/20 border-violet-500/20">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-violet-300 animate-spin" />
                <span className="text-sm text-violet-300">أليشا تكتب...</span>
                <Badge variant="outline" className="text-[9px] border-white/10 text-slate-500">
                  {getCurrentProviderName()}
                </Badge>
              </div>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 bg-black/30 backdrop-blur-xl px-4 py-3">
        <div className="flex items-end gap-2">
          {/* Mic Button */}
          <Button
            onClick={toggleRecording}
            variant={isRecording ? 'destructive' : 'default'}
            size="icon"
            className={`shrink-0 rounded-full h-11 w-11 transition-all duration-300 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25 animate-pulse'
                : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/25'
            }`}
          >
            {isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </Button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? 'جاري الاستماع...' : 'اكتب رسالتك هنا...'}
              disabled={isRecording}
              className="min-h-[44px] max-h-[120px] resize-none bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50 rounded-xl pr-4 pl-12"
              rows={1}
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleTextSubmit}
            disabled={!inputText.trim() || isThinking || isRecording}
            size="icon"
            className="shrink-0 rounded-full h-11 w-11 bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25"
          >
            <Send className="w-5 h-5 rotate-180" />
          </Button>

          {/* TTS Toggle Button */}
          <Button
            onClick={() => {
              if (ttsRef.current.getIsSpeaking()) {
                ttsRef.current.stop();
              } else {
                toggleTTS();
              }
            }}
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full h-11 w-11 text-slate-400 hover:text-white hover:bg-white/10"
          >
            {ttsEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Provider Badge */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400">
            <Cpu className="w-3 h-3 ml-1" />
            {getCurrentProviderName()} / {getCurrentModelName()}
          </Badge>
          <span className="text-[10px] text-slate-600">•</span>
          <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">
            {sttProvider === 'assemblyai' ? 'AssemblyAI' : 'Web Speech API'}
          </Badge>
          <span className="text-[10px] text-slate-600">•</span>
          <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500">
            {ttsProvider === 'google' ? 'Google TTS' : 'Web Speech API'}
          </Badge>
        </div>
      </div>
    </div>
  );
}
