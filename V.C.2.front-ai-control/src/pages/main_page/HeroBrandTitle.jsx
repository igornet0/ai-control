import React, { useEffect, useState } from 'react';
import styles from './Hero.module.css';

const WORD = 'Данные';
const LETTERS = [...WORD];
const CIPHER = '01ABCDEF#%&$@<>/*';
const MASK = '•';

// Цикл «шифрования»: слово → шифр → замок защёлкивается (••••••) → замок открывается → расшифровка.
const PHASES = [
  ['idle', 2600],
  ['encrypt', 900],
  ['lock', 520],
  ['locked', 1500],
  ['unlock', 420],
  ['decrypt', 1000],
];
const TICK_MS = 55;
const STAGGER_MS = 110;
const DECRYPT_DELAY_MS = 250;
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const randomGlyph = () => CIPHER[Math.floor(Math.random() * CIPHER.length)];

function glyphsFor(phase, elapsed) {
  return LETTERS.map((ch, i) => {
    switch (phase) {
      case 'encrypt':
        return elapsed >= i * STAGGER_MS ? randomGlyph() : ch;
      case 'lock':
      case 'unlock':
        return randomGlyph();
      case 'locked':
        return MASK;
      case 'decrypt':
        return elapsed >= DECRYPT_DELAY_MS + i * STAGGER_MS ? ch : randomGlyph();
      default:
        return ch;
    }
  });
}

const BrandLockIcon = () => (
  <svg className={styles.lockIcon} viewBox="0 0 48 56" fill="none" aria-hidden>
    <defs>
      <linearGradient id="hero-lock-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="50%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#f472b6" />
      </linearGradient>
      <linearGradient id="hero-lock-shine" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      className={styles.lockShackle}
      d="M14 25V18.5C14 12.7 18.7 8 24.5 8S35 12.7 35 18.5V25"
      stroke="url(#hero-lock-gradient)"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    <rect x="9" y="25" width="30" height="26" rx="8" fill="url(#hero-lock-gradient)" />
    <rect x="11" y="27" width="26" height="12" rx="6" fill="url(#hero-lock-shine)" />
    <circle cx="24" cy="36" r="3.25" fill="#0f172a" />
    <rect x="22.4" y="36" width="3.2" height="8.5" rx="1.6" fill="#0f172a" />
  </svg>
);

const HeroBrandTitle = ({ className }) => {
  const [phase, setPhase] = useState('idle');
  const [glyphs, setGlyphs] = useState(LETTERS);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let index = 0;
    let phaseStart = performance.now();
    let timer;

    const tick = () => {
      const now = performance.now();
      let elapsed = now - phaseStart;
      if (elapsed >= PHASES[index][1]) {
        index = (index + 1) % PHASES.length;
        phaseStart = now;
        elapsed = 0;
        setPhase(PHASES[index][0]);
      }
      const next = glyphsFor(PHASES[index][0], elapsed);
      setGlyphs((prev) => (prev.join('') === next.join('') ? prev : next));
      timer = setTimeout(tick, TICK_MS);
    };

    timer = setTimeout(tick, TICK_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <h1 className={`${className} ${styles.heroTitle}`}>
      <span className={styles.brandPrefix} data-phase={phase}>2A</span>{' '}
      <span className={styles.brandStage} data-phase={phase}>
        <span className="sr-only">{WORD}</span>
        <span className={styles.brandWord} aria-hidden>
          {glyphs.map((glyph, i) => (
            <span key={i} className={styles.brandSlot}>
              {/* Символы рисуются через ::before — в textContent остаётся только настоящее слово. */}
              <span className={styles.brandSlotSizer} data-ch={LETTERS[i]} />
              <span
                className={styles.brandGlyph}
                data-ch={glyph}
                data-cipher={glyph !== LETTERS[i] ? '' : undefined}
                style={{ '--i': i }}
              />
            </span>
          ))}
          <span className={styles.brandBeam} />
        </span>
        <span className={styles.brandLock} aria-hidden>
          <span className={styles.lockRing} />
          {SPARK_ANGLES.map((angle) => (
            <span key={angle} className={styles.lockSpark} style={{ '--a': `${angle}deg` }} />
          ))}
          <BrandLockIcon />
        </span>
      </span>
    </h1>
  );
};

export default HeroBrandTitle;
