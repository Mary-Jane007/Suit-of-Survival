# Suit of Survival

Suit of Survival is a dark, original card night. This branch has the Next.js shell, email auth, guest join, an owner dashboard, a lobby, and the Phase 3 library: games, cards, representatives, and announcements stored as rows.

The deck is loaded by `supabase/migrations/20261106200100_phase3_content.sql`, which `scripts/phase3-content.mjs` generates. Each row is marked `export` or `proposal`. Export lines that fail [SAFETY.md](SAFETY.md) stay stored and unpublished. The 2 of Diamonds cipher stays out of play with an empty secret. No solution is invented for it.

A live room deals published, in-play cards and scores them on the server. The shared screen and phone controllers are a later phase. Collections are a later phase.

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

`npx supabase db reset` applies `supabase/migrations`, including the Phase 3 deck, then the comment-only `supabase/seed.sql`. Email confirmation is off in `supabase/config.toml`, so the first local signup can sign in immediately.

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

## What you can do

Without a live Supabase project, the app builds and the landing page, How to play, the library shell, and the owner shell render. Forms submit a configuration message. No rows can be read or written.

With `npx supabase db reset` or `npx supabase db push`, plus keys in `.env.local` and the first account signed in as owner:

- Land on SUIT OF SURVIVAL / THE GAME HAS BEGUN and open Enter, the library, and How to play.
- Open a published game and read the shippable cards. Hidden answers are not in that response.
- Edit a game, duplicate it, delete it by typing the slug, and add a proposal card.
- Edit a card's prompt, rounds, timer, question, hints, scoring, representative, draft or publish, and the hidden answer.
- Edit representative dialogue for Sable Voss, Ivo Quill, Noa Veld, Maren Holt, and Tess Calder.
- Preview announcement screens from the dashboard: card detected, rules, countdown, started, paused, success, and game over.
- Open a lobby. Starting the draw, pausing, scoring, and rejoining need the server key.

## Routes

| Path | Who |
| --- | --- |
| `/` | Anyone |
| `/enter` | Anyone. Join needs the server key. Opening a room needs a signed-in account. |
| `/library`, `/library/[slug]` | Anyone. Published, in-play cards only. |
| `/how-to-play` | Anyone |
| `/auth/sign-in`, `/auth/sign-up` | Anyone |
| `/play/[code]` | The host and joined players. The server key deals and scores. |
| `/owner` | The owner account only |
| `/owner/games/new`, `/owner/games/[id]` | Owner. Create and edit games. |
| `/owner/cards/[id]` | Owner. Hidden answers load here. |
| `/owner/representatives/[id]` | Owner |
| `/owner/announcements`, `/owner/announcements/[slug]` | Owner. Preview, no live room. |

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test:engine
```

## Play

The host opens a room. A player joins with a display name, or with an account. The same room code returns the same participant row. The host starts, pauses, resumes, and ends. A player can stop. Stopped is not eliminated.

Draws come from published, in-play cards. A dealt card is not drawn again unless the 10 of Hearts assigns it. The length defaults to 8 and follows `rules.draws` when the server can read it. Digital elimination runs only when that game has it turned on, and only for a unique lowest score at the end.

Clients send moves. They do not send scores. If a card has no stored answer, figure, or defined result, the room says so and writes no points.

The play view subscribes to one realtime channel, `session:<id>`. Hidden answers stay in `cards.secret`.

## Table

Open a table while signed in. That room is `real_life` and uses one code.

- `/play/<code>` is the host. Pause, resume, extend the timer by 30 seconds, shorten it by 15, skip, reveal a stored hint, reveal a stored answer, end, and restart. Skip writes no score. The answer is not sent to a phone. The board sees it only after the host reveals it.
- `/play/<code>/board` is the TV. It shows the card, suit, representative, rules, countdown, announcements, player list, and results. It does not accept moves. Announcements play at the start, the rules, the draw, a pause, a success, and game over.
- `/play/<code>/phone` is a controller. The seat role is `phone`. The board seat role is `board`. A player can stop. A physical task stays optional, and the phone line is shown next to it.

Phones join before the host starts, so they are in the draw. Two browsers, or a private window, keep separate phone cookies.

Local steps when Supabase is on this machine:

```bash
npx supabase start
npx supabase db reset
```

Copy the URL and keys into `.env.local` from `npx supabase status`. Do not invent them. Then `npm run dev`. Sign in, open a table, open the board on one screen, join two phones, and start. The server scores the round.

This environment has no Supabase project. `npm run test:engine` is the proof that a board plus two phones finish a published puzzle, a client score is ignored, the answer stays off the phone, a skip writes no points, and the timer moves only by the server clock.

## Not in this phase

Collections are later work. Announcement previews on the dashboard still do not require a live room.
