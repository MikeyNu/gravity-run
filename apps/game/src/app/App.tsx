import { useEffect, useRef } from 'react';
import { createMovementLab } from '../bootstrap/createMovementLab';
import { useHudStore } from '../ui/hudStore';

export function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const phase = useHudStore((state) => state.phase);
  const speed = useHudStore((state) => state.speed);
  const tick = useHudStore((state) => state.tick);
  const quality = useHudStore((state) => state.quality);
  const targetLocked = useHudStore((state) => state.targetLocked);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const lab = createMovementLab(viewport);
    lab.start();

    return () => lab.dispose();
  }, []);

  return (
    <main className="game-shell">
      <div ref={viewportRef} className="game-viewport" aria-label="Gravity Run movement laboratory" />

      <header className="brand-lockup" aria-label="Gravity Run">
        <span className="brand-kicker">MOVEMENT LAB</span>
        <strong>GRAVITY RUN</strong>
      </header>

      <section className="telemetry" aria-label="Simulation telemetry">
        <Telemetry label="STATE" value={phase} />
        <Telemetry label="SPEED" value={`${speed.toFixed(1)} m/s`} />
        <Telemetry label="TICK" value={String(tick)} />
        <Telemetry label="TARGET" value={targetLocked ? 'LOCKED' : 'SEARCHING'} />
        <Telemetry label="QUALITY" value={quality.toUpperCase()} />
      </section>

      <section className="control-hint">
        <span className="control-icon" aria-hidden="true" />
        <div>
          <strong>HOLD TO TETHER</strong>
          <span>Release to preserve tangent velocity</span>
        </div>
      </section>

      <div className="reticle" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </main>
  );
}

function Telemetry({ label, value }: { label: string; value: string }) {
  return (
    <div className="telemetry-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
