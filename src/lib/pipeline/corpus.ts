// Canned livestream dialogue used by the simulated ingest source and the mock
// STT provider. `intensity` (0..1) is a hidden "how hype is this line" hint that
// drives the synthetic audio-energy and chat-velocity signals so detection
// fires believably in simulated mode. Lines are seeded with cues for several
// qualities (hype, funny, fight, story, controversial) so the classifier has
// variety to catch. The real pipeline never sees `intensity`.

export interface CorpusLine {
  text: string;
  intensity: number;
}

export const STREAM_CORPUS: CorpusLine[] = [
  { text: "yo what's up everyone, welcome back to the stream", intensity: 0.1 },
  { text: "let me just get the settings sorted real quick", intensity: 0.05 },
  { text: "okay so today we're going for the ranked grind", intensity: 0.15 },
  { text: "oh this guy is already pushing, watch out", intensity: 0.35 },
  { text: "no no no he's flanking, he's flanking", intensity: 0.55 },
  { text: "WAIT WHAT, no way, NO WAY he just hit that", intensity: 0.95 },
  { text: "did you see that?? that was insane, clip that clip that", intensity: 0.98 },
  { text: "okay okay calm down, let's reset for a sec", intensity: 0.3 },
  { text: "haha okay story time while we queue, so basically back when I started", intensity: 0.5 },
  { text: "one time at a tournament I completely blanked on stage, so embarrassing", intensity: 0.55 },
  { text: "honestly, hot take, I think the new patch is actually better, unpopular opinion", intensity: 0.6 },
  { text: "no offense but the problem with this community is everyone overreacts", intensity: 0.62 },
  { text: "LMAO did you see his character just fall off the map, I'm dying", intensity: 0.8 },
  { text: "that's so funny, I can't breathe, hahaha", intensity: 0.78 },
  { text: "wait, did that guy just call me out in chat? square up bro", intensity: 0.82 },
  { text: "who said that, say it again, run it back, I'll fight you one v one", intensity: 0.9 },
  { text: "alright shoutout to everyone who just subscribed, appreciate you", intensity: 0.2 },
  { text: "okay big fight incoming, hold on hold on", intensity: 0.5 },
  { text: "LET'S GO, triple kill, are you kidding me right now", intensity: 0.97 },
  { text: "that's actually a world record pace, I'm not even joking", intensity: 0.85 },
  { text: "what the, my game just froze, give me a sec", intensity: 0.4 },
  { text: "deep breath... and... THERE IT IS, we did it, WE DID IT", intensity: 0.99 },
  { text: "oh my god my hands are shaking, that was so clutch", intensity: 0.8 },
  { text: "alright let's read some chat while I cool down", intensity: 0.15 },
];
