export type AudioFxType =
  "none" | "echo" | "pitch_high" | "pitch_deep" | "reverb" | "robot" | "radio" | "bass" | "studio";

export interface AudioFxItem {
  id: AudioFxType;
  title: string;
  badge: string;
  description: string;
  tag: string;
  icon: "none" | "echo" | "high" | "deep" | "reverb" | "robot" | "radio" | "bass" | "studio";
}

export const AUDIO_EFFECTS: AudioFxItem[] = [
  {
    id: "none",
    title: "صوت أصلي",
    badge: "طبيعي",
    description: "النقاء الأصلي للمقطع الصوتي بدون أي مؤثرات",
    tag: "افتراضي",
    icon: "none",
  },
  {
    id: "echo",
    title: "صدى صوت (Echo)",
    badge: "مؤثر بيئي",
    description: "تكرار الصدى الكلاسيكي للمشاهد والمسرحيات واللقطات الدرامية",
    tag: "صدى",
    icon: "echo",
  },
  {
    id: "pitch_high",
    title: "سنجاب كرتوني",
    badge: "صوت رفيع",
    description: "رفع حدة الصوت بنبرة كرتونية مرحة ومضحكة للقفشات الكوميدية",
    tag: "حدة الصوت",
    icon: "high",
  },
  {
    id: "pitch_deep",
    title: "صوت غليظ / فخم",
    badge: "صوت عميق",
    description: "خفض نبرة الصوت بطابع مسرحي ضخم للأدوار الفخمة والوحوش",
    tag: "حدة الصوت",
    icon: "deep",
  },
  {
    id: "reverb",
    title: "قاعة واسعة (Hall)",
    badge: "مساحة واسعة",
    description: "صدى قاعة سينمائية مفتوحة يعطي اتساعاً واقعياً للصوت",
    tag: "محيط",
    icon: "reverb",
  },
  {
    id: "robot",
    title: "روبوت آلي (Robot)",
    badge: "خيال علمي",
    description: "تضمين ترددي إلكتروني يحول نبرة المتحدث إلى صوت آلي مستقبلي",
    tag: "مبتكر",
    icon: "robot",
  },
  {
    id: "radio",
    title: "راديو وهاتف قديم",
    badge: "كلاسيك",
    description: "محاكاة صوت مكالمة هاتفية أو مذياع كلاسيكي عتيق",
    tag: "قديم",
    icon: "radio",
  },
  {
    id: "bass",
    title: "تضخيم البيس (Mega Bass)",
    badge: "جهير قوي",
    description: "تعزيز الترددات المنخفضة لإعطاء المقطع قوة وحضوراً عميقاً",
    tag: "تعزيز",
    icon: "bass",
  },
  {
    id: "studio",
    title: "استوديو احترافي",
    badge: "تنقية صوت",
    description: "عزل التشويش المنخفض وإبراز تفاصيل مخارج الحروف بنقاء عالي",
    tag: "تنقية",
    icon: "studio",
  },
];

/**
 * High-performance granular dual-tap crossfading pitch shifter for real-time Web Audio API.
 * Modulates phase with Hann window crossfading to eliminate clicks while preserving duration.
 */
function createPitchShifterNode(ctx: AudioContext, pitchRatio: number): AudioNode {
  const bufferSize = 2048;
  const node = ctx.createScriptProcessor(bufferSize, 2, 2);
  const grainSize = 1024;
  const ringBufferSize = 8192;
  const ringL = new Float32Array(ringBufferSize);
  const ringR = new Float32Array(ringBufferSize);
  let writeIndex = 0;
  let phase = 0;

  // Rate of change: delta = 1 - pitchRatio
  const delta = 1 - pitchRatio;

  node.onaudioprocess = (e) => {
    const inL = e.inputBuffer.getChannelData(0);
    const inR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inL;
    const outL = e.outputBuffer.getChannelData(0);
    const outR = e.outputBuffer.getChannelData(1);

    for (let i = 0; i < bufferSize; i++) {
      ringL[writeIndex] = inL[i] ?? 0;
      ringR[writeIndex] = inR[i] ?? 0;

      phase += delta;
      while (phase >= grainSize) phase -= grainSize;
      while (phase < 0) phase += grainSize;

      const phase1 = phase;
      const phase2 = (phase + grainSize / 2) % grainSize;

      const frac1 = phase1 / grainSize;
      const frac2 = phase2 / grainSize;
      const w1 = Math.sin(Math.PI * frac1);
      const w2 = Math.sin(Math.PI * frac2);
      const g1 = w1 * w1;
      const g2 = w2 * w2;

      let r1 = writeIndex - phase1;
      while (r1 < 0) r1 += ringBufferSize;
      while (r1 >= ringBufferSize) r1 -= ringBufferSize;

      let r2 = writeIndex - phase2;
      while (r2 < 0) r2 += ringBufferSize;
      while (r2 >= ringBufferSize) r2 -= ringBufferSize;

      const r1Floor = Math.floor(r1);
      const r1Frac = r1 - r1Floor;
      const r1Next = (r1Floor + 1) % ringBufferSize;

      const r2Floor = Math.floor(r2);
      const r2Frac = r2 - r2Floor;
      const r2Next = (r2Floor + 1) % ringBufferSize;

      const sL1 = (ringL[r1Floor] ?? 0) * (1 - r1Frac) + (ringL[r1Next] ?? 0) * r1Frac;
      const sR1 = (ringR[r1Floor] ?? 0) * (1 - r1Frac) + (ringR[r1Next] ?? 0) * r1Frac;

      const sL2 = (ringL[r2Floor] ?? 0) * (1 - r2Frac) + (ringL[r2Next] ?? 0) * r2Frac;
      const sR2 = (ringR[r2Floor] ?? 0) * (1 - r2Frac) + (ringR[r2Next] ?? 0) * r2Frac;

      outL[i] = sL1 * g1 + sL2 * g2;
      outR[i] = sR1 * g1 + sR2 * g2;

      writeIndex++;
      if (writeIndex >= ringBufferSize) writeIndex = 0;
    }
  };

  return node;
}

function makeDistortionCurve(amount = 25): Float32Array {
  const k = amount;
  const n = 2048;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; ++i) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export type FxChain = {
  input: AudioNode;
  output: AudioNode;
  cleanup: () => void;
};

/**
 * Builds the Web Audio processing graph for the requested effect.
 */
export function buildAudioFxGraph(ctx: AudioContext, fx: AudioFxType): FxChain {
  const cleanups: (() => void)[] = [];

  switch (fx) {
    case "pitch_high": {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const shifter = createPitchShifterNode(ctx, 1.44);

      // Add high-frequency brightness
      const filter = ctx.createBiquadFilter();
      filter.type = "highshelf";
      filter.frequency.value = 4000;
      filter.gain.value = 4;

      input.connect(shifter);
      shifter.connect(filter);
      filter.connect(output);

      cleanups.push(() => {
        input.disconnect();
        shifter.disconnect();
        filter.disconnect();
      });
      return { input, output, cleanup: () => cleanups.forEach((c) => c()) };
    }

    case "pitch_deep": {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const shifter = createPitchShifterNode(ctx, 0.72);

      // Low-frequency warmth boost
      const filter = ctx.createBiquadFilter();
      filter.type = "lowshelf";
      filter.frequency.value = 250;
      filter.gain.value = 5;

      input.connect(shifter);
      shifter.connect(filter);
      filter.connect(output);

      cleanups.push(() => {
        input.disconnect();
        shifter.disconnect();
        filter.disconnect();
      });
      return { input, output, cleanup: () => cleanups.forEach((c) => c()) };
    }

    case "echo": {
      const input = ctx.createGain();
      const output = ctx.createGain();

      const dry = ctx.createGain();
      dry.gain.value = 1.0;

      const wet = ctx.createGain();
      wet.gain.value = 0.55;

      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.23;

      const feedback = ctx.createGain();
      feedback.gain.value = 0.42;

      const toneFilter = ctx.createBiquadFilter();
      toneFilter.type = "lowpass";
      toneFilter.frequency.value = 3600;

      // Dry path
      input.connect(dry);
      dry.connect(output);

      // Wet / delay loop
      input.connect(delay);
      delay.connect(toneFilter);
      toneFilter.connect(wet);
      wet.connect(output);

      // Feedback
      toneFilter.connect(feedback);
      feedback.connect(delay);

      cleanups.push(() => {
        input.disconnect();
        dry.disconnect();
        wet.disconnect();
        delay.disconnect();
        feedback.disconnect();
        toneFilter.disconnect();
      });
      return { input, output, cleanup: () => cleanups.forEach((c) => c()) };
    }

    case "reverb": {
      const input = ctx.createGain();
      const output = ctx.createGain();

      const dry = ctx.createGain();
      dry.gain.value = 0.85;
      input.connect(dry);
      dry.connect(output);

      // Multi-tap spatial delays
      const delays = [0.035, 0.065, 0.098, 0.135];
      const gains = [0.35, 0.28, 0.22, 0.16];

      const dampFilter = ctx.createBiquadFilter();
      dampFilter.type = "lowpass";
      dampFilter.frequency.value = 3200;

      delays.forEach((dt, idx) => {
        const d = ctx.createDelay(1.0);
        d.delayTime.value = dt;
        const g = ctx.createGain();
        g.gain.value = gains[idx] ?? 0.2;

        input.connect(d);
        d.connect(dampFilter);
        dampFilter.connect(g);
        g.connect(output);

        cleanups.push(() => {
          d.disconnect();
          g.disconnect();
        });
      });

      cleanups.push(() => {
        input.disconnect();
        dry.disconnect();
        dampFilter.disconnect();
      });
      return { input, output, cleanup: () => cleanups.forEach((c) => c()) };
    }

    case "robot": {
      const input = ctx.createGain();
      const output = ctx.createGain();

      // Ring Modulator using an Oscillator multiplying input
      const mod = ctx.createGain();
      mod.gain.value = 0; // modulated by oscillator

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 52; // 52 Hz for robotic metallic hum

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 1600;
      bandpass.Q.value = 1.2;

      input.connect(mod);
      osc.connect(mod.gain);
      mod.connect(bandpass);
      bandpass.connect(output);

      osc.start();

      cleanups.push(() => {
        try {
          osc.stop();
        } catch {
          // ignore if already stopped
        }
        osc.disconnect();
        mod.disconnect();
        bandpass.disconnect();
        input.disconnect();
      });
      return { input, output, cleanup: () => cleanups.forEach((c) => c()) };
    }

    case "radio": {
      const input = ctx.createGain();
      const output = ctx.createGain();

      // Telephone / Old radio bandpass filtering
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 450;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3200;

      const peak = ctx.createBiquadFilter();
      peak.type = "peaking";
      peak.frequency.value = 1800;
      peak.gain.value = 5;
      peak.Q.value = 1.6;

      const dist = ctx.createWaveShaper();
      dist.curve = makeDistortionCurve(18) as unknown as Float32Array<ArrayBuffer>;
      dist.oversample = "2x";

      input.connect(hp);
      hp.connect(lp);
      lp.connect(peak);
      peak.connect(dist);
      dist.connect(output);

      cleanups.push(() => {
        input.disconnect();
        hp.disconnect();
        lp.disconnect();
        peak.disconnect();
        dist.disconnect();
      });
      return { input, output, cleanup: () => cleanups.forEach((c) => c()) };
    }

    case "bass": {
      const input = ctx.createGain();
      const output = ctx.createGain();

      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = "lowshelf";
      bassFilter.frequency.value = 135;
      bassFilter.gain.value = 11;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 8;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.01;
      compressor.release.value = 0.12;

      input.connect(bassFilter);
      bassFilter.connect(compressor);
      compressor.connect(output);

      cleanups.push(() => {
        input.disconnect();
        bassFilter.disconnect();
        compressor.disconnect();
      });
      return { input, output, cleanup: () => cleanups.forEach((c) => c()) };
    }

    case "studio": {
      const input = ctx.createGain();
      const output = ctx.createGain();

      // Cut low rumble
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 85;

      // Vocal clarity presence peak
      const peak = ctx.createBiquadFilter();
      peak.type = "peaking";
      peak.frequency.value = 3200;
      peak.gain.value = 4;
      peak.Q.value = 1.0;

      // Airy high shelf
      const hs = ctx.createBiquadFilter();
      hs.type = "highshelf";
      hs.frequency.value = 9000;
      hs.gain.value = 3.5;

      // Vocal compression
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 3;
      comp.attack.value = 0.005;
      comp.release.value = 0.1;

      input.connect(hp);
      hp.connect(peak);
      peak.connect(hs);
      hs.connect(comp);
      comp.connect(output);

      cleanups.push(() => {
        input.disconnect();
        hp.disconnect();
        peak.disconnect();
        hs.disconnect();
        comp.disconnect();
      });
      return { input, output, cleanup: () => cleanups.forEach((c) => c()) };
    }

    case "none":
    default: {
      const input = ctx.createGain();
      const output = ctx.createGain();
      input.connect(output);
      cleanups.push(() => {
        input.disconnect();
      });
      return { input, output, cleanup: () => cleanups.forEach((c) => c()) };
    }
  }
}
