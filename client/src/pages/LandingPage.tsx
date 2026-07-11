import { useLocation } from 'wouter';
import { useState, useEffect } from 'react';
import './LandingPage.css';

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

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="lp-root">
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
            <button className="lp-btn lp-btn--gold" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              Get Pro
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero__eyebrow">
          <span className="lp-badge">
            <IconInstagram />
            Instagram Carousel Builder
          </span>
        </div>
        <h1 className="lp-hero__headline">
          Build Dumps<br />
          <em>That Hit.</em>
        </h1>
        <p className="lp-hero__sub">
          The AI-powered carousel sequencer for creators who care about<br className="lp-br-desktop" />
          {' '}how their feed looks and what it does.
        </p>
        <div className="lp-hero__ctas">
          <button className="lp-btn lp-btn--gold lp-btn--lg" onClick={() => navigate('/app')}>
            Start Building Free <IconArrow />
          </button>
          <button className="lp-btn lp-btn--ghost lp-btn--lg" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>
            See How It Works
          </button>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────── */}
      <section id="features" className="lp-section lp-features">
        <div className="lp-container">
          <div className="lp-section__header">
            <div className="lp-section__label">FEATURES</div>
            <h2 className="lp-section__title">Everything you need to post better</h2>
          </div>
          <div className="lp-features__grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-card__icon">{f.icon}</div>
                <h3 className="lp-feature-card__title">{f.title}</h3>
                <p className="lp-feature-card__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ───────────────────────────────────────── */}
      <section id="how" className="lp-section lp-how">
        <div className="lp-container">
          <div className="lp-section__header">
            <div className="lp-section__label">HOW IT WORKS</div>
            <h2 className="lp-section__title">Three steps. One great post.</h2>
          </div>
          <div className="lp-how__steps">
            {STEPS.map((s, i) => (
              <div key={s.num} className="lp-step">
                <div className="lp-step__num">{s.num}</div>
                {i < STEPS.length - 1 && <div className="lp-step__line" />}
                <div className="lp-step__content">
                  <h3 className="lp-step__title">{s.title}</h3>
                  <p className="lp-step__desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── iOS App Banner ─────────────────────────────────────── */}
      <section className="lp-section lp-ios-banner">
        <div className="lp-container">
          <div className="lp-ios-banner__inner">
            <div className="lp-ios-banner__icon"><IconPhone /></div>
            <div className="lp-ios-banner__text">
              <div className="lp-section__label">iOS APP</div>
              <h3 className="lp-ios-banner__title">Take Dumpster everywhere</h3>
              <p className="lp-ios-banner__desc">Build and sequence carousels on your iPhone. Your pool syncs across web and mobile.</p>
            </div>
            <a
              href="https://apps.apple.com"
              className="lp-btn lp-btn--outline"
              target="_blank"
              rel="noreferrer"
            >
              Coming Soon <IconArrow />
            </a>
          </div>
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────────────── */}
      <section id="pricing" className="lp-section lp-pricing">
        <div className="lp-container">
          <div className="lp-section__header">
            <div className="lp-section__label">PRICING</div>
            <h2 className="lp-section__title">Start free. Go Pro when you're ready.</h2>
          </div>
          <div className="lp-pricing__grid">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`lp-plan ${plan.highlight ? 'lp-plan--highlight' : ''}`}>
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────────── */}
      <section className="lp-section lp-cta">
        <div className="lp-container">
          <div className="lp-cta__inner">
            <h2 className="lp-cta__title">Your carousel game starts here.</h2>
            <p className="lp-cta__sub">No credit card. No setup. Just better posts.</p>
            <button className="lp-btn lp-btn--gold lp-btn--lg" onClick={() => navigate('/app')}>
              Open Dumpster Free <IconArrow />
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────── */}
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
    </div>
  );
}
