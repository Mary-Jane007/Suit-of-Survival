# Safety

Suit of Survival is a recreational game. These rules apply to the owner dashboard, announcements, imported text, proposed card copy, and anything a contributor adds.

## In the product

- Elimination is a digital status only. It changes nothing outside the app.
- A player can always stop. Stopping is not a punishment and does not humiliate them.
- No real danger, violence, weapons, dangerous stunts, threats, or physical punishment.
- Physical challenges, when a later phase adds them, stay optional, low-risk, and indoor. A phone version sits beside the physical one. A pass scores nothing.
- Hearts must not humiliate anyone or pressure a private disclosure. No secrets, no questions about bodies, homes, relationships, or a player's real life.
- Words such as death, eaten, force, and punishment do not ship as the thing the player experiences. Point values can stay. The wording has to change first.
- Art is original. No copied show logos, screenshots, characters, or artwork.

## In the database

- Card rules live in rows, not in React components.
- `cards.source` is `export` for verbatim source text and `proposal` for a later completion. Do not blur the two.
- `cards.publishable` defaults to false. Export lines that fail the rules above stay unpublished. A shippable wording is a separate proposal. It does not delete the export row.
- Hidden answers belong in `cards.secret`. Do not put them in `prompt`.
- Only the owner writes games, cards, representatives, announcements, collections, and owner settings.
- Only the server role writes rounds, answers, votes, and scores. The browser does not decide a draw, a score, or an elimination.

## This phase

Phase 2 does not deal a challenge and does not import the deck. If you are adding card text, stop. That work is Phase 3, and it still has to pass this file.
