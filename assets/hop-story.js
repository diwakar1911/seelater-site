/* Highlight the Before/After hop-story steps from the phone videos.
   Only while #before-after is in view. Respects reduced motion. */
(function () {
  "use strict";

  var section = document.getElementById("before-after");
  if (!section) return;

  var beforeSteps = Array.prototype.slice.call(
    section.querySelectorAll(".hop-story-before .hop-step")
  );
  var afterSteps = Array.prototype.slice.call(
    section.querySelectorAll(".hop-story-after .hop-step")
  );
  if (!beforeSteps.length && !afterSteps.length) return;

  var videos = Array.prototype.slice.call(
    section.querySelectorAll(".hero-device .phone-video")
  );
  var beforeVideo = videos[0] || null;
  var afterVideo = videos[1] || null;

  var reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var THRESHOLD = 0.45;
  var visible = false;

  function prefersReduced() {
    return reducedMq.matches;
  }

  function applyStatic(on) {
    var stories = section.querySelectorAll(".hop-story");
    Array.prototype.forEach.call(stories, function (ol) {
      ol.classList.toggle("is-static", on);
    });
    if (on) {
      beforeSteps.concat(afterSteps).forEach(function (s) {
        s.classList.remove("is-active");
        s.removeAttribute("aria-current");
      });
    }
  }

  function setLive(active) {
    var live = section.querySelector(".hop-story-live");
    var cap = active && active.querySelector(".hop-step-cap");
    if (live) live.textContent = cap ? cap.textContent : "";
  }

  function activate(steps, t, isBefore) {
    if (!steps.length) return;
    var active = steps[0];
    for (var i = 0; i < steps.length; i++) {
      var start = parseFloat(steps[i].getAttribute("data-start"));
      var end = parseFloat(steps[i].getAttribute("data-end"));
      if (!isFinite(start)) start = 0;
      if (!isFinite(end)) end = Infinity;
      if (t >= start && t < end) {
        active = steps[i];
        break;
      }
    }
    /* If t is past every window, keep the last step. */
    if (active === steps[0] && t > 0) {
      var last = steps[steps.length - 1];
      var lastStart = parseFloat(last.getAttribute("data-start"));
      if (isFinite(lastStart) && t >= lastStart) active = last;
    }
    steps.forEach(function (s) {
      var on = s === active;
      s.classList.toggle("is-active", on);
      if (on) s.setAttribute("aria-current", "step");
      else s.removeAttribute("aria-current");
    });
    if (isBefore) setLive(active);
  }

  function sync() {
    if (prefersReduced()) {
      applyStatic(true);
      return;
    }
    applyStatic(false);
    if (beforeVideo) activate(beforeSteps, beforeVideo.currentTime || 0, true);
    if (afterVideo) activate(afterSteps, afterVideo.currentTime || 0, false);
  }

  function onVisibility(isVisible) {
    visible = isVisible;
    if (prefersReduced()) {
      applyStatic(true);
      return;
    }
    if (isVisible) sync();
  }

  function bind(video, steps, isBefore) {
    if (!video) return;
    function tick() {
      if (visible && !prefersReduced()) activate(steps, video.currentTime || 0, isBefore);
    }
    video.addEventListener("timeupdate", tick);
    video.addEventListener("seeked", tick);
    video.addEventListener("play", tick);
  }

  bind(beforeVideo, beforeSteps, true);
  bind(afterVideo, afterSteps, false);

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        var entry = entries[0];
        var ratio = entry && entry.isIntersecting ? entry.intersectionRatio : 0;
        onVisibility(ratio >= THRESHOLD);
      },
      { threshold: [0, 0.25, 0.4, 0.45, 0.5, 0.75, 1] }
    );
    io.observe(section);
  } else {
    onVisibility(true);
  }

  if (reducedMq.addEventListener) {
    reducedMq.addEventListener("change", function () {
      if (prefersReduced()) applyStatic(true);
      else if (visible) sync();
    });
  }

  if (prefersReduced()) applyStatic(true);
  else setLive(beforeSteps[0]);

  window.__hopStory = { sync: sync, visible: function () { return visible; } };
})();
