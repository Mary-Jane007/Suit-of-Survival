"use client";

import { useEffect } from "react";

const CUES = [
  {
    file: "when-a-game-starts.mp3",
    title: "When a game starts",
    text: "The white page opens on The Box. A chime, then the presenter: ようこそ。プレイヤーの皆様。まもなく、ザ・ボックスが開始します。",
  },
  {
    file: "presenter-nanami.mp3",
    title: "Presenter",
    text: "The same welcome, voice only. Calm, a little slow, as if the room itself is speaking.",
  },
  {
    file: "presenter-keita.mp3",
    title: "Presenter, other voice",
    text: "The same line again, in a lower voice, so you can choose which one belongs at the table.",
  },
  {
    file: "presenter-rules.mp3",
    title: "The rules",
    text: "After the welcome, the presenter reads the rules that are on the white page. This take is The Box.",
  },
  {
    file: "game-detected.mp3",
    title: "Game detected",
    text: "A short pair of tones when a card is found, before the white page.",
  },
  {
    file: "game-starts.mp3",
    title: "Opening chime",
    text: "The chime alone, without the voice.",
  },
  {
    file: "countdown.mp3",
    title: "Countdown",
    text: "Five quiet ticks, then one higher tone when the challenge begins.",
  },
  {
    file: "ten-seconds.mp3",
    title: "Ten seconds",
    text: "Two soft ticks when the clock is almost done.",
  },
  {
    file: "answer-locked.mp3",
    title: "Answer locked",
    text: "A small click when a phone sends its answer.",
  },
  {
    file: "cleared.mp3",
    title: "Cleared",
    text: "Three rising notes when the whole table clears. This is the moment the fireworks are on screen.",
  },
  {
    file: "presenter-cleared.mp3",
    title: "Presenter, cleared",
    text: "ゲームクリア。Successfully completed.",
  },
  {
    file: "not-completed.mp3",
    title: "Not completed",
    text: "One low tone that falls. A score only. No alarm.",
  },
  {
    file: "presenter-not-completed.mp3",
    title: "Presenter, not completed",
    text: "ゲームオーバー。Not completed.",
  },
];

export default function ListenPage() {
  useEffect(() => {
    document.body.classList.add("proclaiming");
    return () => document.body.classList.remove("proclaiming");
  }, []);
  return (
    <section className="proclamation">
      <div className="sheet">
        <p className="quiet">Preview</p>
        <h1 className="listen-title">Listen first</h1>
        <p>These cues are not in the game yet. Nothing on this page plays during a room.</p>
        <div className="cue-list">
          {CUES.map((cue) => (
            <article className="cue" key={cue.file}>
              <h2>{cue.title}</h2>
              <p>{cue.text}</p>
              <audio controls preload="none" src={`/preview-sounds/${cue.file}`} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
