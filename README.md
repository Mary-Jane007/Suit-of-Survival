# Suit of Survival

A real-life multiplayer card arena. One screen runs the room. Phones join with a code and answer there. Scores, clears, and benching are digital. Players can stop at any time.

The deck starts from the Notion export. Written Hearts and Diamonds games keep their rules, including the original Dutch notes. Clubs, Spades, and the empty Diamond pages were blank, so those cards are editable starter games.

## Run

```bash
npm install
npm run dev
```

Open the owner panel, claim the table, and put that browser on the television. Everyone else joins the room code from a phone.

`npm test` checks the scoring engine and a two-player room. `npm run build` compiles the app and applies database migrations when `DATABASE_URL` is set. Without it, the app uses a local Postgres-compatible database in `.data/`.

## Owner key

Set `OWNER_ACCESS_CODE` before exposing the site. The local dev script allows the first claim without that key. Do not rely on that outside this machine.
