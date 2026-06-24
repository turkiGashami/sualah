# نشر سُعلاة على CranL (Application from Git)

المستودع: **https://github.com/turkiGashami/sualah** (خاص)
الواجهة: Next.js 14 (pnpm monorepo، التطبيق في `apps/web`). الـ backend كامل على Supabase
(منشور مسبقاً) — CranL يستضيف الواجهة فقط.

## الخطوات في لوحة CranL

1. **اربط GitHub:** بوّب **GitHub** في CranL وامنح وصولاً لمستودع `sualah`
   (لأنه خاص). أو اجعله عاماً إن كان أسهل.
2. **New Application → Application from Git → اختر `turkiGashami/sualah`.**
3. **إعدادات البناء** (مهمة لأنه monorepo بـ pnpm):
   | الحقل | القيمة |
   |------|--------|
   | Root directory | `/` (جذر المستودع — لا تختر `apps/web`) |
   | Install command | `pnpm install --frozen-lockfile` |
   | Build command | `pnpm --filter @sualah/web build` |
   | Start command | `pnpm --filter @sualah/web start` |
   | Node version | 22 (مثبّت في `.nvmrc` — pnpm 11 يتطلّب Node ≥ 22.13) |

   التطبيق يستمع على المنفذ من متغيّر `PORT` (يحقنه CranL تلقائياً).

4. **متغيّرات البيئة** (عامة وآمنة — لازمة وقت البناء):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://eiooasvslicpmmhuhdei.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_jjfIvyCWT82KsdzgkQtyTQ_L84zs8bA
   # اختياري — تحليلات Google (GA4): فعّلها بإضافة معرّف القياس
   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
   ```
   > لا تضع `service_role` هنا أبداً — الواجهة لا تحتاجه.

5. **Deploy.** بعد نجاح البناء تحصل على رابط CranL — افتح `/host` منه، والـ QR
   يستخدم نطاق CranL تلقائياً.

## Supabase — لا تغيير مطلوب
- الدوال تسمح بكل الأصول (CORS `*`)، والدخول المجهول لا يحتاج ضبط نطاق.
- لاحقاً عند إضافة دخول إيميل/Google: أضف نطاق CranL في
  Supabase → Authentication → URL Configuration.

## كل دفعة (push) جديدة
CranL يعيد البناء والنشر تلقائياً من فرع `main` (إن فعّلت auto-deploy).
