(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeSine = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Book geometry (matches the CSS custom properties on .book)
  const W = 440, H = 540, T = 64;
  const leaves = $$('.leaf');
  const N = leaves.length;              // N leaves → spreads 0 (closed) … N
  const DZ = T / N;

  const stage = $('#stage');
  const scene = $('#scene');
  const book = $('#book');
  const heroCopy = $('#heroCopy');
  const panel = $('.panel');
  const spreadShadow = $('#spreadShadow');
  const spine = $('#spine');
  const edgeR = $('#edgeR'), edgeL = $('#edgeL'), topR = $('#topR'), topL = $('#topL');

  /* ── Layout ───────────────────────────────────────────────── */
  let vw, vh, mobile, sOpen, sClosed, closedTx, closedTy;
  function layout() {
    vw = innerWidth; vh = innerHeight; mobile = vw < 900;
    sOpen = Math.min((vw * 0.94) / (2 * W), (vh * 0.92) / H);   // flat spread with white space around
    if (mobile) {
      sClosed = Math.min((vh * 0.4) / H, (vw * 0.62) / W);
      closedTx = -(W / 2) * sClosed * 0.85;
      closedTy = vh * 0.18;
    } else {
      sClosed = Math.min((vh * 0.9) / H, (vw * 0.4) / W);
      closedTx = vw * 0.22 - (W / 2) * sClosed * 0.93;   // book owns the right half
      closedTy = 0;
    }
  }
  layout();
  addEventListener('resize', layout);

  /* ── State: which spread is showing ───────────────────────── */
  let target = 0, pos = 0;
  const goTo = (k) => { target = clamp(k, 0, N); };

  let tiltX = 0, tiltY = 0, tx = 0, ty = 0;
  scene.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    tx = (e.clientX / vw - 0.5) * 2;
    ty = (e.clientY / vh - 0.5) * 2;
  });
  scene.addEventListener('pointerleave', () => { tx = 0; ty = 0; });

  let down = null;
  scene.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  scene.addEventListener('pointerup', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    down = null;
    if (e.target.closest('a, button, input')) return;
    const now = Math.round(target);
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (now > 0) goTo(now + (dx < 0 ? 1 : -1));
      else if (dx < 0) goTo(1);
      return;
    }
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) return;
    if (now === 0) { goTo(1); return; }
    const r = book.getBoundingClientRect();
    goTo(e.clientX > r.left + r.width / 2 ? now + 1 : now - 1);
  });
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    const now = Math.round(target);
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { if (now < N) { e.preventDefault(); goTo(now + 1); } }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(now - 1); }
    if (e.key === 'Escape') goTo(0);
  });
  // keep the book keyboard reachable
  scene.tabIndex = 0;
  scene.setAttribute('role', 'button');
  scene.setAttribute('aria-label', 'Bangalore Coffee Shops — click to open the book');

  /* ── Page curl ─────────────────────────────────────────────── */
  const K = 10;
  function buildCurl(leaf) {
    const front = $(':scope > .face.front', leaf), back = $(':scope > .face.back', leaf);
    let curl = leaf._curl;
    if (!curl) { curl = document.createElement('div'); curl.className = 'curl'; curl.setAttribute('aria-hidden', 'true'); leaf.appendChild(curl); leaf._curl = curl; }
    curl.textContent = '';
    const pw = leaf.offsetWidth, ph = leaf.offsetHeight, sw = pw / K;
    const clone = (face, left) => {
      const c = face.cloneNode(true);
      c.removeAttribute('id'); c.setAttribute('inert', '');
      $$('[id]', c).forEach((n) => n.removeAttribute('id'));
      $$('[for]', c).forEach((n) => n.removeAttribute('for'));
      c.style.left = `${left}px`; c.style.width = `${pw}px`; c.style.height = `${ph}px`;
      return c;
    };
    const strips = [];
    let parent = curl;
    for (let i = 0; i < K; i++) {
      const s = document.createElement('div');
      s.className = 'strip';
      s.style.width = `${sw + 0.7}px`;
      s.style.left = i ? `${sw}px` : '0';
      const fc = document.createElement('div'); fc.className = 'fc';
      const bc = document.createElement('div'); bc.className = 'bc';
      fc.appendChild(clone(front, -i * sw));
      bc.appendChild(clone(back, -(pw - (i + 1) * sw)));
      s.append(fc, bc);
      parent.appendChild(s);
      strips.push(s);
      parent = s;
    }
    leaf._strips = strips;
  }

  /* ── Render loop ───────────────────────────────────────────── */
  let last = performance.now();
  let openState = false;

  function render(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // flipping several pages at once (e.g. closing) speeds up so it never drags
    const speed = 5.5 + Math.min(4, Math.abs(target - pos));
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * speed);
    pos += (target - pos) * k;
    if (Math.abs(target - pos) < 0.0005) pos = target;
    tiltX += (ty * -3 - tiltX) * 0.06;
    tiltY += (tx * 5 - tiltY) * 0.06;

    const open = easeSine(clamp(pos));
    const s = lerp(sClosed, sOpen, open);
    const rx = 0;
    const ry = lerp(16, 0, open);
    book.style.transform =
      `translate3d(${lerp(closedTx, 0, open)}px, ${lerp(closedTy, 0, open)}px, 0) scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg)`;

    leaves.forEach((el, i) => {
      const e = easeSine(clamp(pos - i));
      const z = lerp(T / 2 - i * DZ, -T / 2 + i * DZ, e);
      el.style.transform = `translateZ(${z}px) rotateY(${-180 * e}deg)`;
      el.style.setProperty('--shade', Math.sin(Math.PI * e).toFixed(3));
      const moving = i > 0 && e > 0.002 && e < 0.998;     // hard cover stays rigid
      if (moving !== el.classList.contains('moving')) {
        if (moving) buildCurl(el);
        el.classList.toggle('moving', moving);
      }
      if (moving) {
        // trailing edge lags early in the turn, leads as the page lays down
        const lead = Math.sin(Math.PI * e) * (6 * (2 * e - 1) + 3);
        const rot = `rotateY(${-lead}deg)`;
        el._strips.forEach((s, n) => { if (n) s.style.transform = rot; });
      }
    });

    // page-block edges grow/shrink as leaves move from the right stack to the left
    const base = Math.min(Math.floor(pos), N);
    const frac = pos - base;
    const landed = base + smooth(0.9, 1, frac);
    const lifted = base + smooth(0, 0.1, frac);
    const zTop = T / 2 - DZ * Math.min(lifted, N);
    const rightDepth = Math.max(0.01, zTop + T / 2);
    const leftDepth = Math.max(0.01, DZ * Math.min(landed, N));
    const edgeFade = 1 - smooth(0.6, 1, pos);               // flat spread has no visible edges
    edgeR.style.width = `${rightDepth}px`;
    edgeR.style.transform = `translateZ(${zTop}px) rotateY(90deg)`;
    topR.style.height = `${rightDepth}px`;
    topR.style.transform = `translateZ(${-T / 2}px) rotateX(90deg)`;
    edgeL.style.width = `${leftDepth}px`;
    edgeL.style.transform = `translateZ(${-T / 2}px) rotateY(-90deg)`;
    topL.style.height = `${leftDepth}px`;
    topL.style.transform = `translateZ(${-T / 2}px) rotateX(90deg)`;
    edgeR.style.opacity = topR.style.opacity = rightDepth > 1 ? edgeFade : 0;
    edgeL.style.opacity = topL.style.opacity = leftDepth > 1 ? edgeFade : 0;

    spine.style.opacity = (1 - smooth(0, 0.5, pos)).toFixed(3);


    const hc = 1 - smooth(0, 0.45, pos);
    heroCopy.style.opacity = hc.toFixed(3);
    heroCopy.style.transform = mobile
      ? `translateY(${(1 - hc) * -40}px)`
      : `translateX(${(1 - hc) * -70}px)`;
    heroCopy.style.pointerEvents = hc < 0.25 ? 'none' : 'auto';
    heroCopy.style.visibility = hc <= 0.001 ? 'hidden' : 'visible';
    panel.style.opacity = hc.toFixed(3);
    spreadShadow.style.left = `${-W * open}px`;
    spreadShadow.style.width = `${W * (1 + open)}px`;

    const isOpen = target > 0;
    if (isOpen !== openState) {
      openState = isOpen;
            scene.style.cursor = isOpen ? 'default' : 'pointer';
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  /* ── Waitlist forms ────────────────────────────────────────── */
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const forms = $$('.wl-form');

  function showDone(form, already) {
    form.classList.add('is-done');
    form.innerHTML = `<div class="wl-done" role="status">${CHECK}<span>${already
      ? 'You’re already on the list — we’ll be in touch.'
      : 'You’re on the list. We’ll email you when pre-orders open.'}</span></div>`;
  }

  forms.forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('input', form);
      const msg = $('.wl-msg', form);
      const email = input.value.trim();
      msg.textContent = '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        msg.textContent = 'Please enter a valid email address.';
        input.focus();
        return;
      }
      if (!window.WAITLIST_ENDPOINT) {
        msg.textContent = 'The waitlist isn’t connected yet — please check back soon.';
        return;
      }
      form.classList.add('is-busy');
      try {
        const res = await fetch(window.WAITLIST_ENDPOINT || '/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email, source: form.dataset.source }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
        forms.forEach((f) => showDone(f, data.already));
      } catch (err) {
        msg.textContent = err.message;
        form.classList.remove('is-busy');
      }
    });
  });
})();
