/* Before/After phone videos.

   iPhone Safari does not load video data until play() is called, no
   matter what preload says. So: as soon as #before-after is on screen,
   call play() on both videos right away. Never wait for readyState,
   never pause/seek both to fix drift (seeks stutter on iOS). Small drift
   is corrected by nudging playbackRate; only a large gap (one video
   stalled for a while) gets a single seek, at most every few seconds.

   Both files are exactly 40.000 s / 1200 frames and use native loop, so
   they stay aligned across loops without a seek-to-0 gap.

   If play() is refused (iPhone Low Power Mode blocks autoplay), the
   poster stays up and a play button appears; one tap starts both. */
(function () {
  "use strict";

  var videos = Array.prototype.slice.call(
    document.querySelectorAll(".hero-device .phone-video")
  );
  if (videos.length < 2) return;

  var device = videos[0].closest(".hero-device");
  var section = document.getElementById("before-after") ||
    (videos[0] && videos[0].closest(".compare-demo, section"));

  var reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var THRESHOLD = 0.3;
  var SOFT = 0.08;        /* below this: no correction */
  var HARD = 1.5;         /* above this: one seek on the leader */
  var NUDGE = 0.06;       /* playbackRate offset while catching up */
  var HARD_COOLDOWN = 4000;

  var visible = false;
  var hasPlayed = false;
  var startedAt = 0;
  var userPaused = false;
  var scrubbing = false;
  var blocked = false;
  var loops = [];
  var lastT = videos.map(function () { return 0; });
  var lastHard = 0;
  var watchId = 0;
  var tapBtn = null;
  var held = null;
  var heldAt = 0;

  function prefersReduced() { return reducedMq.matches; }

  function prepare(v) {
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.loop = true;
    v.setAttribute("loop", "");
    /* JS decides when to start (only once the section is on screen). */
    v.autoplay = false;
    v.removeAttribute("autoplay");
    if (v.preload !== "auto") v.preload = "auto";
    if (!visible) { try { v.pause(); } catch (e) {} }
  }
  videos.forEach(prepare);

  function duration() {
    var d = videos.map(function (v) { return v.duration; }).filter(function (x) {
      return x && isFinite(x) && x > 0;
    });
    return d.length ? Math.min.apply(null, d) : 40;
  }

  function currentTime() { return videos[0].currentTime || 0; }

  /* ---- tap-to-play fallback (Low Power Mode, data saver) ---- */
  function ensureTapButton() {
    if (tapBtn || !device) return tapBtn;
    tapBtn = document.createElement("button");
    tapBtn.type = "button";
    tapBtn.className = "hero-tap-play";
    tapBtn.setAttribute("aria-label", "Play both videos");
    tapBtn.innerHTML =
      '<svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">' +
      '<path fill="currentColor" d="M6.4 3.8v12.4L16.2 10 6.4 3.8Z"/></svg>' +
      '<span>Play</span>';
    tapBtn.hidden = true;
    tapBtn.addEventListener("click", function () {
      userPlay();
    });
    device.appendChild(tapBtn);
    return tapBtn;
  }

  function showTap(on) {
    var b = ensureTapButton();
    if (b) b.hidden = !on;
  }

  /* ---- playback ---- */
  function resetRates() {
    videos.forEach(function (v) {
      if (v.playbackRate !== 1) v.playbackRate = 1;
    });
  }

  function playOne(v) {
    v.muted = true;
    var p;
    try { p = v.play(); } catch (e) { return Promise.resolve(false); }
    if (!p || !p.then) return Promise.resolve(true);
    return p.then(function () { return true; }, function (err) {
      if (err && err.name === "NotAllowedError") {
        blocked = true;
        showTap(true);
      }
      return false;
    });
  }

  /* play() must be called synchronously here so a tap counts as a
     user gesture on iOS. */
  function playBoth() {
    var ps = videos.map(playOne);
    return Promise.all(ps).then(function (ok) {
      if (ok.every(Boolean)) {
        blocked = false;
        showTap(false);
      }
      return ok;
    });
  }

  function pauseBoth() {
    held = null;
    videos.forEach(function (v) {
      try { v.pause(); } catch (e) {}
    });
    resetRates();
  }

  function shouldRun() {
    return visible && !userPaused && !scrubbing && !prefersReduced();
  }

  function start() {
    if (!shouldRun()) return;
    if (!hasPlayed) {
      hasPlayed = true;
      startedAt = performance.now();
    }
    startWatch();
    playBoth();
  }

  /* ---- soft sync ---- */
  function wrapDiff(a, b, dur) {
    var d = a - b;
    if (d > dur / 2) d -= dur;
    else if (d < -dur / 2) d += dur;
    return d;
  }

  function syncTick() {
    if (!shouldRun()) return;
    var dur = duration();

    /* Loop bookkeeping (native loop wraps currentTime back to ~0). */
    videos.forEach(function (v, i) {
      var t = v.currentTime || 0;
      if (t + 1 < lastT[i]) {
        loops.push({ i: i, wall: performance.now(), from: lastT[i], to: t });
        if (loops.length > 50) loops.shift();
      }
      lastT[i] = t;
    });

    var a = videos[0], b = videos[1];
    var now = performance.now();

    /* Hold: if one video is still buffering, pause the one that is
       ahead until the other catches up. Pausing is cheap; seeking is
       what stutters on iOS. */
    if (held) {
      var other = held === a ? b : a;
      var gap = wrapDiff(held.currentTime, other.currentTime, dur);
      if ((other.readyState >= 3 && !other.paused && gap <= SOFT) ||
          now - heldAt > 6000) {
        var h = held;
        held = null;
        playOne(h);
      } else if (other.paused && !blocked) {
        playOne(other);
      }
      if (held) return;
    }

    /* Keep trying if something paused us without asking (iOS can do
       this after a stall or when the tab comes back). */
    var paused = videos.filter(function (v) { return v.paused; });
    if (paused.length && !blocked) {
      paused.forEach(playOne);
      return;
    }

    var d = wrapDiff(a.currentTime, b.currentTime, dur); /* >0: a leads */
    var ad = Math.abs(d);
    var leader = d > 0 ? a : b;
    var lagger = d > 0 ? b : a;

    if (lagger.readyState < 3 || lagger.seeking) {
      if (ad > SOFT && leader.readyState >= 3) {
        held = leader;
        heldAt = now;
        resetRates();
        try { leader.pause(); } catch (e) {}
      }
      return;
    }
    if (leader.readyState < 3 || leader.seeking) {
      resetRates();
      return;
    }
    if (ad < SOFT) {
      resetRates();
      return;
    }
    if (ad > HARD && now - lastHard > HARD_COOLDOWN) {
      lastHard = now;
      resetRates();
      /* Move only the leader back to where the lagger is; the lagger
         keeps its buffer and keeps playing. */
      try { leader.currentTime = lagger.currentTime; } catch (e) {}
      return;
    }
    var n = ad > 0.4 ? NUDGE * 2 : NUDGE;
    leader.playbackRate = 1 - n;
    lagger.playbackRate = 1 + n;
  }

  function startWatch() {
    if (watchId) return;
    watchId = setInterval(syncTick, 250);
  }

  function stopWatch() {
    if (watchId) { clearInterval(watchId); watchId = 0; }
  }

  /* ---- visibility ---- */
  function announce(active) {
    window.__heroesActive = active;
    try {
      window.dispatchEvent(new CustomEvent("seelater:heroes", { detail: { active: active } }));
    } catch (e) {}
  }

  function onVisibility(isVisible) {
    if (isVisible === visible) return;
    visible = isVisible;
    announce(isVisible);
    if (isVisible) start();
    else { stopWatch(); pauseBoth(); }
  }

  if (section && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      var r = e && e.isIntersecting ? e.intersectionRatio : 0;
      /* Tall section on a short screen: count it as visible once most of
         the viewport is covered by it. */
      var rb = e && e.rootBounds;
      var cover = rb && rb.height ? e.intersectionRect.height / rb.height : 0;
      onVisibility(r >= THRESHOLD || cover >= 0.6);
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 1] });
    io.observe(section);
  } else {
    visible = true;
    start();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { stopWatch(); pauseBoth(); }
    else if (visible) start();
  });

  if (reducedMq.addEventListener) {
    reducedMq.addEventListener("change", function () {
      if (prefersReduced()) { stopWatch(); pauseBoth(); }
      else start();
    });
  }

  videos.forEach(function (v) {
    /* One reload attempt on a network error. */
    var reloaded = false;
    v.addEventListener("error", function () {
      if (reloaded) return;
      reloaded = true;
      var src = v.getAttribute("src");
      if (!src) return;
      try { v.src = src; v.load(); } catch (e) {}
      if (shouldRun()) setTimeout(function () { playOne(v); }, 300);
    });
  });

  /* ---- API used by loop-scrub.js ---- */
  function seekBoth(t) {
    hasPlayed = true;
    var dur = duration();
    var max = dur > 0.08 ? dur - 0.05 : dur;
    t = Math.max(0, Math.min(max, t));
    held = null;
    resetRates();
    videos.forEach(function (v, i) {
      try { v.currentTime = t; } catch (e) {}
      lastT[i] = t;
    });
    if (window.__hopStory) {
      if (typeof window.__hopStory.follow === "function") window.__hopStory.follow();
      else if (typeof window.__hopStory.sync === "function") window.__hopStory.sync();
    }
    return t;
  }

  function userPlay() {
    userPaused = false;
    hasPlayed = true;
    blocked = false;
    if (!startedAt) startedAt = performance.now();
    startWatch();
    return playBoth();
  }

  function userPause() {
    userPaused = true;
    stopWatch();
    pauseBoth();
  }

  function setScrubbing(on) {
    scrubbing = !!on;
    if (scrubbing) { stopWatch(); pauseBoth(); }
    else if (shouldRun() && hasPlayed) startWatch();
  }

  window.__heroSync = {
    videos: videos,
    loops: loops,
    threshold: THRESHOLD,
    visible: function () { return visible; },
    hasPlayed: function () { return hasPlayed; },
    startedAt: function () { return startedAt; },
    duration: duration,
    currentTime: currentTime,
    seekBoth: seekBoth,
    userPlay: userPlay,
    userPause: userPause,
    setScrubbing: setScrubbing,
    isUserPaused: function () { return userPaused; },
    isScrubbing: function () { return scrubbing; },
    isPlaying: function () {
      return videos.some(function (v) { return !v.paused && !v.ended; });
    },
    snapshot: function () {
      return {
        hasPlayed: hasPlayed,
        visible: visible,
        blocked: blocked,
        reduced: prefersReduced(),
        startedAt: startedAt,
        loopCount: loops.length,
        loops: loops,
        now: performance.now(),
        state: videos.map(function (v) {
          return {
            t: v.currentTime,
            dur: v.duration,
            rate: v.playbackRate,
            paused: v.paused,
            ready: v.readyState,
            loop: v.loop,
            network: v.networkState
          };
        })
      };
    }
  };
})();
