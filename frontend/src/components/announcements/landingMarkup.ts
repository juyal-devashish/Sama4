// Markup of the original sama4.online waitlist page, ported once (static, trusted; edit here).
// Behaviour (demo, reveal, waitlist form) lives in Landing.tsx; its in-app bar is the page's nav.
// prettier-ignore
export const LANDING_MARKUP = `<section class="hero">
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
          <span class="demo-source-icon">S</span>
          <span class="demo-source-name">Sample Wire</span>
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
      <p class="value-label">Why Samā4</p>
      <h2 class="value-title">Understand the story without opening five more tabs.</h2>
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
        <p class="value-card-desc">One feed from more than 20 outlets, with the same story told twice shown once.</p>
      </div>
      <div class="value-card">
        <div class="value-card-icon">◎</div>
        <h3 class="value-card-title">Connections, not just headlines</h3>
        <p class="value-card-desc">See how the people, organizations and events in today&rsquo;s news connect across stories.</p>
      </div>
      <div class="value-card">
        <div class="value-card-icon">◈</div>
        <h3 class="value-card-title">Written for newcomers</h3>
        <p class="value-card-desc">Explanations assume no background, so you can follow a story you joined late.</p>
      </div>
      <div class="value-card">
        <div class="value-card-icon">⊕</div>
        <h3 class="value-card-title">Answers you can check</h3>
        <p class="value-card-desc">Ask about any story and get an answer grounded in the article and recent reporting.</p>
      </div>
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
          <h3>Open today&rsquo;s edition</h3>
          <p>Each night Samā4 reads the day&rsquo;s news from more than 20 outlets, picks the most consequential stories and writes a short, neutral summary of each.</p>
        </div>
      </div>
      <div class="step">
        <span class="step-num"></span>
        <div class="step-body">
          <h3>See what the story assumes</h3>
          <p>People, places, organizations and ideas a reader might not know are highlighted in the summary and in the opening of the original article.</p>
        </div>
      </div>
      <div class="step">
        <span class="step-num"></span>
        <div class="step-body">
          <h3>Select a highlight to understand it</h3>
          <p>Click a highlighted term, or tab to it and press Enter, for a short explanation beside the text. Ask a follow-up question, or open the original story at its publisher.</p>
        </div>
      </div>
    </div>
  </div>
</section>
<section class="reader-shot reveal">
  <div class="reader-shot-inner">
    <p class="section-label">See it working</p>
    <figure>
      <img src="/images/reader-explained.webp" width="1400" height="925" loading="lazy" decoding="async" alt="The Samā4 reader: a story summary with names and ideas highlighted, and beside it a short explanation of the highlighted term “the Detroit Pistons”, with related terms and other stories that mention it." />
      <figcaption>A real story in the reader, with one highlighted term explained in the margin. <a href="/">Open today&rsquo;s stories</a></figcaption>
    </figure>
  </div>
</section>
<section class="features reveal" id="features">
  <div class="features-inner">
    <p class="section-label">Available now</p>
    <div class="features-grid">
      <div class="feature-item">
        <div class="feature-icon">◉</div>
        <h3 class="feature-title">Explanations beside the story</h3>
        <p class="feature-desc">Select a highlighted name, place or idea for a short explanation, written from Wikipedia and the story itself.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">⊕</div>
        <h3 class="feature-title">Follow-up questions</h3>
        <p class="feature-desc">Ask about any highlighted term and get an answer grounded in the story.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">◎</div>
        <h3 class="feature-title">How terms connect</h3>
        <p class="feature-desc">See which people, organizations and places a term is tied to, and other stories that mention it.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">◈</div>
        <h3 class="feature-title">A nightly edition</h3>
        <p class="feature-desc">Each night Samā4 picks the day&rsquo;s most consequential stories from more than 20 outlets, with duplicates removed.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">≋</div>
        <h3 class="feature-title">References for every story</h3>
        <p class="feature-desc">One page listing everyone and everything a story names, each with its explanation.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">◇</div>
        <h3 class="feature-title">No tracking</h3>
        <p class="feature-desc">No analytics, advertising scripts or tracking cookies. Saved stories, your theme and your topics stay in your browser. <a href="/privacy">Read the privacy page</a></p>
      </div>
    </div>
    <p class="section-label features-planned-label">Planned &middot; not available yet</p>
    <div class="features-grid features-planned">
      <div class="feature-item">
        <div class="feature-icon">⌘</div>
        <h3 class="feature-title">Browser extension</h3>
        <p class="feature-desc">The same explanations on articles you read anywhere, not just in Samā4&rsquo;s own edition.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">◈</div>
        <h3 class="feature-title">Voice briefings</h3>
        <p class="feature-desc">Hear the day&rsquo;s stories and ask questions out loud.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">◇</div>
        <h3 class="feature-title">Depth control</h3>
        <p class="feature-desc">Choose a one-line gloss for scanning or a deeper explanation for learning.</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">≋</div>
        <h3 class="feature-title">Multi-language</h3>
        <p class="feature-desc">Read a story in one language and get explanations in the language you think in.</p>
      </div>
    </div>
  </div>
</section>
<section class="cta-section" id="waitlist">
  <h2 class="cta-title">Get early access to Samā4.</h2>
  <p class="cta-sub">
    The reader is free and open to everyone now. Early access means trying the
    planned features first, starting with the browser extension and voice briefings.
  </p>
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
    <li><a href="/about">About</a></li>
    <li><a href="/privacy">Privacy</a></li>
    <li><a href="https://sama4.online" target="_blank" rel="noopener noreferrer">sama4.online</a></li>
  </ul>
  <span class="footer-copy">© 2026 Samā4</span>
</footer>`;
