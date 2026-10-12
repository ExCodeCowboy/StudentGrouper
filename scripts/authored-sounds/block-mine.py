"""Authored game blips for the 'block-mine' reveal (deterministic; dedicated CC0).

    python scripts/authored-sounds/block-mine.py work/open-sounds

Writes short stems to <root>/authored/block-mine/*.wav (22.05 kHz mono 24-bit PCM;
byte-identical on every run, since float WAVs carry a timestamped PEAK chunk)
plus NOTES.json (every pitched note, for the originality tests). The reveal
recipe (work/sound-recipes/block-mine.json) places them on the timeline next
to recorded foley (pick ticks, block cracks, plops, wooden knocks, bells,
a light switch), and scripts/prepare-reveal-sounds.py mixes and levels them.

Only electronic, original material, in a timbre unlike the other reveals:
a soft kalimba-like mallet (inharmonic sine partials, fast decay, a tiny
filtered-noise tick on the strike). No pulse-wave chiptune (that is
pixel-quest's voice), and nothing modelled on the sandbox game's own
sounds: no randomly pitched pickup pop, no orb 'ding', no block-break crunch.
Melodic material is stepwise C-major pentatonic: the collect 'ta-ding' is a
rising major second or minor third, the build climbs C D E G A one row at a
time and the crown lands on C. Deliberately avoided: any short-long rising
perfect fourth (the famous coin pickup) and the ascending major-triad
'course clear' run.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

RATE = 22050
SEMITONES = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
# Kalimba-like tine: inharmonic partials, the upper ones die fast.
PARTIALS = ((1.0, 1.0, 7.0), (2.76, .32, 16.0), (5.40, .10, 30.0), (8.93, .04, 46.0))


def note(name):
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((SEMITONES[pitch] + 12 * (octave - 4)) / 12)


def lowpass(signal, cutoff):
    frequencies = np.fft.rfftfreq(len(signal), 1 / RATE)
    return np.fft.irfft(np.fft.rfft(signal) / (1 + (frequencies / cutoff) ** 4), n=len(signal))


def mallet(name, seconds=.45, strike=.25, seed=1, damping=1.0):
    """One soft mallet strike: sine partials plus a 3 ms filtered-noise tick.

    damping > 1 shortens every partial's ring (the gem glint's quick pings)."""
    t = np.arange(int(round(seconds * RATE))) / RATE
    freq = note(name)
    out = np.zeros_like(t)
    for ratio, amp, decay in PARTIALS:
        if freq * ratio > RATE * .45:
            continue
        out += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-decay * damping * t)
    out *= np.clip(t / .002, 0, 1)
    rng = np.random.default_rng(seed)
    click = lowpass(rng.standard_normal(len(t)), 2400) * np.exp(-t / .003)
    out += strike * click / max(np.max(np.abs(click)), 1e-9)
    return out


def place(track, sound, at):
    start = int(round(at * RATE))
    end = min(len(track), start + len(sound))
    track[start:end] += sound[:end - start]


def normalise(sound, peak=.9):
    return sound * peak / max(np.max(np.abs(sound)), 1e-9)


def write(folder, name, sound, notes, log):
    fade = min(len(sound), int(.03 * RATE))
    sound = sound.copy()
    sound[-fade:] *= np.linspace(1, 0, fade)
    sf.write(folder / f"{name}.wav", normalise(sound), RATE, subtype="PCM_24")
    log[name] = notes


def main(root):
    folder = Path(root) / "authored" / "block-mine"
    folder.mkdir(parents=True, exist_ok=True)
    log = {}

    # Collect 'ta-ding': a cube lands in the hotbar. One per swing slot, a step higher each time.
    for slot, (low, high) in enumerate((("E5", "G5"), ("G5", "A5"), ("A5", "C6"), ("C6", "D6"))):
        track = np.zeros(int(.5 * RATE))
        place(track, mallet(low, .42, seed=10 + slot) * .8, 0)
        place(track, mallet(high, .42, seed=20 + slot), .045)
        write(folder, f"collect-{slot}", track, [low, high], log)

    # Build: one soft note per house row as it lands (C D E G A), then the crown on C.
    for row, name in enumerate(("C5", "D5", "E5", "G5", "A5")):
        write(folder, f"build-{row}", mallet(name, .5, strike=.35, seed=30 + row), [name], log)
    crown = np.zeros(int(.9 * RATE))
    place(crown, mallet("C6", .85, strike=.2, seed=40), 0)
    place(crown, mallet("G5", .8, strike=0, seed=41) * .45, .0)
    place(crown, mallet("E6", .7, strike=0, seed=42) * .35, .09)
    write(folder, "crown", crown, ["C6", "G5", "E6"], log)

    # Gem glint: quick, very high pings that follow the pixel glint across the gem's face
    # (7 frames in 0.32 s, so one ping per ~46 ms frame), a little dip then up to a bright top ping.
    # Neighbour-note sparkle in the pentatonic scale; no triad run.
    shimmer_notes = ["A7", "G7", "E7", "G7", "A7", "C8"]
    shimmer_gains = (.62, .7, .78, .74, .7, 1.0)
    shimmer = np.zeros(int(.52 * RATE))
    for i, (name, gain) in enumerate(zip(shimmer_notes, shimmer_gains)):
        ping = mallet(name, .26, strike=0, seed=50 + i, damping=2.5) * gain
        place(shimmer, ping, i * .046)
    write(folder, "shimmer", shimmer, shimmer_notes, log)

    (folder / "NOTES.json").write_text(json.dumps(log, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(log)} stems to {folder}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "work/open-sounds")
