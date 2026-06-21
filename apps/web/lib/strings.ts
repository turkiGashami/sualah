// Arabic copy + labels for all surfaces, in one file (§ code conventions).
import type { Role, Phase } from "@sualah/game-core";

export const roleLabel: Record<Role, string> = {
  villager: "مواطن",
  seer: "العرّاف",
  guard: "الحارس",
  ghoul: "غول",
};

export const roleEmoji: Record<Role, string> = {
  villager: "🧕",
  seer: "🔮",
  guard: "🛡️",
  ghoul: "👹",
};

export const roleTagline: Record<Role, string> = {
  villager: "لا قدرة لك — الإقناع سلاحك. اكشف الغيلان بالنقاش والتصويت.",
  seer: "كل ليلة افحص لاعباً لتعرف إن كان من الوحوش أم بريئاً.",
  guard: "كل ليلة احمِ لاعباً من الافتراس (يجوز نفسك)، ولا تكرّر الهدف ليلتين متتاليتين.",
  ghoul: "أنت من الغيلان. اتفقوا في الليل على ضحية، وتخفّوا في النهار.",
};

export const phaseLabel: Record<Phase, string> = {
  role_reveal: "تعرّف على دورك",
  night: "الديرة نامت…",
  dawn: "بزغ الفجر",
  discussion: "النقاش",
  vote: "التصويت",
  runoff: "إعادة التصويت",
  execution: "ساعة الحكم",
  win_check: "…",
  ended: "انتهت اللعبة",
};

export const ui = {
  appName: "سُعلاة",
  tagline: "وحوشٌ متخفّون بين أهل الديرة",
  hostCta: "ابدأ غرفة على الشاشة",
  joinCta: "انضم بالكود",
  enterCode: "أدخل الكود",
  yourName: "اسمك",
  join: "انضم",
  start: "ابدأ اللعبة",
  waiting: "بانتظار اللاعبين…",
  players: "اللاعبون",
  scanToJoin: "امسح الكود للانضمام",
  needFive: "تحتاج 5 لاعبين على الأقل للبدء",
  settings: "الإعدادات",
  discussionMin: "مدة النقاش",
  tapWhenReady: "اضغط لتسمع الأجواء وابدأ",
  dontShowPhone: "لا تُرِ جوالك أحداً",
  sleeping: "نائم…",
  fakeTap: "اضغط للتفاعل",
  pickVictim: "اختاروا ضحية الليلة",
  pickInspect: "من تفحص الليلة؟",
  pickProtect: "من تحمي الليلة؟",
  chooseToExpel: "صوّت لطرد المشبوه",
  skip: "تخطّي",
  youVoted: "تم تصويتك",
  ghostMode: "وضع الروح",
  ghostBlurb: "خرجت من اللعبة — صرت تشاهد كل الأسرار. أرسل تفاعلاً يطفو على الشاشة.",
  victimDawn: (name: string) => `افترس الغيلانُ ${name} الليلة`,
  safeDawn: "نجت الديرة الليلة — لا ضحية",
  expelled: (name: string, role: string) => `طُرد ${name}… وكان ${role}`,
  noExpel: "لم تُجمِع الديرة على أحد — لا طرد اليوم",
  villageWin: "فازت الديرة! نُقّيت الأرض من الغيلان",
  monstersWin: "فازت الغيلان! ابتُلعت الديرة",
  alive: "حيّ",
  dead: "خارج",
  round: (n: number) => `الليلة ${n}`,
  connecting: "جارٍ الاتصال…",
};
