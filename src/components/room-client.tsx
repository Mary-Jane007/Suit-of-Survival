"use client";

import { useEffect, useState } from "react";
import { CardFace, Nav, Portrait, Timer } from "./ui";

type Room = {
  now: number;
  safety: string;
  viewer: { id: string; username: string; role: string } | null;
  you: { id: string; username: string; isHost: boolean; score: number; status: string; hand: { id: string; name: string; suit: string; rank: string }[]; entered: boolean } | null;
  session: { code: string; phase: string; playStyle: string; drawMode: string; paused: boolean; deadline: number | null };
  announcement: { kicker: string; title: string; body: string; targetId?: string } | null;
  card: { suit: string; rank: string; name: string; title: string; difficulty: string; rules: string; objective: string; materials: string; safety: string } | null;
  representative: { name: string; portraitKey: string; accent: string; line: string } | null;
  players: { id: string; username: string; ready: boolean; entered: boolean; score: number; status: string; isHost: boolean; connected: boolean }[];
  play: {
    prompt: string;
    subprompt: string;
    input: Record<string, unknown>;
    feedback: string | null;
    hint: string | null;
    revealed: string | null;
    board: Record<string, unknown> | null;
    round: number;
    rounds: number;
    deadline: number | null;
    paused: boolean;
    hostPanel: { entries: { id: string; name: string; text: string; marked: string | null }[] } | null;
    format?: string;
  } | null;
  result: { tone: string; summary: string; rows: { username: string; delta: number; total: number; success: boolean; reason: string }[] } | null;
  deck: { id: string; name: string; suit: string; rank: string }[] | null;
  history: { name: string; suit: string; rank: string }[];
  pendingNote: string | null;
  log: string[];
};

export function RoomClient({ code, mode }: { code: string; mode: "phone" | "screen" }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [number, setNumber] = useState(50);
  const [misleadTo, setMisleadTo] = useState("");
  const [misleadCard, setMisleadCard] = useState("");

  async function refresh() {
    const res = await fetch(`/api/room/${code}`, { cache: "no-store" });
    const data = await res.json();
    if (data.error) setError(data.error);
    else {
      setRoom(data);
      setError("");
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [code]);

  useEffect(() => {
    setFlipped(false);
    const id = setTimeout(() => setFlipped(true), 350);
    setOrder([]);
    setText("");
    return () => clearTimeout(id);
  }, [room?.card?.name, room?.session.phase, room?.play?.round]);

  async function send(body: Record<string, unknown>) {
    const res = await fetch(`/api/room/${code}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    else {
      setRoom(data);
      setError("");
    }
  }

  if (!room) {
    return (
      <>
        <Nav />
        <main className="narrow">Loading the arena…</main>
      </>
    );
  }

  const host = room.you?.isHost;
  const phase = room.session.phase;
  const showCard = ["detected", "intro", "rules", "registration", "countdown", "playing", "results", "oath"].includes(phase);

  return (
    <>
      <Nav />
      <main className={mode === "screen" ? "stage" : "phone"}>
        <div className="meta">
          Room {room.session.code} · {phase} · {room.session.playStyle}
          {room.pendingNote ? ` · ${room.pendingNote}` : ""}
        </div>
        {mode === "screen" ? (
          <Screen room={room} flipped={flipped} host={Boolean(host)} send={send} />
        ) : (
          <Phone room={room} flipped={flipped} send={send} order={order} setOrder={setOrder} text={text} setText={setText} number={number} setNumber={setNumber} misleadTo={misleadTo} setMisleadTo={setMisleadTo} misleadCard={misleadCard} setMisleadCard={setMisleadCard} />
        )}
        {host && mode === "screen" ? <HostDock room={room} send={send} /> : null}
        {host && mode === "phone" ? <HostDock room={room} send={send} /> : null}
        <p className="error">{error}</p>
        <p className="safety">{room.card?.safety || room.safety}</p>
        {showCard ? null : null}
      </main>
    </>
  );
}

function Screen({ room, flipped, host, send }: { room: Room; flipped: boolean; host: boolean; send: (body: Record<string, unknown>) => void }) {
  const phase = room.session.phase;
  return (
    <>
    <section className="stage-layout">
      <div>{room.card ? <CardFace suit={room.card.suit} rank={room.card.rank} name={room.card.name} flipped={flipped || phase !== "detected"} /> : <CardFace suit="spades" rank="?" flipped={false} />}</div>
      <div className="announce">
        <div className="kicker">{room.announcement?.kicker || "ARENA"}</div>
        <h2>{room.announcement?.title || room.card?.title || room.session.code}</h2>
        {phase === "results" ? null : <p>{room.announcement?.body}</p>}
        {phase === "countdown" || phase === "registration" || phase === "playing" ? (
          <Timer deadline={room.play?.deadline || room.session.deadline} now={room.now} paused={room.session.paused || room.play?.paused} />
        ) : null}
        {phase === "rules" && room.card ? <p>{room.card.rules}</p> : null}
        {phase === "playing" && room.play ? (
          <div>
            <p>{room.play.prompt}</p>
            <p className="meta">{room.play.subprompt} · Round {room.play.round}/{room.play.rounds}</p>
            <Board board={room.play.board} />
            {room.play.hint ? <p>Hint: {room.play.hint}</p> : null}
            {room.play.revealed ? <p>Revealed: {room.play.revealed}</p> : null}
            {room.play.feedback ? <p>{room.play.feedback}</p> : null}
          </div>
        ) : null}
        {phase === "results" && room.result ? <Results result={room.result} /> : null}
        {phase === "lobby" ? <Roster room={room} /> : null}
      </div>
      <aside className="rep">
        {room.representative ? (
          <>
            <Portrait portraitKey={room.representative.portraitKey} accent={room.representative.accent} />
            <strong>{room.representative.name}</strong>
            <p>{room.representative.line}</p>
          </>
        ) : (
          <>
            <Portrait portraitKey="herald" />
            <strong>The Herald</strong>
            <p>The arena is open.</p>
          </>
        )}
      </aside>
    </section>
    {host && (phase === "lobby" || phase === "results") ? (
      <div className="deck-tray">
        <Deck room={room} send={send} />
      </div>
    ) : null}
    </>
  );
}

function Phone(props: {
  room: Room;
  flipped: boolean;
  send: (body: Record<string, unknown>) => void;
  order: string[];
  setOrder: (value: string[]) => void;
  text: string;
  setText: (value: string) => void;
  number: number;
  setNumber: (value: number) => void;
  misleadTo: string;
  setMisleadTo: (value: string) => void;
  misleadCard: string;
  setMisleadCard: (value: string) => void;
}) {
  const { room, send } = props;
  const phase = room.session.phase;
  if (!room.you) return <Join code={room.session.code} viewer={room.viewer} />;
  return (
    <section className="stack">
      <div className="kicker">{room.announcement?.kicker}</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 42, margin: 0 }}>{room.announcement?.title || "Waiting"}</h2>
      <p>{room.announcement?.body}</p>
      {phase === "countdown" || phase === "registration" || phase === "playing" ? (
        <Timer deadline={room.play?.deadline || room.session.deadline} now={room.now} paused={room.session.paused || room.play?.paused} />
      ) : null}
      {room.card ? <CardFace suit={room.card.suit} rank={room.card.rank} name={room.card.name} flipped={props.flipped || phase !== "detected"} /> : null}
      {(phase === "registration" || phase === "rules") && !room.you.entered ? (
        <button className="btn" onClick={() => send({ type: "enter" })}>Step in</button>
      ) : null}
      {phase === "oath" && room.announcement?.targetId === room.you.id ? (
        <div className="choices">
          <button className="btn" onClick={() => send({ type: "betray", flag: false })}>Ally — keep the trust</button>
          <button className="ghost" onClick={() => send({ type: "betray", flag: true })}>Betray — break it</button>
        </div>
      ) : null}
      {phase === "playing" && room.play ? <PlayForm {...props} /> : null}
      {phase === "results" && room.result ? <Results result={room.result} /> : null}
      {phase !== "results" ? <Roster room={room} /> : null}
      {room.session.playStyle === "hands" && (phase === "lobby" || phase === "results") ? (
        <div className="stack">
          <span className="meta">Your hand</span>
          {room.you.hand.map((card) => (
            <button key={card.id} className="ghost" onClick={() => send({ type: "play_card", gameId: card.id })}>
              {card.rank} {card.suit} — {card.name}
            </button>
          ))}
        </div>
      ) : null}
      <p className="meta">You · {room.you.username} · {room.you.score} · {room.you.status}</p>
    </section>
  );
}

function PlayForm(props: {
  room: Room;
  send: (body: Record<string, unknown>) => void;
  order: string[];
  setOrder: (value: string[]) => void;
  text: string;
  setText: (value: string) => void;
  number: number;
  setNumber: (value: number) => void;
  misleadTo: string;
  setMisleadTo: (value: string) => void;
  misleadCard: string;
  setMisleadCard: (value: string) => void;
}) {
  const play = props.room.play!;
  const input = play.input;
  const kind = String(input.kind);
  const send = props.send;
  return (
    <div className="stack">
      <p>{play.prompt}</p>
      {play.subprompt ? <p className="meta">{play.subprompt}</p> : null}
      <Board board={play.board} />
      {kind === "choice" || kind === "pair" ? (
        <div className="choices">
          {((input.options || input.cards || []) as { id: string; label: string }[]).map((option) => (
            <button key={option.id} className="ghost" onClick={() => send({ type: "submit", payload: { choice: option.id, guess: option.id, misleadTo: props.misleadTo, misleadCard: props.misleadCard } })}>
              {option.label}
            </button>
          ))}
          {kind === "pair" ? <p className="meta">They recommend {String(input.recommendation || "")}.</p> : null}
        </div>
      ) : null}
      {play.format === "forehead" && kind === "choice" ? (
        <div className="grid-2">
          <label>Optional wrong suggestion for
            <select value={props.misleadTo} onChange={(event) => props.setMisleadTo(event.target.value)}>
              <option value="">No one</option>
              {props.room.players.filter((player) => player.id !== props.room.you?.id).map((player) => <option key={player.id} value={player.id}>{player.username}</option>)}
            </select>
          </label>
          <label>Card you suggest
            <select value={props.misleadCard} onChange={(event) => props.setMisleadCard(event.target.value)}>
              <option value="">None</option>
              {((input.options || []) as { id: string; label: string }[]).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>
      ) : null}
      {kind === "text" || kind === "story" ? (
        <form className="stack" onSubmit={(event) => { event.preventDefault(); send({ type: "submit", payload: { text: props.text } }); }}>
          <textarea value={props.text} onChange={(event) => props.setText(event.target.value)} placeholder={String(input.placeholder || "Write here")} />
          <button className="btn" type="submit">Submit</button>
        </form>
      ) : null}
      {kind === "number" ? (
        <form className="stack" onSubmit={(event) => { event.preventDefault(); send({ type: "submit", payload: { number: props.number } }); }}>
          <input type="number" min={Number(input.min ?? 0)} max={Number(input.max ?? 100)} value={props.number} onChange={(event) => props.setNumber(Number(event.target.value))} />
          <button className="btn" type="submit">Lock number</button>
        </form>
      ) : null}
      {kind === "players" ? (
        <div className="choices">
          {(input.people as { id: string; label: string }[]).map((person) => (
            <button key={person.id} className="ghost" onClick={() => send({ type: "submit", payload: { playerId: person.id } })}>{person.label}</button>
          ))}
        </div>
      ) : null}
      {kind === "doors" ? (
        <div className="doors">
          {(input.walls as string[]).map((wall) => (
            <button key={wall} className="ghost" onClick={() => send({ type: "submit", payload: { choice: wall } })}>{wall}</button>
          ))}
        </div>
      ) : null}
      {kind === "roles" ? (
        <div className="choices">
          {(input.roles as { id: string; label: string; blurb: string; points: number }[]).map((role) => (
            <button key={role.id} className="ghost" onClick={() => send({ type: "submit", payload: { role: role.id } })}>{role.label} · {role.points} · {role.blurb}</button>
          ))}
          <button className="btn" onClick={() => send({ type: "submit", payload: { accept: true } })}>Accept the table</button>
        </div>
      ) : null}
      {kind === "boolean" ? (
        <div className="choices">
          <button className="btn" onClick={() => send({ type: "submit", payload: { flag: true } })}>{String(input.trueLabel)}</button>
          <button className="ghost" onClick={() => send({ type: "submit", payload: { flag: false } })}>{String(input.falseLabel)}</button>
        </div>
      ) : null}
      {kind === "suits" ? (
        <div className="doors">
          {["spades", "hearts", "diamonds", "clubs"].map((suit) => (
            <button key={suit} className={`ghost suit-${suit}`} onClick={() => send({ type: "submit", payload: { suit } })}>{suit}</button>
          ))}
        </div>
      ) : null}
      {kind === "order" ? (
        <div className="stack">
          <div className="chip-row">
            {props.order.map((id) => {
              const item = (input.pool as { id: string; label: string }[]).find((piece) => piece.id === id);
              return <button key={id} className="chip on" onClick={() => props.setOrder(props.order.filter((piece) => piece !== id))}>{item?.label}</button>;
            })}
          </div>
          <div className="chip-row">
            {(input.pool as { id: string; label: string }[]).filter((piece) => !props.order.includes(piece.id)).map((piece) => (
              <button key={piece.id} className="chip" onClick={() => props.setOrder([...props.order, piece.id])}>{piece.label}</button>
            ))}
          </div>
          <button className="btn" onClick={() => send({ type: "submit", payload: { order: props.order } })}>Lock order</button>
        </div>
      ) : null}
      {kind === "tap" ? <button className="btn" onClick={() => send({ type: "submit", payload: { tap: true } })}>{String(input.label || "Tap")}</button> : null}
      {kind === "wait" ? <p className="meta">{String(input.message || "Watch the main screen.")}</p> : null}
      {kind === "judge" || play.hostPanel ? (
        <div className="stack">
          {(play.hostPanel?.entries || []).map((entry) => (
            <div key={entry.id} className="panel">
              <strong>{entry.name}</strong>
              <p>{entry.text || "No answer yet."}</p>
              <div className="dock">
                <button className="ghost" onClick={() => send({ type: "mark", userId: entry.id, correct: true })}>Accept</button>
                <button className="ghost" onClick={() => send({ type: "mark", userId: entry.id, correct: false })}>Refuse</button>
                <span className="meta">{entry.marked || "unmarked"}</span>
              </div>
            </div>
          ))}
          {play.hostPanel ? <button className="btn" onClick={() => send({ type: "resolve" })}>Enter judgment</button> : null}
        </div>
      ) : null}
      {play.hint ? <p>Hint: {play.hint}</p> : null}
      {play.revealed ? <p>Revealed: {play.revealed}</p> : null}
    </div>
  );
}

function Board({ board }: { board: Record<string, unknown> | null }) {
  if (!board) return null;
  const revealed = board.revealed as { label: string }[] | undefined;
  if (revealed?.length) return <p className="meta">{revealed.map((item) => item.label).join(" · ")}</p>;
  if (board.live === true) return <p className="kicker">FLASH</p>;
  if (Array.isArray(board.words)) return <p>{(board.words as string[]).join(" · ")}</p>;
  if (board.story) return <p>{String(board.story)}</p>;
  if (Array.isArray(board.others)) {
    return <div className="players">{(board.others as { name: string; card: string }[]).map((person) => <div key={person.name} className="player"><span>{person.name}</span><span>{person.card}</span></div>)}</div>;
  }
  if (board.fragment) return <p>Your fragment: {String(board.fragment)}</p>;
  if (board.current) return <p className="meta">Now: {String(board.current)}</p>;
  if (Array.isArray(board.seats)) {
    return <div className="players">{(board.seats as { name: string; role: string | null; accepted: boolean }[]).map((seat) => <div key={seat.name} className="player"><span>{seat.name}</span><span>{seat.role || "—"} {seat.accepted ? "accepted" : ""}</span></div>)}</div>;
  }
  if (board.offered) return <p>Offered {String(board.offered)} · theirs {String(board.theirs)}</p>;
  if (board.holder) return <p>{String(board.card)} is with {String(board.holder)}</p>;
  if (board.hidden) return <p className="meta">{String(board.message || "Cards stay on the phones.")}</p>;
  return null;
}

function Results({ result }: { result: NonNullable<Room["result"]> }) {
  return (
    <div className="stack">
      <p>{result.summary}</p>
      {result.rows.map((row) => (
        <div key={row.username} className="player">
          <span>{row.username} {row.success ? "cleared" : "missed"}</span>
          <span className={row.delta >= 0 ? "score-up" : "score-down"}>{row.delta >= 0 ? "+" : ""}{row.delta} · {row.total}</span>
        </div>
      ))}
    </div>
  );
}

function Roster({ room }: { room: Room }) {
  return (
    <div className="players">
      {room.players.map((player) => (
        <div key={player.id} className="player">
          <span>{player.username}{player.isHost ? " · host" : ""}{player.entered ? " · in" : ""}</span>
          <span>{player.score} · {player.status}{player.connected ? "" : " · away"}</span>
        </div>
      ))}
    </div>
  );
}

function Deck({ room, send }: { room: Room; send: (body: Record<string, unknown>) => void }) {
  if (!room.deck) return null;
  return (
    <div className="stack">
      <div className="dock">
        <button className="btn" onClick={() => send({ type: "draw_random" })}>Draw at random</button>
        <button className="ghost" onClick={() => send({ type: "reset_deck" })}>Reset deck</button>
      </div>
      <div className="card-grid">
        {room.deck.map((card) => (
          <button key={card.id} className={`mini-card suit-${card.suit}`} onClick={() => send({ type: "draw_manual", gameId: card.id })}>
            <strong>{card.rank}</strong>
            <span>{card.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HostDock({ room, send }: { room: Room; send: (body: Record<string, unknown>) => void }) {
  const phase = room.session.phase;
  return (
    <div className="dock">
      {["detected", "intro", "rules", "registration", "countdown"].includes(phase) ? <button className="btn" onClick={() => send({ type: "advance" })}>Continue</button> : null}
      {phase === "registration" ? <button className="ghost" onClick={() => send({ type: "enter_all" })}>Enter everyone</button> : null}
      {phase === "playing" ? (
        <>
          <button className="ghost" onClick={() => send({ type: room.session.paused ? "resume" : "pause" })}>{room.session.paused ? "Resume" : "Pause"}</button>
          <button className="ghost" onClick={() => send({ type: "extend", seconds: 30 })}>+30s</button>
          <button className="ghost" onClick={() => send({ type: "shorten", seconds: 15 })}>−15s</button>
          <button className="ghost" onClick={() => send({ type: "hint" })}>Hint</button>
          <button className="ghost" onClick={() => send({ type: "reveal" })}>Reveal</button>
          <button className="ghost" onClick={() => send({ type: "skip" })}>Skip round</button>
          <button className="ghost hot" onClick={() => send({ type: "end" })}>End challenge</button>
        </>
      ) : null}
      {phase === "results" ? <button className="ghost" onClick={() => send({ type: "continue" })}>Between cards</button> : null}
      <button className="ghost" onClick={() => send({ type: "close" })}>Close arena</button>
    </div>
  );
}

function Join({ code, viewer }: { code: string; viewer: Room["viewer"] }) {
  const [error, setError] = useState("");
  const next = `/account?next=${encodeURIComponent(`/room/${code}`)}`;
  async function enter() {
    setError("");
    const joined = await fetch("/api/sessions/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    const room = await joined.json();
    if (!joined.ok) return setError(room.error || "Could not enter the room.");
    location.reload();
  }
  if (!viewer) {
    return (
      <section className="panel stack">
        <div className="kicker">Join {code}</div>
        <p>Sign in first. The cards you clear stay on that account.</p>
        <a className="btn" href={`${next}&mode=login`}>Log in</a>
        <a className="ghost" href={`${next}&mode=signup`}>Sign up</a>
      </section>
    );
  }
  return (
    <section className="panel stack">
      <div className="kicker">Join {code}</div>
      <p>{viewer.username}, step into this room. Your collection comes with you.</p>
      <button className="btn" onClick={enter}>Enter the arena</button>
      <p className="error">{error}</p>
    </section>
  );
}
