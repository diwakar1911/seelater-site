/* Before/After phone videos.

   Playback is left to the browser: both <video> tags carry
   autoplay muted playsinline loop preload="auto", which iPhone Safari
   starts on its own when they are on screen and pauses when they are not.
   This script never gates, pauses or seeks on its own. On non-Safari
   desktop browsers only, a small playbackRate nudge lines the two up if
   they drift apart. On iPhone/Safari they simply loop independently
   (both files are exactly 1200 frames, so they stay as aligned as they
   started).

   It only:
   - gives loop-scrub.js its play/pause/seek controls, and
   - shows a Play button if the browser refused autoplay (iPhone Low
     Power Mode), so one tap starts both. */
(function () {
  "use strict";

  var videos = Array.prototype.slice.call(
    document.querySelectorAll(".hero-device .phone-video")
  );
  if (videos.length < 2) return;

  var device = videos[0].closest(".hero-device");
  var section = document.getElementById("before-after") || device;
  var userPaused = false;
  var scrubbing = false;
  var tapBtn = null;
  var loops = [];

  videos.forEach(function (v) {
    /* Belt and braces: iOS needs the property, not just the attribute. */
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    videos.forEach(function (v) { v.autoplay = false; v.removeAttribute("autoplay"); });
    pauseBoth();
  }

  function playBoth() {
    videos.forEach(function (v) {
      v.muted = true;
      var p;
      try { p = v.play(); } catch (e) { return; }
      if (p && p.catch) p.catch(function () {});
    });
  }

  function pauseBoth() {
    videos.forEach(function (v) { try { v.pause(); } catch (e) {} });
  }

  /* ---- Low Power Mode fallback ----
     A blocked autoplay leaves video.paused === true. (A video that is
     merely still loading reports paused === false.) */
  function showTap(on) {
    if (!device) return;
    if (!tapBtn) {
      tapBtn = document.createElement("button");
      tapBtn.type = "button";
      tapBtn.className = "hero-tap-play";
      tapBtn.setAttribute("aria-label", "Play both videos");
      tapBtn.innerHTML =
        '<svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">' +
        '<path fill="currentColor" d="M6.4 3.8v12.4L16.2 10 6.4 3.8Z"/></svg>' +
        "<span>Play</span>";
      tapBtn.addEventListener("click", function () {
        userPaused = false;
        playBoth();
        showTap(false);
      });
      device.appendChild(tapBtn);
    }
    tapBtn.hidden = !on;
  }

  var checkTimer = 0;
  function checkBlocked() {
    checkTimer = 0;
    if (userPaused || scrubbing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (videos.every(function (v) { return v.paused; })) showTap(true);
  }

  videos.forEach(function (v) {
    v.addEventListener("playing", function () { showTap(false); });
  });

  if ("IntersectionObserver" in window && section) {
    new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      if (e && e.isIntersecting && e.intersectionRatio >= 0.3) {
        if (!checkTimer) checkTimer = setTimeout(checkBlocked, 2500);
      } else if (checkTimer) {
        clearTimeout(checkTimer);
        checkTimer = 0;
      }
    }, { threshold: [0, 0.3, 0.6] }).observe(section);
  }

  /* ---- Very light drift correction ----
     Never seeks, pauses or calls play(). If both videos are playing and
     one is ahead, it runs 5% slower and the other 5% faster until they
     line up, then both go back to normal speed. */
  function setRate(v, r) {
    if (Math.abs(v.playbackRate - r) > 0.001) v.playbackRate = r;
  }
  /* Off on Safari and every iPhone/iPad browser (all WebKit): there the
     two videos just loop on their own. Rate changes are not worth the
     risk of a stall on iOS. */
  var appleWebKit = /AppleWebKit/.test(navigator.userAgent) &&
    !/Chrome|Chromium|Edg|OPR/.test(navigator.userAgent) ||
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!appleWebKit) setInterval(function () {
    var a = videos[0], b = videos[1];
    var live = !a.paused && !b.paused && !a.seeking && !b.seeking &&
      a.readyState >= 3 && b.readyState >= 3 && !scrubbing;
    if (!live) { setRate(a, 1); setRate(b, 1); return; }
    var dur = duration();
    var d = a.currentTime - b.currentTime;
    if (d > dur / 2) d -= dur;
    else if (d < -dur / 2) d += dur;
    var ad = Math.abs(d);
    if (ad < 0.06 || ad > 8) { setRate(a, 1); setRate(b, 1); return; }
    if (ad < 0.15 && a.playbackRate === 1 && b.playbackRate === 1) return;
    setRate(d > 0 ? a : b, 0.95);
    setRate(d > 0 ? b : a, 1.05);
  }, 1000);

  /* ---- API used by loop-scrub.js ---- */
  function duration() {
    var d = videos.map(function (v) { return v.duration; }).filter(function (x) {
      return x && isFinite(x) && x > 0;
    });
    return d.length ? Math.min.apply(null, d) : 40;
  }

  function currentTime() { return videos[0].currentTime || 0; }

  function seekBoth(t) {
    var dur = duration();
    var max = dur > 0.08 ? dur - 0.05 : dur;
    t = Math.max(0, Math.min(max, t));
    videos.forEach(function (v) { try { v.currentTime = t; } catch (e) {} });
    if (window.__hopStory) {
      if (typeof window.__hopStory.follow === "function") window.__hopStory.follow();
      else if (typeof window.__hopStory.sync === "function") window.__hopStory.sync();
    }
    return t;
  }

  function userPlay() {
    userPaused = false;
    showTap(false);
    playBoth();
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
    threshold: 0.3,
    visible: function () { return true; },
    hasPlayed: function () { return videos.some(function (v) { return v.currentTime > 0; }); },
    startedAt: function () { return 0; },
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
        userPaused: userPaused,
        state: videos.map(function (v) {
          return { t: v.currentTime, dur: v.duration, paused: v.paused, ready: v.readyState, loop: v.loop, autoplay: v.autoplay };
        })
      };
    }
  };
})();
