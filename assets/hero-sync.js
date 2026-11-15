/* Start and loop the two hero phone videos together. */
(function () {
  "use strict";

  var videos = Array.prototype.slice.call(
    document.querySelectorAll(".hero-device .phone-video")
  );
  if (videos.length < 2) return;

  var ready = false;
  var cycling = false;
  var startedAt = 0;
  var loops = [];

  function prepare(v) {
    v.loop = false;
    v.removeAttribute("loop");
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.setAttribute("muted", "");
    v.setAttribute("autoplay", "");
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

  function playBoth() {
    return Promise.all(
      videos.map(function (v) {
        var play = v.play();
        return play && play.catch ? play.catch(function () {}) : play;
      })
    );
  }

  function startTogether() {
    if (ready) return;
    if (!videos.every(function (v) { return v.readyState >= 3; })) return;
    ready = true;
    seekToZero().then(function () {
      startedAt = performance.now();
      return playBoth();
    });
  }

  function restartTogether(reason) {
    if (!ready || cycling) return;
    cycling = true;
    var wall = performance.now();
    var before = videos.map(function (v) {
      return { t: v.currentTime, dur: v.duration, paused: v.paused };
    });
    seekToZero()
      .then(function () {
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

  videos.forEach(function (v) {
    v.addEventListener("ended", function () { restartTogether("ended"); });
    v.addEventListener("timeupdate", function () {
      if (!ready || cycling) return;
      var dur = v.duration;
      if (dur && isFinite(dur) && dur > 0 && v.currentTime >= dur - 0.04) {
        restartTogether("timeupdate");
      }
    });
    v.addEventListener("canplaythrough", startTogether);
    v.addEventListener("loadeddata", startTogether);
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
    startTogether();
  });

  window.__heroSync = {
    videos: videos,
    loops: loops,
    startedAt: function () { return startedAt; },
    snapshot: function () {
      return {
        ready: ready,
        cycling: cycling,
        startedAt: startedAt,
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
            loop: v.loop
          };
        })
      };
    }
  };
})();
