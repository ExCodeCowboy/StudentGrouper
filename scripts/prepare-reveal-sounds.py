"""Prepare bundled CC0 clips; development dependencies: numpy and soundfile.

Usage: python scripts/prepare-reveal-sounds.py work/open-sounds
Every audible sample comes from a credited clip; no generated tones or noise.
"""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
RATE = 22050

def spectral_filter(samples, rate, response):
    frequencies = np.fft.rfftfreq(len(samples), 1 / rate)
    return np.fft.irfft(np.fft.rfft(samples) * response(frequencies), n=len(samples))


def speaker_rumble(samples, rate):
    """Expose the existing engine texture on small speakers, without repitching."""
    base = spectral_filter(samples, rate, lambda f:
        (f ** 2 / (f ** 2 + 105 ** 2))
        * (1 + 2 * f ** 2 / (f ** 2 + 200 ** 2))
        / (1 + (f / 2200) ** 4))
    base_rms = np.sqrt(np.mean(base * base))
    # Gentle parallel saturation adds harmonics of this recording's rumble.
    texture = spectral_filter(np.tanh(base * 2.2 / max(base_rms, 1e-9)), rate,
        lambda f: (f ** 2 / (f ** 2 + 180 ** 2)) / (1 + (f / 1600) ** 4))
    texture *= base_rms / max(np.sqrt(np.mean(texture * texture)), 1e-9)
    return base + .45 * texture


def prepare(source_root, recipe):
    output = ROOT / "public/sounds/reveals"
    output.mkdir(parents=True, exist_ok=True)
    manifest = []
    for name, profile in recipe.items():
        track = np.zeros(round(profile["durationMs"] * RATE / 1000))
        inputs = []
        for cue in profile["cues"]:
            path = (source_root / cue["file"]).resolve()
            if not path.is_relative_to(source_root):
                raise ValueError("Source must remain inside the download directory")
            raw, rate = sf.read(path, always_2d=True)
            samples = raw.mean(axis=1)
            start = round(cue.get("trimStart", 0) * rate)
            end = start + round(cue.get("length", len(samples) / rate) * rate)
            samples = samples[start:end]
            samples -= samples.mean()
            if cue.get("processing") == "speaker-rumble":
                samples = speaker_rumble(samples, rate)
            speed = cue.get("speed", 1)
            # Windowed sinc low-pass before resampling prevents aliases.
            cutoff = min(.45, .45 * RATE / (rate * speed))
            taps = np.arange(-48, 49)
            kernel = 2 * cutoff * np.sinc(2 * cutoff * taps) * np.hanning(len(taps))
            kernel /= kernel.sum()
            samples = np.convolve(samples, kernel, mode="same")
            positions = np.arange(0, len(samples) - 1, rate * speed / RATE)
            samples = np.interp(positions, np.arange(len(samples)), samples)
            if cue.get("bassDb"):
                # Shape the existing engine effect; add no synthesized layer.
                frequencies = np.fft.rfftfreq(len(samples), 1 / RATE)
                shelf = 1 + (10 ** (cue["bassDb"] / 20) - 1) / (1 + (frequencies / 600) ** 4)
                subsonic = frequencies ** 2 / (frequencies ** 2 + 45 ** 2)
                samples = np.fft.irfft(np.fft.rfft(samples) * shelf * subsonic, n=len(samples))
            seconds = np.arange(len(samples)) / RATE
            duration = len(samples) / RATE
            attack = cue.get("attack", .012)
            release = cue.get("release", min(.08, duration / 3))
            smooth = lambda x: (lambda t: t * t * (3 - 2 * t))(np.clip(x, 0, 1))
            envelope = smooth(seconds / attack) * smooth((duration - seconds - 1 / RATE) / release)
            samples *= envelope
            # Remove any offset introduced by trimming/fades while preserving silence.
            samples -= envelope * samples.sum() / max(envelope.sum(), 1e-9)
            peak = np.max(np.abs(samples))
            rms = np.sqrt(np.mean(samples * samples))
            samples *= min(cue.get("peak", .18) / max(peak, 1e-9), cue.get("rms", .035) / max(rms, 1e-9))
            at = round(cue["at"] * RATE)
            if at + len(samples) > len(track):
                raise ValueError(f"{name}: cue runs past the reveal")
            track[at:at + len(samples)] += samples
            inputs.append({**cue, "duration": round(duration, 5), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        peak = np.max(np.abs(track))
        if peak > .24:
            track *= .24 / peak
        # Round PCM to avoid negative quantization/DC bias.
        pcm = np.rint(track * 32767).astype(np.int16)
        target = output / f"{name}.wav"
        sf.write(target, pcm, RATE, subtype="PCM_16")
        entry = {"file": target.name, "durationMs": profile["durationMs"], "sampleRate": RATE,
                 "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "cues": inputs,
                 "peak": round(float(np.max(np.abs(track))), 6), "rms": round(float(np.sqrt(np.mean(track * track))), 6)}
        manifest.append(entry)
        print(f"{name}: {target.stat().st_size:,} bytes; peak {entry['peak']}; RMS {entry['rms']}")
    (output / "CUES.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    source_path = output / "SOURCES.json"
    sources = json.loads(source_path.read_text(encoding="utf-8"))
    known = {source["id"] for source in sources["sources"]}
    sources["files"] = []
    for entry in manifest:
        used = sorted({cue["sourceId"] for cue in entry["cues"]})
        if not set(used).issubset(known):
            raise ValueError(f"Uncredited source in {entry['file']}")
        sources["files"].append({"file": entry["file"], "sha256": entry["sha256"], "sourceIds": used,
            "edits": "Excerpted, downmixed to mono, resampled with anti-alias filtering, faded, level matched and mixed on the reveal timeline. Per-cue trimming, playback speed and EQ appear in CUES.json.",
            "cueManifest": "CUES.json"})
    source_path.write_text(json.dumps(sources, indent=2) + "\n", encoding="utf-8")
    # Include the file fingerprint in the app module graph and asset URL. This
    # invalidates stale browser audio when a clip is rebuilt or redeployed.
    versions = {Path(entry["file"]).stem: entry["sha256"][:12] for entry in manifest}
    (ROOT / "src/revealEffects/revealSoundVersions.json").write_text(json.dumps(versions, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    prepare(Path(sys.argv[1]).resolve(), json.loads((ROOT / "scripts/reveal-sound-cues.json").read_text()))
