# Gentle reveal sounds

Each of the nine student-view reveals has a short soundtrack assembled from bundled CC0 game-audio clips. Sounds start with the teacher's Reveal click. The small speaker button beside Reveal mutes them immediately; enabling it waits for the next reveal. The preference is shared between Groups and Today and saved on this device, with a session fallback when browser storage cannot be written. Instant and reduced-motion reveals stay silent.

| Reveal | Accent |
| --- | --- |
| Balloon lift-off | Light recorded swishes and a small bell accent |
| Rainbow zipper | A recorded jacket zipper, slowed to follow the opening |
| Dragon hiccup | Two bubble sounds timed to the hiccups |
| Cat & yarn | A recorded cat mew-purr during curiosity and a soft tap at paw contact |
| Saturn V · Moon landing | A fuller engine roar that swells at liftoff and fades with ascent, a soft landing tap and a bell for the flag |
| Black-hole whoosh | An atmospheric game effect shaped around the spiral |
| Fairy dust | A small character giggle during her pause, with a quiet magic accent and light swishes |
| Ocean wave | An excerpt of recorded water shaped to the passing wave |
| Confetti party | A one-second snare roll behind closed covers, then a trumpet ta-da with the confetti burst |

The source library includes recorded animals, water and foley, alongside designed game effects. These clips are edited into short reveal tracks; the app does not generate oscillator/noise substitutes at runtime. Original sources, creators, CC0 terms, download URLs and SHA-256 hashes are preserved in [SOURCES.json](../public/sounds/reveals/SOURCES.json) and [CREDITS.md](../public/sounds/reveals/CREDITS.md). The selected-file manifest identifies excerpts and edits. No NASA audio is included: the launch uses [Rocket Engine by theMinesAreShakin](https://opengameart.org/content/rocket-engine), a CC0 low-rumble effect selected by the user, and lunar cues are stylized accents.

## Modules and lifecycle

`src/revealEffects/revealSounds.ts` owns the typed asset registry, cue descriptions and visual durations. Each reveal module opts in with its optional `sound` property; the chosen Surprise effect determines its own sound. `revealAudio.ts` plays one finished track for the whole screen, independently of the number of teams or stations.

The player preloads the bundled file bytes without creating or resuming an audio context. It retains the small PCM WAV recordings and caches at most three decoded audio buffers. A Reveal click creates the context if needed and calls `resume()` directly in the click stack, before awaiting loading or decoding. `decodeAudioData()` receives a copy of the original bytes so eviction or a closed context can be recovered without losing the cached recording. Relevant API details: [AudioContext.resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume), [BaseAudioContext.decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData), and [AudioBufferSourceNode.start](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start).

The tracks use conservative authored levels and shaped starts and endings. The player applies a 0.55 master gain, an 8 ms attack and a 30 ms cancellation fade. A 250 ms deadline covers permission, loading and decoding: a late or blocked start stays silent while the visual continues. For shorter startup delays, playback begins at the elapsed track offset to preserve synchronization. Failed loads may retry on a later reveal.

Hiding, switching effects, leaving student view, hiding the browser page, or enabling reduced motion cancels the sound. A failed or blocked audio start leaves the visual reveal usable and provides a message on the speaker control. Enabling sound does not start a late cue. Opening transition music stops the reveal; revealing a hidden day closes any transition song first. Reveal mute controls only reveal accents, leaving the separate transition-music controls intact.

The clips ship with the application, so their playback does not depend on OpenGameArt or another remote sound service. The Mac package includes the same bundled assets. This packaging design does not constitute a physical Mac playback check.

## Preparing replacement clips

The nine mono PCM WAV tracks total about 1.56 MB and have no runtime conversion dependency. `scripts/prepare-reveal-sounds.py` rebuilds them from the credited downloads using NumPy and SoundFile. The default input folder is supplied as its argument: `python scripts/prepare-reveal-sounds.py work/open-sounds`. Download/extract originals to the paths in `scripts/reveal-sound-cues.json`; source files and archives with their verified hashes are listed in `SOURCES.json`. The recipe records source clips, placement, trimming, playback speed, gain caps and fades. The script writes `CUES.json` with per-input and output hashes, and refreshes the output mapping in `SOURCES.json`. The script also generates `src/revealEffects/revealSoundVersions.json`. Each audio URL includes its finished-WAV hash so changed clips invalidate browser/CDN caches and participate in the local preview's module updates.

The rocket uses a 2.06-second middle excerpt (2.015-4.075 seconds) of `rocket_engine.001.wav` at its original pitch and speed, with a 0.15-second attack and 0.45-second release. Its `speaker-rumble` processing profile removes sub-bass below about 105 Hz, brings forward existing low-mid texture, and mixes in a softly saturated copy of the same recording to add audible harmonics. No new sound source is mixed in. The peak cap remains 0.24 and RMS cap 0.075 before the player's master gain. The original mix put over 98% of launch energy below 200 Hz; processing raises the 200-1500 Hz signal by about 12.7 dB without raising the overall volume ceiling. This is a signal measurement, not a measured speaker response or listening assessment. Confetti lasts 3.8 seconds so its 1-second anticipation, burst and particle tails fit the same audio/visual timeline.

## Validation

Automated checks cover the registry and packaged tracks, visual duration agreement, finite samples, conservative peaks, quiet endpoints and cue timing. Playback tests cover byte preloading without audio activation, click-time resume, decoding, delay offsets, blocked or late starts, rapid replacement, cancellation, cleanup and cache eviction. Numerical checks can identify clipping, timing errors and malformed assets; they do not establish that a sound is pleasant.

The ignored `work/reveal-sound-review.html` provides a browser review harness. The original downloaded candidates stay under ignored `work/open-sounds/`; only the selected edited clips and their provenance are bundled. All 243 app tests, lint and the production build passed after the replacement. A fresh browser fixture verified the bundled 8.8-second moon track, 3.8-second confetti track and 3.2-second fairy track start through real Web Audio, with one source for four groups. The production output contains all nine WAVs and their credits. A listening audition and physical Mac playback have not been verified in this session; these checks establish loading, timing and lifecycle behavior.

The rocket presence revision passed the focused audio checks and production build. A fresh browser playback began at a 0.117-second timeline offset (before the 0.24-second engine cue) and the decoded buffer contained the expected liftoff signal. A regression check now requires sufficient engine energy above the weakest bass range of small speakers.
