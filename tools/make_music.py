"""Tổng hợp 4 bản nhạc nền (loop liền mạch) cho app → www/audio/*.ogg
Nhạc do script tự sáng tác & tổng hợp (numpy) nên không dính bản quyền.
Chạy:  python tools/make_music.py        (cần numpy, scipy, ffmpeg có libvorbis)"""
import os, subprocess, tempfile
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'www', 'audio')
os.makedirs(OUT, exist_ok=True)

mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)
TAU = 2 * np.pi


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def tgrid(dur):
    return np.arange(int(dur * SR)) / SR


def attack(t, a):
    return 1 - np.exp(-t / max(a, 1e-4) * 3)


def release(t, dur, r):
    return np.clip(1 - (t - dur) / r, 0, 1) ** 2


# ------------------------------------------------------------------ giọng (voice)
def epiano(f, dur, vel=1.0, bright=1.0):
    t = tgrid(dur + 0.5)
    idx = (0.9 + 1.2 * vel) * bright * np.exp(-t / 0.28)
    x = np.sin(TAU * f * t + idx * np.sin(TAU * f * t))
    x += 0.22 * np.sin(TAU * 2 * f * t) * np.exp(-t / 0.35)
    x += 0.10 * np.sin(TAU * 7 * f * t) * np.exp(-t / 0.05) * bright     # tiếng "tine"
    return x * attack(t, 0.004) * np.exp(-t / 1.1) * release(t, dur, 0.4) * vel


def bell(f, dur, vel=1.0, decay=1.0):
    t = tgrid(dur + 1.2)
    parts = ((1.0, 1.0, 1.9), (2.0, 0.34, 1.0), (3.01, 0.22, 0.6), (4.17, 0.12, 0.35), (5.43, 0.06, 0.2))
    x = sum(a * np.sin(TAU * f * r * t) * np.exp(-t / (tau * decay)) for r, a, tau in parts)
    return x * attack(t, 0.002) * release(t, dur + 0.8, 0.4) * vel


def pad(f, dur, att=1.6, rel=2.0, vel=1.0, rng=None):
    rng = rng or np.random.default_rng(1)
    t = tgrid(dur + rel)
    x = np.zeros_like(t)
    for det in (-8, 0, 7):
        ff = f * 2 ** (det / 1200)
        ph = rng.uniform(0, TAU, 8)
        for h in range(1, 9):
            x += np.sin(TAU * ff * h * t + ph[h - 1]) / h ** 1.15
    x = lp(x, 1600)
    s = np.clip(t / att, 0, 1)
    s = s * s * (3 - 2 * s)
    return x * s * release(t, dur, rel) * vel * 0.28


def pluck(f, dur, vel=1.0, tau=0.22, bright=1.0):
    t = tgrid(dur + 0.3)
    x = np.zeros_like(t)
    for h in range(1, 14):
        if f * h > 9000:
            break
        x += np.sin(TAU * f * h * t) / h * np.exp(-t * (h * 3.2 / bright))
    return x * attack(t, 0.002) * np.exp(-t / tau) * release(t, dur, 0.15) * vel


def bass(f, dur, vel=1.0):
    t = tgrid(dur + 0.2)
    x = np.sin(TAU * f * t) + 0.45 * np.sin(TAU * 2 * f * t) + 0.18 * np.sin(TAU * 3 * f * t)
    return x * attack(t, 0.012) * (0.55 + 0.45 * np.exp(-t / 0.4)) * release(t, dur, 0.12) * vel


def kick(vel=1.0):
    t = tgrid(0.35)
    ph = TAU * np.cumsum(46 + 95 * np.exp(-t / 0.028)) / SR
    return (np.sin(ph) * np.exp(-t / 0.16) + 0.2 * np.exp(-t / 0.004)) * vel


def snare(rng, vel=1.0, soft=True):
    t = tgrid(0.28)
    n = bp(rng.standard_normal(len(t)), 1400, 6500) * np.exp(-t / 0.075)
    x = n * 0.9 + 0.5 * np.sin(TAU * 185 * t) * np.exp(-t / 0.04)
    return (lp(x, 4800) if soft else x) * vel


def hat(rng, vel=1.0, open_=False):
    t = tgrid(0.25 if open_ else 0.09)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t / (0.09 if open_ else 0.022)) * vel * 0.6


# ------------------------------------------------------------------ bàn trộn
class Mix:
    def __init__(self, seconds, tail=4.0):
        self.len = int(seconds * SR)
        self.n = int((seconds + tail) * SR)
        self.dry = np.zeros((self.n, 2)); self.rev = np.zeros((self.n, 2))

    def add(self, t, x, gain=1.0, pan=0.0, send=0.0):
        i = int(round(t * SR))
        if i >= self.n or i < 0:
            return
        x = x[: self.n - i]
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.dry[i:i + len(x), 0] += x * gain * l; self.dry[i:i + len(x), 1] += x * gain * r
        if send:
            self.rev[i:i + len(x), 0] += x * gain * l * send; self.rev[i:i + len(x), 1] += x * gain * r * send

    def render(self, rt=2.4, wet=1.0, lowcut=None):
        rng = np.random.default_rng(99)
        m = int(rt * SR); tt = np.arange(m) / SR
        ir = [rng.standard_normal(m) * np.exp(-tt / (rt / 6.9)) for _ in range(2)]
        ir = [lp(i_, 5200) for i_ in ir]
        ir = [i_ / np.sqrt(np.sum(i_ ** 2)) * 0.9 for i_ in ir]
        wetl = fftconvolve(self.rev[:, 0], ir[0])[: self.n] * wet
        wetr = fftconvolve(self.rev[:, 1], ir[1])[: self.n] * wet
        out = self.dry + np.stack([wetl, wetr], 1)
        if lowcut:
            out = np.stack([hp(out[:, 0], lowcut), hp(out[:, 1], lowcut)], 1)
        # gập phần đuôi (reverb/release) vào đầu bài → loop liền mạch
        tail = out[self.len:]
        out = out[: self.len].copy()
        out[: len(tail)] += tail[: len(out)]
        return out


def master(out, rms=0.105):
    out = out - out.mean(0)
    out *= rms / np.sqrt(np.mean(out ** 2))
    out = np.tanh(out * 1.25) / 1.25 if np.max(np.abs(out)) > 0.8 else out
    pk = np.max(np.abs(out))
    if pk > 0.89:
        out *= 0.89 / pk
    return out


def save(name, out):
    out = master(out)
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'x.wav')
        wavfile.write(w, SR, (out * 32767).astype(np.int16))
        dst = os.path.join(OUT, name + '.ogg')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, '-c:a', 'libvorbis', '-q:a', '2.5', dst], check=True)
    seam = np.abs(out[0] - out[-1]).max()
    print(f'{name}: {len(out) / SR:.1f}s  rms={np.sqrt(np.mean(out ** 2)):.3f}  peak={np.max(np.abs(out)):.2f}  seam={seam:.4f}  {os.path.getsize(dst) // 1024} KB')


def jitter(rng, ms=7):
    return rng.uniform(-ms, ms) / 1000


# ------------------------------------------------------------------ 1) Lo-fi thư giãn
def lofi():
    rng = np.random.default_rng(11)
    bpm = 78; beat = 60 / bpm; bars = 16; sec = bars * 4 * beat
    mx = Mix(sec, 3.5)
    A = [([57, 60, 64, 67], 41), ([55, 59, 62, 64], 40), ([53, 57, 60, 64], 38), ([55, 59, 64, 67], 36)]
    B = [([60, 64, 67, 71], 45), ([53, 57, 60, 64], 38), ([53, 59, 62, 64], 43), ([59, 62, 64, 67], 36)]
    prog = A + A + B + B
    pent = [64, 67, 69, 72, 74, 76, 79, 81, 84]
    sw = lambda b: b + (0.16 if (b * 2) % 2 == 1 else 0)          # nhịp lệch (swing) cho nốt móc đơn lẻ
    pos = 4
    for bar, (ch, root) in enumerate(prog):
        t0 = bar * 4 * beat
        for k, n in enumerate(ch):                                   # hợp âm piano điện, rải nhẹ
            mx.add(t0 + k * 0.022 + jitter(rng, 4), epiano(mtof(n), 3.6 * beat, 0.52 + rng.uniform(-.05, .05)), 0.36, pan=-0.15 + k * 0.1, send=0.3)
        mx.add(t0 + 2.5 * beat * 0 + 2.5 * beat + jitter(rng), epiano(mtof(ch[1]), beat, 0.4), 0.18, pan=0.1, send=0.3)
        mx.add(t0, bass(mtof(root + 12), 1.9 * beat, 0.9), 0.5)
        mx.add(t0 + 2.5 * beat, bass(mtof(root + 12 if bar % 2 else root + 19), 1.2 * beat, 0.75), 0.42)
        # trống
        for b in (0, 2.5):
            mx.add(t0 + b * beat + jitter(rng, 5), kick(0.95 if b == 0 else 0.7), 0.5)
        for b in (1, 3):
            mx.add(t0 + b * beat + jitter(rng, 9), snare(rng, 0.65), 0.28, pan=0.08, send=0.15)
        for e in range(8):
            b = e / 2 + (0.16 if e % 2 else 0)
            mx.add(t0 + b * beat + jitter(rng, 5), hat(rng, 0.5 if e % 2 else 0.8, e == 7), 0.22, pan=-0.2 if e % 2 else 0.2, send=0.1)
        # giai điệu thưa
        for b in ([0, 1.5, 2, 3.5] if bar % 2 == 0 else [0.5, 2.5, 3]):
            if rng.random() < (0.72 if bar < 8 else 0.85):
                pos = int(np.clip(pos + rng.choice([-2, -1, -1, 0, 1, 1, 2]), 0, len(pent) - 1))
                mx.add(t0 + sw(b) * beat + jitter(rng, 6), epiano(mtof(pent[pos] + 0), 1.4 * beat, 0.55, 1.2), 0.2, pan=0.25, send=0.45)
    # tạp âm đĩa than
    n = int(sec * SR); crack = np.zeros(n)
    for i in rng.integers(0, n - 50, int(sec * 3.2)):
        crack[i:i + 40] += rng.standard_normal(40) * rng.uniform(0.02, 0.12) * np.exp(-np.arange(40) / 6)
    hiss = hp(rng.standard_normal(n), 3500) * 0.004
    mx.dry[:n, 0] += crack + hiss; mx.dry[:n, 1] += np.roll(crack, 17) + np.roll(hiss, 301)
    out = mx.render(rt=2.0, wet=0.9, lowcut=40)
    out = np.stack([lp(out[:, 0], 8500), lp(out[:, 1], 8500)], 1)
    save('lofi', out)


# ------------------------------------------------------------------ 2) Tập trung sâu (ambient)
def focus():
    rng = np.random.default_rng(23)
    beat = 1.0; chord_len = 8.0
    chords = [([57, 60, 64, 67, 71], 45), ([53, 57, 60, 64, 67], 41), ([55, 59, 62, 64, 67], 48),
              ([59, 62, 64, 69, 71], 43), ([53, 57, 60, 64, 67], 38), ([55, 59, 62, 67, 71], 40)]
    sec = chord_len * len(chords)
    mx = Mix(sec, 5.0)
    for i, (ch, root) in enumerate(chords):
        t0 = i * chord_len
        for k, n in enumerate(ch):
            mx.add(t0, pad(mtof(n), chord_len + 0.5, att=2.2, rel=2.8, vel=0.8, rng=rng), 0.5, pan=(k - 2) * 0.28, send=0.5)
        mx.add(t0, pad(mtof(root), chord_len + 0.5, att=2.5, rel=3.0, vel=1.2, rng=rng), 0.35, send=0.2)
        # chuông thưa, âm cao, rất nhẹ
        tt = t0 + rng.uniform(0.8, 1.6)
        while tt < t0 + chord_len - 1.0:
            n = int(rng.choice(ch)) + 12 * int(rng.choice([1, 1, 2]))
            mx.add(tt, bell(mtof(n), 1.0, rng.uniform(0.35, 0.6), 1.5), 0.17, pan=rng.uniform(-0.8, 0.8), send=0.75)
            tt += rng.choice([1.5, 2.0, 2.5, 3.0, 4.0])
    out = mx.render(rt=4.2, wet=1.0, lowcut=35)
    save('focus', out)


# ------------------------------------------------------------------ 3) Hộp nhạc
def musicbox():
    rng = np.random.default_rng(37)
    bpm = 104; beat = 60 / bpm; per = 3; cycle = [
        ([72, 76, 79, 84], 48), ([69, 72, 76, 81], 45), ([65, 69, 72, 77], 41), ([67, 71, 74, 79], 43),
        ([72, 76, 79, 84], 48), ([64, 67, 71, 76], 40), ([65, 69, 72, 77], 41), ([67, 71, 74, 77], 43)]
    pat = [0, 1, 2, 3, 2, 1]
    bars = 24; sec = bars * per * beat
    mx = Mix(sec, 3.5)
    mel = {  # [chu kỳ 2, chu kỳ 3] → nốt giai điệu theo từng ô nhịp (độ cao tương đối trong hợp âm, 0-3 = nốt, +4 = cao hơn quãng tám)
        1: [3, None, 2, None, 3, None, 2, None],
        2: [7, 6, 5, 6, 7, 5, 6, 4],
    }
    for bar in range(bars):
        cyc, k = divmod(bar, 8)
        notes, root = cycle[k]
        t0 = bar * per * beat
        for i, p in enumerate(pat):
            vel = (0.75 if i == 0 else 0.5 if i % 2 == 0 else 0.42) * rng.uniform(0.92, 1.05)
            mx.add(t0 + i * beat / 2 + jitter(rng, 4), bell(mtof(notes[p]), 0.5, vel, 1.0), 0.19, pan=-0.35 + 0.14 * p, send=0.35)
        if cyc >= 1 and mel[cyc][k] is not None:
            m = mel[cyc][k]; n = notes[m % 4] + (12 if m >= 4 else 0) + 0
            mx.add(t0 + jitter(rng, 5), bell(mtof(n + 12 if m < 4 else n), 1.6 * beat, 0.8, 1.3), 0.17, pan=0.3, send=0.5)
        if cyc >= 2:
            mx.add(t0, bell(mtof(root + 12), 1.5 * beat, 0.6, 1.4), 0.2, pan=-0.1, send=0.4)
    out = mx.render(rt=2.4, wet=0.9, lowcut=60)
    save('musicbox', out)


# ------------------------------------------------------------------ 4) Nhịp sáng (synth arpeggio)
def pulse():
    rng = np.random.default_rng(51)
    bpm = 108; beat = 60 / bpm; s16 = beat / 4; bars = 16; sec = bars * 4 * beat
    mx = Mix(sec, 3.0)
    prog = [([69, 72, 76, 81], 45), ([65, 69, 72, 77], 41), ([64, 67, 72, 76], 36), ([67, 71, 74, 79], 43)]
    seq = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 2, 1]
    lead = {1: [3, 2, 1, 2], 2: [2, 3, 2, 1]}
    for bar in range(bars):
        notes, root = prog[(bar // 2) % 4]
        t0 = bar * 4 * beat
        sect = 0 if bar < 4 else (1 if bar < 8 else (0 if bar < 12 else 1))
        for i in range(16):
            vel = 0.85 if i % 4 == 0 else 0.6 if i % 2 == 0 else 0.45
            mx.add(t0 + i * s16 + jitter(rng, 2), pluck(mtof(notes[seq[i]]), s16 * 1.8, vel * (0.9 if sect == 0 else 1.0), 0.2, 1.0),
                   0.27, pan=-0.4 if i % 2 else 0.4, send=0.3)
        if bar % 2 == 0:
            for k, n in enumerate(notes):
                mx.add(t0, pad(mtof(n - 12), 8 * beat, att=0.8, rel=1.0, vel=0.7, rng=rng), 0.4, pan=(k - 1.5) * 0.3, send=0.35)
        for e in range(8):
            if e % 4 == 3 and bar % 2 == 1:
                continue
            mx.add(t0 + e * beat / 2, bass(mtof(root + (12 if e % 2 else 0) + 12), beat * 0.45, 0.85), 0.34)
        for b in range(4):
            mx.add(t0 + b * beat, kick(0.8), 0.4)
            mx.add(t0 + (b + 0.5) * beat, hat(rng, 0.7 if b % 2 else 0.5, False), 0.2, pan=0.25, send=0.1)
        if bar >= 8:
            mx.add(t0 + 1 * beat, snare(rng, 0.45), 0.18, send=0.2)
            mx.add(t0 + 3 * beat, snare(rng, 0.45), 0.18, send=0.2)
        if sect == 1:                                                  # giai điệu lead
            for b, m in enumerate(lead[1 + (bar % 2)]):
                n = notes[m] + 12
                mx.add(t0 + b * beat + jitter(rng, 4), epiano(mtof(n), beat * 0.95, 0.7, 1.4), 0.22, pan=0.15, send=0.4)
    out = mx.render(rt=1.8, wet=0.8, lowcut=40)
    save('pulse', out)


if __name__ == '__main__':
    for fn in (lofi, focus, musicbox, pulse):
        fn()
    print('→', OUT)
