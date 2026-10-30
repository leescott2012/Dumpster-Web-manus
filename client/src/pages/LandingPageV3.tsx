import { useLocation } from 'wouter';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './LandingPageV3.css';

/* Draft 3 — Apple product-page style (iPhone 17 Pro grammar):
   sticky product nav, giant scrubbed hero wordmark, "highlights" phone reel
   with looping in-screen motion, pinned scroll scenes, gold stat callouts,
   3-col spec grids, plan cards, FAQ. GSAP ScrollTrigger drives the scrub. */

gsap.registerPlugin(ScrollTrigger);

const PHOTOS = [1926769, 1183266, 1758144, 2043590, 2529148, 733872, 1130626, 2613260, 1036623, 1040881, 1687675, 415829];
const src = (id: number, w = 300, h = 380) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;

const FAQS = [
  { q: 'What exactly is a "dump"?', a: 'An Instagram carousel — a multi-photo post. Dumpster helps you pick, order, and caption the photos so the carousel actually performs instead of just existing.' },
  { q: 'How does the AI know my style?', a: 'You connect your Instagram and Dumpster scrubs your top posts. The AI learns what your audience responds to — tone, pacing, sequencing — and applies it to every new dump.' },
  { q: 'Is there really a free plan?', a: 'Yes. 5 dumps, a 50-photo pool, manual sequencing, and basic captions. No credit card. Pro is $5.99/mo when you want unlimited everything and the AI engine.' },
  { q: 'Web or iPhone?', a: 'Both. Your pool syncs across the web app and the native iOS app (coming soon), so you can build at your desk and ship from your phone.' },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`v3-faq ${open ? 'v3-faq--open' : ''}`}>
      <button className="v3-faq__q" onClick={() => setOpen(!open)} aria-expanded={open}>
        {q}<span className="v3-faq__plus">{open ? '−' : '+'}</span>
      </button>
      <div className="v3-faq__a"><p>{a}</p></div>
    </div>
  );
}

export default function LandingPageV3() {
  const [, navigate] = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [navOn, setNavOn] = useState(false);

  useEffect(() => {
    const root = rootRef.current!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onScroll = () => setNavOn(root.scrollTop > root.clientHeight * 0.55);
    root.addEventListener('scroll', onScroll, { passive: true });
    if (reduced) return () => root.removeEventListener('scroll', onScroll);

    const ctx = gsap.context(() => {
      // hero: wordmark settles + photo pile parallaxes apart as you scroll
      gsap.timeline({
        scrollTrigger: { trigger: '.v3-hero', scroller: root, start: 'top top', end: 'bottom top', scrub: 0.6 },
      })
        .to('.v3-hero__mark', { scale: 0.82, yPercent: -12, opacity: 0.25, ease: 'none' }, 0)
        .to('.v3-hero__pile .v3-pp', { y: (i) => -60 - i * 46, rotate: (i) => (i % 2 ? 10 : -9), ease: 'none' }, 0)
        .fromTo('.v3-phone--hero', { y: 90, scale: 0.94 }, { y: -50, scale: 1.03, ease: 'none' }, 0);

      // sequence scene: pinned — scattered photos scrub into an ordered strip
      const cards = gsap.utils.toArray<HTMLElement>('.v3-seq__card');
      const seqTl = gsap.timeline({
        scrollTrigger: { trigger: '.v3-seq', scroller: root, start: 'top top', end: '+=1600', scrub: 0.5, pin: true },
      });
      cards.forEach((c, i) => {
        seqTl.fromTo(c,
          { x: [ -260, 200, -120, 300, -340, 140, 240 ][i], y: [ -120, -190, 150, 90, 30, -60, 170 ][i], rotation: [ -18, 14, -8, 18, 9, -13, 6 ][i], opacity: 0.55 },
          { x: 0, y: 0, rotation: 0, opacity: 1, ease: 'power2.out', duration: 1 }, i * 0.12);
      });
      seqTl.fromTo('.v3-seq__labels', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, '>-0.3');

      // design: oversized device drifts + untilts while you scroll past
      gsap.fromTo('.v3-design__device', { rotate: -11, y: 90 }, {
        rotate: -4, y: -70, ease: 'none',
        scrollTrigger: { trigger: '.v3-design', scroller: root, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
      });

      // speed: one huge phone scales up as it enters
      gsap.fromTo('.v3-big__phone', { scale: 0.78, y: 70 }, {
        scale: 1, y: 0, ease: 'none',
        scrollTrigger: { trigger: '.v3-big', scroller: root, start: 'top 92%', end: 'center 55%', scrub: 0.5 },
      });

      // family: three phones rise in staggered
      gsap.fromTo('.v3-family .v3-phone', { y: 140, opacity: 0 }, {
        y: 0, opacity: 1, stagger: 0.16, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: '.v3-family', scroller: root, start: 'top 72%' },
      });

      // section headlines rise in
      gsap.utils.toArray<HTMLElement>('.v3-rise').forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 56 }, {
          opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, scroller: root, start: 'top 82%' },
        });
      });

      // stat counters
      gsap.utils.toArray<HTMLElement>('.v3-count').forEach((el) => {
        const target = Number(el.dataset.to || 0);
        ScrollTrigger.create({
          trigger: el, scroller: root, start: 'top 85%', once: true,
          onEnter: () => gsap.fromTo(el, { innerText: 0 }, {
            innerText: target, duration: 1.4, ease: 'power1.out', snap: { innerText: 1 },
          }),
        });
      });
    }, root);

    return () => { ctx.revert(); root.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <div className="v3-root" ref={rootRef}>
      {/* sticky product nav — appears after the hero */}
      <nav className={`v3-nav ${navOn ? 'v3-nav--on' : ''}`}>
        <span className="v3-nav__name">Dumpster</span>
        <div className="v3-nav__actions">
          <button className="v3-pill v3-pill--ghost" onClick={() => navigate('/app')}>Open App</button>
          <button className="v3-pill v3-pill--gold" onClick={() => document.getElementById('v3plans')?.scrollIntoView({ behavior: 'smooth' })}>Get Pro</button>
        </div>
      </nav>

      <button className="v3-switch" onClick={() => navigate('/')}>drafts: 1 · 2 · <b>3</b></button>

      {/* promo banner (Apple: trade-in strip) */}
      <div className="v3-promo">Get 5 free dumps when you join — no credit card, no setup.</div>

      {/* ── Hero ── */}
      <section className="v3-hero">
        <p className="v3-hero__kicker">Dumpster</p>
        <h1 className="v3-hero__mark">DUMP<span>.</span></h1>
        <div className="v3-hero__stage">
          <div className="v3-hero__pile">
            {PHOTOS.slice(0, 5).map((p, i) => (
              <img key={p} className="v3-pp" src={src(p, 260, 330)} alt="" style={{ zIndex: 5 - i }} loading="eager" draggable={false} />
            ))}
          </div>
          <div className="v3-phone v3-phone--hero">
            <div className="v3-phone__notch" />
            <div className="v3-phone__screen v3-loop-swipe">
              <div className="v3-loop-swipe__strip">
                {PHOTOS.slice(4, 10).map((p) => <img key={p} src={src(p, 380, 780)} alt="" loading="eager" draggable={false} />)}
              </div>
              <span className="v3-loop__tag">Dumpster, in motion</span>
            </div>
          </div>
        </div>
        <div className="v3-hero__cta">
          <button className="v3-pill v3-pill--gold v3-pill--lg" onClick={() => navigate('/app')}>Start Free</button>
          <p className="v3-hero__price">Free, or Pro from $5.99/mo.</p>
        </div>
      </section>

      {/* ── Highlights reel ── */}
      <section className="v3-sec">
        <h2 className="v3-h2 v3-rise">Get the highlights.</h2>
        <div className="v3-reel">
          <div className="v3-phone">
            <div className="v3-phone__screen v3-loop-sort">
              {PHOTOS.slice(0, 6).map((p, i) => <img key={p} src={src(p, 120, 150)} alt="" className={`v3-ls${i}`} draggable={false} />)}
              <span className="v3-loop__tag">AI sorts the mess</span>
            </div>
          </div>
          <div className="v3-phone">
            <div className="v3-phone__screen v3-loop-cap">
              <img src={src(PHOTOS[7], 220, 260)} alt="" draggable={false} />
              <p className="v3-loop-cap__text">low effort, high intention ✨<span /></p>
              <span className="v3-loop__tag">Captions write themselves</span>
            </div>
          </div>
          <div className="v3-phone">
            <div className="v3-phone__screen v3-loop-swipe">
              <div className="v3-loop-swipe__strip">
                {PHOTOS.slice(2, 8).map((p) => <img key={p} src={src(p, 200, 420)} alt="" draggable={false} />)}
              </div>
              <span className="v3-loop__tag">Swipe-ready in seconds</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Genius Engine: pro results down to the pixel ── */}
      <section className="v3-sec v3-sec--wide">
        <p className="v3-eyebrow v3-rise">The Genius Engine</p>
        <h2 className="v3-h2 v3-rise">Pro picks.<br />Down to the pixel.</h2>
        <p className="v3-para v3-rise" style={{ marginBottom: 52 }}>
          It reads your whole camera roll — <b>subjects, quality, duplicates</b> — and clusters
          the hidden stories inside it. Not sorting. <b>Discerning.</b>
        </p>
        <div className="v3-pixel v3-rise">
          {/* slot: swap for Lee's picked photos */}
          <img src={src(PHOTOS[1], 900, 660)} alt="" loading="lazy" draggable={false} />
          <img src={src(PHOTOS[3], 440, 660)} alt="" loading="lazy" draggable={false} />
          <img src={src(PHOTOS[6], 440, 660)} alt="" loading="lazy" draggable={false} />
        </div>
      </section>

      {/* ── The Valet: hand-held phone, real video on screen ── */}
      <section className="v3-sec v3-stage">
        <p className="v3-eyebrow v3-rise">The Valet</p>
        <h2 className="v3-h2 v3-rise">It's a total<br />dump changer.</h2>
        <p className="v3-para v3-rise" style={{ marginBottom: 44 }}>
          One tap. The Valet clusters your pool, runs the Formula, weaves the caption —
          and hands you <b>ready-to-post carousels</b> while your coffee's still hot.
        </p>
        <div className="v3-hand v3-hand--up v3-rise">
          <img className="v3-hand__photo" src="/landing/hand-up.jpg" alt="" loading="lazy" draggable={false} />
          <video className="v3-hand__screen" src="/landing/clip-car-night.mp4" autoPlay muted loop playsInline />
        </div>
      </section>

      {/* ── Design: oversized angled device + materials story ── */}
      <section className="v3-sec v3-design">
        <div className="v3-design__text">
          <p className="v3-eyebrow v3-rise">Design</p>
          <h2 className="v3-h2 v3-rise">Dark. Gold. Yours.</h2>
          <p className="v3-design__copy v3-rise">A workspace that looks like a studio, not a spreadsheet. Dark-first for the late-night editing sessions, gold where your eyes need to go, and fast everywhere else.</p>
        </div>
        <div className="v3-phone v3-phone--design v3-design__device">
          <div className="v3-phone__notch" />
          <div className="v3-phone__screen">
            <img className="v3-screenfill" src={src(PHOTOS[0], 420, 860)} alt="" loading="lazy" draggable={false} />
          </div>
        </div>
      </section>

      {/* ── Full-bleed media band + side stats (Apple "A big zoom forward.") ── */}
      <section className="v3-sec v3-sec--wide">
        <p className="v3-eyebrow v3-rise">Sequencing</p>
        <h2 className="v3-h2 v3-rise">A big leap in storytelling.</h2>
        <div className="v3-band v3-rise">
          <img className="v3-band__media" src={src(PHOTOS[2], 1100, 720)} alt="" draggable={false} />
          <div className="v3-band__stats">
            <div className="v3-stat"><em>Up to</em><b>10 slides</b><em>one story engine</em></div>
            <div className="v3-stat"><em>All</em><b>3 acts</b><em>Hook → Story → Closer</em></div>
          </div>
        </div>
        <button className="v3-cmp v3-rise" onClick={() => navigate('/app')}>See it on your photos <span>+</span></button>
      </section>

      {/* ── Sequencing (pinned scrub scene) ── */}
      <section className="v3-seq">
        <div className="v3-seq__inner">
          <p className="v3-eyebrow">The Formula Engine</p>
          <h2 className="v3-h2">Watch the mess become a story.</h2>
          <div className="v3-seq__stage">
            {PHOTOS.slice(0, 7).map((p) => (
              <img key={p} className="v3-seq__card" src={src(p, 170, 220)} alt="" draggable={false} />
            ))}
          </div>
          <div className="v3-seq__labels">
            <span>HOOK</span><span>→</span><span>STORY</span><span>→</span><span>CLOSER</span>
          </div>
          <p className="v3-seq__hint">keep scrolling — watch the mess become a story</p>
        </div>
      </section>

      {/* mixed-color paragraph (Apple Intelligence blurb style) */}
      <section className="v3-sec v3-sec--tight">
        <p className="v3-para v3-rise">
          Every dump comes packed with intelligence. <b>AI auto-arrange</b> puts your photos in
          the order that keeps thumbs scrolling. Captions are written <b>in your voice</b>, trained
          on your own posts. And the <b>Instagram scrub</b> studies what your audience already
          loves — so every post ships with a strategy built in.
        </p>
      </section>

      {/* ── Captions ── */}
      <section className="v3-sec">
        <p className="v3-eyebrow v3-rise">AI Captions</p>
        <h2 className="v3-h2 v3-rise">Any more you and it<br />would write your diary.</h2>
        <div className="v3-grid3 v3-rise">
          <div className="v3-cell"><h3>Your voice</h3><p>Trained on your own posts, not a generic influencer template. It sounds like you on a good day.</p></div>
          <div className="v3-cell"><h3>Your audience</h3><p>The Instagram scrub reads what your followers actually respond to and writes toward it.</p></div>
          <div className="v3-cell"><h3>One tap</h3><p>Generate, tweak if you want, copy. The caption is the last thing between you and posting — so it's fast.</p></div>
        </div>
      </section>

      {/* ── Engine ── */}
      <section className="v3-sec">
        <p className="v3-eyebrow v3-rise">The Genius Engine</p>
        <h2 className="v3-h2 v3-rise">Built to make you post more.</h2>
        <div className="v3-grid3 v3-rise">
          <div className="v3-cell"><h3>AI auto-arrange</h3><p>Drop the photos, get the sequence. The formula engine places every slide in its optimal slot.</p></div>
          <div className="v3-cell"><h3>Instagram scrub</h3><p>Analyzes your top-performing posts and injects that intelligence into every dump you build.</p></div>
          <div className="v3-cell"><h3>Engagement playbook</h3><p>Not just pretty — strategic. Every suggestion is tied to what drives saves, shares, and follows.</p></div>
        </div>
        <div className="v3-stats v3-rise">
          <div className="v3-stat"><em>Instagram scrubs</em><b><span className="v3-count" data-to="10">0</span>/mo</b><em>on Pro</em></div>
          <div className="v3-stat"><em>Photo pool</em><b>∞</b><em>unlimited on Pro</em></div>
          <div className="v3-stat"><em>Dumps</em><b>∞</b><em>unlimited on Pro</em></div>
        </div>
        <button className="v3-cmp v3-rise" onClick={() => document.getElementById('v3plans')?.scrollIntoView({ behavior: 'smooth' })}>Compare plans <span>+</span></button>
      </section>

      {/* ── Workflows: real app screenshot beside a real photo ── */}
      <section className="v3-sec v3-sec--wide">
        <p className="v3-eyebrow v3-rise">The Aesthetic Stylist</p>
        <h2 className="v3-h2 v3-rise">Pro workflows.<br />Zero pro effort.</h2>
        <div className="v3-duo v3-rise">
          <div className="v3-phone v3-phone--shot">
            <div className="v3-phone__screen">
              {/* slot: swap for AI-menu capture when Lee taps to it */}
              <img className="v3-screenfill" src="/landing/app-builder.png" alt="Dumpster app — dump builder" loading="lazy" draggable={false} />
            </div>
          </div>
          <img className="v3-duo__photo" src={src(PHOTOS[10], 640, 800)} alt="" loading="lazy" draggable={false} />
        </div>
        <div className="v3-grid3 v3-rise" style={{ marginTop: 56 }}>
          <div className="v3-cell"><h3>Scrub any profile</h3><p>Point it at an Instagram you admire — yours or anyone's — and it distills the aesthetic into a playbook you can apply.</p></div>
          <div className="v3-cell"><h3>Your style profile</h3><p>Casual, Aesthetic, Minimal, Witty, Poetic — the AI learns the one that's yours and stays in character.</p></div>
          <div className="v3-cell"><h3>Real analytics</h3><p>What performs, when to post, what your audience saves. A creative director and a data analyst in your pocket.</p></div>
        </div>
      </section>

      {/* ── Effort: hand-held phone with real app screens (Apple battery section) ── */}
      <section className="v3-sec v3-big">
        <p className="v3-eyebrow v3-rise">The Valet, again</p>
        <h2 className="v3-h2 v3-rise">Effort.<br />All-time low.</h2>
        <div className="v3-hand v3-hand--dark v3-big__phone">
          <img className="v3-hand__photo" src="/landing/hand-dark.jpg" alt="" loading="lazy" draggable={false} />
          <img className="v3-hand__screen" src="/landing/app-builder.png" alt="Dumpster app in hand" loading="lazy" draggable={false} />
        </div>
        <div className="v3-stats v3-rise">
          <div className="v3-stat"><em>Camera roll to posted</em><b>~2 min</b><em>on a good dump</em></div>
          <div className="v3-stat"><em>Overthinking required</em><b>0</b><em>all-time low</em></div>
        </div>
      </section>

      {/* ── Family: three big phones, one per step (Apple triptych) ── */}
      <section className="v3-sec v3-family">
        <h2 className="v3-h2 v3-rise">One app. Every step.</h2>
        <div className="v3-reel v3-reel--family">
          <div>
            <div className="v3-phone v3-phone--family">
              <div className="v3-phone__screen">
                <img className="v3-screenfill" src="/landing/app-builder.png" alt="Dumpster builder screen" loading="lazy" draggable={false} />
              </div>
            </div>
            <p className="v3-fam-label">POOL</p>
          </div>
          <div>
            <div className="v3-phone v3-phone--family">
              <div className="v3-phone__notch" />
              <div className="v3-phone__screen v3-fam-seq">
                {PHOTOS.slice(4, 7).map((p, i) => (
                  <div key={p} className="v3-fam-seq__row">
                    <img src={src(p, 140, 110)} alt="" loading="lazy" draggable={false} />
                    <span>{['HOOK', 'STORY', 'CLOSER'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="v3-fam-label">SEQUENCE</p>
          </div>
          <div>
            <div className="v3-phone v3-phone--family">
              <div className="v3-phone__notch" />
              <div className="v3-phone__screen v3-fam-ship">
                <img src={src(PHOTOS[7], 260, 300)} alt="" loading="lazy" draggable={false} />
                <p>low effort, high intention ✨</p>
                <span className="v3-fam-ship__btn">Share to Instagram</span>
              </div>
            </div>
            <p className="v3-fam-label">SHIP</p>
          </div>
        </div>
      </section>

      {/* ── Plans (light section, Apple buy-rail style) ── */}
      <section className="v3-sec v3-sec--light" id="v3plans">
        <h2 className="v3-h2 v3-rise">Why Dumpster is the best<br />place to build your dumps.</h2>
        <div className="v3-plans v3-rise">
          <div className="v3-plan">
            <h3>START FREE</h3>
            <h4>5 dumps on the house.<br />No card, no catch.</h4>
            <p>A 50-photo pool, manual sequencing, and basic captions — everything you need to feel the workflow.</p>
            <img src={src(PHOTOS[5], 400, 260)} alt="" draggable={false} />
            <button className="v3-plan__plus" aria-label="Get started free" onClick={() => navigate('/app')}>+</button>
          </div>
          <div className="v3-plan v3-plan--pro">
            <h3>GO PRO — $5.99/MO</h3>
            <h4>Unlimited everything,<br />plus the AI engine.</h4>
            <p>Unlimited dumps and pool, AI auto-arrange, captions in your voice, Instagram scrub, the playbook, and the iOS app. $34.99/yr in-app.</p>
            <img src={src(PHOTOS[3], 400, 260)} alt="" draggable={false} />
            <button className="v3-plan__plus v3-plan__plus--gold" aria-label="Start Pro" onClick={() => navigate('/app')}>+</button>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="v3-sec">
        <h2 className="v3-h2 v3-rise">Questions? Answers.</h2>
        <div className="v3-faqs v3-rise">
          {FAQS.map((f) => <Faq key={f.q} {...f} />)}
        </div>
      </section>

      {/* ── On and off the grid: horizontal swipe gallery ── */}
      <section className="v3-sec v3-sec--wide v3-offgrid">
        <p className="v3-eyebrow v3-rise">Cloud Sync</p>
        <h2 className="v3-h2 v3-rise">Every vibe.<br />On and off the grid.</h2>
        <div className="v3-swipe v3-rise">
          {[
            { p: PHOTOS[0], t: 'Synced everywhere', d: 'Your style profile, rules, and caption pool follow you — web today, iPhone tomorrow.' },
            { p: PHOTOS[4], t: 'The caption pool', d: 'Every good line you’ve ever saved, ready to deploy on the right photo.' },
            { p: PHOTOS[8], t: 'Vibe-aware swaps', d: 'Swap a photo and it suggests replacements that match the dump’s warmth and mood.' },
            { p: PHOTOS[11], t: 'Undo everything', d: 'Full undo/redo. Experiment ruthlessly — nothing is precious until you post it.' },
            { p: PHOTOS[2], t: 'Your accent color', d: 'Dark mode, light mode, and an accent that matches your brand — not ours.' },
          ].map((c) => (
            <div key={c.t} className="v3-swipe__card">
              <img src={src(c.p, 480, 340)} alt="" loading="lazy" draggable={false} />
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
        <p className="v3-swipe__hint">swipe →</p>
      </section>

      {/* ── Keep exploring links row ── */}
      <section className="v3-sec v3-sec--tight v3-links">
        <h2 className="v3-h2 v3-rise" style={{ fontSize: 'clamp(26px,4vw,40px)' }}>Keep exploring.</h2>
        <div className="v3-links__row v3-rise">
          <button onClick={() => navigate('/app')}>Open the Web App ›</button>
          <button onClick={() => document.getElementById('v3plans')?.scrollIntoView({ behavior: 'smooth' })}>Compare plans ›</button>
          <button onClick={() => navigate('/v2')}>See the showreel draft ›</button>
          <span>iOS app — coming soon</span>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="v3-footer">
        <button className="v3-pill v3-pill--gold v3-pill--lg" onClick={() => navigate('/app')}>Open Dumpster Free</button>
        <p className="v3-legal">1. AI features are in beta and may occasionally have better taste than you. 2. "Unlimited" means unlimited; we checked with legal. 3. Your photos stay yours — always.</p>
        <p>© 2026 Dumpster · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
      </footer>
    </div>
  );
}
