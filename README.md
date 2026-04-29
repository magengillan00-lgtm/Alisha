# Alisha - مساعد AI الذكي مع أفاتار Live2D

<p align="center">
  <img src="public/settings-icon.png" width="120" alt="Alisha Logo" />
</p>

<p align="center">
  <strong>Alisha</strong> - مساعد ذكاء اصطناعي صوتي تفاعلي مع أفاتار Live2D
</p>

<p align="center">
  🎤 محادثة صوتية | 🎭 أفاتار تفاعلي | 🌍 8 مزودي API | 🎨 20 خلفية أنمي | 🧠 ذاكرة دائمة
</p>

---

## 📋 نبذة عن المشروع

**Alisha** هو تطبيق ويب تفاعلي يعمل كمساعد ذكاء اصطناعي مع أفاتار Live2D ثلاثي الأبعاد. يتميز التطبيق بقدرته على إجراء محادثات صوتية كاملة مع حركة متزامنة للشفاه، ويدعم 8 مزودي مختلفين للذكاء الاصطناعي، و3 لغات (العربية والإنجليزية واليابانية).

## ✨ المميزات الرئيسية

### 🎙️ محادثة صوتية كاملة
- إدخال صوتي عبر التعرف على الكلام (Web Speech API)
- ردود صوتية طبيعية عبر توليد الكلام (Web Speech Synthesis)
- إدخال نصي كبديل عند عدم توفر الميكروفون
- إمكانية كتم الصوت عند الحاجة

### 🎭 أفاتار Live2D تفاعلي
- 4 حالات للأفاتار: ساكن، يستمع، يفكر، يتكلم
- **تزامن كامل** بين حركة الفم والصوت الفعلي - الفم لا يتحرك إلا عندما يبدأ الصوت بالتشغيل فعلياً
- حركة تنفس طبيعية في حالة السكون
- حركة إيماءة بالرأس أثناء الاستماع
- إمالة الرأس أثناء التفكير

### 🔑 8 مزودي API مجانيين
التطبيق يدعم المزودين التاليين مع **اكتشاف تلقائي** لنوع المفتاح:

| المزود | البادئة | الرابط |
|--------|---------|--------|
| Google Gemini | `AIza...` | [Google AI Studio](https://aistudio.google.com/apikey) |
| HuggingFace | `hf_...` | [HuggingFace](https://huggingface.co/settings/tokens) |
| NVIDIA NIM | `nvapi-...` | [NVIDIA](https://build.nvidia.com/) |
| Groq | `gsk_...` | [Groq](https://console.groq.com/keys) |
| Together AI | - | [Together](https://api.together.xyz/) |
| OpenRouter | `sk-or-...` | [OpenRouter](https://openrouter.ai/keys) |
| Cohere | - | [Cohere](https://dashboard.cohere.com/api-keys) |
| Mistral AI | - | [Mistral](https://console.mistral.ai/) |

> 💡 **اكتشاف تلقائي**: الصق أي مفتاح وسيتعرف النظام تلقائياً على المزود المناسب!

### 🌍 دعم متعدد اللغات
- **العربية** (🇸🇦) - صوت عربي طبيعي
- **الإنجليزية** (🇺🇸) - صوت إنجليزي طبيعي
- **اليابانية** (🇯🇵) - صوت ياباني طبيعي
- الرد يكون بلغة الإعدادات بغض النظر عن لغة الإدخال

### 🎨 20 خلفية أنمي
- واجهة اختيار منبثقة أنيقة لتبديل الخلفيات
- خلفيات أنمي متنوعة: ساكورا، مجرة، غابات، قلاع، تحت الماء، وأكثر

### 🧠 نظام الذاكرة
- **ذاكرة دائمة**: تعليمات مخصصة تُقرأ في كل محادثة ولا تُنسى
  - التعرف على المستخدم (غيلان بن عقبة / magen gillan)
  - هوية الأفاتار (اليشيا - Alisha)
  - لقب المستخدم (الملك الأحمر / Red King / akna ow)
- **ذاكرة مؤقتة**: عرض رسائل المحادثة الحالية مع إمكانية المسح

---

## 🛠️ التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|----------|
| [Next.js 16](https://nextjs.org/) | إطار العمل الرئيسي |
| [TypeScript](https://www.typescriptlang.org/) | لغة البرمجة |
| [Tailwind CSS 4](https://tailwindcss.com/) | التصميم والأنماط |
| [Framer Motion](https://www.framer.com/motion/) | الحركات والانتقالات |
| [Zustand](https://zustand-demo.pmnd.rs/) | إدارة الحالة |
| [Live2D Cubism SDK](https://www.live2d.com/) | أفاتار ثلاثي الأبعاد |
| [Pixi.js](https://pixijs.com/) | محرك الرسوميات |
| [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) | التعرف على الكلام وتوليده |
| [Capacitor](https://capacitorjs.com/) | بناء تطبيق Android |

---

## 📁 هيكل المشروع

```
src/
├── app/
│   ├── layout.tsx          # التخطيط الرئيسي مع تحميل Live2D SDK
│   ├── page.tsx            # الصفحة الرئيسية
│   └── globals.css         # الأنماط العامة
├── components/
│   ├── ChatView.tsx        # واجهة المحادثة الصوتية الرئيسية
│   ├── SetupWizard.tsx     # صفحة إدخال مفتاح API مع اكتشاف تلقائي
│   ├── ModelSelector.tsx   # صفحة اختيار الموديل
│   ├── SettingsDialog.tsx  # قائمة الإعدادات الشاملة
│   ├── Live2DViewer.tsx    # مكون عرض الأفاتار التفاعلي
│   └── ui/                 # مكونات واجهة المستخدم الأساسية
├── lib/
│   ├── gemini-client.ts    # عميل API متعدد المزودين
│   └── speech.ts           # أدوات التعرف على الكلام وتوليده
├── store/
│   └── useAppStore.ts      # إدارة حالة التطبيق (Zustand)
public/
├── live2d/                 # ملفات نموذج Live2D
├── backgrounds/            # 20 خلفية أنمي (bg1-bg20)
└── settings-icon.png       # أيقونة الإعدادات
android/                    # مشروع Capacitor Android
```

---

## 🚀 طريقة التشغيل

### المتطلبات
- Node.js 18+
- npm أو bun

### التثبيت والتشغيل

```bash
# استنساخ المشروع
git clone https://github.com/magengillan00-lgtm/Alisha.git
cd Alisha

# تثبيت الحزم
npm install

# تشغيل بيئة التطوير
npm run dev
```

افتح المتصفح على `http://localhost:3000`

### بناء APK (Android)

```bash
# تثبيت Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# بناء المشروع كملفات ثابتة
# تغيير output في next.config.ts إلى "export"
npx next build

# إضافة منصة Android
npx cap add android

# مزامنة الملفات
npx cap sync android

# بناء APK
cd android && ./gradlew assembleDebug
```

سيكون ملف APK في: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📱 التوافق مع الأجهزة

تم بناء APK ليتوافق مع:
- **Honor 8X** (JSN-L22) - Kirin 710, ARM64
- جميع أجهزة Android التي تدعم API 21+ (Android 5.0+)
- يعمل أيضاً على جميع المتصفحات الحديثة (Chrome, Firefox, Safari, Edge)

> ⚠️ **ملاحظة**: ميزة التعرف على الكلام الصوتي تعمل بشكل أفضل على متصفح Chrome وAndroid.

---

## 🔧 كيف يعمل النظام

### تدفق المحادثة
1. المستخدم يضغط زر الميكروفون ويتحدث
2. الأفاتار يتحول لحالة "استماع" مع حركة إيماءة بالرأس
3. النص يُرسل إلى مزود API المختار مع تعليمات الذاكرة الدائمة
4. الأفاتار يتحول لحالة "تفكير" مع إمالة الرأس (الفم مغلق)
5. عند وصول الرد، يبدأ تشغيل الصوت
6. **فقط عندما يبدأ الصوت فعلياً** يتحول الأفاتار لحالة "تكلم" مع تزامن حركة الفم
7. عند انتهاء الصوت يعود الأفاتار لحالة السكون

### اكتشاف المفتاح التلقائي
عند لصق مفتاح API:
1. النظام يفحص بادئة المفتاح (AIza, hf_, nvapi-, gsk_, sk-or-, إلخ)
2. يتم عرض المزود المتوقع فوراً
3. عند الضغط على "تحقق"، يتم تجربة المزود المتوقع أولاً
4. إذا فشل، يتم تجربة جميع المزودين تلقائياً واحداً تلو الآخر
5. عند نجاح أي مزود، يتم الانتقال مباشرة لاختيار الموديل

---

## 📄 الترخيص

هذا المشروع مفتوح المصدر للاستخدام الشخصي.

---

## 👤 المطور

- **غيلان بن عقبة** (magen gillan)
- GitHub: [magengillan00-lgtm](https://github.com/magengillan00-lgtm)
