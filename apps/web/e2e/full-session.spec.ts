import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

// A full 7-player session (2 ghouls) driven to a team win (§13.6). Each player
// gets an isolated browser context → its own anonymous identity. The driver is
// REACTIVE: every tick it reads each phone's actual screen and acts on what's
// really there (no assumed model that could drift). Village always lynches a
// living ghoul, so the village wins. Requires a live Supabase (functions
// deployed, anon sign-ins on, anon rate limit raised for repeated runs).

const N = 7;
const NAMES = Array.from({ length: N }, (_, i) => `لاعب${i + 1}`);

interface P {
  ctx: BrowserContext;
  page: Page;
  name: string;
  alive: boolean;
  role?: "ghoul" | "seer" | "guard" | "villager";
}

async function newPlayer(browser: Browser, code: string, name: string): Promise<P> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/play/${code}`);
  const nameInput = page.getByPlaceholder("اسمك");
  await nameInput.fill(name);
  await page.getByRole("button", { name: "انضم" }).click();
  await expect(nameInput).toBeHidden({ timeout: 20_000 }); // join landed
  return { ctx, page, name, alive: true };
}

const bodyText = (page: Page) => page.innerText("body");
const isEnded = async (tv: Page) => (await tv.getByText(/فازت/).count()) > 0;
const snap = async (page: Page) =>
  (await bodyText(page)).replace(/\s+/g, " ").trim().slice(0, 90);

async function clickName(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: false }).first().click();
}
async function clickSkip(page: Page): Promise<void> {
  await page.getByRole("button", { name: "تخطّي" }).click();
}

// Read roles from the role-reveal cards (unambiguous labels).
async function detectAllRoles(players: P[]): Promise<void> {
  for (const p of players) {
    await p.page.waitForFunction(
      () => /غول|العرّاف|الحارس|مواطن/.test(document.body.innerText),
      { timeout: 25_000 },
    );
    const t = await bodyText(p.page);
    p.role = /غول/.test(t) ? "ghoul" : /العرّاف/.test(t) ? "seer" : /الحارس/.test(t) ? "guard" : "villager";
  }
  // eslint-disable-next-line no-console
  console.log("roles:", players.map((p) => `${p.name}=${p.role}`).join(", "));
}

// One reactive pass: each living player acts on whatever its phone currently shows.
async function driveOnce(players: P[]): Promise<void> {
  for (const p of players) {
    if (!p.alive) continue;
    const t = await bodyText(p.page);

    if (/وضع الروح/.test(t)) {
      p.alive = false;
      continue;
    }
    if (/اختاروا ضحية|من تفحص|من تحمي/.test(t)) {
      // ghoul / seer / guard: act on the first available target
      const btn = p.page.locator(".grid button").first();
      if (await btn.count()) await btn.click().catch(() => {});
    } else if (/صوّت لطرد|إعادة التصويت/.test(t)) {
      if (p.role === "ghoul") {
        await clickSkip(p.page).catch(() => {});
      } else {
        const target = players.find((x) => x.alive && x.role === "ghoul");
        if (target) await clickName(p.page, target.name).catch(() => clickSkip(p.page).catch(() => {}));
        else await clickSkip(p.page).catch(() => {});
      }
    }
    // role_reveal / dawn / discussion / execution: nothing to do (timers advance)
  }
}

test("a 7-player session plays to a team win", async ({ browser }) => {
  test.setTimeout(220_000);

  const hostCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  await host.goto("/host?fast=1");
  const codeEl = host.getByTestId("room-code");
  await expect(codeEl).toBeVisible({ timeout: 20_000 });
  const code = (await codeEl.textContent())!.trim();
  expect(code).toHaveLength(4);

  const players: P[] = [];
  for (const name of NAMES) players.push(await newPlayer(browser, code, name));

  await expect(host.getByRole("button", { name: "ابدأ اللعبة" })).toBeEnabled({ timeout: 25_000 });
  await host.getByRole("button", { name: "ابدأ اللعبة" }).click();

  const tv = await hostCtx.newPage();
  await tv.goto(`/tv/${code}`);

  await detectAllRoles(players);

  for (let tick = 0; tick < 90 && !(await isEnded(tv)); tick++) {
    await driveOnce(players);
    if (tick % 5 === 0) {
      // eslint-disable-next-line no-console
      console.log(`tick ${tick} | tv: ${await snap(tv)} | aliveGhouls=${players.filter((p) => p.alive && p.role === "ghoul").length}`);
    }
    await tv.waitForTimeout(1500);
  }

  await expect(tv.getByText(/فازت/)).toBeVisible({ timeout: 30_000 });
  // eslint-disable-next-line no-console
  console.log("final:", await snap(tv));

  for (const p of players) await p.ctx.close();
  await hostCtx.close();
});
