/**
 * Builds supabase/migrations/20261106200100_phase3_content.sql
 * from the Phase 1 plan and the export inventory.
 * Run: node scripts/phase3-content.mjs
 *
 * Export rows keep the page wording. Proposal rows are the plan's completions.
 * Hidden answers go in secret. The 2 of Diamonds has no solution.
 */
import { writeFileSync } from "node:fs";

const REP = {
  sable: "aaaaaaaa-0000-4000-8000-000000000001",
  ivo: "aaaaaaaa-0000-4000-8000-000000000002",
  noa: "aaaaaaaa-0000-4000-8000-000000000003",
  maren: "aaaaaaaa-0000-4000-8000-000000000004",
  tess: "aaaaaaaa-0000-4000-8000-000000000005",
};

const GAME = "bbbbbbbb-0000-4000-8000-000000000001";

const SUIT_N = { spades: 1, diamonds: 2, clubs: 3, hearts: 4 };
const RANK_N = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
const RANK_ORDER = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const REP_FOR = { diamonds: REP.ivo, hearts: REP.noa, clubs: REP.maren, spades: REP.tess };

function cardId(suit, rank, source) {
  const body = `${SUIT_N[suit].toString(16).padStart(2, "0")}${RANK_N[rank].toString(16).padStart(2, "0")}${source === "export" ? "01" : "02"}000000`;
  return `cccccccc-0000-4000-8000-${body}`;
}

function sqlText(value) {
  const text = value ?? "";
  if (text.includes("$sos$")) {
    throw new Error("text contains the dollar tag");
  }
  return `$sos$${text}$sos$`;
}

function sqlJson(value) {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function card(partial) {
  return {
    rounds: null,
    timer: null,
    scoring: {},
    hints: [],
    question: null,
    players: null,
    kind: "note",
    secret: {},
    publishable: false,
    inPlay: false,
    safety: null,
    reading: null,
    child: null,
    physical: null,
    note: null,
    ...partial,
  };
}

const placeholder = "Diamonds Theme\n\nThis page is part of the Diamonds suit collection.";

const cards = [
  card({
    suit: "diamonds",
    rank: "A",
    source: "export",
    title: "Door of life (1)",
    kind: "door_pattern",
    players: "1",
    rounds: 8,
    scoring: { clear: 1, out: -1 },
    safety: "The export names death as the result of two doors. Stored unpublished.",
    child: "Dood - 1 muur naar rechts.\n\nleven- 1 muur naar links.",
    prompt:
      "Door of life (1):\n\nIn een kamer zijn er 4 deuren. Aan elke muur 1 deur. 2 deuren houden je in leven (+1), en 2 betekenen je dood (-1). kies tijdens elke ronde steeds 1 deur. Er zijn in totaal 8 rondes. Dit is geen spel van intuitie maar van patroonherkenning.",
  }),
  card({
    suit: "diamonds",
    rank: "A",
    source: "proposal",
    title: "Door of life (1)",
    kind: "door_pattern",
    players: "1",
    rounds: 8,
    scoring: { clear: 1, out: -1 },
    publishable: true,
    inPlay: true,
    prompt:
      "Four doors, one on each wall. Eight rounds. Each round, pick one door. Two doors are clear (+1) and two are out (−1). Out is points only. This is pattern recognition, not intuition.\n\nIf the group uses a real room, every door is a normal door or a named wall. No door is dangerous. A player may stop.\n\nProposed start, beside the export child page: round 1, North and South are clear (+1), East and West are out (−1). After each round the clear pair rotates one wall counterclockwise, and the out pair rotates one wall clockwise.",
  }),
  card({
    suit: "diamonds",
    rank: "2",
    source: "export",
    title: "Decode",
    kind: "puzzle",
    players: "1",
    timer: 60,
    scoring: { success: 5 },
    note: "Out of play until the owner supplies the plaintext. No solution is stored.",
    prompt:
      "Decode :\n\nOntcijfer de geheime boodschap in deze korte tekst. (+5).\n\nTijd: 60s\n\nOne of  a child’s greatest characteristics is it’s curiosity.\n\nIt is often the small childeren that ask life’s greatest questions.\n\nThe adults however, often choose to accept life just the way it is.\n\nWhen does true intelligence start?\n\nPeople think that intelligence is just the result of knowledge.\n\nBut intelligence starts with thinking like a child.\n\n-9-2-1-5-8-2",
  }),
  card({
    suit: "diamonds",
    rank: "3",
    source: "export",
    title: "Memory (1)",
    kind: "puzzle",
    players: "1",
    scoring: { success: 5 },
    publishable: true,
    inPlay: true,
    note: "The card says ten calls. The child page lists nine. No tenth color is stored.",
    secret: { answer: "Rood, geel, groen, blauw, geel, blauw, rood, groen, blauw.", answer_source: "export" },
    prompt:
      "Memory (1):\n\nIk noem 4 kleuren 10 keer in een bepaalde volgorde op. Herhaal de kleuren in de juiste volgorde en win +5.",
  }),
  card({
    suit: "diamonds",
    rank: "4",
    source: "export",
    title: "Two doors",
    kind: "puzzle",
    players: "1",
    scoring: { success: 10 },
    publishable: true,
    inPlay: true,
    reading: "Both guards indicate the imprisonment door, so the player chooses the other door. The question text stays the export question.",
    secret: {
      answer: "Welke deur zou de andere wachter kiezen als de juiste?",
      explanation: "de waarheid spreker kiest de onjuiste deur en de leugenaar liegt over wat de waarh spreker zou aanwijzen.",
      proposed_clarification: "Both guards indicate the imprisonment door, so the player chooses the other door.",
      answer_source: "export",
    },
    prompt:
      "Two doors:\n\nJe staat voor 2 deuren.\n\nAchter 1 zit eeuwige vrijheid en achter de ander eeuwig gevangenschap.\n\nEr staan 2 wachters. 1 liegt altijd en 1 spreekt altijd de waarheid.\n\nJe mag 1 vraag stellen aan 1 wachter.\n\nWelke vraag stel je om de juiste deur te kiezen? (+10)",
  }),
  card({
    suit: "diamonds",
    rank: "5",
    source: "export",
    title: "The Box",
    kind: "puzzle",
    players: "1",
    scoring: { success: 10 },
    safety: "The export question writes dood. Stored unpublished. The answer page says Doos B.",
    secret: { answer: "Doos B.", answer_source: "export" },
    prompt:
      "The Box\n\nVoor je staan 3 dozen:\n\nDoos A: “ De sleutel zit hier”.\n\nDoos B: “De sleutel zit niet hier”.\n\nDoos C: “De sleutel zit niet in doos A”.\n\nSlechts 1 doos is waar.\n\nIn welke dood zit de sleutel. (+10)",
  }),
  card({
    suit: "diamonds",
    rank: "5",
    source: "proposal",
    title: "The Box",
    kind: "puzzle",
    players: "1",
    scoring: { success: 10 },
    publishable: true,
    inPlay: true,
    reading: "The export word dood is read as a typo for doos. The answer stays Doos B.",
    secret: { answer: "Doos B.", answer_source: "export" },
    prompt:
      "The Box\n\nThree boxes. Exactly one statement is true. (+10)\n\nDoos A: “ De sleutel zit hier”.\n\nDoos B: “De sleutel zit niet hier”.\n\nDoos C: “De sleutel zit niet in doos A”.\n\nIn welke doos zit de sleutel.",
  }),
  card({
    suit: "diamonds",
    rank: "6",
    source: "export",
    title: "6 of Diamonds",
    kind: "placeholder",
    prompt: placeholder,
    note: "The export page is the placeholder sentence. It is not a challenge.",
  }),
  card({
    suit: "diamonds",
    rank: "6",
    source: "proposal",
    title: "Odd one",
    kind: "puzzle",
    players: "1",
    timer: 45,
    scoring: { success: 5 },
    publishable: true,
    inPlay: true,
    secret: { answer: "48", answer_source: "proposal" },
    question: "Which number does not belong: 4, 9, 16, 25, 36, 48, 64?",
    prompt: "Odd one (1)\n\n45 seconds. Which number does not belong: 4, 9, 16, 25, 36, 48, 64?",
  }),
  card({
    suit: "diamonds",
    rank: "7",
    source: "export",
    title: "Light switch",
    kind: "puzzle",
    players: "1",
    note: "The export has no points, no time, and no answer page.",
    prompt:
      "Light switch:\n\nJe staat in een kamer met 3 lichtschakelaars. In een andere kamer is er 1 lamp.\n\nElke schakelaar hoort bij de lamp, maar er is maar 1 die het werkelijk aanmaakt. Jij weet niet welke.\n\nJe mag alle schakelaars gebruiken, maar je mag slechts 1 keer naar de kamer met de lamp lopen.\n\nHoe bepaal je welke schakelaar de lamp bedient?",
  }),
  card({
    suit: "diamonds",
    rank: "7",
    source: "proposal",
    title: "Light switch",
    kind: "puzzle",
    players: "1",
    scoring: { success: 10 },
    publishable: true,
    inPlay: true,
    physical: {
      optional: true,
      indoor: true,
      low_risk: true,
      phone: "Say the answer out loud. Nobody rewires a lamp.",
    },
    secret: {
      answer: "Name the switches A, B, and C. Turn A on for a few minutes, turn A off, turn B on, then enter. Lit lamp is B. Dark and warm is A. Dark and cold is C.",
      answer_source: "proposal",
    },
    prompt:
      "Light switch\n\nYou are told about three switches and one lamp. Only one switch turns the lamp on. You may use the switches in the telling, and you may enter the lamp room once. Which switch controls the lamp?\n\nPlay is verbal. Nobody rewires a lamp. A real room is optional only if the switches and lamp are already ordinary household fittings and the walk is one indoor trip. Score +10.",
  }),
  card({
    suit: "diamonds",
    rank: "8",
    source: "export",
    title: "8 of Diamonds",
    kind: "placeholder",
    prompt: placeholder,
    note: "The export page is the placeholder sentence. It is not a challenge.",
  }),
  card({
    suit: "diamonds",
    rank: "8",
    source: "proposal",
    title: "Sum code",
    kind: "puzzle",
    players: "1",
    timer: 60,
    scoring: { success: 5 },
    publishable: true,
    inPlay: true,
    secret: { answer: "7354", answer_source: "proposal" },
    question: "Four digits, each 1–9. First plus second is 10. Second plus third is 8. Third plus fourth is 9. First plus fourth is 11. The first digit is 7.",
    prompt: "Sum code (1)\n\n60 seconds. Four digits, each 1–9. First plus second is 10. Second plus third is 8. Third plus fourth is 9. First plus fourth is 11. The first digit is 7.",
  }),
  card({
    suit: "diamonds",
    rank: "9",
    source: "export",
    title: "9 of Diamonds",
    kind: "placeholder",
    prompt: placeholder,
    note: "The export page is the placeholder sentence. It is not a challenge.",
  }),
  card({
    suit: "diamonds",
    rank: "9",
    source: "proposal",
    title: "Seating",
    kind: "puzzle",
    players: "1",
    timer: 90,
    scoring: { success: 10 },
    publishable: true,
    inPlay: true,
    secret: { answer: "Chen", order: "Chen, Dina, Ana, Bo", answer_source: "proposal" },
    question: "Who is in the leftmost seat?",
    prompt:
      "Seating (1)\n\n90 seconds. Four seats in a row, left to right. Ana sits somewhere left of Bo. Chen sits at an end. Dina sits next to Chen. Bo does not sit next to Dina. Who is in the leftmost seat?",
  }),
  card({
    suit: "diamonds",
    rank: "10",
    source: "export",
    title: "10 of Diamonds",
    kind: "placeholder",
    prompt: placeholder,
    note: "The export page is the placeholder sentence. It is not a challenge.",
  }),
  card({
    suit: "diamonds",
    rank: "10",
    source: "proposal",
    title: "Two digits",
    kind: "puzzle",
    players: "1",
    timer: 90,
    scoring: { success: 10 },
    publishable: true,
    inPlay: true,
    secret: { answer: "63", answer_source: "proposal" },
    question: "The tens digit is 3 more than the ones digit. The product of the digits is 18.",
    prompt: "Two digits (1)\n\n90 seconds. A two-digit number. The tens digit is 3 more than the ones digit. The product of the digits is 18.",
  }),
  card({
    suit: "diamonds",
    rank: "J",
    source: "export",
    title: "Jack of Diamonds",
    kind: "placeholder",
    prompt: placeholder,
    note: "The export page is the placeholder sentence. It is not a challenge.",
  }),
  card({
    suit: "diamonds",
    rank: "J",
    source: "proposal",
    title: "Quarter hour",
    kind: "puzzle",
    players: "1",
    timer: 120,
    scoring: { success: 10 },
    publishable: true,
    inPlay: true,
    secret: { answer: "7.5 degrees", answer_source: "proposal" },
    question: "A clock shows 3:15. What is the smaller angle between the hour and minute hands?",
    prompt: "Quarter hour (1)\n\n2 minutes. A clock shows 3:15. What is the smaller angle between the hour and minute hands?",
  }),
  card({
    suit: "diamonds",
    rank: "Q",
    source: "export",
    title: "Queen of Diamonds",
    kind: "placeholder",
    prompt: placeholder,
    note: "The export page is the placeholder sentence. It is not a challenge.",
  }),
  card({
    suit: "diamonds",
    rank: "Q",
    source: "proposal",
    title: "Safe",
    kind: "puzzle",
    players: "1",
    timer: 90,
    scoring: { success: 10 },
    publishable: true,
    inPlay: true,
    secret: { answer: "972", answer_source: "proposal" },
    question: "The code is the largest three-digit number that uses 2, 7, and 9 once and is divisible by 3.",
    prompt: "Safe (1)\n\n90 seconds. The code is the largest three-digit number that uses 2, 7, and 9 once and is divisible by 3.",
  }),
  card({
    suit: "diamonds",
    rank: "K",
    source: "export",
    title: "Balance scale (all)",
    kind: "number_target",
    players: "all",
    rounds: 5,
    timer: 60,
    scoring: { closest: 2, others: -2 },
    publishable: true,
    inPlay: true,
    reading:
      "Each round, the result is the arithmetic mean of the numbers actually submitted, multiplied by 0.8. Closest gets +2. Everyone else gets −2. A tie for closest: each tied player gets +2, and the others still get −2. Numbers from 0 through 100 inclusive.",
    prompt:
      "Balance scale (all):\n\nElke speler kiest een getal tussen 0-100 binnen 60s.\n\nDe gekozen getallen worden vermenigvuldigd met 0.8.\n\nDe persoon die het nummer heeft gekozen dat het dichtst bij het resultaat ligt, wint (+2), en de rest -2.\n\ner zijn in totaal 5 rondes.",
  }),
];

const heartsExport = [
  ["A", "Generosity (1)", "point_gift", "1", "Kies een speler uit aan wie je 5 punten geeft.", { gift: 5 }],
  ["2", "Trust pick (1)", "trust", "1", "Kies een speler die je deze ronde kunt vertrouwen. Als deze speler je verraadt met een spel Schoppen, harten, Ruiten of Klaveren, zak je (-5).\n\nZo niet, dan krijg je (+5).", { betrayed: -5, kept: 5 }],
  ["3", "Guess (1)", "prediction", "1", "Raad eens wie er in de volgende ronde zakt. Als ze zakken, WIN je. (+7)\n\nAls ze winnen, ZAK je. (-7)", { zakken: 7, win: -7 }],
  ["5", "Forced Alliance (2)", "alliance", "2", "Kies een speler met wie je moet samenwerken bij de volgende ronde. Jullie beide moeten samen uitdagingen winnen. (+7)\n\nAls een van jullie verliest (-5) voor jullie beide.\n\nAls jullie beide verliezen (-7) voor jullie beide.", { both_gain: 7, one_loses: -5, both_lose: -7 }],
  ["6", "The taker (1)", "transfer", "1", "Neem +10 punten van een speler.", { take: 10 }],
  ["8", "Intuition (2)", "bluff", "2", "Kies een speler uit. Die houdt twee kaarten voor zich. De speler laat weten welke twee kaarten het zijn en ook welke je moet kiezen, bv Diamonds 4. Als je de juiste kaart gekozen heb, heb je gewonnen (+7) en de speler verloren (-7) en vice versa.", { hit: 7, miss: -7 }],
  ["9", "Trade of trust (2)", "trade", "2", "Kies een speler uit. Pak een kaart uit zijn hand, en ook een kaart uit jou hand. De speler kan ervoor kiezen z’n kaart te behouden of te ruilen voor jou kaart. Overtuig de speler om jou kaart te nemen. Lukt dat jou dan WIN je 7 punten. Lukt dat jou niet dat VERLIES je 7 punten.", { convinced: 7, not_convinced: -7 }],
  ["J", "Chain reaction (all)", "pass_around", "all", "Kies een kaart uit jou hand die jij niet wilt en geef het aan een speler. De speler kan ervoor kiezen de kaart aan iemand anders te geven. Dit gaat door tot de tijd om is ( 60s). De kaart blijft bij de persoon bij wie de tijd om is. Is de kaart weer bij de oorspronkelijke eigenaar -10 punten. Is het bij iemand anders +10 punten.", { returned: -10, elsewhere: 10 }],
  ["K", "Face cards (4)", "forehead", "4", "Kies 3 medespelers. Elke speler krijgt een kaart op z’n voorhoofd. Jij weet zelf niet welke kaart op jou voorhoofd zit. Wanneer de tijd ( 2 min. ) om is moet je de juiste kaart doorgeven die jij hebt (+10). Heb je het fout (-15). Je mag geen reflectieve spullen gebruiken. Je mag elkaar helpen, maar houdt in gedachte dat wanneer je iemand succesvol de verkeerde kaart heb laten doorgeven er +5 punten aan jou word toegevoegd.", { right: 10, wrong: -15, mislead: 5 }],
];

for (const [rank, title, kind, players, prompt, scoring] of heartsExport) {
  cards.push(
    card({
      suit: "hearts",
      rank,
      source: "export",
      title,
      kind,
      players,
      timer: rank === "J" ? 60 : rank === "K" ? 120 : null,
      scoring,
      publishable: true,
      inPlay: true,
      prompt,
      physical:
        rank === "K"
          ? { optional: true, indoor: true, low_risk: true, phone: "The card can be named without a mirror or a forehead." }
          : null,
    }),
  );
}

cards.push(
  card({
    suit: "hearts",
    rank: "4",
    source: "export",
    title: "Sheep,Shepard,Wolf (3)",
    kind: "role_pick",
    players: "3",
    timer: 60,
    scoring: { sheep: -10, shepard: 2, wolf: 10, no_agreement: -10 },
    safety: "The export calls a point cost a straf. Stored unpublished.",
    child: "Sheep : - 10 points for choosing the safe option\n\nShepard : +2 points\n\nWolf : +10 points for bravery",
    prompt:
      "Sheep,Shepard,Wolf (3):\n\nJullie moeten allemaal binnen 60 seconden beslissen of jullie een schaap, herder of wolf willen zijn. Elke keuze vertegenwoordigt een straf of voordeel. Een negatief karakter betekent niet per se een straf. Iedereen in de groep MOET het eens zijn met elkaars keuze. Als niemand het eens is, krijgen jullie allemaal -10 punten.",
  }),
  card({
    suit: "hearts",
    rank: "4",
    source: "proposal",
    title: "Sheep, shepherd / herder, wolf (3)",
    kind: "role_pick",
    players: "3",
    timer: 60,
    scoring: { sheep: -10, shepherd: 2, wolf: 10, no_agreement: -10, stop: 0 },
    publishable: true,
    inPlay: true,
    prompt:
      "Within 60 seconds everyone chooses sheep, shepherd / herder, or wolf. The group must agree on every choice.\n\nEach choice has a point cost or a point gain. Sheep −10, shepherd +2, wolf +10, and −10 for everyone if the group does not agree.\n\nA player who stops ends the card at 0 for everyone. That 0 is the safety stop, not the disagreement score.",
  }),
  card({
    suit: "hearts",
    rank: "7",
    source: "export",
    title: "Wolf among Sheep (4)",
    kind: "secret_mark",
    players: "4",
    scoring: { marked: -10, wolf_blocked: -10, protect_other: -5, wolf_open: 10 },
    safety: "The export says the marked player is eaten. The numbers are points. Stored unpublished.",
    prompt:
      "Wolf among Sheep (4):\n\nVier spelers staan voor een lastige keuze. Een van hen, de Hartenspeler - Wolf, moet in het geheim kiezen wie er gegeten wordt (-10). De anderen - de schapen - moeten ervoor kiezen zichzelf te beschermen of de keuze van de wolf te beïnvloeden door iemand te kiezen om te beschermen. Als de wolf het beschermde schaap kiest, verliest hij -10 punten. Dit werkt alleen als het schaap door andere schapen wordt beschermd. Houd er rekening mee dat als je ervoor kiest om een ander schaap te beschermen, je -5 punten krijgt. Als de wolf een onbeschermd schaap kiest, krijgt hij +10 punten.",
  }),
  card({
    suit: "hearts",
    rank: "7",
    source: "proposal",
    title: "Wolf among Sheep (4)",
    kind: "secret_mark",
    players: "4",
    scoring: { marked: -10, wolf_blocked: -10, protect_other: -5, wolf_open: 10 },
    publishable: true,
    inPlay: true,
    reading: "The chosen sheep is protected only when at least one other sheep selected them. Protecting yourself does not trigger the wolf's −10. The −5 line applies only when you protect someone else.",
    prompt:
      "Four players. The Hearts player is the wolf and secretly marks one sheep. Marked means −10 points. Nothing is eaten.\n\nThe sheep protect themselves or someone else. The marked sheep is protected only when at least one other sheep selected them. Protecting yourself does not give the wolf −10. Protecting someone else gives the protector −5. If the wolf marks a sheep protected by other sheep, the wolf gets −10. An unprotected sheep gives the wolf +10.",
  }),
  card({
    suit: "hearts",
    rank: "10",
    source: "export",
    title: "Risk Reputation (1)",
    kind: "assigned_replay",
    players: "1",
    scoring: { assigned_loses: 7, assigned_wins: -7 },
    safety: "The export says force a player. A player can always stop. Stored unpublished.",
    prompt:
      "Risk Reputation (1):\n\nForceer een speler om een challenge te doen naar jou keuze ( Diamonds, Spades, Clubs, Hearts), dit geldt ook voor challenges die al zijn gespeeld.\n\nAls ze verliezen +7\n\nAls ze winnen -7",
  }),
  card({
    suit: "hearts",
    rank: "10",
    source: "proposal",
    title: "Risk Reputation (1)",
    kind: "assigned_replay",
    players: "1",
    scoring: { assigned_loses: 7, assigned_wins: -7, refusal: 0 },
    publishable: true,
    inPlay: true,
    prompt:
      "Assign a published challenge, including one already played. The player who played this card receives +7 if the assigned player loses that challenge and −7 if they win. The assigned challenge still applies its own points.\n\nThe named player may refuse. A refusal or a stop scores 0 for both on this card. Only challenges that already passed the safety check can be named.",
  }),
  card({
    suit: "hearts",
    rank: "Q",
    source: "export",
    title: "Story telling (2)",
    kind: "fiction_guess",
    players: "2",
    scoring: { guess_wrong: 10, guess_right: -10 },
    safety: "Guessing whether a story is true pressures a private disclosure. Stored unpublished.",
    prompt:
      "Story telling (2):\n\nKies een speler uit. Jij vertelt een verhaal en de speler moet raden als het waar is of niet. wees zo creatief mogelijk. +10 voor jou als de speler fot raadt, -10 als hij goed raadt.",
  }),
  card({
    suit: "hearts",
    rank: "Q",
    source: "proposal",
    title: "Story telling (2)",
    kind: "fiction_guess",
    players: "2",
    scoring: { guess_wrong: 10, guess_right: -10, pass: 0 },
    publishable: true,
    inPlay: true,
    prompt:
      "Choose a player. You tell a story. They guess whether it matches the prompt. The story is fiction. Waar means the story includes exactly one invented detail about the weather. The guesser is judging the story against that prompt, not a player's life.\n\n+10 if they guess wrong, −10 if they guess right. Either player may pass for 0. No questions about bodies, homes, relationships, or secrets.",
  }),
);

const clubProposals = [
  ["A", "Shape", "2", 90, 5, "One player sees four colored shapes. They may say only color words and left, right, above, or below. The other rebuilds the figure. Both get +5 if it matches.", { note: "The plan does not name the four shapes. The owner supplies the figure." }],
  ["2", "One word", "3", 60, 5, "Two players see a target word from the card. Each may say one word to the third player, who guesses. All three get +5 if the guess is right.", { sample_target: "river", answer_source: "proposal" }],
  ["3", "Order", "all", 60, 5, "Each phone shows a unique number. Players line up in order. They may say only “this side”. No pushing. All get +5 if the line is correct. Phone alternative: each submits a position. Minimum 3 players.", { note: "The plan does not list the numbers. The owner supplies them." }],
  ["4", "Fragments", "all", 90, 5, "One fixed sentence is split across the phones. The group restores it. All get +5 if the sentence matches. The sentence is card text, not a personal fact. Minimum 3 players.", { note: "The plan does not give the sentence. The owner supplies card text." }],
  ["5", "List", "all", 90, 5, "Eight ordinary objects are read once. Each player is responsible for two. The group repeats the list in order. All get +5 if it matches. Minimum 3 players.", { note: "The plan does not name the eight objects. The owner supplies them." }],
  ["6", "Grid", "2", 90, 5, "A 4×4 grid and a path. One player may say only up, down, left, or right. The other traces the path. Both get +5 if the trace matches.", { note: "The plan does not draw the path. The owner supplies it." }],
  ["7", "Same answer", "2", 60, 5, "Both submit one color from red, yellow, green, and blue. They may talk. Both get +5 if the colors match. There is no secret correct color. A mismatch scores 0.", {}],
  ["8", "Halves", "2", 90, 5, "Each phone shows part of one addition. Both say the total. Both get +5 if they match the total. The server can change the addends later.", { sample: "17+4 on one phone and +9 on the other", answer: "30", answer_source: "proposal" }],
  ["9", "Sentence", "3", 60, 5, "Player 1 sees a fixed 8-word sentence, says it once to player 2, who says it once to player 3. Player 3 types it. All get +5 on an exact match.", { note: "The plan does not give the sentence. The owner supplies eight words of card text." }],
  ["10", "Roles", "3", 120, 10, "Reader, builder, and checker reorder six steps from the card. All three confirm. All get +10 if the order matches.", { note: "The plan does not list the six steps. The owner supplies them." }],
  ["J", "One speech", "all", 90, 2, "Each player gets one clue and may speak one sentence. The group locks one answer. Clues: it is a direction; it is not east, south, or west; it has five letters; it starts with N. Extra players receive “Do not add a letter.” Everyone gets +2 if the locked answer matches the card.", { answer: "NORTH", answer_source: "proposal" }],
  ["Q", "Shared story", "3", 120, 5, "Two players describe the object named on the card. The third player picks it from four labels. All three get +5 if the pick is right. The pair is trying to be understood. This is not the Queen of Hearts guess.", { sample_object: "a brass key", note: "The plan does not list the four labels. The owner supplies them.", answer_source: "proposal" }],
  ["K", "Match three", "all", 60, 2, "Each player secretly picks 1, 2, 3, 4, or 5. They may talk first. Anyone who picked a number that at least three players also picked gets +2. Everyone else gets 0.", {}],
];

const spadeProposals = [
  ["A", "Cups", "1", 60, 5, "60 seconds, +5. Seated, stack 6 plastic cups into a pyramid and unstack them. Phone: tap the pyramid diagram in order. A pass scores 0."],
  ["2", "Steps", "1", 30, 5, "30 seconds, +5. Stand from a chair, take 5 ordinary steps to a second chair, sit. No race. Phone: hold a button for 5 seconds while seated. A pass scores 0."],
  ["3", "Sort", "1", 45, 5, "45 seconds, +5. Seated, sort ten face-up cards by rank with one hand. Phone: sort ten labels. A pass scores 0."],
  ["4", "Bin", "1", null, 5, "Three tries, +5 if at least two land. Toss a paper ball into a basket about 2 meters away. Misses score 0. Phone: tap a target three times. A pass scores 0."],
  ["5", "Copy", "2", 30, 5, "30 seconds, +5. Seated, one player shows three slow hand gestures. The other copies them in order. Phone: repeat a three-icon sequence. A pass scores 0."],
  ["6", "Tower", "1", 90, 5, "90 seconds, +5. Build a freestanding tower from 10 index cards or plastic cups. It must stand for 3 seconds. Phone: a stacking puzzle. A pass scores 0."],
  ["7", "Spoon", "1", 45, 5, "45 seconds, +5. Seated, move 8 dry beans from one cup to another with a spoon. Phone: drag 8 tokens. A pass scores 0."],
  ["8", "Knot", "1", 60, 5, "60 seconds, +5. Seated, tie the bow shown on a diagram, using a ribbon or shoelace. Phone: put the diagram's steps in order. A pass scores 0."],
  ["9", "Sequence", "1", 45, 5, "45 seconds, +5. Seated motions only: clap, tap knee, touch the table, raise a hand, clap, hands flat. The player repeats them once. Phone: six icons. A pass scores 0."],
  ["10", "Still", "all", 20, 5, "20 seconds, +5 to each person who stays seated with hands on knees. No contact and no blindfold. Phone: do not tap for 20 seconds. A pass scores 0."],
  ["J", "Pass", "all", 60, 2, "60 seconds, +2 each if the group completes 10 passes. Seated, pass one soft object to the left. A drop scores 0. Phone: pass a token in seat order. A pass scores 0."],
  ["Q", "Pair", "2", 45, 5, "45 seconds, +5 each. Two seated players mirror hand positions for 20 seconds. They do not touch. Phone: match a silhouette. A pass scores 0."],
  ["K", "Build together", "all", 90, 2, "90 seconds, +2 each if it stands. The group builds one 6-cup pyramid. Each person places one cup, then the next person. Phone: the same turn order on the shared screen. A pass scores 0."],
];

for (const rank of RANK_ORDER) {
  for (const suit of ["clubs", "spades"]) {
    const label = rank === "A" ? "Ace" : rank === "J" ? "Jack" : rank === "Q" ? "Queen" : rank === "K" ? "King" : rank;
    const suitName = suit === "clubs" ? "Clubs" : "Spades";
    cards.push(
      card({
        suit,
        rank,
        source: "export",
        title: `${label} of ${suitName}`,
        kind: "empty",
        prompt: "",
        note: "The export page is a title and an empty heading. No challenge text.",
      }),
    );
  }
}

for (const [rank, title, players, timer, points, prompt, secret] of clubProposals) {
  cards.push(
    card({
      suit: "clubs",
      rank,
      source: "proposal",
      title,
      kind: "teamwork",
      players,
      timer,
      scoring: { success: points, miss: 0 },
      publishable: true,
      inPlay: true,
      secret,
      prompt: `${title} (${players})\n\n${prompt}\n\nTalk is about the card, not about a player's life.`,
    }),
  );
}

for (const [rank, title, players, timer, points, prompt] of spadeProposals) {
  cards.push(
    card({
      suit: "spades",
      rank,
      source: "proposal",
      title,
      kind: "physical_or_phone",
      players,
      timer,
      scoring: { success: points, miss: 0, pass: 0 },
      publishable: true,
      inPlay: true,
      physical: {
        optional: true,
        indoor: true,
        low_risk: true,
        phone: "The phone version is in the card text. A miss is 0, not a punishment.",
      },
      prompt: `${title} (${players})\n\n${prompt}\n\nThe physical version is optional. Nothing uses heights, blindfolds, running, hitting, or heavy objects.`,
    }),
  );
}

function setReading(suit, rank, source, reading) {
  const item = cards.find((card) => card.suit === suit && card.rank === rank && card.source === source);
  if (!item) throw new Error(`missing ${suit} ${rank} ${source}`);
  item.reading = reading;
}

setReading("hearts", "2", "export", "The trusted player betrays you if, before the next card is drawn, a card they play causes you to lose points. Any suit counts.");
setReading("hearts", "3", "export", "The next round is the next dealt challenge. Zakken means that player's own point change on that challenge is negative. A pass or a zero scores 0 from this card.");
setReading("hearts", "5", "export", "The next round is the next dealt challenge, and both allies are scored by that one challenge. Both gain points from it: +7 each. Exactly one loses points from it: −5 each. Both lose points from it: −7 each. A zero for both scores 0.");
setReading("hearts", "6", "export", "Take is a transfer. You gain 10, the chosen player loses 10.");
setReading("hearts", "8", "export", "The holder secretly marks one of the two cards as correct, names both cards truthfully, and may recommend either. The guesser picks. Scores stay +7 and −7.");
setReading("hearts", "J", "export", "The original owner receives −10 if the card returns to them and +10 if the timer stops on someone else. The final holder gets no extra points from this sentence.");

const two = cards.find((item) => item.suit === "diamonds" && item.rank === "2");
if (!two || two.source !== "export" || Object.keys(two.secret).length > 0 || two.publishable || two.inPlay) {
  throw new Error("2 of Diamonds must stay an unpublished export with an empty secret");
}
if (cards.some((item) => item.suit === "diamonds" && item.rank === "2" && item.source === "proposal")) {
  throw new Error("Do not invent a 2 of Diamonds proposal");
}
if (JSON.stringify(two).toLowerCase().includes("plaintext:")) {
  throw new Error("2 of Diamonds must not store a solution");
}

const blocked = [/gegeten/i, /\bdood\b/i, /forceer/i, /\bstraf\b/i];
for (const item of cards) {
  if (!item.publishable) continue;
  const visible = `${item.prompt}\n${item.question ?? ""}`;
  for (const pattern of blocked) {
    if (pattern.test(visible)) {
      throw new Error(`publishable ${item.suit} ${item.rank} ${item.source} contains ${pattern}`);
    }
  }
  const answer = item.secret?.answer;
  if (typeof answer === "string" && new RegExp(`answer\\s*[:=]\\s*${answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(item.prompt)) {
    throw new Error(`answer leaked into prompt for ${item.suit} ${item.rank} ${item.source}`);
  }
}

const seen = new Set();
for (const item of cards) {
  const key = `${item.suit}:${item.rank}:${item.source}`;
  if (seen.has(key)) throw new Error(`duplicate ${key}`);
  seen.add(key);
}

function effectOf(item) {
  const effect = {
    kind: item.kind,
    in_play: item.inPlay,
  };
  if (item.players) effect.player_count = item.players;
  if (item.rounds != null) effect.rounds = item.rounds;
  if (item.timer != null) effect.timer_seconds = item.timer;
  if (item.scoring && Object.keys(item.scoring).length > 0) effect.scoring = item.scoring;
  if (item.hints.length > 0) effect.hints = item.hints;
  if (item.question) effect.question = item.question;
  if (item.safety) effect.safety = item.safety;
  if (item.reading) effect.proposed_reading = item.reading;
  if (item.child) effect.child_page = item.child;
  if (item.note) effect.owner_note = item.note;
  if (item.physical) effect.physical = item.physical;
  return effect;
}

function insertCard(item) {
  const secret = item.secret && Object.keys(item.secret).length > 0 ? item.secret : {};
  return `insert into public.cards (
  id, game_id, suit, rank, title, prompt, effect, secret, sort_order, source, publishable, representative_id
) values (
  '${cardId(item.suit, item.rank, item.source)}',
  '${GAME}',
  '${item.suit}',
  '${item.rank}',
  ${sqlText(item.title)},
  ${sqlText(item.prompt)},
  ${sqlJson(effectOf(item))},
  ${sqlJson(secret)},
  ${RANK_N[item.rank]},
  '${item.source}',
  ${item.publishable ? "true" : "false"},
  '${REP_FOR[item.suit]}'
);`;
}

const reps = [
  {
    id: REP.sable,
    name: "Sable Voss",
    role: "game_master",
    suit: null,
    portrait: "/representatives/sable-voss.svg",
    bio: "Opens and closes the room. Does not play a hand.",
    style: { accent: "blood", mark: "frame" },
    dialogue: {
      started: "The room is open. Points are the only score on the table.",
      round_resolved: "The points are on the board.",
      player_stopped: "[Name] has stopped. Play continues for everyone else.",
      player_eliminated: "[Name] is out of the scoring. They can stay and watch.",
      card_drawn: "[Card title]. You can stop whenever you want.",
    },
  },
  {
    id: REP.ivo,
    name: "Ivo Quill",
    role: "representative",
    suit: "diamonds",
    portrait: "/representatives/ivo-quill.svg",
    bio: "Reads puzzle cards.",
    style: { accent: "blood", mark: "diamond" },
    dialogue: { card_drawn: "[Card title]. You can stop whenever you want.", greeting: "Reads puzzle cards." },
  },
  {
    id: REP.noa,
    name: "Noa Veld",
    role: "representative",
    suit: "hearts",
    portrait: "/representatives/noa-veld.svg",
    bio: "Reads Hearts cards. Does not ask for secrets.",
    style: { accent: "blood", mark: "heart" },
    dialogue: {
      card_drawn: "[Card title]. You can stop whenever you want.",
      greeting: "Reads Hearts cards. Does not ask for secrets.",
    },
  },
  {
    id: REP.maren,
    name: "Maren Holt",
    role: "representative",
    suit: "clubs",
    portrait: "/representatives/maren-holt.svg",
    bio: "Reads group cards.",
    style: { accent: "paper", mark: "club" },
    dialogue: { card_drawn: "[Card title]. You can stop whenever you want.", greeting: "Reads group cards." },
  },
  {
    id: REP.tess,
    name: "Tess Calder",
    role: "representative",
    suit: "spades",
    portrait: "/representatives/tess-calder.svg",
    bio: "Offers the physical version and the phone version in the same breath.",
    style: { accent: "paper", mark: "spade" },
    dialogue: {
      card_drawn: "[Card title]. You can stop whenever you want.",
      greeting: "Offers the physical version and the phone version in the same breath.",
    },
  },
];

function insertRep(rep) {
  return `insert into public.representatives (
  id, name, role, suit, portrait_url, bio, announcement_style, dialogue
) values (
  '${rep.id}',
  ${sqlText(rep.name)},
  '${rep.role}',
  ${rep.suit ? `'${rep.suit}'` : "null"},
  ${sqlText(rep.portrait)},
  ${sqlText(rep.bio)},
  ${sqlJson(rep.style)},
  ${sqlJson(rep.dialogue)}
);`;
}

const rules = {
  frame_source: "proposal",
  draws: 8,
  no_repeat: true,
  repeat_exception: "A card may assign a challenge that was already played.",
  hand_size: 5,
  hand_note: "Proposed reading. Cards that say hand use a dealt hand of 5. The active challenge card is not one of those five.",
  digital_elimination: false,
  digital_elimination_note: "Off until the owner turns it on. After the last draw, the single lowest score can be marked eliminated and may stay to watch. A tie for lowest eliminates no one. The status changes nothing outside the app.",
  stop_status: "stopped",
  end: "rank_by_points",
  physical_offered: true,
  inner_rounds: "A card that names its own rounds finishes those rounds before the next draw.",
};

const announcements = [
  ["session-start", "session_start", REP.sable, "The room is open", "The room is open. Points are the only score on the table.", { screen: "started" }],
  ["card-drawn", "card_drawn", null, "Card drawn", "[Card title]. You can stop whenever you want.", { screen: "card_detected" }],
  ["round-resolved", "round_resolved", REP.sable, "Points", "The points are on the board.", { screen: "success" }],
  ["player-stopped", "player_stopped", REP.sable, "Stopped", "[Name] has stopped. Play continues for everyone else.", { screen: "paused" }],
  ["player-eliminated", "player_eliminated", REP.sable, "Out of the scoring", "[Name] is out of the scoring. They can stay and watch.", { screen: "game_over" }],
  ["screen-started", "started", REP.sable, "Started", "The room is open. Points are the only score on the table.", { screen: "started" }],
  ["screen-card-detected", "card_detected", null, "Card detected", "[Card title]. You can stop whenever you want.", { screen: "card_detected" }],
  ["screen-rules", "rules", REP.sable, "Rules", "Eight draws. No repeat, unless a card assigns a challenge that was already played. Points add up. You can stop. A stop is not elimination. Points are the only score on the table.", { screen: "rules" }],
  ["screen-countdown", "countdown", REP.sable, "Countdown", "You can stop whenever you want.", { screen: "countdown", seconds: 3 }],
  ["screen-paused", "paused", REP.sable, "Paused", "The room is paused. You can stop whenever you want.", { screen: "paused" }],
  ["screen-success", "success", REP.sable, "Success", "The points are on the board.", { screen: "success" }],
  ["screen-game-over", "game_over", REP.sable, "Game over", "The room is closed. Points are the only score on the table.", { screen: "game_over" }],
];

const lines = [];
lines.push(`-- Phase 3 content. Generated by scripts/phase3-content.mjs.`);
lines.push(`-- Export rows are verbatim page text. Proposal rows are the plan's completions.`);
lines.push(`-- Unsafe export lines are publishable = false. The 2 of Diamonds secret is empty.`);
lines.push(`-- Markdown emphasis marks from the inventory are not page text and are not stored.`);
lines.push(``);
for (const rep of reps) lines.push(insertRep(rep), ``);

lines.push(`insert into public.games (
  id, slug, title, suit, summary, rules, status,
  supports_realtime, supports_real_life, physical_challenge, source, representative_id
) values (
  '${GAME}',
  'suit-of-survival',
  'Suit of survival',
  'any',
  'One deck. Four suits. Points are the only score. You can stop.',
  ${sqlJson(rules)},
  'published',
  true,
  true,
  ${sqlJson({ optional: true, indoor: true, low_risk: true, note: "Version 1 mixes optional low-risk indoor physical challenges with digital ones. The owner can turn the physical version off for a session." })},
  'export',
  '${REP.sable}'
);`);
lines.push(``);

for (const item of cards) lines.push(insertCard(item), ``);

announcements.forEach((row, index) => {
  const [slug, trigger, rep, title, body, timing] = row;
  lines.push(`insert into public.announcements (
  id, slug, representative_id, trigger, title, body, timing, game_id, source
) values (
  'dddddddd-0000-4000-8000-${String(index + 1).padStart(12, "0")}',
  '${slug}',
  ${rep ? `'${rep}'` : "null"},
  '${trigger}',
  ${sqlText(title)},
  ${sqlText(body)},
  ${sqlJson(timing)},
  '${GAME}',
  'proposal'
);`);
  lines.push(``);
});

const out = "supabase/migrations/20261106200100_phase3_content.sql";
writeFileSync(out, `${lines.join("\n")}\n`);
console.log(`wrote ${cards.length} cards and ${announcements.length} announcements to ${out}`);
