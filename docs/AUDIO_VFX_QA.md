# Gravity Run audio and event-VFX QA contract

## Audio architecture

- Audio is unlocked only after a user gesture and uses the browser Web Audio graph directly.
- A master gain node owns mute and volume state.
- One-shot sources are created per event and disconnected after completion.
- The tether loop has a dedicated source and gain node, with speed-linked pitch and intensity.
- Snapshot transitions are processed once per simulation tick so multiple render frames cannot replay the same sound.
- Missing or undecodable assets fail silently with a diagnostic warning; gameplay remains deterministic.

## Generated sound family

The deterministic generator creates mono 24 kHz, 16-bit PCM assets for:

- interface confirmation;
- tether attachment;
- seamless tether energy loop;
- good release;
- perfect/overdrive release;
- fragment collection;
- near miss;
- failure.

The sounds use bounded synthesis, FM/harmonic layers, filtered noise, click-free envelopes, peak headroom, and DC removal. They are project-owned and reproducible from source.

## Event particle architecture

- One pooled point buffer serves release, fragment, near-miss, and failure bursts.
- No particle object allocation occurs during gameplay.
- Position, velocity, color, size, alpha, lifetime, and maximum lifetime are stored in typed arrays.
- Events are seeded deterministically and consumed once per simulation tick.
- Additive soft-disc particles are tone-mapped with the main HDR frame.

## QA evidence

- Eight generated WAV assets total approximately 238 KB.
- Every asset is mono, 24 kHz, 16-bit PCM.
- Peak amplitude remains below 0.86 with effectively zero DC offset.
- Durations remain inside event-specific bounds.
- The asset manifest recursively measures directory packs and enforces the 300 KB audio budget.
- TypeScript/TSX parser validation reports no syntax errors after integration.

## Remaining audio work

The current procedural family is a production-capable feedback baseline, not the final music and ambience package. Final certification still requires authored music states, broader variation pools, loudness normalization, device-speaker review, headphones review, and accessibility listening tests.
