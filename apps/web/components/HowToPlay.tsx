"use client";
import { useEffect, useState } from "react";
import { RoleMark, SaduBand, Crescent, SunIcon, TalkIcon, VoteIcon } from "./art";
import type { Role } from "@sualah/game-core";

const SEEN_KEY = "sualah:intro-seen";

// Auto-shows the rules once on first open (per device), skippable, and always
// re-openable via a floating "كيف تلعب؟" button. Mount on player-facing pages.
export function HowToPlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 rounded-full border-2 border-ink bg-parch px-4 py-2 text-sm font-bold text-ink shadow-hardsm transition active:scale-95"
      >
        ؟ كيف تلعب
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/70 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="my-6 w-full max-w-lg overflow-hidden rounded-lg border-2 border-ink bg-sand shadow-hard"
            onClick={(e) => e.stopPropagation()}
          >
            <SaduBand className="h-10 w-full" />
            <div className="space-y-5 p-6">
              <header className="text-center">
                <h2 className="font-stage text-4xl text-ink">كيف تلعب سُعلاة؟</h2>
                <p className="mt-2 text-ash">بين أهل الدِّيرة تتخفّى عفاريت… اكشفوهم قبل أن يفترسوكم جميعاً.</p>
              </header>

              <Section title="الأدوار">
                <RoleRow role="ghoul" name="العفريت (وحش)" desc="يعرف رفاقه، وكل ليلة يفترسون ضحيّة بصمت." danger />
                <RoleRow role="seer" name="المرّي" desc="كل ليلة يقتفي أثر لاعب: من العفاريت أم بريء." />
                <RoleRow role="guard" name="العسّاس" desc="كل ليلة يحرس لاعباً واحداً من الافتراس." />
                <RoleRow role="villager" name="ابن الديرة" desc="لا قدرة — سلاحه الإقناع والفطنة." />
              </Section>

              <Section title="مجرى الجولة">
                <Step icon={<Crescent className="h-6 w-6 text-ink" />} t="الليل" d="الدِّيرة تنام. العفاريت تختار ضحيّة، المرّي يقتفي الأثر، العسّاس يحرس — كلٌّ من جواله سرّاً." />
                <Step icon={<SunIcon className="h-6 w-6 text-clay" />} t="الفجر" d="تُعلَن ضحيّة الليلة (إن لم يحرسها العسّاس)." />
                <Step icon={<TalkIcon className="h-6 w-6 text-ink" />} t="النقاش" d="تكلّموا وجهاً لوجه — مَن المشبوه؟" />
                <Step icon={<VoteIcon className="h-6 w-6 text-ink" />} t="التصويت" d="صوّتوا لطرد واحد. المطرود يُكشف دوره للجميع." />
              </Section>

              <Section title="الفوز">
                <Step icon={<RoleMark role="villager" className="h-6 w-6 text-olive" />} t="أهل الديرة" d="يفوزون إذا طُرد كل العفاريت." />
                <Step icon={<RoleMark role="ghoul" className="h-6 w-6 text-oxblood" />} t="العفاريت" d="يفوزون إذا تساوى عددهم مع الأبرياء." />
              </Section>

              <p className="rounded-md border-2 border-ink bg-parch p-3 text-sm font-bold text-ink">
                💡 جوّالك سرّك — لا تُرِه أحداً. وإذا خرجت من اللعبة تصير «روحاً» تشاهد كل الأسرار.
              </p>

              <button onClick={close} className="btn-primary w-full text-lg">
                فهمت، يلّا نبدأ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-title text-xl text-oxblood">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function RoleRow({ role, name, desc, danger }: { role: Role; name: string; desc: string; danger?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-md border-2 border-ink bg-parch px-3 py-2">
      <RoleMark role={role} className={`h-7 w-7 shrink-0 ${danger ? "text-oxblood" : "text-ink"}`} />
      <div>
        <p className="font-bold text-ink">{name}</p>
        <p className="text-sm text-ash">{desc}</p>
      </div>
    </div>
  );
}

function Step({ icon, t, d }: { icon: React.ReactNode; t: string; d: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="text-ink">
        <span className="font-bold">{t}:</span> <span className="text-ash">{d}</span>
      </p>
    </div>
  );
}
