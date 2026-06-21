# سُعلاة (Sealah) — Technical Brief (v1) — ريبو مستقل

> لعبة جلسات ويب مستقلة: **أدوار خفية بثيم أساطير الجزيرة.** وحوش متخفون بين أهل الديرة، ليل ونهار وتصويت — الإقناع والخداع وجهاً لوجه، والجوال للسر فقط. شاشة مشتركة + جوالات، انضمام بـ QR بدون تثبيت.
>
> هذا الريبو **واحد من أربع تجارب ألعاب منفصلة** (ملحمة، سُعلاة، ديرة، تحدي القبائل) بنفس الـ stack والـ conventions — **مستقل بالكامل ولا يعتمد على أي ريبو آخر**. الالتزام بالـ conventions يجعل أي دمج مستقبلي في منصة واحدة شبه ميكانيكي.

---

## 0. الفكرة في سطر

كل لاعب يستلم دوراً سرياً على جواله: أهل ديرة أبرياء بينهم وحوش متخفون (غيلان). في الليل الوحوش تفترس بصمت عبر الجوالات، وفي النهار حرب كلامية حقيقية وتصويت على طرد المشبوه — حتى ينقّى أهل الديرة الوحوش، أو يبتلع الوحوش الديرة.

## 1. السياق التجاري

- **المرحلة:** تجربة. **v1 مجانية بالكامل بدون billing** — الإيراد يُبنى للفائزة من التجارب الأربع فقط. *(قرار موثق قابل للنقض من تركي.)*
- **التميّز:** ليست نسخة Mafia/Werewolf الغربية — الثيم من فولكلور الجزيرة (غول، سعلاة، عرّاف الديرة) بصوت وهوية محلية.
- **المستخدمون:** مضيف بحساب + 5–16 لاعباً ضيوفاً.
- **مقياس النجاح:** جلسات متتالية في نفس الليلة (اللعبة إدمانية بطبيعتها لو ضُبط الإيقاع) + صفر حوادث "انكشف دور بالغلط".

## 2. Tech Stack (موحّد عبر التجارب الأربع)

| الطبقة | التقنية |
|--------|---------|
| Frontend | Next.js 14 (App Router) + TypeScript strict + Tailwind (RTL-first) + Zustand |
| Backend | Supabase: Postgres + Auth (email/Google للمضيف، Anonymous للاعبين) + Realtime + Edge Functions (Deno) |
| Game logic | `packages/game-core` — TypeScript نقي، state machine قابلة للاختبار بمعزل |
| Audio | ملفات أصوات أجواء محلية (ليل/فجر/كشف) تشغلها شاشة الـ TV |
| Testing | Vitest + Playwright |
| Hosting | Vercel + Supabase |

## 3. المعمارية

```
[/tv/{code}] الشاشة: المسرح والأجواء       [/play/{code}] الجوالات: الدور السري + القدرات + التصويت
        │                                          │
        └────► Supabase Realtime: room:{code} ◄────┘
                      ▲ بث snapshots عامة (صفر أسرار)
                      │
        [Edge Functions — الكاتب الوحيد للحالة]
          rooms / game-action / advance-phase
                      │
   [Postgres: rooms, players, game_sessions, player_secrets, votes]
```

**القاعدة الذهبية:** العميل لا يكتب الحالة أبداً — كل تغيير عبر Edge Functions بـ service role.

## 4. مفاهيم النواة

### 4.1 نموذج الحالة ثلاثي الطبقات — **أهم قرار في هذه اللعبة**
| الطبقة | أين | من يراها |
|--------|-----|----------|
| `state` الكاملة | `game_sessions.state` (jsonb) | Edge Functions فقط — الأدوار، أهداف الليل، نتائج العرّاف |
| `public_state` | `game_sessions.public_state` + البث | الجميع — الأحياء/الأموات/المرحلة فقط |
| سرّ اللاعب | `player_secrets` (RLS: صاحبه فقط) | اللاعب نفسه عبر anonymous auth uid |

**ممنوع منعاً باتاً** وصول أي سرّ (دور، هدف، نتيجة فحص) إلى البث أو `public_state` أو أي view يقرأه عميل. **الغش بفتح DevTools يجب أن يكون مستحيلاً** — هذا الـ invariant رقم 1 في الريبو، وأي شك فيه يوقف التطوير حتى يُحسم.

### 4.2 دورة حياة الغرفة والمؤقتات
نفس النمط الموحّد: غرفة بكود 4 خانات + QR، `phase_deadline_at` سيرفري يُبث والعملاء يعرضون عداً تنازلياً فقط، تقدّم مبكر عند اكتمال المطلوب، `advance-phase` idempotent تستدعيها شاشة الـ TV (وأي جوال كاحتياط)، سماحية +2s.

### 4.3 state machine نقية
`game-core` يصدّر `sealahModule`: `init` (توزيع الأدوار)، `reduce` (قدرات الليل/التصويت)، `onPhaseTimeout`، `checkEnd`. صفر I/O، الوقت والعشوائية (seed) يُمرران وسيطين — **توزيع الأدوار وقرارات التعادل قابلة لإعادة الإنتاج في الاختبارات**.

## 5. Schema قاعدة البيانات

الجداول المشتركة (`profiles`, `rooms`, `players`, `game_sessions`, `votes`) **مطابقة حرفياً لتعريفات الـ conventions الموحدة** — انظر القيم في الكود أدناه، مع الإضافات الخاصة باللعبة:

```sql
-- (profiles, rooms, players: مطابقة للنمط الموحد — كود 4 خانات، unique
--  rooms_live_code، players بـ unique(room_id, nickname/seat/auth_uid))

create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  game_type text not null default 'sealah',
  phase text not null,
  -- role_reveal|night|dawn|discussion|vote|runoff|execution|ended
  phase_deadline_at timestamptz,
  round int not null default 0,                -- رقم الليلة/اليوم
  state jsonb not null default '{}',           -- service role فقط: الأدوار وكل الأسرار
  public_state jsonb not null default '{}',    -- الأحياء، الأموات (بدون أدوار حتى كشفهم)
  settings jsonb not null default '{}',
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table player_secrets (
  session_id uuid not null references game_sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  auth_uid uuid not null,                      -- denormalized لـ RLS مباشر
  secret jsonb not null,
  -- مثال: {"role":"ghoul","mates":["p3","p7"]}
  -- أو:   {"role":"seer","results":[{"round":1,"target":"p2","isMonster":false}]}
  updated_at timestamptz not null default now(),
  primary key (session_id, player_id)
);

-- قدرات الليل والتصويت تمر عبر game-action وتُسجل في state؛
-- جدول votes (النمط الموحد) يُستخدم لتصويت النهار:
create table votes (
  session_id uuid not null references game_sessions(id) on delete cascade,
  round int not null,
  phase text not null,                         -- vote | runoff
  voter_id uuid not null references players(id),
  target_id uuid not null,                     -- player id أو 'skip'
  created_at timestamptz not null default now(),
  primary key (session_id, round, phase, voter_id)
);

create table banned_words (word text primary key);  -- لأسماء اللاعبين المستعارة
```

### RLS
- `player_secrets`: policy وحيدة — `for select using (auth.uid() = auth_uid)`. **لا policies كتابة لأي جدول.**
- `game_sessions`: لا select مباشر للعملاء إطلاقاً — view `session_public` (الأعمدة العامة فقط) + `revoke select` على الجدول من `anon`/`authenticated`.
- `votes`: لا select للعملاء — نتائج التصويت تُبث **بعد** إغلاق المرحلة فقط (لا يُرى التصويت الجاري — يفسد اللعبة).

## 6. الـ Realtime

النمط الموحّد: قناة `room:{code}`، بث `state_update` snapshots عامة كاملة (لا diffs)، snapshot أولي بـ select عند كل فتح/استعادة، presence + heartbeat كل 20s.

**خصوصية الأسرار:** عند تغيّر سرّ لاعب (نتيجة فحص جديدة للعرّاف) يُبث على القناة العامة إشعار `secret_changed` **بدون محتوى وبدون تحديد اللاعب** (يُبث للجميع دورياً مع تحولات المراحل حتى لا يكشف التوقيت شيئاً)، وكل جوال يعيد جلب سرّه عبر RLS عند كل تحول مرحلة.

## 7. مواصفة اللعبة

**اللاعبون:** 5–16. **الأدوار (MVP):**

| الدور | الفريق | القدرة |
|------|--------|--------|
| مواطن | أهل الديرة | لا قدرة — الإقناع سلاحه |
| العرّاف | أهل الديرة | كل ليلة يفحص لاعباً: "من الوحوش / بريء" |
| الحارس | أهل الديرة | كل ليلة يحمي لاعباً (يجوز نفسه؛ لا يكرر نفس الهدف ليلتين متتاليتين) |
| الغول | الوحوش | الوحوش يتفقون على ضحية كل ليلة؛ يعرفون بعضهم منذ البداية |

**التوزيع:** 5–6 لاعبين: غول واحد • 7–9: غولان • 10–13: ثلاثة • 14–16: أربعة. العرّاف والحارس موجودان دائماً من 6 لاعبين فأعلى (في 5: عرّاف فقط). *(افتراضات MVP معتمدة — تصبح configurable لاحقاً.)*

**الإعدادات (للمضيف):** مدة النقاش (2/3/5 دقائق) • مدة الليل (60s) • مدة التصويت (45s).

**تدفق المراحل:**
```
role_reveal: كل جوال يعرض دور صاحبه سراً (15s). الوحوش يرون أسماء بعضهم.
             الشاشة: "تعرّف على دورك… ولا تُرِ جوالك أحداً"
night: الشاشة تظلم + صوت أجواء ("الديرة نامت").
       جوالات الوحوش: قائمة الأحياء للاختيار المشترك
       العرّاف: يختار من يفحص → النتيجة تظهر له فوراً في سرّه
       الحارس: يختار من يحمي
       المواطنون: شاشة "نائم" + زر تفاعل وهمي (حتى لا يكشف غيابُ التفاعل دوراً)
dawn: الشاشة تعلن: ضحية الليلة (إن لم يحمها الحارس) أو "نجت الديرة الليلة"
      + صوت مناسب. دور الضحية لا يُكشف (يزيد الغموض)
discussion: مؤقت نقاش — الكلام حقيقي وجهاً لوجه؛ الشاشة تعرض الأحياء والمؤقت فقط
vote: كل حي يصوّت من جواله: لاعب أو "تخطّي". الأكثرية تطرد.
      تعادل → runoff: جولة إعادة بين المتعادلين فقط (مرة واحدة)؛
      تعادل ثانٍ أو فوز "تخطّي" = لا طرد
execution: المطرود يُكشف دوره للجميع على الشاشة (لحظة الذروة — صوت + مهلة درامية)
win_check: الوحوش = 0 → فوز الديرة | الوحوش ≥ الأبرياء الأحياء → فوز الوحوش
           وإلا → night التالية
ended: شاشة النتيجة: كل الأدوار تنكشف + سجل ليالي اللعبة
```

**وضع الروح (المطرود/الضحية):** جواله يتحول لوضع الروح — **يرى كل الأدوار والأحداث السرية** (متعة المشاهد العليم)، ويرسل reactions محدودة (😱🔥😂👀) تطفو على الشاشة. **قطع أي قناة تسريب:** لا نص، والـ reactions تُبث بتأخير عشوائي 2–5 ثوانٍ وبدون اسم المرسل — حتى لا يكون توقيتها أو مصدرها إشارة.

**قواعد محسومة (لا اجتهاد):**
- العرّاف يفحص وحشاً محمياً: الفحص يكشف الحقيقة دائماً (الحماية ضد الافتراس فقط).
- اختيار الوحوش: آخر اختيار لكل وحش عند انتهاء المهلة؛ اختلفوا → الهدف الأكثر اختياراً؛ تعادل → عشوائي (seed موثق في state). كل الوحوش صامتون → لا ضحية.
- لاعب منقطع أثناء الليل ولم يستخدم قدرته: تُتخطى تلك الليلة فقط؛ يبقى في اللعبة.
- لاعب منقطع لم يصوّت: صوته يسقط؛ الأكثرية تُحسب من المصوّتين فعلاً.
- انسحاب لاعب نهائياً (طرد من المضيف): يُعامل كموت بلا كشف دور حتى نهاية اللعبة، و`win_check` يُعاد تقييمه فوراً.

## 8. الميزات (Phased)

### Phase 1 — اللعبة كاملة
1. حساب مضيف + غرفة + QR + lobby (النمط الموحد).
2. نموذج الأسرار كاملاً (player_secrets + RLS + إشعار secret_changed).
3. اللعبة كاملة (§7) بكل القواعد المحسومة + وضع الروح.
4. **أصوات الأجواء الأساسية في v1 وليس لاحقاً** (ليل/فجر/كشف) — الرهبة جزء من اللعبة لا تجميل؛ بدون صوت تفقد اللعبة نصف أثرها.
5. أدوات المضيف: طرد لاعب، إنهاء جلسة، تعديل الإعدادات في الـ lobby.

### Phase 2 — صقل وأدوار إضافية (بعد جلسة اختبار حقيقية)
6. دور "السعلاة" (وحش ثانٍ بقدرة تشويش: مرة في الجلسة تجعل نتيجة العرّاف تظهر معكوسة) ودور "الشاعر" (مرة في الجلسة يلغي تصويت نهار) — **يُفصَّلان حينها، لا تنفّذ الآن**.
7. إحصاءات نهاية الجلسة (أكثر من نجا، أدق عرّاف...).

## 9. Edge Cases و Error Handling

| الحالة | المعالجة الملزمة |
|--------|------------------|
| جوال قفل أثناء الليل (الأخطر — قد يحمل قدرة) | rejoin يعيده **لواجهة قدرته الحالية** فوراً؛ المهلة تستمر؛ لم يلحق → قاعدة التخطي §7 |
| سرّ وصل لغير صاحبه | غير ممكن بنيوياً (RLS + لا بث للأسرار)؛ اختبار الاختراق في §13 إلزامي قبل أي UI |
| تبويب TV انقفل | استعادة كاملة من snapshot؛ الأصوات تُستأنف حسب المرحلة |
| ضغط مزدوج / تغيير الاختيار الليلي | الاختيار قابل للتغيير حتى نهاية المهلة (آخر اختيار يُعتمد)؛ التصويت النهاري نهائي بمجرد الإرسال (primary key يمنع التكرار) |
| لاعب ينضم بعد البدء | روح مشاهدة فقط؛ يلعب الجلسة القادمة (يُخبر بوضوح) |
| عدد اللاعبين هبط تحت الحد أثناء اللعب | اللعبة تستمر؛ `win_check` يحسم طبيعياً |
| Realtime انقطع | النمط الموحد: إعادة اشتراك + snapshot + إعادة جلب السر |
| تلاعب بوقت العميل / action متأخر | السيرفر يحكم؛ يُرفض |
| state فاسدة | Zod validation على كل تحويل مرحلة؛ الفشل يوقف الكتابة بخطأ صريح |

## 10. متطلبات غير وظيفية

- RTL-first، نصوص الشاشة من 4 أمتار، تباين عالٍ، أنيميشن خفيف.
- مسح QR → lobby <10s • action → الشاشة <1s • كشف الدور على الجوال <1s بعد role_reveal.
- **الأمان فوق كل شيء:** فحص دوري (اختبار آلي في CI) أن لا استعلام anon يصل لأي سر.
- Structured logs (roomCode, sessionId, action, phase, latency) → Sentry للأخطاء.
- pg_cron يومي للتنظيف.

## 11. هيكل المشروع

```
sealah/
├── apps/web/
│   ├── app/host/  app/tv/[code]/  app/play/[code]/
│   └── lib/
├── packages/game-core/        # sealahModule + __tests__ (التوزيع، الليل، التعادل)
├── supabase/
│   ├── migrations/
│   └── functions/             # rooms / game-action / advance-phase
├── public/sounds/             # night.mp3, dawn.mp3, reveal.mp3 ...
├── e2e/                       # Playwright: جلسة 6 لاعبين كاملة
└── CLAUDE.md
```

## 12. CLAUDE.md (للريبو)

```markdown
# Sealah — Context for Claude Code

## Project Overview
Arabic web party game: hidden-roles social deduction themed on Arabian
folklore (ghouls among villagers). TV screen (/tv/{code}) is the stage with
ambient audio; phones (/play/{code}) hold each player's SECRET role, night
abilities, and votes. Guests join via QR. One of four sibling standalone
game experiments sharing stack/conventions.

## Tech Stack
Next.js 14 (TS strict), Tailwind (RTL), Zustand, Supabase (Postgres +
Anonymous/Email Auth + Realtime + Edge Functions/Deno), packages/game-core
(pure TS), Vitest + Playwright.

## Architecture Rules
- Server-authoritative: clients never write state; Edge Functions only.
- THREE-LAYER STATE — invariant #1 of this repo:
  state (server-only: roles, night targets, seer results),
  public_state (broadcast: alive/dead/phase only),
  player_secrets (RLS: owner only). A secret reaching any other client,
  broadcast, or readable view is a critical bug; stop and fix before
  anything else.
- secret_changed notifications carry NO content and NO player identity;
  phones re-fetch their own secret via RLS on every phase change.
- Ghost reactions: broadcast with random 2–5s delay, no sender identity.
- game-core pure TS; randomness via injected seed (reproducible tests).
- Broadcasts are full public snapshots; timers via phase_deadline_at,
  advance-phase idempotent (+2s grace).

## Code Conventions
- camelCase TS, snake_case DB. Zod at every boundary.
- Edge Functions: try/catch + structured logs + explicit errors.
- Arabic strings in one file per surface.

## CRITICAL — Do NOT
- Do NOT put roles/targets/seer-results in public_state, broadcasts,
  logs, or any client-readable view. Ever.
- Do NOT let clients select game_sessions or votes directly.
- Do NOT reveal a night victim's role at dawn (only at execution/ended).
- Do NOT make day votes visible while voting is open.
- Do NOT use client clocks; do NOT use localStorage except rejoin.

## How to Run
- Web: `pnpm dev` | Functions: `supabase functions serve`
- Unit: `pnpm test` | E2E: `pnpm e2e`
```

## 13. التعليمات المباشرة لـ Claude Code

1. الهيكل + CLAUDE.md + tsconfig strict + Vitest.
2. Migrations + `session_public` view + RLS — ثم **اختبار اختراق موثق وإلزامي**: بمفاتيح anon للاعبَين مختلفَين حاول: قراءة سرّ الآخر، قراءة `state`، قراءة أصوات مرحلة مفتوحة. **فشل الكل شرط للمتابعة** + أتمتة هذا الفحص في CI.
3. `game-core`: `sealahModule` كاملاً باختبارات تغطي: توزيع الأدوار لكل أحجام اللعب، قرار الوحوش (اتفاق/اختلاف/صمت)، الحماية، الفحص، التعادل والـ runoff، win_check، التخطي للمنقطعين — **قبل أي UI**.
4. Edge Functions: rooms → game-action → advance-phase.
5. الواجهات: lobby → /play (كشف الدور وواجهات الليل أولاً — قلب اللعبة) → /tv (المراحل + الأصوات) → وضع الروح.
6. Playwright: جلسة 6 لاعبين (2 وحوش) حتى فوز أحد الفريقين.
7. **توقف** — جلسة اختبار حقيقية قبل Phase 2.

**الأولويات:** سلامة الأسرار > كل شيء آخر بلا استثناء • موثوقية rejoin أثناء الليل > أي ميزة • الإيقاع والأجواء (أصوات، مهل درامية) > ميزات إضافية.

**اسأل تركي عند:** اعتماد الاسم • أي قاعدة لعب غير منصوصة (لا تخمّن) • مصدر ملفات الأصوات (جاهزة أم تُنتج).

## 14. على ذمة تركي (خارج Claude Code)

1. اعتماد الاسم وفحص النطاق.
2. توفير/اعتماد ملفات الأصوات (ليل/فجر/كشف/فوز) — مكتبات مجانية مقبولة لـ v1.
3. **جلسة اختبار حقيقية بـ 6–8 لاعبين بعد Phase 1** — راقب تحديداً: هل مدة النقاش الافتراضية مناسبة؟ هل وضع الروح ممتع فعلاً؟
4. قرار الأدوار الإضافية (سعلاة/شاعر) بعد الجلسة التجريبية.
