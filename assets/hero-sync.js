/* Play the Before/After phone videos together only once #before-after
   is in view. First entry restarts from 0; leaving pauses; returning
   resumes in sync. No autoplay before that.

   Load with preload=metadata until the section is visible, then bump
   to auto and stream the files directly (GitHub Pages supports Range).
   Do not blob-fetch the full files on page load — that was stalling
   playback on slow links. Retry play() on stall and resync after a
   buffer if the two clocks drift. */
(function () {
  "use strict";

  var videos = Array.prototype.slice.call(
    document.querySelectorAll(".hero-device .phone-video")
  );
  if (videos.length < 2) return;

  var section = document.getElementById("before-after") ||
    (videos[0] && videos[0].closest(".compare-demo, section"));

  var ready = false;
  var cycling = false;
  var startedAt = 0;
  var hasPlayed = false;
  var visible = false;
  var userPaused = false;
  var scrubbing = false;
  var loops = [];
  var reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var THRESHOLD = 0.45;
  var DRIFT = 0.12;
  var watchId = 0;
  var waiting = videos.map(function () { return false; });
  var reloaded = videos.map(function () { return false; });
  var resyncing = false;

  function prefersReduced() {
    return reducedMq.matches;
  }

  function prepare(v) {
    v.loop = false;
    v.removeAttribute("loop");
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.setAttribute("muted", "");
    v.removeAttribute("autoplay");
    v.autoplay = false;
    /* Keep metadata-only until the section is on screen. */
    v.preload = "metadata";
    try { v.pause(); } catch (e) {}
  }

  videos.forEach(prepare);

  function bumpPreload() {
    videos.forEach(function (v) {
      if (v.preload !== "auto") v.preload = "auto";
    });
  }

  function whenSeeked(v) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        v.removeEventListener("seeked", finish);
        clearTimeout(tid);
        resolve();
      }
      v.addEventListener("seeked", finish);
      var tid = setTimeout(finish, 1200);
    });
  }

  function seekToZero() {
    return Promise.all(
      videos.map(function (v) {
        try { v.pause(); } catch (e) {}
        var p = whenSeeked(v);
        try { v.currentTime = 0; } catch (e) {}
        if (v.currentTime === 0 && v.readyState >= 2) {
          /* already at 0; seeked may not fire */
          return Promise.resolve();
        }
        return p;
      })
    );
  }

  function playOne(v, force, attempt) {
    if (scrubbing || resyncing) return Promise.resolve();
    if (!force && (userPaused || !visible)) return Promise.resolve();
    if (!force && prefersReduced()) return Promise.resolve();
    if (v.seeking) return Promise.resolve();
    var p;
    try { p = v.play(); } catch (e) { return retryPlay(v, force, attempt, e); }
    if (!p || !p.then) return Promise.resolve(p);
    return p.catch(function (err) { return retryPlay(v, force, attempt, err); });
  }

  function retryPlay(v, force, attempt, err) {
    var name = err && err.name;
    if (name === "NotAllowedError" || name === "AbortError") return Promise.resolve();
    if ((attempt || 0) >= 6) return Promise.resolve();
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(playOne(v, force, (attempt || 0) + 1));
      }, 250 * Math.pow(1.4, attempt || 0));
    });
  }

  function playBoth(force) {
    return Promise.all(videos.map(function (v) { return playOne(v, force, 0); }));
  }

  function pauseBoth() {
    videos.forEach(function (v) {
      try { v.pause(); } catch (e) {}
    });
  }

  function waitForData(v, minState, ms) {
    if (v.readyState >= minState) return Promise.resolve();
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        if (v.readyState < minState && Date.now() < until) return;
        done = true;
        ["loadeddata", "canplay", "canplaythrough", "error", "progress"].forEach(function (ev) {
          v.removeEventListener(ev, finish);
        });
        clearTimeout(tid);
        resolve();
      }
      var until = Date.now() + (ms || 8000);
      ["loadeddata", "canplay", "canplaythrough", "error", "progress"].forEach(function (ev) {
        v.addEventListener(ev, finish);
      });
      var tid = setTimeout(finish, ms || 8000);
    });
  }

  function startTogether() {
    if (ready || hasPlayed || userPaused || scrubbing) return;
    if (prefersReduced() || !visible) return;
    ready = true;
    bumpPreload();
    Promise.all(videos.map(function (v) { return waitForData(v, 2, 10000); }))
      .then(function () {
        if (!visible || prefersReduced()) {
          ready = false;
          return;
        }
        return seekToZero();
      })
      .then(function () {
        if (!visible || prefersReduced()) {
          ready = false;
          return;
        }
        hasPlayed = true;
        startedAt = performance.now();
        startWatch();
        return playBoth();
      })
      .catch(function () {
        ready = false;
      });
  }

  function restartTogether(reason) {
    if (!ready || cycling || !visible || prefersReduced() || userPaused || scrubbing) return;
    cycling = true;
    var wall = performance.now();
    var before = videos.map(function (v) {
      return { t: v.currentTime, dur: v.duration, paused: v.paused };
    });
    seekToZero()
      .then(function () {
        if (!visible || prefersReduced()) {
          cycling = false;
          return;
        }
        var afterSeek = videos.map(function (v) { return v.currentTime; });
        return playBoth().then(function () {
          loops.push({
            reason: reason,
            wall: wall,
            driftMs: before.length > 1 ? Math.abs(before[0].t - before[1].t) * 1000 : 0,
            before: before,
            afterSeek: afterSeek,
            t0: videos[0].currentTime,
            t1: videos[1].currentTime
          });
        });
      })
      .then(function () {
        cycling = false;
      });
  }

  function bufferedAround(v, t) {
    try {
      var b = v.buffered;
      for (var i = 0; i < b.length; i++) {
        if (b.start(i) <= t + 0.05 && b.end(i) >= t + 0.25) return true;
      }
    } catch (e) {}
    return false;
  }

  function pickResyncTime(t0, t1) {
    var lead = Math.max(t0, t1);
    var lag = Math.min(t0, t1);
    var bothLead = videos.every(function (v) { return bufferedAround(v, lead); });
    if (bothLead) return lead;
    var bothLag = videos.every(function (v) { return bufferedAround(v, lag); });
    if (bothLag) return lag;
    /* Prefer the time the lagging clip can actually play. */
    return lag;
  }

  function resyncIfDrifted() {
    if (!ready || cycling || resyncing || !visible || prefersReduced() || userPaused || scrubbing) return;
    if (videos.length < 2) return;
    if (videos.some(function (v) { return v.seeking; })) return;
    var t0 = videos[0].currentTime || 0;
    var t1 = videos[1].currentTime || 0;
    if (Math.abs(t0 - t1) < DRIFT) return;
    var dur = duration();
    var max = dur > 0.08 ? dur - 0.05 : dur;
    var t = Math.max(0, Math.min(max, pickResyncTime(t0, t1)));
    resyncing = true;
    Promise.all(
      videos.map(function (v) {
        try { v.pause(); } catch (e) {}
        if (Math.abs((v.currentTime || 0) - t) < 0.04) return Promise.resolve();
        var p = whenSeeked(v);
        try { v.currentTime = t; } catch (e) { return Promise.resolve(); }
        return p;
      })
    ).then(function () {
      resyncing = false;
      if (!visible || prefersReduced() || userPaused || scrubbing) return;
      return playBoth();
    }).catch(function () {
      resyncing = false;
    });
  }

  function startWatch() {
    if (watchId) return;
    watchId = setInterval(function () {
      if (!visible || !hasPlayed || userPaused || scrubbing || prefersReduced() || cycling || resyncing) return;
      videos.forEach(function (v) {
        if (v.paused && !v.ended && !v.seeking) playOne(v, false, 0);
      });
      resyncIfDrifted();
    }, 400);
  }

  function stopWatch() {
    if (watchId) {
      clearInterval(watchId);
      watchId = 0;
    }
  }

  function onVisibility(isVisible) {
    visible = isVisible;
    if (prefersReduced() || userPaused || scrubbing) {
      if (!isVisible) {
        pauseBoth();
        stopWatch();
      } else if (prefersReduced() && !userPaused && !scrubbing) pauseBoth();
      return;
    }
    if (isVisible) {
      bumpPreload();
      if (!hasPlayed) {
        startTogether();
      } else {
        startWatch();
        playBoth();
      }
    } else {
      pauseBoth();
      stopWatch();
    }
  }

  videos.forEach(function (v, i) {
    v.addEventListener("ended", function () { restartTogether("ended"); });
    v.addEventListener("timeupdate", function () {
      if (!ready || cycling || !visible || prefersReduced() || userPaused || scrubbing) return;
      var dur = v.duration;
      if (dur && isFinite(dur) && dur > 0 && v.currentTime >= dur - 0.04) {
        restartTogether("timeupdate");
      }
    });
    v.addEventListener("canplaythrough", function () {
      if (visible && !hasPlayed) startTogether();
    });
    v.addEventListener("loadeddata", function () {
      if (visible && !hasPlayed) startTogether();
    });
    v.addEventListener("canplay", function () {
      if (visible && !hasPlayed) startTogether();
      if (waiting[i] && hasPlayed && visible && !userPaused && !scrubbing) {
        waiting[i] = false;
        playOne(v, false, 0);
        resyncIfDrifted();
      }
    });
    v.addEventListener("waiting", function () { waiting[i] = true; });
    v.addEventListener("stalled", function () {
      waiting[i] = true;
      if (hasPlayed && visible && !userPaused && !scrubbing) playOne(v, false, 0);
    });
    v.addEventListener("playing", function () {
      if (waiting[i]) {
        waiting[i] = false;
        resyncIfDrifted();
      }
    });
    v.addEventListener("error", function () {
      if (reloaded[i]) return;
      reloaded[i] = true;
      var src = v.getAttribute("src") || v.currentSrc;
      if (!src || src.indexOf("blob:") === 0) return;
      try {
        v.src = src;
        v.load();
      } catch (e) {}
      if (visible && hasPlayed && !userPaused && !scrubbing) {
        setTimeout(function () { playOne(v, false, 0); }, 400);
      }
    });
  });

  if (section && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        var entry = entries[0];
        var ratio = entry && entry.isIntersecting ? entry.intersectionRatio : 0;
        onVisibility(ratio >= THRESHOLD);
      },
      { threshold: [0, 0.25, 0.4, 0.45, 0.5, 0.75, 1] }
    );
    io.observe(section);
  } else if (section) {
    /* Rare fallback: treat as visible only when already in view on load. */
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight || 0;
    var visiblePx = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    onVisibility(vh > 0 && visiblePx / Math.max(rect.height, 1) >= THRESHOLD);
  }

  if (reducedMq.addEventListener) {
    reducedMq.addEventListener("change", function () {
      if (prefersReduced()) {
        pauseBoth();
        stopWatch();
      } else if (visible && !userPaused && !scrubbing) {
        if (!hasPlayed) startTogether();
        else {
          startWatch();
          playBoth();
        }
      }
    });
  }

  function duration() {
    var durs = videos.map(function (v) { return v.duration; }).filter(function (d) {
      return d && isFinite(d) && d > 0;
    });
    if (!durs.length) return 40;
    return Math.min.apply(null, durs);
  }

  function currentTime() {
    return videos[0] ? videos[0].currentTime || 0 : 0;
  }

  function seekBoth(t) {
    hasPlayed = true;
    ready = true;
    var dur = duration();
    var max = dur > 0.08 ? dur - 0.05 : dur;
    t = Math.max(0, Math.min(max, t));
    videos.forEach(function (v) {
      try { v.currentTime = t; } catch (e) {}
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
    ready = true;
    startWatch();
    return playBoth(true);
  }

  function userPause() {
    userPaused = true;
    stopWatch();
    pauseBoth();
  }

  function setScrubbing(on) {
    scrubbing = !!on;
    if (scrubbing) {
      stopWatch();
      pauseBoth();
    } else if (visible && hasPlayed && !userPaused && !prefersReduced()) {
      startWatch();
    }
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
        ready: ready,
        cycling: cycling,
        startedAt: startedAt,
        hasPlayed: hasPlayed,
        visible: visible,
        reduced: prefersReduced(),
        loopCount: loops.length,
        loops: loops,
        now: performance.now(),
        state: videos.map(function (v, i) {
          return {
            t: v.currentTime,
            dur: v.duration,
            paused: v.paused,
            ended: v.ended,
            ready: v.readyState,
            loop: v.loop,
            autoplay: v.autoplay,
            waiting: !!waiting[i],
            network: v.networkState
          };
        })
      };
    }
  };
})();
