"""Authored chiptune stems for the 'pixel-quest' reveal (deterministic; dedicated CC0).

    python scripts/authored-sounds/pixel-quest.py work/open-sounds

Writes one short stem per event to <root>/authored/pixel-quest/*.wav (22.05 kHz
mono float) plus NOTES.json (every melodic note list, for the originality
tests). The reveal recipe places the stems on the timeline and
scripts/prepare-reveal-sounds.py mixes, levels and masters them like any clip.

Only electronic, original material: band-limited pulse waves (PolyBLEP), a
4-bit stepped triangle and 15-bit LFSR noise with console-style volume steps.
Deliberately avoided: any short-long rising perfect fourth (the famous coin
pickup), the ascending major-triad "course clear" run, per-jump "bwip"s, and
any recognisable jingle. The bed runs at quarter = 0.72 s so every bonk lands
on a beat; the chords go C, Am, F, G and resolve to C on the trophy grab. The
LEVEL CLEAR fanfare moves in triplet eighths of that pulse (0.24 s) so its notes
land on the hero's cheer hops, and it resolves on the poof.

Dedicated to the public domain (CC0-1.0), like the WAV files it writes.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

RATE = 22050
SEMITONES = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}


def samples(seconds):
    return int(round(seconds * RATE))


def note(name):
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((SEMITONES[pitch] + 12 * (octave - 4)) / 12)


def poly_blep(phase, inc):
    out = np.zeros_like(phase)
    a = phase < inc
    t = phase[a] / inc[a]
    out[a] = t + t - t * t - 1
    b = phase > 1 - inc
    t = (phase[b] - 1) / inc[b]
    out[b] = t * t + t + t + 1
    return out


def frequencies(freq, seconds):
    n = samples(seconds)
    return np.full(n, float(freq)) if np.ndim(freq) == 0 else np.asarray(freq, float)[:n]


def pulse(freq, seconds, duty=0.5):
    """Band-limited pulse; freq may be an array (sweeps, vibrato)."""
    inc = frequencies(freq, seconds) / RATE
    phase = np.cumsum(inc) % 1.0
    saw1 = 2 * phase - 1 - poly_blep(phase, inc)
    shifted = (phase + (1 - duty)) % 1.0
    saw2 = 2 * shifted - 1 - poly_blep(shifted, inc)
    return 0.5 * (saw1 - saw2)


def triangle(freq, seconds):
    phase = np.cumsum(frequencies(freq, seconds) / RATE) % 1.0
    return np.round((4 * np.abs(phase - 0.5) - 1) * 7.5) / 7.5  # 4-bit steps, like a console triangle channel


def noise(seconds, clock=8000, seed=1):
    """15-bit LFSR noise, sample-and-hold at `clock` Hz (lower = crunchier)."""
    n = samples(seconds)
    register = 1 + seed
    steps = int(np.ceil(seconds * clock)) + 1
    values = np.empty(steps)
    for i in range(steps):
        bit = (register ^ (register >> 1)) & 1
        register = (register >> 1) | (bit << 14)
        values[i] = 1.0 if register & 1 else -1.0
    return values[np.minimum((np.arange(n) * clock / RATE).astype(int), steps - 1)]


def env(n, attack=0.004, release=0.03, decay=None, steps=16):
    t = np.arange(n) / RATE
    duration = n / RATE
    e = np.clip(t / max(attack, 1e-4), 0, 1) * np.clip((duration - t) / max(release, 1e-4), 0, 1)
    if decay:
        e *= np.exp(-t / decay)
    return np.round(e * steps) / steps  # console-style volume steps


def sweep(f0, f1, seconds):
    n = samples(seconds)
    return f0 * (f1 / f0) ** (np.arange(n) / max(1, n - 1))


def cat(*parts):
    return np.concatenate(parts)


def mix(*tracks):
    n = max(len(t) for t in tracks)
    return sum(np.pad(t, (0, n - len(t))) for t in tracks)


def place(x, seconds, total):
    out = np.zeros(samples(total))
    start = samples(seconds)
    out[start:start + len(x)] += x[: len(out) - start]
    return out


def tone(fn, name, seconds, **kw):
    x = fn(note(name), seconds, **kw)
    return x * env(len(x), release=min(0.03, seconds / 3))


# Melodic material, exported to NOTES.json so tests can guard originality.
NOTES = {
    # Gem sparkles: stacked thirds over the current chord, climbing one third per chain step.
    "bling": {
        "c": ["C6", "E6", "G6", "B6", "D7", "F7"],
        "am": ["A5", "C6", "E6", "G6", "B6", "D7"],
        "f": ["F5", "A5", "C6", "E6", "G6", "B6"],
        "g": ["G5", "B5", "D6", "F6", "A6", "C7"],
    },
    # LEVEL CLEAR (original): a stepwise pentatonic climb that lands on a held E6 over C. The stem starts at 5.30 with
    # the banner; each note after the pickup lands on one of the hero's cheer hops (5.42, 5.66, 5.90), the V chord
    # (D6 over G) on the squash at 6.00, and the tonic on the poof at 6.10.
    "fanfare_lead": [["E5", 0.12], ["G5", 0.24], ["A5", 0.24], ["C6", 0.10], ["D6", 0.10], ["E6", 0.5]],
    "fanfare_harmony": [["C5", 0.12], ["E5", 0.24], ["F5", 0.24], ["A5", 0.10], ["B5", 0.10], ["C6", 0.5]],
    "fanfare_bass": [["C3", 0.36], ["F2", 0.24], ["G2", 0.20], ["C3", 0.5]],
    "bed_roots": [["G2", -0.36], ["C3", 0.0], ["A2", 0.72], ["F2", 1.44], ["G2", 2.16], ["C3", 2.88]],
    # Firework sparkles: a falling arpeggio of whatever chord the fanfare is on when each burst lands (C, F, G).
    "fireworks": [["E7", "C7", "G6"], ["C7", "A6", "F6"], ["D7", "B6", "G6"]],
    # Poof twinkles on the bloom (6.17) and the break-apart (6.25) frames.
    "poof_twinkles": ["G7", "E7"],
}

ROCKET = 0.2  # each firework stem starts with its rocket's climb, this long before the burst


def stems():
    s = {}
    # Spawn: a quick sparkle that rises as the bunny materialises, then a soft landing tap.
    sparkle = cat(*[pulse(note(n), 0.022, 0.125) for n in ["C6", "E6", "G6", "C7"]])
    s["spawn"] = sparkle * env(len(sparkle), release=0.03)
    land = triangle(sweep(160, 90, 0.05), 0.05)
    s["land"] = land * env(len(land), release=0.02)
    s["blip"] = tone(pulse, "A4", 0.09, duty=0.5)
    go_rise = pulse(sweep(note("G4"), note("G5"), 0.11), 0.11, 0.25)
    t = np.arange(samples(0.2)) / RATE
    go_hold = mix(pulse(note("G5") * (1 + 0.009 * np.sin(2 * np.pi * 6 * t)), 0.2, 0.25), 0.5 * pulse(note("D6"), 0.2, 0.125))
    go = cat(go_rise, go_hold)
    s["go"] = go * env(len(go), release=0.06)
    click = 0.35 * noise(0.075, 12000) * (np.arange(samples(0.075)) < 0.012 * RATE)
    bonk = pulse(sweep(196, 98, 0.075), 0.075, 0.125) + click
    s["bonk"] = bonk * env(len(bonk), release=0.02)
    n = samples(0.32)
    t = np.arange(n) / RATE
    wobble = 330 * (1 + 0.3 * np.exp(-t / 0.12) * np.sin(2 * np.pi * 16 * t))
    s["boing"] = triangle(wobble, 0.32) * env(n, release=0.05, decay=0.16)
    for chord, notes in NOTES["bling"].items():
        for depth in range(4):
            a, b, c = notes[depth:depth + 3]
            x = cat(pulse(note(a), 0.034, 0.25), pulse(note(b), 0.034, 0.25), pulse(note(c), 0.1, 0.25))
            s[f"bling-{chord}-{depth}"] = x * env(len(x), release=0.05, decay=0.12)
    crumble = np.zeros(samples(0.42))
    for k in range(7):
        burst = noise(0.045, 5200 + 600 * k, seed=k) * env(samples(0.045), release=0.03)
        crumble += place(burst * 0.8 ** k, 0.06 * k, 0.42)
    thud = pulse(sweep(110, 70, 0.05), 0.05, 0.5) * env(samples(0.05), release=0.02)
    s["crumble"] = mix(crumble, 0.7 * thud)
    grab = cat(pulse(note("E6"), 0.025, 0.25), pulse(note("G6"), 0.025, 0.25))
    shimmer_n = samples(0.3)
    shimmer = pulse(note("C7"), 0.3, 0.25) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 30 * np.arange(shimmer_n) / RATE)))
    glide = triangle(sweep(note("C5"), note("C6"), 0.45), 0.45)
    s["grab"] = mix(cat(grab, shimmer) * env(len(grab) + shimmer_n, release=0.08), 0.5 * glide * env(len(glide), attack=0.05, release=0.1))

    def line(seq, fn, **kw):
        parts = []
        for name, duration in seq:
            if duration >= 0.4:
                tt = np.arange(samples(duration)) / RATE
                vibrato = 1 + 0.012 * np.sin(2 * np.pi * 6 * tt) * np.clip((tt - 0.12) / 0.1, 0, 1)
                x = fn(note(name) * vibrato, duration, **kw)
            else:
                x = fn(note(name), duration, **kw)
            # The held tonic rings down like a bell (instead of sustaining) so the poof and the collapse read over it.
            parts.append(x * (env(len(x), release=0.04) if duration < 0.4 else env(len(x), release=0.2, decay=0.4)))
        return cat(*parts)

    s["fanfare"] = mix(line(NOTES["fanfare_lead"], pulse, duty=0.5), 0.45 * line(NOTES["fanfare_harmony"], pulse, duty=0.25), 0.8 * line(NOTES["fanfare_bass"], triangle))
    for i, notes in enumerate(NOTES["fireworks"]):
        # Rocket: a thin hiss that brightens as it climbs (stepped LFSR clock), then the burst pop and sparkles.
        climb_n = samples(ROCKET - 0.01)
        climb = np.zeros(climb_n)
        for k in range(8):
            seg = noise(ROCKET / 8, 3500 + 900 * k, seed=40 + 8 * i + k)
            start = k * len(seg)
            climb[start:start + len(seg)] = seg[: max(0, climb_n - start)]
        climb *= np.linspace(0.15, 1, climb_n) ** 1.5 * env(climb_n, attack=0.02, release=0.02)
        pop = noise(0.03, 9000, seed=10 + i) * env(samples(0.03), attack=0.001, release=0.02)
        sparkles = cat(*[pulse(note(name), 0.045, 0.125) * env(samples(0.045), release=0.02) * 0.8 ** j for j, name in enumerate(notes)])
        s[f"firework-{i}"] = mix(0.3 * climb, place(0.8 * pop, ROCKET, ROCKET + 0.2), place(sparkles, ROCKET + 0.02, ROCKET + 0.2))
    s["wink"] = triangle(note("C7"), 0.12) * env(samples(0.12), release=0.08, decay=0.05)
    # Poof (the stem starts on the stretch hop at 6.04): a short breath in, the puff on the swallow frame (+.06), a
    # twinkle on the bloom (+.13) and on the break-apart (+.21), and airy wisps that thin out by +.38 (6.42, gone).
    inhale_n = samples(0.06)
    inhale = cat(*[noise(0.015, 1800 + 1400 * k, seed=60 + k) for k in range(4)])[:inhale_n]
    inhale *= np.linspace(0, 1, inhale_n) ** 2
    puff = noise(0.09, 2600, seed=20) * env(samples(0.09), attack=0.002, release=0.05, decay=0.05)
    thump = triangle(sweep(220, 120, 0.05), 0.05) * env(samples(0.05), release=0.02)
    wisps = noise(0.24, 1400, seed=21) * env(samples(0.24), attack=0.02, release=0.12, decay=0.1)
    twinkle = [pulse(note(name), 0.06, 0.125) * env(samples(0.06), release=0.03, decay=0.035) for name in NOTES["poof_twinkles"]]
    s["poof"] = mix(0.25 * inhale, place(0.8 * puff, 0.06, 0.38), place(0.5 * thump, 0.06, 0.38), place(0.35 * wisps, 0.12, 0.38),
                    place(0.5 * twinkle[0], 0.13, 0.38), place(0.4 * twinkle[1], 0.21, 0.38))
    # Level falls away: one soft crunch per ground strip (16 strips, 20 ms apart, left to right) over a low noise
    # rumble and a gentle triangle slide down; noise-led, so it never fights the fanfare's held tonic.
    total = 0.66
    ticks = np.zeros(samples(total))
    for k in range(16):
        tick = noise(0.016, 3200 - 140 * k, seed=70 + k) * env(samples(0.016), attack=0.001, release=0.01)
        ticks += place(tick * (0.55 + 0.45 * (k % 2)), 0.02 * k, total)
    rumble = noise(total, 900, seed=30) * env(samples(total), attack=0.2, release=0.24, decay=0.5)  # swells as the strips drop fastest
    slide = triangle(sweep(note("C5"), note("C3"), 0.5), 0.5) * env(samples(0.5), attack=0.02, release=0.15, decay=0.3)
    s["collapse"] = mix(0.45 * ticks, 0.45 * rumble, place(0.4 * slide, 0.04, total))

    # Run bed: starts with a pickup 0.36 s before bonk 1 (the file begins at 1.56 s).
    total = 4.80 - 1.56 + 0.3
    offset = 0.36
    bed = np.zeros(samples(total))
    for name, when in NOTES["bed_roots"]:
        duration = 0.3 if when < 2.88 else 0.28
        bed += place(triangle(note(name), duration) * env(samples(duration), release=0.06), when + offset, total)
    stabs = {0.0: ["E4", "G4", "C5"], 0.72: ["E4", "A4", "C5"], 1.44: ["F4", "A4", "C5"], 2.16: ["D4", "G4", "B4"]}
    for when, chord in stabs.items():
        x = sum(pulse(note(name), 0.12, 0.25) for name in chord) / 3 * env(samples(0.12), release=0.04)
        bed += place(0.5 * x, when + 0.36 + offset, total)
    for k in range(9):
        hat = noise(0.03, 11000, seed=50 + k) * env(samples(0.03), release=0.02)
        bed += place(0.25 * hat, offset + 0.18 + 0.36 * k, total)
    s["bed"] = bed
    return s


def main(root):
    out = Path(root) / "authored" / "pixel-quest"
    out.mkdir(parents=True, exist_ok=True)
    for name, x in stems().items():
        peak = np.max(np.abs(x))
        sf.write(out / f"{name}.wav", (x / max(peak, 1e-9) * 0.9).astype(np.float32), RATE, subtype="FLOAT")
        print(f"{name:14s} {len(x) / RATE:5.2f}s")
    (out / "NOTES.json").write_text(json.dumps(NOTES, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "work/open-sounds")
