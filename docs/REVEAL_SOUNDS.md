# Gentle reveal sounds

Each of the thirteen student-view reveals has a short soundtrack, exactly as long as its animation. Sounds start with the teacher's Reveal click. The small speaker button beside Reveal mutes them immediately; enabling it waits for the next reveal. The preference is shared between Groups and Today and saved on this device, with a session fallback when browser storage cannot be written. Instant and reduced-motion reveals stay silent.

| Reveal | Length | Sound |
| --- | --- | --- |
| Saturn V · Moon landing | 9.7 s | Countdown ticks, an engine roar that swells at liftoff, stage-separation pops, a sparkle to the Moon, quiet space, a soft touchdown, a boing for the giant leap, a flag ting, an iris swish and a pop |
| Black-hole whoosh | 5.3 s | A space-portal whoosh, a boing, paper ripping into a shimmering swirl, a gulp, a little burp and a di-ding bell |
| Pixel Quest · Level clear! | 7.0 s | An original soft chiptune (authored in-repo): countdown blips, a bonk and rising gem blings per block, a LEVEL CLEAR fanfare on the cheer hops and a poof |
| Block mine · Dig & build | 7.9 s | Recorded pickaxe tiks, cracks and wooden knocks with authored mallet blips: rising ta-dings as cubes land, a gem chime and a cottage built note by note |
| Hard dot-to-dot | 8.0 s | Pencil taps that count along, a pencil scribble, suspense ticks and a hush, a bell-and-pop snap with sparkles, a boing and departing whooshes |
| Dino egg hatch | 7.8 s | Egg plops and knocks, a crack and a pop, a huge breath and a tiny peep, then a stomp that cracks every egg |
| Wizard owl · Magic letters | 7.2 s | Wing whooshes, paper pats, loop tinks, a wand-charged star pop, seal pops, a fizzle, a giggle and a final boop |
| Squishy bounce | 7.3 s | Slime squelches, door-spring boings, soft swishes and a tiny giggle |
| Kitten & yarn | 8.5 s | Soft paw taps, recorded mews and a purr, a swish onto the yarn, rising bell notes as the covers unravel, twinkles and a springy hop away |
| Balloon pop party | 5.3 s | Balloon poks, a boing, three rising breaths, a sneeze, a ripple of pops, a tiny giggle and a twinkle |
| Fairy dust | 5.3 s | Swishes, glass tinks that count and fizzle, a sparkle-bell BLING, a rising sparkle run and a tiny giggle |
| Ocean wave · Otter surf | 4.9 s | Recorded surf, splashes for the otter and dolphin, a pop from the tube and two little crab clicks |
| Confetti party | 5.0 s | A spotlight drumroll with an early pip and boing, a ba-DUM pop and whoosh, a trumpet ta-da and twinkling stars |

## Source policy

Tracks are edited from **recorded CC0 clips**: animals, water, foley and designed game effects from credited libraries. The one exception is **electronic game sounds** (chiptune and arcade-style blips), which may be synthesized in-repo by deterministic scripts under `scripts/authored-sounds/` and dedicated CC0. Today that covers Pixel Quest (`authored-pixel-quest`) and the blips in Block mine (`authored-block-mine`). The app never generates oscillator or noise substitutes at runtime. Original sources, creators, CC0 terms, download URLs and SHA-256 hashes (or, for authored sets, the generator script) are preserved in [SOURCES.json](../public/sounds/reveals/SOURCES.json) and [CREDITS.md](../public/sounds/reveals/CREDITS.md). No NASA audio is included: the launch uses [Rocket Engine by theMinesAreShakin](https://opengameart.org/content/rocket-engine), and lunar cues are stylized accents.

## Modules and lifecycle

`src/revealEffects/revealSounds.ts` owns the typed asset registry, cue descriptions and visual durations. Each reveal module opts in with its `sound` property; the chosen Surprise effect determines its own sound. `revealAudio.ts` plays one finished track for the whole screen, independently of the number of teams or stations.

The player preloads the bundled file bytes without creating or resuming an audio context. It retains the small PCM WAV recordings and caches at most three decoded audio buffers. A Reveal click creates the context if needed and calls `resume()` directly in the click stack, before awaiting loading or decoding. `decodeAudioData()` receives a copy of the original bytes so eviction or a closed context can be recovered without losing the cached recording. Relevant API details: [AudioContext.resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume), [BaseAudioContext.decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData), and [AudioBufferSourceNode.start](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start).

The tracks use conservative authored levels and shaped starts and endings. The player applies a 0.55 master gain, an 8 ms attack and a 30 ms cancellation fade. A 250 ms deadline covers permission, loading and decoding: a late or blocked start stays silent while the visual continues. For shorter startup delays, playback begins at the elapsed track offset to preserve synchronization. Failed loads may retry on a later reveal.

Hiding, switching effects, leaving student view, hiding the browser page, or enabling reduced motion cancels the sound. A failed or blocked audio start leaves the visual reveal usable and provides a message on the speaker control. Enabling sound does not start a late cue. Opening transition music stops the reveal; revealing a hidden day closes any transition song first. Reveal mute controls only reveal accents, leaving the separate transition-music controls intact.

The clips ship with the application, so their playback does not depend on OpenGameArt or another remote sound service. The Mac package includes the same bundled assets.

## Building the tracks

The thirteen mono 16-bit PCM WAV tracks (22.05 kHz) total about 3.9 MB and need no runtime conversion. `scripts/reveal-sound-cues.json` is the recipe: for each reveal, its `durationMs` (equal to the effect's) and every layer's source clip, start time, trimming, playback speed, processing, gain caps and fades. To rebuild, with NumPy and SoundFile installed:

1. Download and extract the credited originals into `work/open-sounds/` at the paths the recipe names (`SOURCES.json` lists each download and its hash).
2. Generate the authored stems: `python scripts/authored-sounds/pixel-quest.py work/open-sounds` and `python scripts/authored-sounds/block-mine.py work/open-sounds` (deterministic; they write `work/open-sounds/authored/<id>/`).
3. Build: `python scripts/prepare-reveal-sounds.py work/open-sounds`. It writes `public/sounds/reveals/<id>.wav`, `CUES.json` (per-input and output hashes), the `files` mapping in `SOURCES.json`, and `src/revealEffects/revealSoundVersions.json`. It refuses a layer from an uncredited source or one that runs past the reveal. Each audio URL includes its finished-WAV hash, so changed tracks invalidate browser/CDN caches.

To audition one reveal without touching the bundled files: `python scripts/prepare-reveal-sounds.py work/open-sounds --only <id> --recipe <recipe.json> --preview <folder>`. When a reveal is removed, delete its recipe entry and WAV, and any source no other recipe uses.

The Moon's engine roar layers two excerpts of `rocket_engine.001.wav` at original pitch with the `speaker-rumble` processing profile: it removes sub-bass below about 105 Hz, brings forward the existing low-mid texture and mixes in a softly saturated copy of the same recording, so the roar stays audible on small speakers without raising the volume ceiling.

## Validation

Automated checks (`tests/revealSounds.test.ts`) cover: one track per registered reveal, built from the current recipe; WAV format; track, profile, recipe and animation durations agreeing; hashes and asset URLs; CC0 provenance for every layer (a verified download, or a generator script in the repository); conservative peaks and RMS, no DC offset, and silent first 80 ms and last 50 ms; digital silence outside the credited layers; sound in every described cue window; and reveal-specific phases (the Moon's countdown, a liftoff roar with enough texture above 200 Hz, a silent coast in space and the landing accents; the kitten's recorded mew and quiet wiggle). `tests/revealAudio.test.ts` covers byte preloading without audio activation, click-time resume, decoding, delay offsets, blocked or late starts, rapid replacement, cancellation, cleanup and cache eviction. Numerical checks catch clipping, timing errors and malformed assets; they do not establish that a sound is pleasant, so new tracks still need a listening pass (the ignored `work/reveal-sound-review.html` harness) and a physical Mac playback check.
