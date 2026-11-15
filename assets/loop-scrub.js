/* Scrub both Before/After phone videos in sync, with hop-story following. */
(function () {
  "use strict";

  var section = document.getElementById("before-after");
  var root = document.getElementById("loopScrub");
  if (!section || !root) return;

  var range = document.getElementById("loopScrubRange");
  var fill = document.getElementById("loopScrubFill");
  var playBtn = document.getElementById("loopScrubPlay");
  var playIc = playBtn ? playBtn.querySelector(".loop-scrub-ic-play") : null;
  var pauseIc = playBtn ? playBtn.querySelector(".loop-scrub-ic-pause") : null;
  var ticks = Array.prototype.slice.call(root.querySelectorAll(".loop-scrub-tick"));
  var timeEl = document.getElementById("loopScrubTime");
  var steps = Array.prototype.slice.call(section.querySelectorAll(".hop-step"));

  var wasPlaying = false;
  var dragging = false;
  var raf = 0;

  function sync() {
    return window.__heroSync || null;
  }

  function duration() {
    var hs = sync();
    var d = hs && hs.duration ? hs.duration() : 40;
    return d && isFinite(d) && d > 0 ? d : 40;
  }

  function current() {
    var hs = sync();
    return hs && hs.currentTime ? hs.currentTime() : (range ? parseFloat(range.value) || 0 : 0);
  }

  function isPlaying() {
    var hs = sync();
    return hs && hs.isPlaying ? hs.isPlaying() : false;
  }

  function formatTime(t) {
    var s = Math.max(0, Math.round(t));
    return s + (s === 1 ? " second" : " seconds");
  }

  function formatClock(t) {
    var s = Math.max(0, Math.floor(t + 0.0001));
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function stepLabel(t) {
    var match = null;
    steps.forEach(function (step) {
      if (!step.closest(".hop-story-before")) return;
      var start = parseFloat(step.getAttribute("data-start"));
      var end = parseFloat(step.getAttribute("data-end"));
      if (!isFinite(start)) start = 0;
      if (!isFinite(end)) end = Infinity;
      if (t >= start && t < end) match = step;
    });
    if (!match && steps.length) {
      var last = section.querySelector(".hop-story-before .hop-step:last-child");
      if (last) match = last;
    }
    var cap = match && match.querySelector(".hop-step-cap");
    return cap ? cap.textContent.trim() : "";
  }

  function setUI(t, dur) {
    if (!range) return;
    if (!dur) dur = duration();
    if (range.max !== String(dur)) range.max = String(dur);
    if (!dragging) range.value = String(t);
    var pct = dur > 0 ? Math.max(0, Math.min(100, (t / dur) * 100)) : 0;
    if (fill) fill.style.width = pct + "%";
    var label = stepLabel(t);
    var text = formatTime(t) + (label ? ", " + label : "");
    range.setAttribute("aria-valuenow", String(Math.round(t * 10) / 10));
    range.setAttribute("aria-valuetext", text);
    if (timeEl) timeEl.textContent = formatClock(t);
    root.classList.toggle("is-dragging", dragging);
    var currentStart = -1;
    ticks.forEach(function (tick) {
      var start = parseFloat(tick.getAttribute("data-start"));
      if (isFinite(start) && t >= start && start > currentStart) currentStart = start;
    });
    ticks.forEach(function (tick) {
      var start = parseFloat(tick.getAttribute("data-start"));
      tick.classList.toggle("is-current", isFinite(start) && start === currentStart);
    });
    var playing = isPlaying();
    if (playBtn) {
      playBtn.classList.toggle("is-playing", playing);
      playBtn.setAttribute("aria-label", playing ? "Pause the loop" : "Play the loop");
    }
    if (playIc) playIc.hidden = playing;
    if (pauseIc) pauseIc.hidden = !playing;
  }

  function seekTo(t, resume) {
    var hs = sync();
    if (!hs || !hs.seekBoth) return;
    var next = hs.seekBoth(t);
    setUI(next, duration());
    if (resume && hs.userPlay) hs.userPlay();
  }

  function onPointerDown() {
    var hs = sync();
    if (!hs) return;
    wasPlaying = isPlaying() && !(hs.isUserPaused && hs.isUserPaused());
    dragging = true;
    if (hs.setScrubbing) hs.setScrubbing(true);
  }

  function onInput() {
    var t = parseFloat(range.value) || 0;
    var hs = sync();
    if (hs && hs.seekBoth) {
      hs.seekBoth(t);
    }
    setUI(t, duration());
  }

  function onPointerUp() {
    var hs = sync();
    dragging = false;
    if (hs && hs.setScrubbing) hs.setScrubbing(false);
    if (wasPlaying && hs && hs.userPlay) hs.userPlay();
    wasPlaying = false;
    setUI(current(), duration());
  }

  function tickFrame() {
    raf = 0;
    if (!dragging) setUI(current(), duration());
    raf = requestAnimationFrame(tickFrame);
  }

  if (range) {
    range.addEventListener("pointerdown", onPointerDown);
    range.addEventListener("touchstart", onPointerDown, { passive: true });
    range.addEventListener("mousedown", onPointerDown);
    range.addEventListener("input", onInput);
    range.addEventListener("change", onInput);
    range.addEventListener("pointerup", onPointerUp);
    range.addEventListener("mouseup", onPointerUp);
    range.addEventListener("touchend", onPointerUp);
    range.addEventListener("keyup", function (e) {
      /* Arrow keys already move the range; keep videos in sync. */
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
        onInput();
      }
    });
  }

  document.addEventListener("pointerup", function () {
    if (dragging) onPointerUp();
  });

  if (playBtn) {
    playBtn.addEventListener("click", function () {
      var hs = sync();
      if (!hs) return;
      if (isPlaying()) {
        if (hs.userPause) hs.userPause();
      } else {
        if (hs.userPlay) hs.userPlay();
      }
      setUI(current(), duration());
    });
  }

  ticks.forEach(function (tick) {
    tick.addEventListener("click", function () {
      var start = parseFloat(tick.getAttribute("data-start"));
      if (!isFinite(start)) return;
      var resume = isPlaying();
      seekTo(start, resume);
    });
  });

  steps.forEach(function (step) {
    if (!step.hasAttribute("tabindex")) step.setAttribute("tabindex", "0");
    if (!step.hasAttribute("role")) step.setAttribute("role", "button");
    function jump() {
      var start = parseFloat(step.getAttribute("data-start"));
      if (!isFinite(start)) return;
      var resume = isPlaying();
      seekTo(start, resume);
    }
    step.addEventListener("click", jump);
    step.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        jump();
      }
    });
  });

  raf = requestAnimationFrame(tickFrame);
  setUI(0, 40);
})();
