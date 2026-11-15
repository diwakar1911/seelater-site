/* Play the Before/After phone videos together only once #before-after
   is in view. First entry restarts from 0; leaving pauses; returning
   resumes in sync. No autoplay before that. */
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
    v.preload = "auto";
    try { v.pause(); } catch (e) {}
  }

  videos.forEach(prepare);

  function whenSeeked(v) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        v.removeEventListener("seeked", finish);
        resolve();
      }
      v.addEventListener("seeked", finish);
      setTimeout(finish, 250);
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

  function playBoth(force) {
    if (scrubbing) return Promise.resolve();
    if (!force && (userPaused || !visible)) return Promise.resolve();
    if (!force && prefersReduced()) return Promise.resolve();
    return Promise.all(
      videos.map(function (v) {
        var play = v.play();
        return play && play.catch ? play.catch(function () {}) : play;
      })
    );
  }

  function pauseBoth() {
    videos.forEach(function (v) {
      try { v.pause(); } catch (e) {}
    });
  }

  function startTogether() {
    if (ready || hasPlayed || userPaused || scrubbing) return;
    if (prefersReduced() || !visible) return;
    if (!videos.every(function (v) { return v.readyState >= 3; })) return;
    ready = true;
    seekToZero().then(function () {
      if (!visible || prefersReduced()) {
        ready = false;
        return;
      }
      hasPlayed = true;
      startedAt = performance.now();
      return playBoth();
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

  function onVisibility(isVisible) {
    visible = isVisible;
    if (prefersReduced() || userPaused || scrubbing) {
      if (!isVisible) pauseBoth();
      else if (prefersReduced() && !userPaused && !scrubbing) pauseBoth();
      return;
    }
    if (isVisible) {
      if (!hasPlayed) {
        startTogether();
      } else {
        playBoth();
      }
    } else {
      pauseBoth();
    }
  }

  videos.forEach(function (v) {
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
  });

  /* Load via blob so seek-to-0 works even when the server has no Range support. */
  Promise.all(
    videos.map(function (v) {
      var src = v.getAttribute("src") || v.currentSrc;
      if (!src) return Promise.resolve();
      return fetch(src)
        .then(function (r) { return r.blob(); })
        .then(function (blob) {
          return new Promise(function (resolve) {
            var url = URL.createObjectURL(blob);
            function onReady() {
              v.removeEventListener("canplaythrough", onReady);
              resolve();
            }
            v.addEventListener("canplaythrough", onReady);
            v.src = url;
            v.load();
            setTimeout(resolve, 8000);
          });
        })
        .catch(function () {});
    })
  ).then(function () {
    if (visible && !hasPlayed) startTogether();
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
      if (prefersReduced()) pauseBoth();
      else if (visible && !userPaused && !scrubbing) {
        if (!hasPlayed) startTogether();
        else playBoth();
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
    return playBoth(true);
  }

  function userPause() {
    userPaused = true;
    pauseBoth();
  }

  function setScrubbing(on) {
    scrubbing = !!on;
    if (scrubbing) pauseBoth();
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
        state: videos.map(function (v) {
          return {
            t: v.currentTime,
            dur: v.duration,
            paused: v.paused,
            ended: v.ended,
            ready: v.readyState,
            loop: v.loop,
            autoplay: v.autoplay
          };
        })
      };
    }
  };
})();
