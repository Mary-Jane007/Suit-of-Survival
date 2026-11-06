# Suit of Survival

Phase 2 foundation for a dark, original card night. This branch has the Next.js shell, the Supabase schema, email auth, guest join, an owner dashboard, and a lobby. It does not deal a challenge, run multiplayer play, or start real-life mode.

Card text stays out of the database until Phase 3. Rules for that import are in [SAFETY.md](SAFETY.md).

## Run the app

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

Set `.env.local` before you start the dev server. `npm run dev` reads it on startup. The public URL and key are also baked in at `npm run build`, so set them before a production build too.

With the env file still empty, the app builds and the landing page, How to play, and the route shells render. Pages that read or write the database tell you what is missing.

Do not commit `.env.local`. Do not put keys in git.

## Supabase

This repository does not include a hosted project or any API keys. You connect one.

### Local, with Docker

```bash
npx supabase start
npx supabase db reset
npx supabase status
```

`npx supabase db reset` applies `supabase/migrations` and the empty `supabase/seed.sql`. Email confirmation is off in `supabase/config.toml`, so the first local signup can sign in immediately.

From `npx supabase status`, copy:

- API URL → `NEXT_PUBLIC_SUPABASE_URL`
- anon key, or the publishable key if that is what the CLI prints → `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- service_role key → `SUPABASE_SERVICE_ROLE_KEY`

Studio is at [http://127.0.0.1:54323](http://127.0.0.1:54323) after `npx supabase start`.

### Hosted project

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Then, in the Supabase dashboard, open Project Settings → API and copy the project URL and keys into `.env.local`. Use the names in `.env.example`. A new project uses a publishable key and a secret key. An older project uses the anon key and the service_role key. Set one of each pair.

Hosted projects often require email confirmation. Sign up, open the link in the message, then sign in. While you are setting the project up you can turn off Confirm email under Authentication. The first confirmed account is the owner. Every account after that is a player.

Guest join writes a participant with `user_id` null, so it needs the secret or service_role key on the server. Without that key, a signed-in host can still open a room. A guest sees a configuration message instead of a seat.

## What you can do in this phase

- Land on SUIT OF SURVIVAL / THE GAME HAS BEGUN and open Enter, the library, and How to play.
- Create an account. The first profile is the only owner.
- Open the owner dashboard. Empty states are counts and lists from the database.
- Sign in and open a room. Share the code. A guest joins with a display name and no account.
- See the lobby. Refresh it to see a new name. No card is dealt.

## Routes

| Path | Who |
| --- | --- |
| `/` | Anyone |
| `/enter` | Anyone. Join needs the server key. Opening a room needs a signed-in account. |
| `/library` | Anyone. Published games only. |
| `/how-to-play` | Anyone |
| `/auth/sign-in`, `/auth/sign-up` | Anyone |
| `/play/[code]` | The host, or anyone when the server key is set |
| `/owner` | The owner account only |

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```

## Not in this phase

Phase 3 is the card import, owner editing, and one published card. Phase 4 is multiplayer play. Phase 5 is the shared screen and phones. Do not seed the 52 cards here.
