import { useLocation } from 'wouter';
import { useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import './LandingPage.css';

/* Hero background: tilted photo columns drifting in opposite directions (CSS
   only). ponytail: Pexels stock (free license), swap for real dump shots later. */
const CARD_PHOTOS = [1926769, 1183266, 1758144, 2043590, 2529148, 733872, 1130626, 2613260];
const cardSrc = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=360&h=640&fit=crop`;
const COLS = 9;

function HeroColumns() {
  return (
    <div className="lp-cols" aria-hidden="true">
      <div className="lp-cols__grid">
        {Array.from({ length: COLS }, (_, c) => {
          const seq = Array.from({ length: 6 }, (_, k) => CARD_PHOTOS[(c * 3 + k) % CARD_PHOTOS.length]);
          return (
            <div className="lp-col" key={c}>
              <div className="lp-col__track" style={{ animationDelay: `${-c * 11}s` }}>
                {[...seq, ...seq].map((id, k) => (
                  <div className="lp-col__card" key={k}>
                    <img src={cardSrc(id)} alt="" draggable={false} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
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
      '$34.99/yr available in-app',
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

  const handleScroll = () => {
    const root = rootRef.current;
    if (!root) return;
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
              Sign in
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
        <HeroColumns />
        <div className="lp-hero__copy">
          <h1 className="lp-hero__headline">Build dumps that hit.</h1>
          <button className="lp-hero__btn" onClick={() => navigate('/app')}>
            Sign up free
          </button>
        </div>
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
            <p className="lp-cta__sub">Free account, no credit card. Sign in and start in minutes.</p>
          </Rise>
          <Rise delay={0.24}>
            <button className="lp-btn lp-btn--gold lp-btn--lg" onClick={() => navigate('/app')}>
              Sign up free <IconArrow />
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
              <span>© 2026 Chamillion Collective. All rights reserved.</span>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
