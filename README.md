# Alisha - مساعد AI الذكي مع أفاتار Live2D

<p align="center">
  <strong>Alisha</strong> - مساعد ذكاء اصطناعي صوتي تفاعلي مع أفاتار Live2D
</p>

<p align="center">
  🎤 محادثة صوتية | 🎭 أفاتار تفاعلي | 🌍 10 مزودي API | 🎨 30 خلفية أنمي | 🧠 ذاكرة دائمة | 🔐 Supabase Auth
</p>

---

## 📋 نبذة عن المشروع

**Alisha** هو تطبيق ويب تفاعلي يعمل كمساعد ذكاء اصطناعي مع أفاتار Live2D. يتميز بقدرته على إجراء محادثات صوتية كاملة مع حركة متزامنة للشفاه، ويدعم 10 مزودين مختلفين للذكاء الاصطناعي، و3 لغات (العربية والإنجليزية واليابانية).

## ✨ المميزات الرئيسية

### 🔐 مصادقة آمنة عبر Supabase
- تسجيل حساب بالبريد وكلمة المرور
- جلسة محفوظة بأمان
- بيانات المستخدم (إعدادات، ذاكرة، رسائل) متزامنة عبر الأجهزة

### 🎙️ محادثة صوتية كاملة
- إدخال صوتي عبر Web Speech API أو AssemblyAI
- ردود صوتية طبيعية
- إدخال نصي كبديل

### 🎭 أفاتار Live2D تفاعلي
- 4 حالات: ساكن، يستمع، يفكر، يتكلم
- تزامن كامل بين حركة الفم والصوت

### 🌍 10 مزودي API
Google AI Studio, OpenRouter, NVIDIA NIM, Abliteration, HuggingFace, Groq, Together AI, Cohere, Mistral AI, Agent Router.

### 🧠 ذاكرة دائمة متزامنة
- الإعدادات والذاكرة محفوظة في Supabase
- تنتقل بين الأجهزة تلقائياً
- مفاتيح API محفوظة محلياً في المتصفح فقط

## 🏗️ التقنيات

| التقنية | الاستخدام |
|---|---|
| Next.js 16 + React 19 | الإطار |
| TypeScript | الأمان النوعي |
| Tailwind CSS 4 | التنسيق |
| Zustand | إدارة الحالة |
| [Supabase](https://supabase.com) | Auth + قاعدة بيانات |
| Live2D Cubism SDK | الأفاتار |
| Web Speech API | الصوت |

## 🚀 الإعداد

### 1) الإعدادات الحالية
تم تجهيز المشروع ليستخدم نفس مشروع Supabase النشط:
- **URL**: `https://khgvmatuqqgpctimzcoi.supabase.co`
- الإعدادات في `src/lib/supabase-config.ts`

### 2) قاعدة البيانات
شغّل `supabase/schema.sql` في **Supabase Dashboard → SQL Editor** لإنشاء:
- `alisha_user_settings` - إعدادات المستخدم
- `alisha_memory` - الذاكرة الدائمة
- `alisha_user_keys` - مفاتيح API (مشفّرة)
- `alisha_messages` - سجل المحادثات
- RLS policies (كل مستخدم يرى بياناته فقط)
- Trigger لتهيئة إعدادات المستخدم الجديد تلقائياً

### 3) حساب المستخدم
المستخدمون يسجلون حساباتهم مباشرة من واجهة التطبيق (لا حاجة لإعداد مسبق).

### 4) التطوير
```bash
npm install
npm run dev
```

### 5) النشر على GitHub Pages
```bash
git init
git add .
git commit -m "v2.0 - Supabase integration"
git remote add origin https://github.com/magengillan00-lgtm/Alisha.git
git push -u origin main
```

ثم في GitHub: **Settings → Pages → Source: GitHub Actions**

## 🔐 الأمان

| الميزة | الحالة |
|---|---|
| مصادقة عبر Supabase Auth | ✅ |
| Row Level Security على كل الجداول | ✅ |
| مفاتيح API في localStorage فقط | ✅ |
| لا server-side code (static export) | ✅ |
| لا SSRF في Caddyfile | ✅ |
| CSP + security headers | ✅ |
| لا مفاتيح في query string | ✅ |

## 📁 بنية المشروع

```
Alisha/
├── src/
│   ├── app/                    # صفحات Next.js
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── LoginScreen.tsx     # ✅ شاشة تسجيل الدخول
│   │   ├── ChatView.tsx
│   │   ├── Live2DViewer.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── SettingsDialog.tsx
│   │   ├── SetupWizard.tsx
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/
│   ├── lib/
│   │   ├── supabase.ts         # ✅ Supabase client + queries
│   │   ├── supabase-config.ts  # ⚙️ إعدادات Supabase
│   │   ├── gemini-client.ts    # ✅ multi-provider LLM client
│   │   ├── llm-providers.ts
│   │   ├── speech.ts
│   │   └── ...
│   └── store/
│       ├── auth-store.ts       # ✅ Supabase Auth
│       └── useAppStore.ts      # ✅ Zustand + Supabase sync
├── supabase/
│   └── schema.sql              # ✅ 4 جداول + RLS + triggers
├── public/                     # ملفات static
├── Caddyfile                   # ✅ آمن (HTTPS + CSP + headers)
├── package.json
├── next.config.ts              # ✅ static export + basePath
├── tailwind.config.ts          # ✅ src/** content paths
├── tsconfig.json               # ✅ noImplicitAny: true
├── eslint.config.mjs           # ✅ قواعد محسّنة
└── README.md
```

## 🔄 التغيير عن الإصدار السابق

| قبل | بعد |
|---|---|
| لا مصادقة (任何人 يستخدم التطبيق) | Supabase Auth حقيقي |
| الإعدادات والذاكرة في localStorage | متزامنة عبر Supabase |
| `output: "export"` + server-routes (متناقض!) | static فقط (تم حذف server-routes) |
| `lucide-react: "^1.11.0"` (غير موجود) | `^0.469.0` |
| `ignoreBuildErrors: true` | تمت الإزالة |
| `reactStrictMode: false` | `true` |
| `noImplicitAny: false` | `true` |
| ESLint 22 قاعدة معطّلة | معظمها "warn" |
| Caddyfile ثغرة SSRF + HTTP | HTTPS + CSP + security headers |
| مفاتيح Gemini في query string | في header (`x-goog-api-key`) |
| لا timeout على fetch | 30s timeout |
| `process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY` | مدخلات المستخدم |
| `.zscripts/` من مشروع آخر | محذوفة |
| `deploy.sh` مع `git reset --hard` | محذوف |
| README يدّعي Capacitor و free GitHub keys | محدّث |

## 📄 الترخيص

© 2024 Alisha. جميع الحقوق محفوظة.
