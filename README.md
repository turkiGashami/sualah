# سُعلاة (Sealah)

لعبة جلسات ويب عربية بأدوار خفية بثيم أساطير الجزيرة — وحوش (غيلان) متخفّون بين
أهل الديرة. شاشة مشتركة (TV) للأجواء والمسرح، وجوّالات للدور السري والقدرات
والتصويت. الانضمام بـ QR بدون تثبيت.

> ريبو مستقل بالكامل — واحد من أربع تجارب ألعاب بنفس الـ stack والـ conventions.

## التشغيل

```bash
pnpm install
cp .env.example .env.local   # ثم عبّئ مفاتيح Supabase
pnpm test                    # اختبارات game-core (النواة)
pnpm pentest                 # اختبار اختراق الأسرار (إلزامي)
pnpm dev                     # تشغيل الويب
pnpm e2e                     # جلسة Playwright كاملة
```

## المعمارية

- **سيرفر مرجعي:** العميل لا يكتب الحالة أبداً — كل تغيير عبر Edge Functions.
- **حالة ثلاثية الطبقات (Invariant #1):** `state` (سيرفر فقط) /
  `public_state` (بث عام) / `player_secrets` (RLS: صاحبه فقط).
- **النواة:** `packages/game-core` — TypeScript نقي، state machine قابلة
  لإعادة الإنتاج (seed)، بلا I/O.

راجع [CLAUDE.md](CLAUDE.md) للقواعد الكاملة و[الـ brief](Sealah-BRIEF-v1.md)
للمواصفة.

## الحالة

قيد التطوير — Phase 1 (اللعبة كاملة). v1 مجانية بدون billing.
