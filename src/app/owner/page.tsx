"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/ui";

const SECTIONS = ["overview", "games", "cards", "representatives", "players", "sessions", "announcements", "design", "settings"] as const;

export default function OwnerPage() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("overview");
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  async function load(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Owner only.");
      setLocked(body.error === "Owner only.");
      setData(null);
      return;
    }
    setError("");
    setLocked(false);
    setData(body);
  }

  useEffect(() => {
    if (section === "overview") {
      fetch("/api/owner").then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          setError(body.error || "Owner only.");
          setLocked(body.error === "Owner only.");
        } else {
          setError("");
          setLocked(false);
          setData(body);
        }
      });
      return;
    }
    setEditing(null);
    load(section === "design" ? "settings" : section);
  }, [section]);

  return (
    <>
      <Nav />
      <main className="wide">
        <p className="kicker">Owner</p>
        <h1 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>The table</h1>
        <div className="owner-nav">
          {SECTIONS.map((item) => (
            <button key={item} className="ghost" aria-current={section === item} onClick={() => setSection(item)}>{item}</button>
          ))}
        </div>
        <p className="meta">Only the owner can edit games, cards, rules, representatives, and the arena. Players keep their own progress and cannot change the table.</p>
        <p className="error">{error}</p>
        {locked ? <p>Sign in with the owner account to edit games, cards, and rules.</p> : null}
        {section === "overview" && data && !error ? <Overview data={data as Record<string, unknown>} /> : null}
        {section === "games" && Array.isArray(data) ? (
          editing ? <GameEditor game={editing} onDone={() => { setEditing(null); load("games"); }} /> : <GameList games={data as Record<string, unknown>[]} onEdit={async (id) => { const res = await fetch("/api/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "game", id }) }); setEditing(await res.json()); }} onNew={() => setEditing({ status: "draft", format: "multiple_choice", suit: "diamonds", rank: "2", minPlayers: 1, maxPlayers: 8, timerSeconds: 60, rounds: 1, definition: { format: "multiple_choice", successPoints: 5, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionId: "a", prompt: "" } })} />
        ) : null}
        {section === "cards" && Array.isArray(data) ? <Cards cards={data as Record<string, unknown>[]} reload={() => load("cards")} /> : null}
        {section === "representatives" && Array.isArray(data) ? <Reps reps={data as Record<string, unknown>[]} reload={() => load("representatives")} /> : null}
        {section === "players" && Array.isArray(data) ? <SimpleTable rows={data as Record<string, unknown>[]} keys={["username", "role", "score", "cards"]} /> : null}
        {section === "sessions" && Array.isArray(data) ? <SimpleTable rows={data as Record<string, unknown>[]} keys={["code", "phase", "host", "players", "play_style"]} /> : null}
        {section === "announcements" && Array.isArray(data) ? <Announcements rows={data as Record<string, unknown>[]} reload={() => load("announcements")} /> : null}
        {(section === "design" || section === "settings") && data && !Array.isArray(data) ? <SettingsForm initial={data as Record<string, unknown>} focus={section} /> : null}
      </main>
    </>
  );
}

function Overview({ data }: { data: Record<string, unknown> }) {
  const active = data.active as { code?: string; phase?: string } | null;
  const activity = (data.activity as { message: string }[]) ?? [];
  return (
    <section className="stack">
      <div className="grid-2">
        <article className="panel"><span className="meta">Players</span><h2>{String(data.players)}</h2></article>
        <article className="panel"><span className="meta">Games</span><h2>{String(data.games)}</h2></article>
        <article className="panel"><span className="meta">Sessions</span><h2>{String(data.sessions)}</h2></article>
        <article className="panel"><span className="meta">Cards collected</span><h2>{String(data.clears)}</h2></article>
      </div>
      <p>{active?.code ? `Live room ${active.code} is ${active.phase}.` : "No arena is open."}</p>
      {active?.code ? <a className="btn" href={`/screen/${active.code}`}>Open the live screen</a> : <a className="ghost" href="/enter">Open an arena</a>}
      <div className="panel">{activity.map((item, index) => <p key={index}>{item.message}</p>)}</div>
    </section>
  );
}

function GameList({ games, onEdit, onNew }: { games: Record<string, unknown>[]; onEdit: (id: string) => void; onNew: () => void }) {
  return (
    <section className="stack">
      <button className="btn" onClick={onNew}>New game</button>
      <div className="lib-grid">
        {games.map((game) => (
          <button key={String(game.id)} className={`lib-card suit-${game.suit}`} onClick={() => onEdit(String(game.id))}>
            <strong>{String(game.rank)}</strong>
            <span>{String(game.name)}</span>
            <span className="meta">{String(game.status)} · {String(game.format)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function GameEditor({ game, onDone }: { game: Record<string, unknown>; onDone: () => void }) {
  const [form, setForm] = useState<Record<string, unknown>>({
    ...game,
    definitionText: typeof game.definition === "string" ? game.definition : JSON.stringify(game.definition ?? {}, null, 2),
  });
  const [error, setError] = useState("");
  function set(key: string, value: unknown) { setForm((current) => ({ ...current, [key]: value })); }
  async function save(status?: string) {
    let definition = {};
    try { definition = JSON.parse(String(form.definitionText || "{}")); } catch { return setError("The definition is not valid JSON."); }
    const res = await fetch("/api/owner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save-game",
        id: form.id,
        name: form.name,
        description: form.description,
        suit: form.suit,
        rank: form.rank,
        representativeId: form.representative_id,
        minPlayers: form.min_players,
        maxPlayers: form.max_players,
        timerSeconds: form.timer_seconds,
        materials: form.materials,
        rules: form.rules,
        rulesOriginal: form.rules_original,
        instructions: form.instructions,
        objective: form.objective,
        win: form.win_condition,
        fail: form.fail_condition,
        scoring: form.scoring_summary,
        rounds: form.rounds,
        format: form.format,
        status: status || form.status,
        safety: form.safety_note,
        definition,
      }),
    });
    const body = await res.json();
    if (!res.ok) return setError(body.error || "Could not save.");
    onDone();
  }
  return (
    <form className="stack" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <div className="grid-2">
        <label>Name<input value={String(form.name ?? "")} onChange={(event) => set("name", event.target.value)} /></label>
        <label>Format
          <select value={String(form.format ?? "host_judge")} onChange={(event) => set("format", event.target.value)}>
            {["multiple_choice","keywords","host_judge","custom","sequence","pattern_doors","number_contest","role_consensus","deduction_wolf","transfer","pending_trust","pending_guess","pending_alliance","pending_risk","intuition","trade","chain","bluff_story","forehead","echo_choice","split_clue","reaction","order_coop","word_chain","unanimous"].map((format) => <option key={format}>{format}</option>)}
          </select>
        </label>
        <label>Suit
          <select value={String(form.suit ?? "diamonds")} onChange={(event) => set("suit", event.target.value)}>
            {["spades","hearts","diamonds","clubs"].map((suit) => <option key={suit}>{suit}</option>)}
          </select>
        </label>
        <label>Rank
          <select value={String(form.rank ?? "2")} onChange={(event) => set("rank", event.target.value)}>
            {["A","2","3","4","5","6","7","8","9","10","J","Q","K"].map((rank) => <option key={rank}>{rank}</option>)}
          </select>
        </label>
        <label>Minimum<input type="number" value={Number(form.min_players ?? 1)} onChange={(event) => set("min_players", Number(event.target.value))} /></label>
        <label>Maximum<input type="number" value={Number(form.max_players ?? 8)} onChange={(event) => set("max_players", Number(event.target.value))} /></label>
        <label>Timer seconds<input type="number" value={Number(form.timer_seconds ?? 60)} onChange={(event) => set("timer_seconds", Number(event.target.value))} /></label>
        <label>Rounds<input type="number" value={Number(form.rounds ?? 1)} onChange={(event) => set("rounds", Number(event.target.value))} /></label>
      </div>
      <label>Description<textarea value={String(form.description ?? "")} onChange={(event) => set("description", event.target.value)} /></label>
      <label>Rules<textarea value={String(form.rules ?? "")} onChange={(event) => set("rules", event.target.value)} /></label>
      <label>Instructions<textarea value={String(form.instructions ?? "")} onChange={(event) => set("instructions", event.target.value)} /></label>
      <label>Objective<input value={String(form.objective ?? "")} onChange={(event) => set("objective", event.target.value)} /></label>
      <label>Clear condition<input value={String(form.win_condition ?? "")} onChange={(event) => set("win_condition", event.target.value)} /></label>
      <label>Miss condition<input value={String(form.fail_condition ?? "")} onChange={(event) => set("fail_condition", event.target.value)} /></label>
      <label>Scoring<input value={String(form.scoring_summary ?? "")} onChange={(event) => set("scoring_summary", event.target.value)} /></label>
      <label>Materials<input value={String(form.materials ?? "")} onChange={(event) => set("materials", event.target.value)} /></label>
      <label>Safety note<textarea value={String(form.safety_note ?? "")} onChange={(event) => set("safety_note", event.target.value)} /></label>
      <label>Definition
        <textarea value={String(form.definitionText ?? "")} onChange={(event) => set("definitionText", event.target.value)} style={{ minHeight: 220 }} />
      </label>
      <p className="meta">Options, answers, sequences, and point values live in the definition. The arena reads that record. It does not keep a private copy in the page.</p>
      <p className="error">{error}</p>
      <div className="dock">
        <button className="btn" type="submit">Save draft</button>
        <button className="ghost" type="button" onClick={() => save("published")}>Publish</button>
        {form.id != null ? <button className="ghost" type="button" onClick={async () => { await fetch("/api/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "duplicate-game", id: form.id }) }); onDone(); }}>Duplicate</button> : null}
        {form.id != null ? <button className="ghost hot" type="button" onClick={async () => { await fetch("/api/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete-game", id: form.id }) }); onDone(); }}>Delete</button> : null}
        <button className="ghost" type="button" onClick={onDone}>Back</button>
      </div>
    </form>
  );
}

function Cards({ cards, reload }: { cards: Record<string, unknown>[]; reload: () => void }) {
  return (
    <div className="stack">
      {cards.map((card) => (
        <form key={String(card.id)} className="panel grid-2" onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await fetch("/api/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save-card", id: card.id, difficultyLabel: form.get("label"), description: form.get("description"), difficulty: form.get("difficulty"), active: form.get("active") === "on" }) });
          reload();
        }}>
          <strong className={`suit-${card.suit}`}>{String(card.rank)} {String(card.suit)}</strong>
          <label>Label<input name="label" defaultValue={String(card.difficulty_label ?? "")} /></label>
          <label>Difficulty number<input name="difficulty" type="number" defaultValue={Number(card.difficulty ?? 1)} /></label>
          <label>Meaning<input name="description" defaultValue={String(card.description ?? "")} /></label>
          <label>In the deck<input name="active" type="checkbox" defaultChecked={card.active !== false} /></label>
          <button className="ghost" type="submit">Save card</button>
        </form>
      ))}
    </div>
  );
}

function Reps({ reps, reload }: { reps: Record<string, unknown>[]; reload: () => void }) {
  const [blank, setBlank] = useState(false);
  const all = blank ? [...reps, { id: "", name: "", suit: "diamonds", enabled: true }] : reps;
  return (
    <div className="stack">
      <button className="btn" onClick={() => setBlank(true)}>New representative</button>
      {all.map((rep, index) => (
        <RepForm key={String(rep.id || index)} rep={rep} onSaved={() => { setBlank(false); reload(); }} />
      ))}
    </div>
  );
}

function RepForm({ rep, onSaved }: { rep: Record<string, unknown>; onSaved: () => void }) {
  const [portrait, setPortrait] = useState(String(rep.portrait_image ?? ""));
  return (
    <form className="panel stack" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await fetch("/api/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        action: "save-representative",
        id: rep.id || undefined,
        name: form.get("name"),
        suit: form.get("suit"),
        personality: form.get("personality"),
        style: form.get("style"),
        intro: form.get("intro"),
        rulesLine: form.get("rules"),
        startLine: form.get("start"),
        successLine: form.get("success"),
        failureLine: form.get("failure"),
        specialLine: form.get("special"),
        accent: form.get("accent"),
        enabled: form.get("enabled") === "on",
        portraitImage: portrait || null,
      }) });
      onSaved();
    }}>
      <div className="grid-2">
        <label>Name<input name="name" defaultValue={String(rep.name ?? "")} /></label>
        <label>Suit
          <select name="suit" defaultValue={String(rep.suit ?? "diamonds")}>
            <option value="">Any</option>
            {["spades","hearts","diamonds","clubs"].map((suit) => <option key={suit}>{suit}</option>)}
          </select>
        </label>
        <label>Accent<input name="accent" defaultValue={String(rep.accent ?? "#c4161c")} /></label>
        <label>Enabled<input name="enabled" type="checkbox" defaultChecked={rep.enabled !== false} /></label>
      </div>
      <label>Personality<textarea name="personality" defaultValue={String(rep.personality ?? "")} /></label>
      <label>Style<input name="style" defaultValue={String(rep.style ?? "")} /></label>
      <label>Introduction<textarea name="intro" defaultValue={String(rep.intro ?? "")} /></label>
      <label>Rules line<textarea name="rules" defaultValue={String(rep.rules_line ?? "")} /></label>
      <label>Start<input name="start" defaultValue={String(rep.start_line ?? "")} /></label>
      <label>Success<input name="success" defaultValue={String(rep.success_line ?? "")} /></label>
      <label>Failure<input name="failure" defaultValue={String(rep.failure_line ?? "")} /></label>
      <label>Special<input name="special" defaultValue={String(rep.special_line ?? "")} /></label>
      <label>Portrait
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setPortrait(String(reader.result || ""));
          reader.readAsDataURL(file);
        }} />
      </label>
      <button className="ghost" type="submit">Save representative</button>
    </form>
  );
}

function Announcements({ rows, reload }: { rows: Record<string, unknown>[]; reload: () => void }) {
  return (
    <div className="stack">
      {rows.map((row) => (
        <form key={String(row.key)} className="panel stack" onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await fetch("/api/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save-announcement", key: row.key, kicker: form.get("kicker"), title: form.get("title"), body: form.get("body"), enabled: form.get("enabled") === "on" }) });
          reload();
        }}>
          <strong>{String(row.key)}</strong>
          <label>Kicker<input name="kicker" defaultValue={String(row.kicker ?? "")} /></label>
          <label>Title<input name="title" defaultValue={String(row.title_template ?? "")} /></label>
          <label>Body<textarea name="body" defaultValue={String(row.body_template ?? "")} /></label>
          <label>Enabled<input name="enabled" type="checkbox" defaultChecked={row.enabled !== false} /></label>
          <button className="ghost" type="submit">Save announcement</button>
        </form>
      ))}
    </div>
  );
}

function SettingsForm({ initial, focus }: { initial: Record<string, unknown>; focus: "design" | "settings" }) {
  const theme = (initial.theme ?? {}) as Record<string, string | boolean>;
  const [message, setMessage] = useState("");
  return (
    <form className="stack" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const payload: Record<string, unknown> = { action: "save-settings" };
      if (focus === "settings") {
        Object.assign(payload, {
          benchThreshold: form.get("bench"),
          benchingEnabled: form.get("benching") === "on",
          benchLocksPlay: form.get("lock") === "on",
          awardCardOn: form.get("award"),
          maxPlayers: form.get("max"),
          registrationSeconds: form.get("registration"),
          countdownSeconds: form.get("countdown"),
          soundEnabled: form.get("sound") === "on",
          handSize: form.get("hand"),
        });
      } else {
        payload.theme = {
          bg: form.get("bg"),
          red: form.get("red"),
          fg: form.get("fg"),
          muted: form.get("muted"),
          displayFont: form.get("display"),
          bodyFont: form.get("body"),
          glitch: form.get("glitch") === "on",
          scanlines: form.get("scan") === "on",
        };
      }
      const res = await fetch("/api/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      setMessage(res.ok ? "Saved. The arena picks it up on the next load." : "Could not save.");
    }}>
      {focus === "settings" ? (
        <div className="grid-2">
          <label>Bench at score<input name="bench" type="number" defaultValue={Number(initial.benchThreshold ?? -20)} /></label>
          <label>Show bench status<input name="benching" type="checkbox" defaultChecked={initial.benchingEnabled !== false} /></label>
          <label>Bench stops play<input name="lock" type="checkbox" defaultChecked={initial.benchLocksPlay === true} /></label>
          <label>Award a card
            <select name="award" defaultValue={String(initial.awardCardOn ?? "success")}>
              <option value="success">On a clear</option>
              <option value="participate">For taking part</option>
              <option value="never">Never</option>
            </select>
          </label>
          <label>Player limit<input name="max" type="number" defaultValue={Number(initial.maxPlayers ?? 12)} /></label>
          <label>Registration seconds<input name="registration" type="number" defaultValue={Number(initial.registrationSeconds ?? 20)} /></label>
          <label>Countdown seconds<input name="countdown" type="number" defaultValue={Number(initial.countdownSeconds ?? 5)} /></label>
          <label>Hand size<input name="hand" type="number" defaultValue={Number(initial.handSize ?? 4)} /></label>
          <label>Sound cues<input name="sound" type="checkbox" defaultChecked={initial.soundEnabled === true} /></label>
        </div>
      ) : (
        <div className="grid-2">
          <label>Background<input name="bg" defaultValue={String(theme.bg ?? "#090909")} /></label>
          <label>Red<input name="red" defaultValue={String(theme.red ?? "#c4161c")} /></label>
          <label>Text<input name="fg" defaultValue={String(theme.fg ?? "#f4f1ea")} /></label>
          <label>Muted<input name="muted" defaultValue={String(theme.muted ?? "#9a958c")} /></label>
          <label>Display face
            <select name="display" defaultValue={String(theme.displayFont ?? "Oswald")}>
              {["Oswald", "Cinzel", "Outfit", "IBM Plex Mono"].map((font) => <option key={font}>{font}</option>)}
            </select>
          </label>
          <label>Body face
            <select name="body" defaultValue={String(theme.bodyFont ?? "Outfit")}>
              {["Outfit", "IBM Plex Mono", "Cinzel", "Oswald"].map((font) => <option key={font}>{font}</option>)}
            </select>
          </label>
          <label>Glitch titles<input name="glitch" type="checkbox" defaultChecked={theme.glitch !== false} /></label>
          <label>Scanlines<input name="scan" type="checkbox" defaultChecked={theme.scanlines !== false} /></label>
        </div>
      )}
      <button className="btn" type="submit">Save</button>
      <p className="meta">{message}</p>
    </form>
  );
}

function SimpleTable({ rows, keys }: { rows: Record<string, unknown>[]; keys: string[] }) {
  return (
    <div className="stack">
      {rows.map((row, index) => (
        <div key={index} className="player">
          {keys.map((key) => <span key={key}>{String(row[key] ?? "")}</span>)}
        </div>
      ))}
    </div>
  );
}
