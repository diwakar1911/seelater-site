/* Messages → SeeLater funnel paths. Positions chips from each link bubble
   to the phone so the graphic stays honest on both desktop and mobile. */
(function () {
  const root = document.getElementById("funnel");
  if (!root) return;

  const visual = root.querySelector(".funnel-visual");
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

  function box(el) {
    const a = el.getBoundingClientRect();
    const b = visual.getBoundingClientRect();
    return {
      left: a.left - b.left,
      top: a.top - b.top,
      width: a.width,
      height: a.height,
      right: a.right - b.left,
      bottom: a.bottom - b.top,
      cx: a.left + a.width / 2 - b.left,
      cy: a.top + a.height / 2 - b.top,
    };
  }

  function layout() {
    const w = visual.offsetWidth;
    const h = visual.offsetHeight;
    if (w < 10 || h < 10) return;

    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));

    const stacked = w < 700;
    const imBox = box(im);
    const phoneBox = box(phone);
    if (reducedMq.matches) root.classList.add("is-reduced");
    else root.classList.remove("is-reduced");

    const mid = {
      tt: 0.22,
      ig: 0.5,
      yt: 0.78,
    };
    const endFrac = { tt: 0.33, ig: 0.45, yt: 0.58 };
    const order = ["tt", "ig", "yt"];
    const cardBox = {};

    chips.forEach((chip) => {
      const src = chip.getAttribute("data-src");
      const card = im.querySelector('.funnel-im-link[data-src="' + src + '"]');
      if (!card || !paths[src]) return;
      const c = box(card);
      cardBox[src] = c;
      let d;
      if (!stacked) {
        const x1 = c.right - 1;
        const y1 = c.cy;
        const x2 = phoneBox.left - 2;
        const y2 = phoneBox.top + phoneBox.height * endFrac[src];
        const dx = Math.max(48, (x2 - x1) * 0.48);
        d = "M " + x1 + " " + y1 + " C " + (x1 + dx) + " " + y1 + ", " + (x2 - dx) + " " + y2 + ", " + x2 + " " + y2;
      } else {
        const x1 = imBox.left + imBox.width * mid[src];
        const y1 = imBox.bottom + 2;
        const x2 = phoneBox.cx;
        const y2 = phoneBox.top - 2;
        const midY = y1 + (y2 - y1) * 0.45;
        d = "M " + x1 + " " + y1 + " C " + x1 + " " + midY + ", " + x2 + " " + midY + ", " + x2 + " " + y2;
      }
      paths[src].setAttribute("d", d);
    });

    // Park the three chips in one vertical column on the paths, evenly spaced.
    // They do not travel. left/top is used so equal-sized pills share an x.
    let colX;
    let y0;
    let yStep;
    if (!stacked) {
      colX = imBox.right + (phoneBox.left - imBox.right) / 2;
      const ys = order.map((src) => (cardBox[src] || {}).cy).filter((y) => y != null);
      const yTop = ys.length ? Math.min.apply(null, ys) : imBox.top;
      const yBot = ys.length ? Math.max.apply(null, ys) : imBox.bottom;
      y0 = yTop;
      yStep = order.length > 1 ? (yBot - yTop) / (order.length - 1) : 0;
    } else {
      colX = w / 2;
      const top = imBox.bottom + 22;
      const bot = phoneBox.top - 22;
      y0 = top;
      yStep = order.length > 1 ? (bot - top) / (order.length - 1) : 0;
    }

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

  const ro = new ResizeObserver(() => layout());
  ro.observe(visual);
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

  let running = false;
  let timer = 0;
  let runId = 0;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      clearTimer();
      timer = setTimeout(resolve, ms);
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

  function playFor(i) {
    pages.forEach(function (page, pi) {
      const v = page.querySelector("video");
      if (!v) return;
      muteInline(v);
      // Only the centered card plays. Off-screen and incoming cards stay on a poster.
      if (pi === i && running) {
        const p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else {
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

  let badgeRaf = 0;

  function layoutRail() {
    if (!wrap || !pager || !rail || !badgeTrack) return;
    const wr = wrap.getBoundingClientRect();
    const pr = pager.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    if (wr.width < 8 || pr.height < 8 || railBox.width < 8) return;
    badgeTrack.style.top = (pr.top - railBox.top) + "px";
    badgeTrack.style.height = pr.height + "px";
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

  // Start when the section is on screen. Do not stop on intersection
  // flicker — that was resetting the loop mid-play.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) start();
      });
    }, { threshold: 0.2, rootMargin: "40px" });
    io.observe(root);
  } else {
    start();
  }
  requestAnimationFrame(function () {
    const r = root.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (r.bottom > 40 && r.top < vh - 40) start();
  });
})();
