/* Messages → SeeLater funnel paths. Positions chips from each link bubble
   to the phone so the graphic stays honest on both desktop and mobile. */
(function () {
  const root = document.getElementById("funnel");
  if (!root) return;

  const visual = root.querySelector(".funnel-visual");
  const stage = root.querySelector(".funnel-stage") || visual.parentElement;
  const svg = root.querySelector(".funnel-svg-live");
  const im = root.querySelector(".funnel-im");
  const phone = root.querySelector(".funnel-device .phone-bezel") || root.querySelector(".funnel-device");
  const chips = Array.from(root.querySelectorAll(".funnel-chip-travel"));
  if (!visual || !svg || !im || !phone || chips.length !== 3) return;

  const NS = "http://www.w3.org/2000/svg";
  const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");

  const marker = document.createElementNS(NS, "marker");
  marker.setAttribute("id", "funnel-arrow-live");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto");
  const tip = document.createElementNS(NS, "path");
  tip.setAttribute("d", "M1 1.2 8.5 5 1 8.8Z");
  tip.setAttribute("fill", "#14582a");
  marker.appendChild(tip);
  const defs = document.createElementNS(NS, "defs");
  defs.appendChild(marker);
  svg.appendChild(defs);

  const paths = {};
  for (const src of ["tt", "ig", "yt"]) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("class", "funnel-path");
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "#1A6B34");
    p.setAttribute("stroke-opacity", "0.55");
    p.setAttribute("stroke-width", "2.2");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("marker-end", "url(#funnel-arrow-live)");
    svg.appendChild(p);
    paths[src] = p;
  }

  function visualScale() {
    const bw = visual.getBoundingClientRect().width;
    return visual.offsetWidth > 0 ? bw / visual.offsetWidth : 1;
  }

  function box(el) {
    const a = el.getBoundingClientRect();
    const b = visual.getBoundingClientRect();
    const s = visualScale() || 1;
    return {
      left: (a.left - b.left) / s,
      top: (a.top - b.top) / s,
      width: a.width / s,
      height: a.height / s,
      right: (a.right - b.left) / s,
      bottom: (a.bottom - b.top) / s,
      cx: (a.left + a.width / 2 - b.left) / s,
      cy: (a.top + a.height / 2 - b.top) / s,
    };
  }

  function resetFit() {
    visual.style.transform = "none";
    visual.style.width = "";
    if (stage && stage !== visual) stage.style.height = "";
  }

  function fit() {
    if (!stage || stage === visual) return 1;
    root.classList.remove("is-badge-below");
    resetFit();
    const available = stage.clientWidth;
    visual.style.width = "max-content";
    const natural = Math.ceil(visual.scrollWidth);
    const scale = Math.max(0.35, Math.min(1, available / Math.max(natural, 1)));
    root.style.setProperty("--funnel-scale", String(scale));
    const h = visual.offsetHeight;
    if (scale < 0.999) {
      const leftover = available - natural * scale;
      visual.style.transformOrigin = "top left";
      visual.style.transform = "translateX(" + (leftover / 2) + "px) scale(" + scale + ")";
      visual.style.width = natural + "px";
      stage.style.height = Math.ceil(h * scale) + "px";
    } else {
      visual.style.width = "";
      visual.style.transform = "none";
      stage.style.height = "";
    }
    return scale;
  }

  let fitting = false;

  function layout() {
    if (fitting) return;
    fitting = true;
    try {
      fit();
    } finally {
      fitting = false;
    }
    const w = visual.offsetWidth;
    const h = visual.offsetHeight;
    if (w < 10 || h < 10) return;

    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));

    const imBox = box(im);
    const phoneBox = box(phone);
    if (reducedMq.matches) root.classList.add("is-reduced");
    else root.classList.remove("is-reduced");

    const endFrac = { tt: 0.33, ig: 0.45, yt: 0.58 };
    const order = ["tt", "ig", "yt"];
    const cardBox = {};

    chips.forEach((chip) => {
      const src = chip.getAttribute("data-src");
      const card = im.querySelector('.funnel-im-link[data-src="' + src + '"]');
      if (!card || !paths[src]) return;
      const c = box(card);
      cardBox[src] = c;
      const x1 = c.right - 1;
      const y1 = c.cy;
      const x2 = phoneBox.left - 2;
      const y2 = phoneBox.top + phoneBox.height * endFrac[src];
      const dx = Math.max(36, (x2 - x1) * 0.48);
      const d = "M " + x1 + " " + y1 + " C " + (x1 + dx) + " " + y1 + ", " + (x2 - dx) + " " + y2 + ", " + x2 + " " + y2;
      paths[src].setAttribute("d", d);
    });

    // Park the three chips in one vertical column on the paths, evenly spaced.
    // They do not travel. left/top is used so equal-sized pills share an x.
    const midX = imBox.right + (phoneBox.left - imBox.right) / 2;
    const chipW = (chips[0] && chips[0].offsetWidth) || 132;
    // Keep the pills on the paths and off the phone's left edge.
    const colX = Math.min(midX, phoneBox.left - chipW / 2 - 8);
    const ys = order.map((src) => (cardBox[src] || {}).cy).filter((y) => y != null);
    const yTop = ys.length ? Math.min.apply(null, ys) : imBox.top;
    const yBotRaw = ys.length ? Math.max.apply(null, ys) : imBox.bottom;
    const y0 = Math.max(yTop, phoneBox.top + 20);
    const yBot = Math.min(yBotRaw, phoneBox.bottom - 20);
    const yStep = order.length > 1 ? (Math.max(yBot, y0) - y0) / (order.length - 1) : 0;

    chips.forEach((chip) => {
      const src = chip.getAttribute("data-src");
      const i = order.indexOf(src);
      if (i < 0) return;
      chip.style.offsetPath = "none";
      chip.style.left = colX + "px";
      chip.style.top = y0 + yStep * i + "px";
      chip.style.transform = "translate(-50%, -50%)";
    });
  }

  window.__funnelLayout = layout;
  window.__funnelFit = fit;

  const ro = new ResizeObserver(() => layout());
  ro.observe(visual);
  if (stage && stage !== visual) ro.observe(stage);
  window.addEventListener("resize", layout);
  if (document.readyState === "complete") layout();
  else window.addEventListener("load", layout, { once: true });
  reducedMq.addEventListener("change", layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();

/* SeeLater feed: vertical snap, playing clips, ticking watched count.
   Runs in a normal browser via timers (not only in headless, and not
   only as a CSS animation that some environments skip). */
(function () {
  const root = document.getElementById("funnel");
  if (!root) return;
  const track = root.querySelector(".funnel-track");
  const pages = Array.from(root.querySelectorAll(".funnel-page"));
  const countEl = root.querySelector(".funnel-sl-count b");
  const wrap = root.querySelector(".funnel-phone-wrap");
  const pager = root.querySelector(".funnel-pager");
  const rail = root.querySelector(".funnel-badge-rail");
  const badgeTrack = root.querySelector(".funnel-badge-track");
  const badges = Array.from(root.querySelectorAll(".funnel-out-badge"));
  if (!track || pages.length < 4) return;

  const STEP = 100;
  const HOLD = 2700;
  const SLIDE = 520;
  const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
  const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarseMq = window.matchMedia("(pointer: coarse)");

  let running = false;
  let timer = 0;
  let runId = 0;
  let onScreen = false;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      clearTimer();
      let remaining = ms;
      let last = performance.now();
      const tick = function () {
        if (!running) { resolve(); return; }
        const now = performance.now();
        if (onScreen) remaining -= (now - last);
        last = now;
        if (remaining <= 0) { resolve(); return; }
        timer = setTimeout(tick, onScreen ? Math.max(remaining, 16) : 200);
      };
      timer = setTimeout(tick, ms);
    });
  }

  function setWatched(n) {
    if (countEl) countEl.textContent = n + "/3";
    pages.forEach(function (page, pi) {
      const pill = page.querySelector(".funnel-sl-watch");
      if (!pill) return;
      const srcIndex = pi % 3;
      const done = n > srcIndex;
      pill.classList.toggle("is-yes", done);
      const label = pill.childNodes[pill.childNodes.length - 1];
      if (label && label.nodeType === 3) {
        label.textContent = done ? " Watched" : " Unwatched";
      }
    });
  }

  function pauseToPoster(v) {
    try { v.pause(); } catch (e) {}
    const go = function () {
      try { v.currentTime = 0; } catch (e) {}
    };
    if (v.readyState >= 1) go();
    else v.addEventListener("loadedmetadata", go, { once: true });
  }

  function muteInline(v) {
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
  }

  let liveIndex = 0;

  /* On phones, let the Before/After heroes have the video decoder and
     the network while they are on screen (hero-sync.js sets this). */
  function heroesHaveFocus() {
    return !!window.__heroesActive && coarseMq.matches;
  }

  function tryPlay(v, attempt) {
    muteInline(v);
    if (heroesHaveFocus()) { try { v.pause(); } catch (e) {} return; }
    v.preload = "auto";
    let p;
    try { p = v.play(); } catch (e) { p = Promise.reject(e); }
    if (p && p.catch) {
      p.catch(function (err) {
        const name = err && err.name;
        if (name === "NotAllowedError" || name === "AbortError") return;
        if (!running || !onScreen || (attempt || 0) >= 6) return;
        setTimeout(function () { tryPlay(v, (attempt || 0) + 1); }, 250 * ((attempt || 0) + 1));
      });
    }
  }

  function playFor(i) {
    liveIndex = i;
    pages.forEach(function (page, pi) {
      const v = page.querySelector("video");
      if (!v) return;
      muteInline(v);
      // Only the centered card plays. Off-screen and incoming cards stay on a poster.
      if (pi === i && running && onScreen) {
        tryPlay(v, 0);
      } else {
        v.preload = "metadata";
        pauseToPoster(v);
      }
    });
  }

  function freezeCurrent(i) {
    const page = pages[i];
    const v = page && page.querySelector("video");
    if (!v) return;
    muteInline(v);
    try { v.pause(); } catch (e) {}
  }

  pages.forEach(function (page) {
    const v = page.querySelector("video");
    if (!v) return;
    muteInline(v);
    v.preload = "metadata";
    v.addEventListener("stalled", function () {
      if (!running) return;
      const cur = pages[liveIndex] && pages[liveIndex].querySelector("video");
      if (cur === v) tryPlay(v, 0);
    });
    v.addEventListener("canplay", function () {
      if (!running) return;
      const cur = pages[liveIndex] && pages[liveIndex].querySelector("video");
      if (cur === v && v.paused) tryPlay(v, 0);
    });
  });

  let badgeRaf = 0;

  function layoutScale() {
    const visual = root.querySelector(".funnel-visual");
    if (!visual || visual.offsetWidth < 1) return 1;
    return visual.getBoundingClientRect().width / visual.offsetWidth;
  }

  function layoutRail() {
    if (!wrap || !pager || !rail || !badgeTrack) return;
    const wr = wrap.getBoundingClientRect();
    const pr = pager.getBoundingClientRect();
    if (wr.width < 8 || pr.height < 8) return;
    const s = layoutScale() || 1;
    if (getComputedStyle(rail).position === "absolute") {
      // Overlay rail: size it to the feed pager so pills sit beside the card.
      rail.style.top = ((pr.top - wr.top) / s) + "px";
      rail.style.height = (pr.height / s) + "px";
      badgeTrack.style.top = "0px";
      badgeTrack.style.height = "100%";
    } else {
      const railBox = rail.getBoundingClientRect();
      if (railBox.width < 8) return;
      badgeTrack.style.top = ((pr.top - railBox.top) / s) + "px";
      badgeTrack.style.height = (pr.height / s) + "px";
    }
    paintBadges();
  }

  const phoneFrame = root.querySelector(".funnel-device .phone-bezel")
    || root.querySelector(".funnel-device .phone-body")
    || root.querySelector(".funnel-device");

  function paintBadges() {
    if (!badges.length) return;
    const bandEl = phoneFrame || badgeTrack;
    if (!bandEl) return;
    const band = bandEl.getBoundingClientRect();
    if (band.height < 8) return;
    badges.forEach(function (badge) {
      const r = badge.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      const rel = (cy - band.top) / band.height;
      // Fully visible beside the card; fade/scale out by the time the
      // badge reaches the top of the phone, and fade in from below.
      let t = 1;
      if (rel < 0.20) t = Math.max(0, Math.min(1, (rel - 0.02) / 0.18));
      else if (rel > 0.82) t = Math.max(0, Math.min(1, (1.10 - rel) / 0.28));
      badge.style.opacity = String(t);
      badge.style.transform = "scale(" + (0.72 + 0.28 * t) + ")";
    });
  }

  function stopBadgePaint() {
    if (badgeRaf) {
      cancelAnimationFrame(badgeRaf);
      badgeRaf = 0;
    }
  }

  function startBadgePaint(ms) {
    stopBadgePaint();
    const end = performance.now() + ms;
    const tick = function (now) {
      paintBadges();
      if (now < end) badgeRaf = requestAnimationFrame(tick);
      else badgeRaf = 0;
    };
    badgeRaf = requestAnimationFrame(tick);
  }

  function moveTrack(el, i, animate) {
    if (!el) return;
    el.style.transition = animate
      ? "transform " + SLIDE + "ms " + EASE
      : "none";
    el.style.transform = "translateY(-" + STEP * i + "%)";
  }

  function show(i, animate, watched) {
    moveTrack(track, i, animate);
    moveTrack(badgeTrack, i, animate);
    if (typeof watched === "number") setWatched(watched);
    layoutRail();
    if (animate) startBadgePaint(SLIDE + 60);
    else paintBadges();
  }

  function snapshot() {
    running = false;
    runId += 1;
    clearTimer();
    setWatched(0);
    // Peek the next card for stills; every clip is paused. Badge track matches.
    stopBadgePaint();
    track.style.transition = "none";
    track.style.transform = "translateY(0)";
    if (badgeTrack) {
      badgeTrack.style.transition = "none";
      badgeTrack.style.transform = "translateY(0)";
    }
    pages.forEach(function (page, pi) {
      const v = page.querySelector("video");
      if (!v) return;
      try { v.pause(); } catch (e) {}
      const seek = function () {
        try {
          v.currentTime = pi === 0 ? Math.min(0.8, (v.duration || 1) * 0.2) : 0;
        } catch (e) {}
      };
      if (v.readyState >= 1) seek();
      else v.addEventListener("loadedmetadata", seek, { once: true });
    });
    requestAnimationFrame(function () {
      layoutRail();
      paintBadges();
    });
  }

  async function run(id) {
    // TikTok → Shorts → Reels → TikTok clone, then an instant jump back to 0.
    let i = 0;
    show(0, false, 0);
    playFor(0);
    while (running && id === runId) {
      await wait(HOLD);
      if (!running || id !== runId) break;
      // Freeze the outgoing clip in place (don't rewind while it's still on screen).
      // The incoming card stays on its poster until the swipe lands.
      freezeCurrent(i);
      const next = i + 1;
      show(next, true, next);
      await wait(SLIDE);
      if (!running || id !== runId) break;
      if (next >= 3) {
        show(0, false, 0);
        playFor(0);
        i = 0;
      } else {
        playFor(next);
        i = next;
      }
    }
  }

  function start() {
    if (reducedMq.matches || root.classList.contains("is-shot")) {
      snapshot();
      return;
    }
    if (running) return;
    running = true;
    runId += 1;
    clearTimer();
    run(runId);
  }

  function reset() {
    stop();
    start();
  }

  function stop() {
    running = false;
    runId += 1;
    clearTimer();
  }

  window.__funnelFeed = { start: start, stop: stop, snapshot: snapshot, reset: reset };

  const prevLayout = window.__funnelLayout;
  window.__funnelLayout = function () {
    if (typeof prevLayout === "function") prevLayout();
    layoutRail();
  };
  if (typeof ResizeObserver !== "undefined" && wrap) {
    const bro = new ResizeObserver(function () { layoutRail(); });
    bro.observe(wrap);
    if (pager) bro.observe(pager);
  }
  window.addEventListener("resize", layoutRail);

  if (root.classList.contains("is-shot") || reducedMq.matches) {
    snapshot();
    return;
  }

  function pauseOffscreen() {
    pages.forEach(function (page) {
      const v = page.querySelector("video");
      if (!v) return;
      try { v.pause(); } catch (e) {}
      v.preload = "metadata";
    });
  }

  window.addEventListener("seelater:heroes", function () {
    if (heroesHaveFocus()) {
      const cur = pages[liveIndex] && pages[liveIndex].querySelector("video");
      if (cur) { try { cur.pause(); } catch (e) {} }
    } else if (running && onScreen) {
      playFor(liveIndex);
    }
  });

  // Start when the section is on screen. Leaving it pauses clips so they
  // stop competing for bandwidth, but does not reset the loop.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) {
          onScreen = true;
          if (running) playFor(liveIndex);
          else start();
        } else {
          onScreen = false;
          pauseOffscreen();
        }
      });
    }, { threshold: 0.2, rootMargin: "40px" });
    io.observe(root);
  } else {
    onScreen = true;
    start();
  }
  requestAnimationFrame(function () {
    const r = root.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (r.bottom > 40 && r.top < vh - 40) {
      onScreen = true;
      start();
    }
  });
})();
