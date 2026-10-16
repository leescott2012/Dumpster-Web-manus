import { useLocation } from 'wouter';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useInView, AnimatePresence } from 'framer-motion';
import './LandingPageV2.css';

/* Draft 2 — kinetic showreel. Giant word slams (DUMP. SEQUENCE. CAPTION. SHIP.),
   photos scatter then snap to order — the "dump untangles into carousel" story
   from the Homepage Build Arsenal. Draft 1 stays at "/". */

const PHOTOS = [1926769, 1183266, 1758144, 2043590, 2529148, 733872, 1130626, 2613260, 1036623, 1040881, 1687675, 415829];
const src = (id: number, w = 300, h = 380) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;

/* Giant word that slams in letter by letter */
function Slam({ word, accent }: { word: string; accent?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <h2 className={`v2-slam ${accent ? 'v2-slam--accent' : ''}`}>
      {word.split('').map((c, i) => (
        <motion.span
          key={i}
          initial={reduced ? false : { opacity: 0, y: 90, rotate: -10 }}
          whileInView={{ opacity: 1, y: 0, rotate: 0 }}
          viewport={{ amount: 0.5 }}
          transition={{ delay: i * 0.045, type: 'spring', stiffness: 380, damping: 26 }}
        >
          {c === ' ' ? ' ' : c}
        </motion.span>
      ))}
      <span className="v2-slam__dot">.</span>
    </h2>
  );
}

/* Hero: floating scattered photos */
const SCATTER = [
  { left: '4%', top: '14%', r: -12, i: 0 },
  { left: '80%', top: '10%', r: 9, i: 1 },
  { left: '10%', top: '64%', r: 7, i: 2 },
  { left: '74%', top: '60%', r: -9, i: 3 },
  { left: '44%', top: '76%', r: 4, i: 4 },
  { left: '88%', top: '38%', r: -5, i: 5 },
];

function FloatingPhoto({ left, top, r, i }: (typeof SCATTER)[number]) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="v2-float"
      style={{ left, top, rotate: r }}
      animate={reduced ? undefined : { y: [0, -14, 0] }}
      transition={{ duration: 4 + i * 0.7, repeat: Infinity, ease: 'easeInOut' }}
    >
      <img src={src(PHOTOS[i], 200, 250)} alt="" loading="lazy" draggable={false} />
    </motion.div>
  );
}

/* Sequence slide: mess snaps into an ordered row */
const MESS = [
  { x: -190, y: -90, r: -18 },
  { x: 130, y: -150, r: 12 },
  { x: -70, y: 110, r: -7 },
  { x: 210, y: 70, r: 16 },
  { x: -260, y: 30, r: 9 },
];
const SEQ_LABELS = ['HOOK', '', 'STORY', '', 'CLOSER'];

function SequenceRow() {
  const reduced = useReducedMotion();
  return (
    <div className="v2-seq">
      {MESS.map((m, i) => (
        <motion.div
          key={i}
          className="v2-seq__card"
          initial={reduced ? false : { x: m.x, y: m.y, rotate: m.r, opacity: 0.6 }}
          whileInView={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          viewport={{ amount: 0.5 }}
          transition={{ delay: 0.15 + i * 0.09, type: 'spring', stiffness: 200, damping: 22 }}
        >
          <img src={src(PHOTOS[i + 6], 220, 280)} alt="" loading="lazy" draggable={false} />
          {SEQ_LABELS[i] && <span className="v2-seq__label">{SEQ_LABELS[i]}</span>}
        </motion.div>
      ))}
    </div>
  );
}

/* Caption slide: AI types the caption live */
function Typewriter({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) { setN(0); return; }
    if (reduced) { setN(text.length); return; }
    if (n >= text.length) return;
    const t = setTimeout(() => setN(n + 1), 42);
    return () => clearTimeout(t);
  }, [inView, n, text, reduced]);
  return (
    <p ref={ref} className="v2-type">
      {text.slice(0, n)}
      <span className="v2-type__caret" />
    </p>
  );
}

/* Ship slide: phone frame cycling photos */
function PhoneLoop() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!inView || reduced) return;
    const id = setInterval(() => setIdx((v) => (v + 1) % 6), 1600);
    return () => clearInterval(id);
  }, [inView, reduced]);
  return (
    <div className="v2-phone" ref={ref}>
      <div className="v2-phone__notch" />
      <div className="v2-phone__screen">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={idx}
            src={src(PHOTOS[idx], 260, 540)}
            alt=""
            draggable={false}
            initial={reduced ? false : { x: 240, rotate: 6, opacity: 0 }}
            animate={{ x: 0, rotate: 0, opacity: 1 }}
            exit={{ x: -240, rotate: -6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function LandingPageV2() {
  const [, navigate] = useLocation();
  return (
    <div className="v2-root">
      {/* minimal nav */}
      <nav className="v2-nav">
        <div className="v2-nav__logo">
          <span className="v2-nav__mark">D</span> DUMPSTER
        </div>
        <button className="v2-btn v2-btn--ghost" onClick={() => navigate('/app')}>Open App</button>
      </nav>

      {/* draft switcher */}
      <button className="v2-switch" onClick={() => navigate('/')}>← Draft 1</button>

      {/* ── 1: DUMP IT. ── */}
      <section className="v2-slide v2-hero">
        {SCATTER.map((s) => <FloatingPhoto key={s.i} {...s} />)}
        <div className="v2-hero__content">
          <Slam word="DUMP IT" />
          <motion.p
            className="v2-sub"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            Photo dumps made easy.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
          >
            <button className="v2-btn v2-btn--gold" onClick={() => navigate('/app')}>
              Start Building Free
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── 2: SEQUENCE. ── */}
      <section className="v2-slide">
        <Slam word="SEQUENCE" accent />
        <p className="v2-sub">Your mess snaps into Hook → Story → Closer. On its own.</p>
        <SequenceRow />
      </section>

      {/* ── 3: CAPTION. ── */}
      <section className="v2-slide">
        <Slam word="CAPTION" accent />
        <p className="v2-sub">AI writes it in your voice. You just hit copy.</p>
        <div className="v2-caption-card">
          <img src={src(PHOTOS[7], 340, 260)} alt="" loading="lazy" draggable={false} />
          <Typewriter text="golden hour was a group project 🌇 swipe to the end for the recipe" />
        </div>
      </section>

      {/* ── 4: SHIP. ── */}
      <section className="v2-slide v2-ship">
        <Slam word="SHIP IT" />
        <p className="v2-sub">Camera roll to carousel. For you, not by you.</p>
        <PhoneLoop />
        <button className="v2-btn v2-btn--gold v2-btn--lg" onClick={() => navigate('/app')}>
          Open Dumpster Free
        </button>
        <p className="v2-foot">© 2026 Dumpster · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
      </section>
    </div>
  );
}
