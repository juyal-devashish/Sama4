// Markup of the original sama4.online waitlist page, ported once (static, trusted; edit here).
// Behaviour (demo, reveal, menu, waitlist form) lives in Landing.tsx.
// prettier-ignore
export const LANDING_MARKUP = `<nav>
  <div class="nav-left">
    <a href="/" class="nav-logo"><img src="/logo-owl.png" alt="" class="nav-owl logo-light" /><img src="/logo-owl-dark.png" alt="" class="nav-owl logo-dark" /><span>Samā4</span></a>
    <span class="nav-tag">Read News Smarter</span>
  </div>
  <ul class="nav-links">
    <li><a href="#how">How it works</a></li>
    <li><a href="#features">Features</a></li>
  </ul>
  <div class="nav-right">
    <a href="#waitlist" class="btn-primary">Get early access →</a>
    <button class="hamburger" id="hamburger" aria-label="Menu">
      <svg class="icon-open" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      <svg class="icon-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu">
  <a href="#how">How it works</a>
  <a href="#features">Features</a>
  <a href="#waitlist" class="btn-primary">Get early access →</a>
</div>
<section class="hero">
  <div class="hero-content">
    <h1 class="hero-title">News, explained <span class="accent">inline</span>.</h1>
    <p class="hero-sub">
      Stories assume you already know the people, places and ideas in them. Samā4
      highlights what a story takes for granted. Select a highlight and a short
      explanation opens beside the text.
    </p>
    <div class="hero-actions">
      <a href="#waitlist" class="btn-primary">Get early access →</a>
      <a href="#how" class="btn-secondary">See how it works</a>
    </div>
  </div>
  <div class="hero-divider"></div>
  <div class="hero-demo">
    <div class="phone-frame">
      <div class="phone-notch">
        <span class="phone-notch-pill"></span>
      </div>
      <div class="phone-statusbar">
        <span class="phone-statusbar-time">9:41</span>
        <span class="phone-statusbar-icons">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
        </span>
      </div>
      <div class="phone-app-header">
        <span class="phone-app-icon"><img src="/logo-owl.png" alt="" class="app-owl logo-light" /><img src="/logo-owl-dark.png" alt="" class="app-owl logo-dark" /></span>
        <span class="phone-app-name">Samā4</span>
        <span class="phone-app-badge" id="appBadge" style="display:none">Active</span>
      </div>
      <div class="phone-content">
        <div class="demo-source">
          <span class="demo-source-icon">R</span>
          <span class="demo-source-name">Reuters</span>
          <span class="demo-source-date">Sample story</span>
        </div>
        <h2 class="demo-headline">Fed Holds Rates Steady Amid Renewed Stagflation Fears</h2>
        <p class="demo-article" id="demoArticle">
          The <span class="demo-term" data-type="Institution" data-title="Federal Reserve" data-desc="The central banking system of the United States, founded in 1913. Sets monetary policy and the federal funds rate, which influences borrowing costs globally.">Federal Reserve</span> held its benchmark rate unchanged at 4.25–4.50%, as Chair <span class="demo-term" data-type="Person" data-title="Jerome Powell" data-desc="Chair of the Federal Reserve since 2018. Appointed by President Trump, reappointed by President Biden. Leads the FOMC, which sets U.S. monetary policy.">Jerome Powell</span> signaled the committee would remain data-dependent amid growing concerns about <span class="demo-term" data-type="Economic Term" data-title="Stagflation" data-desc="A rare economic condition combining stagnant growth, high unemployment, and persistent inflation simultaneously. First seen during the 1970s oil crisis.">stagflation</span>. The latest <span class="demo-term" data-type="Indicator" data-title="CPI (Consumer Price Index)" data-desc="A measure of the average change in prices paid by urban consumers for a basket of goods and services. The most widely followed inflation indicator in the U.S.">CPI report</span> showed prices rising 3.8% year-over-year, well above the Fed's <span class="demo-term" data-type="Policy" data-title="2% Inflation Target" data-desc="The Federal Reserve's stated goal for annual inflation. Adopted formally in 2012, it serves as the benchmark for monetary policy decisions.">2% target</span>.
        </p>
        <div class="context-card" id="demoContextCard"></div>
      </div>
      <div class="phone-bottombar" id="demoStatus">
        <span class="spinner"></span>
        <span class="check">✓</span>
        <span id="statusText">Scanning article…</span>
      </div>
      <div class="phone-home-indicator"><span></span></div>
    </div>
    <p class="demo-caption">Demo with a sample story, not today&rsquo;s news.</p>
  </div>
</section>
<section class="value-section reveal">
  <div class="value-inner">
    <div>
      <p class="value-label">Capabilities</p>
      <h2 class="value-title">Intelligence that reads the <span class="strike">noise</span> <span class="highlight">signal</span> so you don't.</h2>
      <p class="value-sub">
        Samā4 gives you a personal AI news analyst that aggregates, deduplicates, and connects, delivering briefings, not clutter.
      </p>
      <div class="value-tags">
        <span class="value-tag">Researchers</span>
        <span class="value-tag">Analysts</span>
        <span class="value-tag">Founders</span>
        <span class="value-tag">Journalists</span>
        <span class="value-tag">Curious Minds</span>
      </div>
    </div>
    <div class="value-cards">
      <div class="value-card">
        <div class="value-card-icon">◉</div>
        <h3 class="value-card-title">Every source, one feed</h3>
        <p class="value-card-desc">One feed from 12+ trusted sources, with the same story told twice shown once. No repeats, no missed angles.</p>
      </div>
      <div class="value-card">
        <div class="value-card-icon">◎</div>
        <h3 class="value-card-title">Connections, not just headlines</h3>
        <p class="value-card-desc">See how the people, organizations and events in today&rsquo;s news connect across stories.</p>
      </div>
      <div class="value-card">
        <div class="value-card-icon">◈</div>
        <h3 class="value-card-title">Voice briefings</h3>
        <p class="value-card-desc">Hear your briefing and ask questions out loud, with replies that keep up with you.</p>
      </div>
      <div class="value-card">
        <div class="value-card-icon">⊕</div>
        <h3 class="value-card-title">Answers you can check</h3>
        <p class="value-card-desc">Ask about any story and get an answer grounded in the article and recent reporting.</p>
      </div>
      <p class="tech-note">How it&rsquo;s built: MinHash de-duplication, spaCy and Wikidata entity linking, Pinecone and Redis retrieval, and Anthropic&rsquo;s Claude for explanations.</p>
    </div>
  </div>
</section>
<section class="how reveal" id="how">
  <div class="how-inner">
    <p class="section-label">How It Works</p>
    <div class="steps">
      <div class="step">
        <span class="step-num"></span>
        <div class="step-body">
          <h3>Open any news article</h3>
          <p>Samā4 works as a browser extension. Open any article from any source — Reuters, NYT, The Economist, Substack, or any site.</p>
        </div>
      </div>
      <div class="step">
        <span class="step-num"></span>
        <div class="step-body">
          <h3>AI identifies what you need to know</h3>
          <p>Our model scans the article and surfaces context on every unfamiliar term, person, organization, and event — automatically.</p>
        </div>
      </div>
      <div class="step">
        <span class="step-num"></span>
        <div class="step-body">
          <h3>Read with full understanding</h3>
          <p>Select any highlighted term (click it, or tab to it and press Enter) for a concise explanation. No context-switching, no tab-hopping. Just informed reading.</p>
        </div>
      </div>
    </div>
  </div>
</section>
<section class="features reveal" id="features">
  <div class="features-inner">
    <p class="section-label">Capabilities</p>
    <div class="features-grid">
      <div class="feature-item">
        <div class="feature-icon">⌘</div>
        <h3 class="feature-title">Browser Extension</h3>
        <p class="feature-desc">Works natively in Chrome. One click to activate on any page you're reading.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">◈</div>
        <h3 class="feature-title">Any Publication</h3>
        <p class="feature-desc">Reuters, Bloomberg, NYT, Substack, newsletters — works across all major and independent sources.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">◎</div>
        <h3 class="feature-title">Always Current</h3>
        <p class="feature-desc">Context grounded in up-to-date knowledge, not a static database frozen in time.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">⊕</div>
        <h3 class="feature-title">Privacy-First</h3>
        <p class="feature-desc">Your reading habits stay private. No tracking, no data selling, no surveillance.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">◇</div>
        <h3 class="feature-title">Depth Control</h3>
        <p class="feature-desc">Choose your context level — brief summaries for scanning, deep explanations for learning.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">≋</div>
        <h3 class="feature-title">Multi-Language</h3>
        <p class="feature-desc">Read news in any language and get context in the language you think in.</p>
      </div>
    </div>
  </div>
</section>
<section class="cta-section" id="waitlist">
  <h2 class="cta-title">Get early access to Samā4.</h2>
  <p class="cta-sub">The news layer that thinks, connects, and briefs.</p>
  <label class="waitlist-label" for="waitlistEmail">Your email address</label>
  <form class="waitlist-form" id="waitlistForm" novalidate>
    <input id="waitlistEmail" name="email" type="email" placeholder="name@example.com" required autocomplete="email" aria-describedby="formError formNote" />
    <button type="submit"><span class="btn-spinner"></span>Get early access</button>
  </form>
  <p class="form-error" id="formError" role="alert"></p>
  <p class="form-note" id="formNote">We only use your email to tell you when early access opens. No spam, never sold. <a href="/privacy">How Samā4 handles your data</a></p>
  <p class="form-success" id="formSuccess" role="status">✓ You're on the list. We'll email you when early access opens.</p>
</section>
<footer>
  <span class="footer-logo"><img src="/logo-owl.png" alt="" class="footer-owl logo-light" /><img src="/logo-owl-dark.png" alt="" class="footer-owl logo-dark" /><span>Samā4</span></span>
  <ul class="footer-links">
    <li><a href="/privacy">Privacy</a></li>
    <li><a href="https://sama4.online" target="_blank" rel="noopener noreferrer">sama4.online</a></li>
  </ul>
  <span class="footer-copy">© 2026 Samā4</span>
</footer>`;
