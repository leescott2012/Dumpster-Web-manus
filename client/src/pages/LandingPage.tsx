import { useLocation } from 'wouter';
import { useRef, useState, useEffect, memo, type ReactNode } from 'react';
import { motion, animate, useAnimationFrame, useReducedMotion, useMotionValue, useTransform, useSpring, useVelocity, type MotionValue } from 'framer-motion';
import { ColorPanels } from '@paper-design/shaders-react';
import './LandingPage.css';

const HeroShader = memo(function HeroShader() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ponytail: feature-detect once — @paper-design/shaders-react throws from an
  // unawaited async init effect when webgl2 is unavailable (blocked GPU,
  // disabled hw accel, some VMs/RDP), which surfaces as an unhandled promise
  // rejection and crashes shader init. Skip the shader there instead.
  const [webgl2Supported] = useState(() => {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  });
  return (
    <div className="lp-hero__shader" aria-hidden="true">
      {webgl2Supported && (
        <ColorPanels
          colors={['#C8A96E', '#8B6F3A', '#d4b87a', '#5a4620']}
          colorBack="#08080800"
          density={4.2}
          angle1={0.62}
          angle2={0.3}
          length={1.1}
          edges
          blur={0.3}
          fadeIn={0.85}
          fadeOut={0.35}
          gradient={0.5}
          speed={reduced ? 0 : 1.6}
          scale={1}
          rotation={180}
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </div>
  );
});

/* Photo-dump carousel driven by page scroll — cards slide, wobble, and wrap
   around as you swipe between slides. ponytail: Pexels stock (free license),
   swap for real dump shots when we have them. */
const CARD_PHOTOS = [1926769, 1183266, 1758144, 2043590, 2529148, 733872, 1130626, 2613260];
const CARD_COUNT = CARD_PHOTOS.length;
const CARD_SPACING = 170;
const CARD_LOOP = CARD_COUNT * CARD_SPACING;
const SCROLL_TRAVEL = CARD_LOOP * 1.5;
const CARD_W = 132;
const cardSrc = (i: number) =>
  `https://images.pexels.com/photos/${CARD_PHOTOS[i]}/pexels-photo-${CARD_PHOTOS[i]}.jpeg?auto=compress&cs=tinysrgb&w=280&h=360&fit=crop`;
const cardTop = (i: number) => 14 + (i % 3) * 16;
const wrapLoop = (v: number) => ((v % CARD_LOOP) + CARD_LOOP) % CARD_LOOP;

function DumpCard({ i, travel, lean, center }: {
  i: number;
  travel: MotionValue<number>;
  lean: MotionValue<number>;
  center: number;
}) {
  const x = useTransform(travel, (t) => wrapLoop(i * CARD_SPACING + t) - CARD_SPACING);
  // depth: cards shrink + dim toward the strip edges, pop at center
  const dist = (xv: number) => Math.min(Math.abs(xv + CARD_W / 2 - center) / Math.max(center, 1), 1);
  const scale = useTransform(x, (xv) => 1.06 - dist(xv) * 0.22);
  const opacity = useTransform(x, (xv) => 1 - dist(xv) * 0.5);
  // wobble as the strip travels + lean into the swipe direction
  const rotate = useTransform([travel, lean], ([t, l]: number[]) => Math.sin(i * 1.7 + t / 130) * 6 + l);
  return (
    <motion.div className="lp-card" style={{ x, rotate, scale, opacity, top: cardTop(i) }}>
      <motion.div
        className="lp-card__inner"
        whileHover={{ scale: 1.12, y: -10 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      >
        <img src={cardSrc(i)} alt="" loading="lazy" draggable={false} />
      </motion.div>
    </motion.div>
  );
}

function ScrollCarousel({ progress }: { progress: MotionValue<number> }) {
  const reduced = useReducedMotion();
  const stripRef = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState(600);
  const drag = useMotionValue(0);
  const auto = useMotionValue(0);
  const paused = useRef(false);
  // idle drift: the strip scrolls on its own, pausing while hovered or grabbed
  useAnimationFrame((_, delta) => {
    if (!paused.current) auto.set(auto.get() + delta * 0.032);
  });
  // page scroll + drag + auto-drift feed one travel value, spring-smoothed so motion overshoots a touch
  const travelRaw = useTransform([progress, drag, auto], ([p, d, a]: number[]) => p * SCROLL_TRAVEL + d + a);
  const travel = useSpring(travelRaw, { stiffness: 140, damping: 24, mass: 0.7 });
  const velocity = useVelocity(travel);
  const lean = useTransform(velocity, [-2500, 2500], [9, -9], { clamp: true });

  useEffect(() => {
    const measure = () => setCenter((stripRef.current?.offsetWidth ?? 1200) / 2);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  if (reduced) {
    return (
      <div className="lp-carousel" aria-hidden="true">
        {CARD_PHOTOS.map((_, i) => (
          <div key={i} className="lp-card" style={{ left: i * CARD_SPACING - CARD_SPACING / 2, top: cardTop(i) }}>
            <div className="lp-card__inner">
              <img src={cardSrc(i)} alt="" loading="lazy" draggable={false} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-hidden="true">
      <motion.div
        ref={stripRef}
        className="lp-carousel"
        onHoverStart={() => { paused.current = true; }}
        onHoverEnd={() => { paused.current = false; }}
        onPanStart={() => { paused.current = true; drag.stop(); }}
        onPan={(_, info) => drag.set(drag.get() + info.delta.x)}
        onPanEnd={(_, info) => {
          paused.current = false;
          // fling with momentum, then settle snapped to a card position
          const scrollPart = progress.get() * SCROLL_TRAVEL;
          const projected = drag.get() + info.velocity.x * 0.35;
          const snapped = Math.round((scrollPart + projected) / CARD_SPACING) * CARD_SPACING - scrollPart;
          animate(drag, snapped, { type: 'spring', velocity: info.velocity.x, stiffness: 90, damping: 22 });
        }}
      >
        {CARD_PHOTOS.map((_, i) => (
          <DumpCard key={i} i={i} travel={travel} lean={lean} center={center} />
        ))}
      </motion.div>
      <p className="lp-carousel__hint">Drag the dump — or just keep swiping</p>
    </div>
  );
}

/* Slide-enter animation wrapper — re-animates on every swipe into view */
function Rise({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 44 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.2 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// SVG Icons
const IconSparkles = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.727 12.727.707.707M3 12h1m16 0h1M4.927 19.073l.707-.707M18.366 5.634l.707-.707"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconLayers = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
);
const IconZap = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconArrow = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconInstagram = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);
const IconPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);
const IconChevronDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const FEATURES = [
  {
    icon: <IconLayers />,
    title: 'Sequence Like a Pro',
    desc: 'Drag-and-drop carousel builder with our formula engine — Hook → Story → Closer. Every slide in its optimal position.',
  },
  {
    icon: <IconSparkles />,
    title: 'AI That Knows Your Aesthetic',
    desc: 'Scrub your Instagram, train the AI on what works. It generates captions and sequencing that match your voice.',
  },
  {
    icon: <IconZap />,
    title: 'Engagement-Driven Playbook',
    desc: 'Analyze top-performing posts, extract what your audience responds to, inject that intelligence into every dump you build.',
  },
];

const STEPS = [
  { num: '01', title: 'Drop Your Photos', desc: 'Add images to your pool. Web or iOS — your content syncs.' },
  { num: '02', title: 'Build Your Dump', desc: 'Drag photos into sequence. Use AI auto-arrange or do it manually.' },
  { num: '03', title: 'Ship It', desc: 'Copy captions, export the sequence. Post directly to Instagram.' },
];

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    desc: 'For creators just getting started.',
    features: ['5 dumps', 'Photo pool (50 photos)', 'Manual sequencing', 'Basic captions'],
    cta: 'Get Started Free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$5.99',
    period: '/mo',
    desc: 'For serious creators who post consistently.',
    features: [
      'Unlimited dumps',
      'Unlimited photo pool',
      'AI auto-arrange',
      'AI captions',
      'Instagram scrub (10/mo)',
      'Engagement playbook',
      'iOS app included',
      '$34.99/yr or $19.99 lifetime available in-app',
    ],
    cta: 'Start Pro — $5.99/mo',
    highlight: true,
  },
];

const SLIDES = [
  { id: 'hero', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'cta', label: 'Get started' },
];

export default function LandingPage() {
  const [, navigate] = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [{ active, scrolled }, setScrollState] = useState({ active: 0, scrolled: false });
  const scrollProgress = useMotionValue(0);

  const handleScroll = () => {
    const root = rootRef.current;
    if (!root) return;
    scrollProgress.set(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight));
    const mid = root.scrollTop + root.clientHeight / 2;
    let current = 0;
    root.querySelectorAll<HTMLElement>('.lp-slide').forEach((slide, i) => {
      if (slide.offsetTop <= mid) current = i;
    });
    const next = { active: current, scrolled: root.scrollTop > 40 };
    setScrollState((prev) => (prev.active === next.active && prev.scrolled === next.scrolled ? prev : next));
  };

  const goTo = (i: number) => {
    document.getElementById(SLIDES[i].id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="lp-root" ref={rootRef} onScroll={handleScroll}>
      {/* ─── Navbar ─────────────────────────────────────────────── */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav--scrolled' : ''}`}>
        <div className="lp-nav__inner">
          <div className="lp-nav__logo">
            <div className="lp-nav__logo-mark">D</div>
            <span className="lp-nav__logo-text">DUMPSTER</span>
          </div>
          <div className="lp-nav__links">
            <a href="#features" className="lp-nav__link">Features</a>
            <a href="#how" className="lp-nav__link">How it works</a>
            <a href="#pricing" className="lp-nav__link">Pricing</a>
          </div>
          <div className="lp-nav__actions">
            <button className="lp-btn lp-btn--ghost" onClick={() => navigate('/app')}>
              Open App
            </button>
            <button className="lp-btn lp-btn--gold" onClick={() => goTo(3)}>
              Get Pro
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Slide dots ─────────────────────────────────────────── */}
      <div className="lp-dots" aria-hidden={false}>
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            className={`lp-dot ${active === i ? 'lp-dot--active' : ''}`}
            aria-label={`Go to ${s.label}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      {/* ─── Slide 1: Hero ──────────────────────────────────────── */}
      <section id="hero" className="lp-slide lp-hero">
        <HeroShader />
        <Rise className="lp-hero__eyebrow">
          <span className="lp-badge">
            <IconInstagram />
            Instagram Carousel Builder
          </span>
        </Rise>
        <Rise delay={0.08}>
          <h1 className="lp-hero__headline">
            Build Dumps<br />
            <em>That Hit.</em>
          </h1>
        </Rise>
        <Rise delay={0.16}>
          <p className="lp-hero__sub">
            The AI-powered carousel sequencer for creators who care about
            {' '}how their feed looks and what it does.
          </p>
        </Rise>
        <Rise delay={0.24} className="lp-hero__ctas">
          <button className="lp-btn lp-btn--gold lp-btn--lg" onClick={() => navigate('/app')}>
            Start Building Free <IconArrow />
          </button>
          <button className="lp-btn lp-btn--ghost lp-btn--lg" onClick={() => goTo(2)}>
            See How It Works
          </button>
        </Rise>
        <Rise delay={0.32} className="lp-hero__carousel-wrap">
          <ScrollCarousel progress={scrollProgress} />
        </Rise>
        <button
          className="lp-swipe-hint"
          style={{ opacity: active === 0 ? 1 : 0 }}
          aria-label="Swipe to features"
          onClick={() => goTo(1)}
        >
          <IconChevronDown />
        </button>
      </section>

      {/* ─── Slide 2: Features ──────────────────────────────────── */}
      <section id="features" className="lp-slide lp-features">
        <div className="lp-container">
          <Rise className="lp-section__header">
            <div className="lp-section__label">FEATURES</div>
            <h2 className="lp-section__title">Everything you need to post better</h2>
          </Rise>
          <div className="lp-features__grid">
            {FEATURES.map((f, i) => (
              <Rise key={f.title} delay={0.1 + i * 0.1} className="lp-feature-card">
                <div className="lp-feature-card__icon">{f.icon}</div>
                <h3 className="lp-feature-card__title">{f.title}</h3>
                <p className="lp-feature-card__desc">{f.desc}</p>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Slide 3: How it works ──────────────────────────────── */}
      <section id="how" className="lp-slide lp-how">
        <div className="lp-container">
          <Rise className="lp-section__header">
            <div className="lp-section__label">HOW IT WORKS</div>
            <h2 className="lp-section__title">Three steps. One great post.</h2>
          </Rise>
          <div className="lp-how__steps">
            {STEPS.map((s, i) => (
              <Rise key={s.num} delay={0.1 + i * 0.12} className="lp-step">
                <div className="lp-step__num">{s.num}</div>
                {i < STEPS.length - 1 && <div className="lp-step__line" />}
                <div className="lp-step__content">
                  <h3 className="lp-step__title">{s.title}</h3>
                  <p className="lp-step__desc">{s.desc}</p>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Slide 4: Pricing ───────────────────────────────────── */}
      <section id="pricing" className="lp-slide lp-pricing">
        <div className="lp-container">
          <Rise className="lp-section__header">
            <div className="lp-section__label">PRICING</div>
            <h2 className="lp-section__title">Start free. Go Pro when you're ready.</h2>
          </Rise>
          <div className="lp-pricing__grid">
            {PLANS.map((plan, i) => (
              <Rise key={plan.name} delay={0.1 + i * 0.12} className={`lp-plan ${plan.highlight ? 'lp-plan--highlight' : ''}`}>
                {plan.highlight && <div className="lp-plan__badge">MOST POPULAR</div>}
                <div className="lp-plan__name">{plan.name}</div>
                <div className="lp-plan__price">
                  {plan.price}<span className="lp-plan__period">{plan.period}</span>
                </div>
                <p className="lp-plan__desc">{plan.desc}</p>
                <ul className="lp-plan__features">
                  {plan.features.map((f) => (
                    <li key={f} className="lp-plan__feature">
                      <span className="lp-plan__check"><IconCheck /></span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`lp-btn lp-btn--full ${plan.highlight ? 'lp-btn--gold' : 'lp-btn--outline'}`}
                  onClick={() => navigate('/app')}
                >
                  {plan.cta}
                </button>
              </Rise>
            ))}
          </div>
          <p className="lp-pricing__swipe-note">Swipe to compare plans</p>
        </div>
      </section>

      {/* ─── Slide 5: Final CTA + footer ────────────────────────── */}
      <section id="cta" className="lp-slide lp-cta">
        <div className="lp-cta__inner">
          <Rise>
            <span className="lp-badge"><IconPhone /> iOS app — coming soon</span>
          </Rise>
          <Rise delay={0.08}>
            <h2 className="lp-cta__title">Your carousel game starts here.</h2>
          </Rise>
          <Rise delay={0.16}>
            <p className="lp-cta__sub">No credit card. No setup. Just better posts.</p>
          </Rise>
          <Rise delay={0.24}>
            <button className="lp-btn lp-btn--gold lp-btn--lg" onClick={() => navigate('/app')}>
              Open Dumpster Free <IconArrow />
            </button>
          </Rise>
        </div>

        <footer className="lp-footer">
          <div className="lp-container">
            <div className="lp-footer__inner">
              <div className="lp-footer__brand">
                <div className="lp-nav__logo">
                  <div className="lp-nav__logo-mark">D</div>
                  <span className="lp-nav__logo-text">DUMPSTER</span>
                </div>
                <p className="lp-footer__tagline">Built for creators who post with intention.</p>
              </div>
              <div className="lp-footer__links">
                <div className="lp-footer__col">
                  <div className="lp-footer__col-title">Product</div>
                  <a href="#features" className="lp-footer__link">Features</a>
                  <a href="#pricing" className="lp-footer__link">Pricing</a>
                  <button className="lp-footer__link" onClick={() => navigate('/app')}>Web App</button>
                </div>
                <div className="lp-footer__col">
                  <div className="lp-footer__col-title">Legal</div>
                  <a href="/privacy" className="lp-footer__link">Privacy Policy</a>
                  <a href="/terms" className="lp-footer__link">Terms of Service</a>
                </div>
              </div>
            </div>
            <div className="lp-footer__bottom">
              <span>© 2026 Dumpster. All rights reserved.</span>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
