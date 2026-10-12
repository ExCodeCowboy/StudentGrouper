import revealSoundVersions from './revealSoundVersions.json';

/**
 * One bundled track per reveal. Recorded CC0 clips, except electronic game sounds (Pixel Quest, Block mine) that are
 * synthesized in-repo by deterministic scripts and dedicated CC0. Provenance ships beside the WAV files.
 */
export type RevealSoundId =
  | 'moon'
  | 'black-hole'
  | 'pixel-quest'
  | 'block-mine'
  | 'dot-to-dot'
  | 'dino-egg'
  | 'wizard'
  | 'squishy-bounce'
  | 'cat'
  | 'balloons'
  | 'fairy'
  | 'wave'
  | 'confetti';
export const REVEAL_SOUND_SAMPLE_RATE = 22050;

type SoundCue = { at: number; duration: number; description: string };
type SoundProfile = { asset: string; durationMs: number; description: string; sourceIds: readonly string[]; cues: readonly SoundCue[] };
const asset = (id: RevealSoundId) => `${import.meta.env?.BASE_URL ?? '/'}sounds/reveals/${id}.wav?v=${revealSoundVersions[id]}`;

/** Cue positions use seconds from the start of the corresponding visual; scripts/reveal-sound-cues.json lists every layer. */
export const REVEAL_SOUND_LIBRARY: Readonly<Record<RevealSoundId, SoundProfile>> = {
  moon: { asset: asset('moon'), durationMs: 9700, description: 'A 3-2-1 countdown, an engine roar that swells at liftoff, soft pops at stage separation, a sparkle to the Moon, quiet space, a soft touchdown, a boing for the giant leap, a flag ting, an iris swish and a big pop.', sourceIds: ['foley', 'magic', 'rocket', 'swishes'], cues: [
    { at: .15, duration: .25, description: 'Countdown tick "3" (wooden_01)' },
    { at: .75, duration: .2, description: 'Countdown tick "2" (wooden_01, +2 semitones)' },
    { at: 1.35, duration: .16, description: 'Countdown tick "1" (wooden_01, +4 semitones)' },
    { at: 1.3, duration: 2.5, description: 'Ignition and liftoff roar, base layer (rocket_engine, speaker-rumble)' },
    { at: 1.9, duration: 1.3, description: 'Liftoff punch layer (rocket_engine, speaker-rumble, bass -4 dB)' },
    { at: 3.62, duration: .12, description: 'Stage separation pop 1 (plop_02)' },
    { at: 3.98, duration: .3, description: 'Escape tower jettison swish (swish-11)' },
    { at: 4.26, duration: .09, description: 'Stage separation pop 2 (plop_02)' },
    { at: 4.64, duration: .5, description: 'Sparkle cut shimmer to the Moon (krank space/unlink)' },
    { at: 4.785, duration: .21, description: 'Glint ting at the 4.80 s cut (glass_03)' },
    { at: 7.05, duration: .33, description: 'Soft touchdown thump (hit_04)' },
    { at: 7.92, duration: .47, description: 'One giant leap boing (spring_05)' },
    { at: 8.64, duration: .75, description: 'Flag sparkle ting (bell_01)' },
    { at: 8.9, duration: .2, description: 'Iris closes swish (swish-8)' },
    { at: 9.46, duration: .18, description: 'POP (plop_01, deeper and louder: speed 0.85, peak 0.19; was 9.43 s at peak 0.13)' },
    { at: 9.48, duration: .15, description: 'Star sparkle on the POP (bell_02; was 9.46 s)' },
  ] },
  'black-hole': { asset: asset('black-hole'), durationMs: 5300, description: 'A space-portal whoosh, a boing, paper ripping into a shimmering swirl, a gulp, a little burp and a di-ding bell.', sourceIds: ['magic', 'foley', 'bubbles'], cues: [
    { at: .3, duration: 1.05, description: 'The hungry portal swirls open' },
    { at: 1.39, duration: .52, description: 'The question marks boing back' },
    { at: 1.7, duration: 1.69, description: 'Paper rips and swirls into the portal' },
    { at: 3.3, duration: .29, description: 'A big gulp' },
    { at: 4.15, duration: .39, description: 'A little burp' },
    { at: 4.72, duration: .48, description: 'Di-ding goodbye' },
  ] },
  'pixel-quest': { asset: asset('pixel-quest'), durationMs: 7000, description: 'An original soft chiptune: countdown blips, a bonk and rising gem blings on every block, a LEVEL CLEAR fanfare that hops along with the bunny, then a poof as the level falls away.', sourceIds: ['authored-pixel-quest'], cues: [
    { at: .2, duration: .19, description: 'Sparkle as the bunny spawns, then a soft landing tap' },
    { at: .3, duration: .79, description: 'Countdown blips on 3, 2, 1' },
    { at: 1.32, duration: .31, description: 'GO! as the run starts' },
    { at: 1.56, duration: 3.54, description: 'Quiet chiptune run music, one chord per bonk' },
    { at: 1.92, duration: .6, description: 'Bonk 1: ear boing, rising gem blings and the block crumbling' },
    { at: 2.64, duration: .6, description: 'Bonk 2' },
    { at: 3.36, duration: .6, description: 'Bonk 3' },
    { at: 4.08, duration: .6, description: 'Bonk 4' },
    { at: 4.8, duration: .45, description: 'Trophy grab shimmer as it lifts the bunny' },
    { at: 5.16, duration: .88, description: 'Three firework rockets and bursts' },
    { at: 5.3, duration: 1.3, description: 'LEVEL CLEAR fanfare, a note on each cheer hop, resolving on the poof' },
    { at: 5.8, duration: .12, description: 'Wink ting' },
    { at: 6.04, duration: .38, description: 'Hop, poof and twinkles as the bunny vanishes' },
    { at: 6.14, duration: .66, description: 'The level crumbles and falls away' },
  ] },
  'block-mine': { asset: asset('block-mine'), durationMs: 7900, description: 'Recorded pickaxe tiks, cracks and wooden knocks with authored mallet blips: tik-tik-tik-CRACK on every card, rising ta-dings as cubes land, a gem chime and glint, and a cottage built note by note up to a bell.', sourceIds: ['foley', 'swishes', 'authored-block-mine'], cues: [
    { at: .18, duration: .19, description: 'The hotbar knocks into place and the pickaxe whooshes out of it' },
    { at: .74, duration: .81, description: 'Tik, tik, tik, CRACK: the first chunk bursts' },
    { at: 1.64, duration: 2.35, description: 'More tik-tik-tik CRACKs; the first cubes of each land in the hotbar with a rising ta-ding' },
    { at: 3.99, duration: .3, description: 'The last CRACK and a happy chime as the gem pops free' },
    { at: 4.44, duration: .6, description: 'The pickaxe clacks home; the gem lands big with a ta-ding and glints' },
    { at: 5.26, duration: .17, description: 'The gem dives into its slot with a whoosh and a bell' },
    { at: 5.45, duration: 1, description: 'The cottage stacks up row by row: a wooden knock and a rising note each' },
    { at: 6.45, duration: .55, description: 'The gem crowns the cottage with a bell and the lights click on' },
    { at: 7.58, duration: .1, description: 'Everything drops away' },
  ] },
  'dot-to-dot': { asset: asset('dot-to-dot'), durationMs: 8000, description: 'Wooden pencil taps count along, a pencil-on-paper scribble races, ticks and a hush, then a bell-and-pop snap with sparkles, a boing and departing whooshes.', sourceIds: ['swishes', 'foley'], cues: [
    { at: .45, duration: .13, description: 'The pencil swoops in' },
    { at: 1, duration: 1.53, description: 'Pencil taps count along: 2, 4, 6, 8, 10' },
    { at: 2.4, duration: 1.92, description: 'Pencil scribbles through the scenery' },
    { at: 4.34, duration: .24, description: 'The big lift to the outline' },
    { at: 4.64, duration: .74, description: 'The outline races round' },
    { at: 5.4, duration: .47, description: 'Suspense ticks, then a hush' },
    { at: 5.93, duration: .65, description: 'The line snaps shut: bell, pop and sparkles' },
    { at: 6.31, duration: .65, description: 'It comes alive with a boing' },
    { at: 6.88, duration: .69, description: 'Whooshes as it leaves and the sheets clear' },
  ] },
  'dino-egg': { asset: asset('dino-egg'), durationMs: 7400, description: 'Eggs plop and knock, one tink, a big pop, a huge breath and a tiny peep, then a stomp cracks every egg open.', sourceIds: ['foley', 'giggle', 'rocket', 'swishes'], cues: [
    { at: .19, duration: .6, description: 'Eggs plop into their nests, then the big one lands with a tock' },
    { at: .69, duration: 1, description: 'Knock-knock from inside every egg' },
    { at: 2, duration: .25, description: 'One hairline crack' },
    { at: 2.44, duration: .85, description: 'The big egg knocks twice, creaks open and pops; the hat lands' },
    { at: 3.38, duration: .58, description: 'A huge breath' },
    { at: 4.04, duration: .15, description: '...and a tiny peep' },
    { at: 4.79, duration: 1.1, description: 'The stomp booms and every egg cracks open' },
    { at: 6.16, duration: .5, description: 'Hop down, and the hat slips over its eyes' },
    { at: 6.86, duration: .45, description: 'Pitter-patter and a pip-pip as it scurries off' },
  ] },
  wizard: { asset: asset('wizard'), durationMs: 7200, description: 'Owl wing whooshes, paper pats, loop tinks and a wand-charged star pop, then seal pops, a fizzle and a padlock click, a giggle, and the padlock clicking open for the final pop.', sourceIds: ['bubbles', 'foley', 'giggle', 'magic', 'swishes'], cues: [
    { at: .25, duration: .6, description: 'The question marks whirl away and night falls with a twinkle' },
    { at: .76, duration: 1.52, description: 'The owl swoops in and a letter pats down on each card' },
    { at: 2.1, duration: .95, description: 'The owl U-turns, glides back and dives into the loops' },
    { at: 3.14, duration: .66, description: 'Arcanum... stellae...: loop whooshes and rising tinks' },
    { at: 3.8, duration: .4, description: 'The wand winds up and taps' },
    { at: 4.19, duration: .45, description: 'APERIO!: the gold star pops in, charges and bursts' },
    { at: 4.68, duration: .24, description: 'Seals pop across the cards; the owl poofs with a boing' },
    { at: 4.9, duration: .38, description: 'The stubborn seal fizzles, a padlock clicks shut and the envelope rattles no' },
    { at: 5.14, duration: .38, description: 'The owl giggles' },
    { at: 5.55, duration: .12, description: 'A hop over to the stubborn letter' },
    { at: 5.93, duration: .7, description: 'Aperi!: the padlock clicks open, then the big pop and a sparkly ding' },
    { at: 6.33, duration: .56, description: 'The owl flies away' },
  ] },
  'squishy-bounce': { asset: asset('squishy-bounce'), durationMs: 7300, description: 'Recorded slime squelches, door-spring boings, soft swishes and a tiny giggle for a gumdrop that hops across the pillows, belly-flops and boings them all away.', sourceIds: ['bubbles', 'foley', 'giggle', 'swishes'], cues: [
    { at: .31, duration: .5, description: 'A sly giggle, then the buddy springs in' },
    { at: .94, duration: 2.1, description: 'Six squishy landings, each kick-off boing a little higher' },
    { at: 3.07, duration: .38, description: 'Super jump' },
    { at: 3.9, duration: .52, description: 'Whoosh down and SPLAT' },
    { at: 4.83, duration: .6, description: 'Every pillow boings away' },
    { at: 5.44, duration: 1, description: 'Plop, then it puffs back up' },
    { at: 6.59, duration: .25, description: 'Wink sparkle' },
    { at: 6.99, duration: .13, description: 'Ducks away' },
  ] },
  cat: { asset: asset('cat'), durationMs: 8500, description: 'Soft paw taps, a little mew, a swish onto the yarn, rising bell notes as the covers unravel, a spring-and-pop, a happy mew-purr, twinkles for the blink and a springy hop away.', sourceIds: ['cat', 'foley', 'swishes'], cues: [
    { at: .3, duration: .45, description: 'Soft paw taps as the kitten trots in' },
    { at: 1.36, duration: .67, description: 'A little mew as she notices the ball' },
    { at: 2.78, duration: .95, description: 'A swish and a soft landing as she hops onto the yarn' },
    { at: 3.4, duration: 1.5, description: 'Rising bell notes as the knitted covers unravel' },
    { at: 4.84, duration: .64, description: 'A spring and a pop as she pops out of the tangle' },
    { at: 5.4, duration: .9, description: 'A happy mew and purr' },
    { at: 6.64, duration: .59, description: 'Twinkles for the slow happy blink' },
    { at: 7.93, duration: .38, description: 'A spring and paw taps as she hops away' },
  ] },
  balloons: { asset: asset('balloons'), durationMs: 5300, description: 'Balloon poks, a boing, three rising breaths, a sneeze of air, a ripple of pops, a tiny giggle, a whoosh and a twinkle goodbye.', sourceIds: ['foley', 'giggle', 'swishes'], cues: [
    { at: .1, duration: .66, description: 'The question marks puff up into balloons' },
    { at: .78, duration: .8, description: 'The hedgehog floats up and settles' },
    { at: 1.67, duration: .59, description: 'The heart balloon pokes a prickle and boings away' },
    { at: 2.39, duration: .15, description: 'A feather lands on his nose' },
    { at: 2.62, duration: .96, description: 'Ah... ah... ah...' },
    { at: 3.62, duration: .69, description: 'Choo! The balloons pop' },
    { at: 4.19, duration: .38, description: 'A tiny giggle' },
    { at: 4.68, duration: .5, description: 'Lift-off and a twinkle goodbye' },
  ] },
  fairy: { asset: asset('fairy'), durationMs: 5340, description: 'Recorded swishes, glass tinks that count to two and fizzle, a sputter-shake into a sparkle-bell BLING, a rising glass sparkle run over the blooms, and a tiny giggle.', sourceIds: ['foley', 'giggle', 'magic', 'swishes'], cues: [
    { at: .12, duration: .7, description: 'A glint, a loop-de-loop whoosh and a tiny bell as the buds sprout' },
    { at: .85, duration: .5, description: 'Wand count: one, two' },
    { at: 1.51, duration: .3, description: 'The third pulse fizzles' },
    { at: 1.82, duration: .7, description: 'A puzzled tink, a sputtering shake, then BLING' },
    { at: 2.52, duration: 1.1, description: 'A rising glass sparkle run as each card blooms' },
    { at: 3.66, duration: .38, description: 'A butterfly flutters onto her nose' },
    { at: 4.16, duration: .6, description: 'Nose giggle' },
    { at: 4.78, duration: .49, description: 'A wink bell and a zoom away' },
  ] },
  wave: { asset: asset('wave'), durationMs: 4900, description: 'Real surf rolls in and out, with splashes for the otter and dolphin, a pop from the tube, a splashdown on the wave\'s back and two little crab clicks. Sources stay water, bubbles, foley and swishes. The only new cue is extracted/bubbles/splash_12.ogg (CC0 bubbles pack, already credited); no synthesis, no new source.', sourceIds: ['bubbles', 'foley', 'swishes', 'water'], cues: [
    { at: .08, duration: 1, description: 'A small lap of water rushes in and draws back' },
    { at: .6, duration: 1.69, description: 'The big wave rises and rolls, dipping for the tail-five' },
    { at: 1, duration: .44, description: 'Splash as the otter pops up onto its board' },
    { at: 1.645, duration: .3, description: 'Splash as the dolphin leaps' },
    { at: 1.845, duration: .32, description: 'Wet slap of the dolphin tail-five' },
    { at: 2.1, duration: .22, description: 'A low gulp as the otter rides into the tube' },
    { at: 2.11, duration: .205, description: 'Splash as the dolphin dives back in' },
    { at: 2.32, duration: .37, description: 'A hushed murmur inside the tube' },
    { at: 2.542, duration: .043, description: 'A tiny tick as the eyes blink' },
    { at: 2.61, duration: .36, description: 'Pop as the tube spits the otter out' },
    { at: 2.695, duration: .28, description: 'Whoosh of the spit' },
    { at: 2.72, duration: 1.18, description: 'Spray bursts from the tube' },
    { at: 2.78, duration: 1.1, description: 'Surf rolls on as the otter rides out' },
    { at: 2.92, duration: .45, description: 'Splash as the otter lands on the back of the wave' },
    { at: 3.47, duration: .47, description: 'Boing as the crab pops up' },
    { at: 3.825, duration: .056, description: 'Tick as the crab looks left' },
    { at: 4.065, duration: .05, description: 'Tick as the crab looks right' },
    { at: 4.3, duration: .27, description: 'Claw click' },
    { at: 4.425, duration: .235, description: 'Second claw click, a little higher' },
    { at: 4.6, duration: .24, description: 'The crab\'s bubble pops' },
  ] },
  confetti: { asset: asset('confetti'), durationMs: 4300, description: 'A spotlight drumroll that hushes for Pip\'s too-early little pop and boing, then builds to a ba-DUM pop and whoosh, a trumpet ta-da and twinkling stars.', sourceIds: ['drumroll', 'fanfare', 'foley', 'swishes'], cues: [
    { at: .1, duration: 1.69, description: 'A drumroll builds while the spotlight searches (5 crossfaded roll cues, unchanged)' },
    { at: .86, duration: .16, description: 'Pip pops too early (little \'pop\', unchanged)' },
    { at: 1.09, duration: .26, description: 'The ribbon curl boings onto Pip (unchanged)' },
    { at: 1.785, duration: .4, description: 'ba-DUM and POP, with the whoosh and paper (unchanged)' },
    { at: 2.065, duration: 2, description: 'Ta-da as the covers pop and the confetti flies (card pop moved from 2.04 to 2.065; trumpet moved from 2.04 to 2.07, trimmed to 2.0 s)' },
    { at: 2.4, duration: 1.84, description: 'Stars twinkle down (2.40, 2.90, 3.22, 3.69, 3.93; last ends 4.231 s)' },
  ] },
};
