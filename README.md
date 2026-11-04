# Prompt chain tool 

Superadmin-only tool for building and running multi-step prompt chains on top of the
same Supabase project as the caption app and admin panel.

## What it does

| Requirement | Where |
|---|---|
| Superadmins only (`profiles.is_superadmin = true`) | `proxy.ts` checks every route, `lib/auth.ts` checks again in every page/action/API route, and Supabase RLS (`is_superadmin()`) checks a third time |
| Create / update / delete a prompt chain | Home page → **New chain**; chain page → **Edit**, **Activate/Deactivate**, **Duplicate**, **Delete** |
| Create / update / delete a step | Chain → **Steps** tab → **Add step**, pencil, bin |
| Reorder steps | Drag the grip handle, or the ↑ / ↓ buttons (keyboard and mobile friendly). `{{step_N}}` references are renumbered automatically so prompts keep pointing at the same step |
| Generate media from a chain | Chain → **Run** tab: upload / pick / link an image, add optional instructions, and watch each step's output appear as it finishes. Any line of the final output can be published as a caption in the caption app |
| View media produced by a chain | Chain → **Media** tab: every run with its image, final output, each step's output, timing, and which captions were published |
| Dark / light / system mode | Toggle in the top bar (and on the login page); saved in a cookie |

## Prompt variables

| Variable | Filled with |
|---|---|
| `{{user_prompt}}` | Text typed in "Extra instructions" on the Run tab |
| `{{previous_output}}` | Output of the step right before this one |
| `{{step_N}}` | Output of step N (must be an earlier step) |

Problems (a step using a later step, an unknown variable) are highlighted in red with a note.
Tick **Send the image to this step** on any step that needs to see the image.

## Setup

1. **SQL**: Supabase → SQL Editor → run `supabase/week8.sql` (after your week 6 and week 7 SQL).
2. **Env vars** (local `.env.local` and Vercel → Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: same as the caption app
   - `GEMINI_API_KEY`: same as the caption app
3. **Supabase Auth redirect**: Supabase → Authentication → URL Configuration → Redirect URLs →
   add `https://YOUR-NEW-APP.vercel.app/**` (and `http://localhost:3000/**` for local).
4. `npm install` then `npm run dev`.

Built with Next.js 16, Supabase, and the Gemini REST API.

