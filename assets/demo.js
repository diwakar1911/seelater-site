/* SeeLater hero demo — iOS 18 iMessage hop, looping.
   Clips: Pexels 4540398, 7502788, 4434242; portrait 1239291. Pexels License. */
(function () {
  var root = document.getElementById("iosDemo");
  if (!root) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var demoMode = (new URLSearchParams(location.search).get("demo") || "").toLowerCase();
  if (demoMode === "still") reduce = true;
  var capture = (demoMode === "capture" || demoMode === "problem");
  var problem = (demoMode === "problem");
  var msgs = document.getElementById("imMsgs");
  var thread = document.getElementById("imThread");
  var player = document.getElementById("imPlayer");
  var video = document.getElementById("imVideo");
  var recEl = document.getElementById("imRec");
  var cards = {
    tt: document.getElementById("cardTt"),
    reels: document.getElementById("cardReels"),
    shorts: document.getElementById("cardShorts")
  };
  var src = {
    tt: { video: "assets/vid/tt.mp4", poster: "assets/vid/tt.jpg" },
    reels: { video: "assets/vid/reels.mp4", poster: "assets/vid/reels.jpg" },
    shorts: { video: "assets/vid/shorts.mp4", poster: "assets/vid/shorts.jpg" }
  };

  var running = false;
  var recStarted = capture ? 0 : Date.now();
  var progressRaf = 0;
  var cancelled = false;
  var virt = 0;
  var anims = [];
  var videoClock = null; /* { el, startVirt, offset } */
  var slVideoClock = null;

  function fitIos() {
    if (capture) {
      root.style.transform = "none";
      return;
    }
    var parent = root.parentElement;
    if (!parent) return;
    var s = parent.clientWidth / 390;
    root.style.transform = "scale(" + s + ")";
    root.style.transformOrigin = "top left";
  }
  fitIos();
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(fitIos).observe(root.parentElement);
  } else {
    window.addEventListener("resize", fitIos);
  }

  function nowMs() { return capture ? virt : performance.now(); }
  function sleep(ms) {
    if (!capture) return new Promise(function (resolve) { setTimeout(resolve, ms); });
    return new Promise(function (resolve) {
      anims.push({ t0: virt, duration: ms, fn: null, resolve: resolve });
    });
  }
  function jitter(base, spread) {
    if (capture) return base;
    return base + (Math.random() * 2 - 1) * spread;
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  /* iOS-ish spring settle */
  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function scaleOf() {
    var r = root.getBoundingClientRect();
    return r.width / 390;
  }

  function rectInIos(el) {
    var s = scaleOf();
    var ir = root.getBoundingClientRect();
    var cr = el.getBoundingClientRect();
    return {
      x: (cr.left - ir.left) / s,
      y: (cr.top - ir.top) / s,
      w: cr.width / s,
      h: cr.height / s
    };
  }

  function animate(duration, fn) {
    if (!capture) {
      return new Promise(function (resolve) {
        var t0 = performance.now();
        function frame(now) {
          if (cancelled) { resolve(); return; }
          var t = Math.min(1, (now - t0) / duration);
          fn(t);
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
    }
    fn(0);
    return new Promise(function (resolve) {
      anims.push({ t0: virt, duration: duration, fn: fn, resolve: resolve });
    });
  }

  function rubberScroll(el, to, duration) {
    var from = el.scrollTop;
    var max = Math.max(0, el.scrollHeight - el.clientHeight);
    var clamped = Math.max(0, Math.min(max, to));
    var overY = 0;
    if (to > max) overY = -Math.min(36, 16 + (to - max));
    if (to < 0) overY = Math.min(32, 16 - to);
    if (Math.abs(clamped - from) < 2 && !overY) {
      el.scrollTop = clamped;
      el.style.transform = "";
      return Promise.resolve();
    }
    return animate(duration, function (t) {
      if (t < 0.7) {
        var u = easeOutCubic(t / 0.7);
        el.scrollTop = from + (clamped - from) * u;
        if (overY) el.style.transform = "translateY(" + (overY * u) + "px)";
      } else {
        var u = easeOutExpo((t - 0.7) / 0.3);
        el.scrollTop = clamped;
        if (overY) el.style.transform = "translateY(" + (overY * (1 - u)) + "px)";
        else el.style.transform = "";
      }
    }).then(function () {
      el.style.transform = "";
      el.scrollTop = clamped;
    });
  }

  function scrollCardIntoView(card) {
    var top = card.offsetTop - 200;
    return rubberScroll(thread, top, problem ? 440 : (capture ? 480 : jitter(620, 80)));
  }

  function press(card) {
    card.classList.add("is-press");
    return sleep(jitter(110, 30)).then(function () {
      card.classList.remove("is-press");
    });
  }

  function tickRec() {
    var sec = Math.floor(((capture ? virt : (Date.now() - recStarted))) / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    if (recEl) recEl.textContent = m + ":" + String(s).padStart(2, "0");
  }

  function stopProgress() {
    if (progressRaf) cancelAnimationFrame(progressRaf);
    progressRaf = 0;
  }

  function startProgress() {
    stopProgress();
    if (capture) {
      try { video.pause(); } catch (e) {}
      videoClock = { el: video, startVirt: virt, offset: 0 };
      return;
    }
    var bar = player.querySelector('.ov[data-ov="' + player.dataset.app + '"] .ov-progress i');
    function tick() {
      if (!video || video.paused || !bar) return;
      var d = video.duration || 4.8;
      var p = Math.min(1, video.currentTime / d);
      bar.style.width = (p * 100).toFixed(2) + "%";
      progressRaf = requestAnimationFrame(tick);
    }
    progressRaf = requestAnimationFrame(tick);
  }

  function resetPlayerInstant() {
    stopProgress();
    videoClock = null;
    try { video.pause(); } catch (e) {}
    player.hidden = true;
    player.classList.remove("is-open");
    player.removeAttribute("data-app");
    player.style.cssText = "";
    msgs.classList.remove("is-back");
    msgs.style.transition = "";
    msgs.style.transform = "";
    msgs.style.filter = "";
    msgs.style.borderRadius = "";
  }

  function openFrom(card, app) {
    var r = rectInIos(card);
    var pack = src[app];
    player.hidden = false;
    player.dataset.app = app;
    player.classList.remove("is-open");
    video.setAttribute("poster", pack.poster);
    if (video.getAttribute("src") !== pack.video) {
      video.src = pack.video;
    }
    video.currentTime = 0;
    var playP = video.play().catch(function () {});

    player.style.position = "absolute";
    player.style.left = r.x + "px";
    player.style.top = r.y + "px";
    player.style.width = r.w + "px";
    player.style.height = r.h + "px";
    player.style.borderRadius = "18px";
    player.style.overflow = "hidden";
    player.style.visibility = "visible";
    player.style.zIndex = "8";
    player.style.boxShadow = "0 8px 28px rgba(0,0,0,0.35)";
    var overlay = player.querySelector('.ov[data-ov="' + app + '"]');
    var scrim = player.querySelector(".ov-scrim");
    if (overlay) overlay.style.opacity = "0";
    if (scrim) scrim.style.opacity = "0";

    msgs.style.transition = "transform 0.48s cubic-bezier(0.32, 0.72, 0, 1), filter 0.48s ease";
    msgs.classList.add("is-back");

    return animate(jitter(460, 40), function (t) {
      var u = easeOutExpo(t);
      player.style.left = r.x + (0 - r.x) * u + "px";
      player.style.top = r.y + (0 - r.y) * u + "px";
      player.style.width = r.w + (390 - r.w) * u + "px";
      player.style.height = r.h + (844 - r.h) * u + "px";
      player.style.borderRadius = 18 * (1 - u) + "px";
      var fade = Math.max(0, (t - 0.35) / 0.65);
      if (overlay) overlay.style.opacity = String(fade);
      if (scrim) scrim.style.opacity = String(fade);
    }).then(function () {
      player.style.left = "0";
      player.style.top = "0";
      player.style.width = "390px";
      player.style.height = "844px";
      player.style.borderRadius = "0";
      player.classList.add("is-open");
      if (overlay) overlay.style.opacity = "1";
      if (scrim) scrim.style.opacity = "1";
      startProgress();
      return playP;
    });
  }

  function swipeBack() {
    stopProgress();
    try { video.pause(); } catch (e) {}
    player.classList.remove("is-open");
    player.style.transition = "none";
    msgs.style.transition = "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), filter 0.38s ease";

    return animate(jitter(380, 30), function (t) {
      var u = easeOutCubic(t);
      /* slight drag hesitation at the start, like a thumb catching the edge */
      var ev = t < 0.08 ? t * 0.4 : u;
      player.style.transform = "translateX(" + (390 * ev) + "px)";
      var back = 0.92 + 0.08 * ev;
      msgs.style.transform = "scale(" + back + ")";
      msgs.style.filter = "brightness(" + (0.72 + 0.28 * ev) + ")";
    }).then(function () {
      resetPlayerInstant();
    });
  }

  function hop(app) {
    var card = cards[app];
    return scrollCardIntoView(card)
      .then(function () { return sleep(problem ? 160 : (capture ? 200 : jitter(280, 90))); })
      .then(function () { return press(card); })
      .then(function () { return sleep(problem ? 70 : (capture ? 70 : jitter(90, 30))); })
      .then(function () { return problem ? launchApp(app) : openFrom(card, app); })
      .then(function () { return sleep(problem ? 1000 : (capture ? 1850 : jitter(2400, 280))); })
      .then(function () { return problem ? switchBackToMessages(app) : swipeBack(); })
      .then(function () { return sleep(problem ? 150 : (capture ? 220 : jitter(320, 80))); });
  }

  function loop() {
    if (cancelled) return;
    running = true;
    /* start near the top, with a little rubber-band settle */
    thread.scrollTop = 0;
    return rubberScroll(thread, -8, 520)
      .then(function () { return sleep(jitter(700, 120)); })
      .then(function () { return hop("tt"); })
      .then(function () { return hop("reels"); })
      .then(function () { return hop("shorts"); })
      .then(function () { return sleep(jitter(600, 120)); })
      .then(function () {
        if (!cancelled) return loop();
      });
  }

  /* rec clock */
  tickRec();
  if (!capture) setInterval(tickRec, 1000);

  /* ---------- SeeLater payoff (capture / rec only) ---------- */
  var slApp = document.getElementById("slApp");
  var slFeed = document.getElementById("slFeed");
  var slEnd = document.getElementById("slEnd");
  var slItems = slFeed ? slFeed.querySelectorAll(".sl-item") : [];

  function slSeek(item, t) {
    var v = item.querySelector("video");
    if (!v) return;
    var d = v.duration || 4.8;
    var ct = Math.max(0, Math.min(d - 0.05, t));
    if (Math.abs((v.currentTime || 0) - ct) > 0.04) {
      try { v.currentTime = ct; } catch (e) {}
    }
    var bar = item.querySelector(".sl-progress i");
    if (bar) bar.style.width = (Math.min(1, ct / d) * 100).toFixed(2) + "%";
  }

  function slShow() {
    slApp.hidden = false;
    slApp.style.opacity = "0";
    slApp.style.transform = "scale(0.94) translateY(18px)";
    slFeed.scrollTop = 0;
    slItems.forEach(function (it, i) {
      it.classList.remove("is-watched");
      it.querySelector(".sl-watched").classList.remove("is-on");
      slSeek(it, 0.15);
    });
    slVideoClock = { index: 0, startVirt: virt, offset: 0.15 };
    return animate(450, function (t) {
      var u = easeOutExpo(t);
      slApp.style.opacity = String(u);
      slApp.style.transform = "scale(" + (0.94 + 0.06 * u) + ") translateY(" + (18 * (1 - u)) + "px)";
    }).then(function () {
      slApp.style.opacity = "1";
      slApp.style.transform = "";
    });
  }

  function slScrollTo(index) {
    var from = slFeed.scrollTop;
    var to = slItems[index].offsetTop;
    slVideoClock = { index: index, startVirt: virt, offset: 0.15 };
    slSeek(slItems[index], 0.15);
    return animate(550, function (t) {
      var u = easeInOut(t);
      slFeed.scrollTop = from + (to - from) * u;
    }).then(function () {
      slFeed.scrollTop = to;
      slVideoClock.startVirt = virt;
    });
  }

  function slMark(index) {
    var it = slItems[index];
    it.classList.add("is-watched");
    it.querySelector(".sl-watched").classList.add("is-on");
  }

  function showEndCard() {
    slEnd.hidden = false;
    slEnd.style.opacity = "0";
    return animate(600, function (t) {
      var u = easeOutCubic(t);
      slEnd.style.opacity = String(u);
      if (t > 0.4) root.classList.add("is-ending");
    }).then(function () {
      slEnd.style.opacity = "1";
      root.classList.add("is-ending");
      slVideoClock = null;
    });
  }

  function payoff() {
    if (!slApp) return Promise.resolve();
    return slShow()
      .then(function () { return sleep(1600); })
      .then(function () { slMark(0); return sleep(180); })
      .then(function () { return slScrollTo(1); })
      .then(function () { return sleep(1600); })
      .then(function () { slMark(1); return sleep(180); })
      .then(function () { return slScrollTo(2); })
      .then(function () { return sleep(1600); })
      .then(function () { slMark(2); return sleep(280); })
      .then(function () { return showEndCard(); })
      .then(function () { return sleep(1400); });
  }

  function syncMedia() {
    var seeks = [];
    function aim(el, t) {
      if (!el || el.readyState < 1) return;
      var d = el.duration || 4.8;
      var ct = Math.max(0, Math.min((d > 0.1 ? d - 0.05 : t), t));
      if (Math.abs((el.currentTime || 0) - ct) > 0.03) {
        seeks.push(new Promise(function (resolve) {
          var done = false;
          function finish() {
            if (done) return;
            done = true;
            el.removeEventListener("seeked", finish);
            resolve();
          }
          el.addEventListener("seeked", finish);
          try { el.currentTime = ct; } catch (e) { finish(); }
          setTimeout(finish, 80);
        }));
      }
    }
    if (videoClock && videoClock.el && !player.hidden) {
      var t = videoClock.offset + (virt - videoClock.startVirt) / 1000;
      aim(videoClock.el, t);
      var bar = player.querySelector('.ov[data-ov="' + player.dataset.app + '"] .ov-progress i');
      var d = videoClock.el.duration || 4.8;
      if (bar) bar.style.width = (Math.min(1, t / d) * 100).toFixed(2) + "%";
    }
    if (slVideoClock && slItems[slVideoClock.index]) {
      var t2 = slVideoClock.offset + (virt - slVideoClock.startVirt) / 1000;
      slSeek(slItems[slVideoClock.index], t2);
      aim(slItems[slVideoClock.index].querySelector("video"), t2);
    }
    return seeks.length ? Promise.all(seeks) : Promise.resolve();
  }

  function syncCssAnims() {
    var sec = virt / 1000;
    root.querySelectorAll(".ov-disc, .ios-recdot").forEach(function (el) {
      el.style.animationPlayState = "paused";
      el.style.animationDelay = (-sec) + "s";
    });
  }

  function tickCapture(dt) {
    virt += dt;
    tickRec();
    syncCssAnims();
    var still = [];
    for (var i = 0; i < anims.length; i++) {
      var a = anims[i];
      var t = a.duration <= 0 ? 1 : Math.min(1, (virt - a.t0) / a.duration);
      if (a.fn) a.fn(t);
      if (t >= 1) a.resolve();
      else still.push(a);
    }
    anims = still;
    return syncMedia();
  }

  window.__demoTick = function (dt) { return tickCapture(dt || 1000 / 30); };
  window.__demoTime = function () { return virt; };
  window.__demoDuration = problem ? 40000 : 25000;


  /* ---------- Problem-only open (lock screen → Messages hop) ---------- */
  var lockScreen = document.getElementById("lockScreen");
  var homeScreen = document.getElementById("homeScreen");
  var lsNotifs = document.getElementById("lsNotifs");
  var lsLock = document.getElementById("lsLock");
  var lsFace = document.getElementById("lsFace");
  var lsHint = document.getElementById("lsHint");
  var lsDim = document.getElementById("lsDim");
  var hsMessages = document.getElementById("hsMessages");
  var hsGrid = document.getElementById("hsGrid");
  var imLate = document.getElementById("imLate");

  if (hsGrid && !hsGrid.childElementCount) {
    var apps = [
      ["calendar", "Calendar"],
      ["photos", "Photos"],
      ["clock", "Clock"],
      ["weather", "Weather"],
      ["mail", "Mail"],
      ["notes", "Notes"],
      ["maps", "Maps"],
      ["settings", "Settings"],
      ["tiktok", "TikTok"],
      ["instagram", "Instagram"],
      ["youtube", "YouTube"],
      ["music", "Music"]
    ];
    apps.forEach(function (a) {
      var el = document.createElement("div");
      el.className = "hs-app";
      el.innerHTML = '<b><img src="assets/img/icons/' + a[0] + '.png" alt=""></b><span>' + a[1] + "</span>";
      hsGrid.appendChild(el);
    });
  }

  function showNote(i) {
    var note = lsNotifs && lsNotifs.querySelectorAll(".ls-note")[i];
    if (!note) return Promise.resolve();
    note.style.opacity = "0";
    note.style.transform = "translateY(22px) scale(0.97)";
    note.classList.add("is-on");
    return animate(420, function (t) {
      var u = easeOutExpo(t);
      note.style.opacity = String(u);
      note.style.transform = "translateY(" + (22 * (1 - u)) + "px) scale(" + (0.97 + 0.03 * u) + ")";
    }).then(function () {
      note.style.opacity = "1";
      note.style.transform = "";
    });
  }

  function pickup() {
    if (!lsDim) return Promise.resolve();
    var from = parseFloat(lsDim.style.opacity || "0.38");
    return animate(700, function (t) {
      var u = easeOutCubic(t);
      lsDim.style.opacity = String(from * (1 - u));
      if (lockScreen) lockScreen.style.filter = "brightness(" + (0.92 + 0.08 * u) + ")";
    }).then(function () {
      lsDim.style.opacity = "0";
      if (lockScreen) lockScreen.style.filter = "";
    });
  }

  function faceId() {
    if (lsFace) {
      lsFace.classList.add("is-scan");
      lsFace.style.opacity = "0";
      lsFace.style.transform = "scale(0.7)";
    }
    return animate(280, function (t) {
      var u = easeOutCubic(t);
      if (lsFace) {
        lsFace.style.opacity = String(u);
        lsFace.style.transform = "scale(" + (0.7 + 0.3 * u) + ")";
      }
    }).then(function () { return sleep(520); })
      .then(function () {
        if (lsFace) lsFace.style.opacity = "0";
        if (lsLock) lsLock.classList.add("is-open");
        return animate(360, function (t) {
          /* lock shackle is CSS-class switched; fade the scan ring out */
          if (lsFace) lsFace.style.opacity = String(1 - t);
        });
      }).then(function () {
        if (lsHint) {
          lsHint.classList.add("is-on");
          lsHint.style.opacity = "0";
          return animate(320, function (t) {
            lsHint.style.opacity = String(easeOutCubic(t));
          });
        }
      });
  }

  function swipeToHome() {
    root.classList.remove("is-locked");
    if (homeScreen) {
      homeScreen.hidden = false;
      homeScreen.style.opacity = "1";
      homeScreen.style.transform = "scale(0.94)";
    }
    return animate(640, function (t) {
      var u = easeOutCubic(t);
      /* slight lead-in as the thumb catches the edge */
      var ev = t < 0.1 ? t * 0.35 : u;
      if (lockScreen) lockScreen.style.transform = "translateY(" + (-844 * ev) + "px)";
      if (homeScreen) homeScreen.style.transform = "scale(" + (0.94 + 0.06 * ev) + ")";
    }).then(function () {
      if (lockScreen) { lockScreen.hidden = true; lockScreen.style.transform = ""; }
      if (homeScreen) homeScreen.style.transform = "";
    });
  }

  function openMessagesFromDock() {
    if (hsMessages) hsMessages.classList.add("is-press");
    return sleep(140).then(function () {
      if (hsMessages) hsMessages.classList.remove("is-press");
      var r = hsMessages ? rectInIos(hsMessages) : { x: 200, y: 760, w: 60, h: 60 };
      var cx = r.x + r.w / 2;
      var cy = r.y + r.h / 2;
      msgs.style.visibility = "visible";
      msgs.style.zIndex = "16";
      msgs.style.transformOrigin = cx + "px " + cy + "px";
      msgs.style.borderRadius = "14px";
      msgs.style.overflow = "hidden";
      if (homeScreen) homeScreen.style.transformOrigin = "50% 50%";
      return animate(520, function (t) {
        var u = easeOutExpo(t);
        var sc = 0.12 + 0.88 * u;
        msgs.style.transform = "scale(" + sc + ")";
        msgs.style.opacity = String(Math.min(1, 0.4 + u * 0.8));
        msgs.style.borderRadius = (14 * (1 - u)) + "px";
        if (homeScreen) {
          homeScreen.style.opacity = String(1 - u);
          homeScreen.style.transform = "scale(" + (1 - 0.08 * u) + ")";
          homeScreen.style.filter = "brightness(" + (1 - 0.25 * u) + ")";
        }
      });
    }).then(function () {
      msgs.style.transform = "";
      msgs.style.opacity = "";
      msgs.style.borderRadius = "";
      msgs.style.overflow = "";
      msgs.style.zIndex = "";
      msgs.style.transformOrigin = "";
      if (homeScreen) {
        homeScreen.hidden = true;
        homeScreen.style.opacity = "";
        homeScreen.style.transform = "";
        homeScreen.style.filter = "";
      }
    });
  }

  function launchApp(app) {
    var pack = src[app];
    var icons = {
      tt: "assets/img/icons/tiktok.png",
      reels: "assets/img/icons/instagram.png",
      shorts: "assets/img/icons/youtube.png"
    };
    var splash = document.getElementById("appSplash");
    var sIcon = document.getElementById("appSplashIcon");
    if (sIcon) sIcon.src = icons[app];
    if (splash) {
      splash.hidden = false;
      splash.dataset.app = app;
      splash.style.opacity = "0";
      splash.style.transform = "scale(0.84)";
    }
    player.hidden = false;
    player.dataset.app = app;
    player.classList.remove("is-open");
    video.setAttribute("poster", pack.poster);
    if (video.getAttribute("src") !== pack.video) video.src = pack.video;
    video.currentTime = 0;
    var playP = video.play().catch(function () {});
    player.style.cssText = "position:absolute;left:0;top:0;width:390px;height:844px;border-radius:0;overflow:hidden;visibility:visible;z-index:8";
    var overlay = player.querySelector('.ov[data-ov="' + app + '"]');
    var scrim = player.querySelector(".ov-scrim");
    if (overlay) overlay.style.opacity = "0";
    if (scrim) scrim.style.opacity = "0";
    msgs.style.transition = "none";
    msgs.classList.add("is-back");
    return animate(260, function (t) {
      var u = easeOutCubic(t);
      if (splash) {
        splash.style.opacity = String(u);
        splash.style.transform = "scale(" + (0.84 + 0.16 * u) + ")";
      }
    }).then(function () { return sleep(130); })
      .then(function () {
        return animate(240, function (t) {
          var u = easeOutCubic(t);
          if (splash) splash.style.opacity = String(1 - u);
          if (overlay) overlay.style.opacity = String(u);
          if (scrim) scrim.style.opacity = String(u);
        });
      }).then(function () {
        if (splash) {
          splash.hidden = true;
          splash.style.opacity = "";
          splash.style.transform = "";
        }
        player.classList.add("is-open");
        if (overlay) overlay.style.opacity = "1";
        if (scrim) scrim.style.opacity = "1";
        startProgress();
        return playP;
      });
  }

  var imField = document.getElementById("imField");
  var imInput = document.getElementById("imInput");
  var imPh = document.getElementById("imPh");
  var imCaret = document.getElementById("imCaret");
  var imMic = document.getElementById("imMic");
  var imSend = document.getElementById("imSend");
  var imKb = document.getElementById("imKb");
  var imCompose = document.getElementById("imCompose");
  var imReply = document.getElementById("imReply");
  var imReplyText = document.getElementById("imReplyText");
  var imReplyDelivered = document.getElementById("imReplyDelivered");
  var imDelivered = document.getElementById("imDelivered");
  var kbAbc = document.getElementById("kbAbc");
  var kbNum = document.getElementById("kbNum");
  var kbEmoji = document.getElementById("kbEmoji");
  var kbPopup = document.getElementById("kbPopup");
  var draft = "";
  var kbReady = false;

  function setDraft(text) {
    draft = text;
    if (imInput) imInput.textContent = draft;
    var has = draft.length > 0;
    if (imField) imField.classList.toggle("is-active", has || (msgs && msgs.classList.contains("is-kb")));
    if (has && imField) imField.classList.add("is-active");
    if (imPh) imPh.style.display = has ? "none" : "";
    if (imSend) imSend.hidden = !has;
    if (imMic) imMic.classList.toggle("is-hide", has);
    updatePredict();
  }

  function updatePredict() {
    var s0 = document.getElementById("kbSug0");
    var s1 = document.getElementById("kbSug1");
    var s2 = document.getElementById("kbSug2");
    if (!s0) return;
    var last = (draft.split(/\s+/).pop() || "");
    var low = last.toLowerCase();
    var triples = {
      "": ["I", "The", "I'm"],
      "i": ["I", "I'll", "I've"],
      "i'": ["I've", "I'm", "I'd"],
      "i've": ["I've", "I've been", "I've got"],
      "o": ["ok", "oh", "on"],
      "op": ["open", "opened", "opening"],
      "ope": ["open", "opened", "opens"],
      "open": ["open", "opened", "opening"],
      "opene": ["opened", "opener", "openers"],
      "opened": ["opened", "opened it", "opened the"],
      "4": ["4", "4 apps", "four"],
      "a": ["a", "and", "at"],
      "ap": ["app", "apps", "apple"],
      "app": ["app", "apps", "apple"],
      "apps": ["apps", "app", "apps.",],
      "f": ["for", "from", "first"],
      "fo": ["for", "from", "four"],
      "for": ["for", "from", "forward"],
      "3": ["3", "3 videos", "three"],
      "v": ["very", "video", "videos"],
      "vi": ["video", "videos", "via"],
      "vid": ["video", "videos", "vid"],
      "vide": ["video", "videos", "vide"],
      "video": ["video", "videos", "videotape"],
      "videos": ["videos", "video", "videos."],
      "y": ["yes", "you", "yeah"],
      "ye": ["yes", "yeah", "yesterday"],
      "yes": ["yes", "yes!!", "yesterday"]
    };
    var t = triples[low] || [last || "I", "the", "to"];
    s0.textContent = t[0];
    s1.textContent = t[1];
    s2.textContent = t[2];
  }

  function keyEl(label, cls, w) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "kb-key" + (cls ? " " + cls : "");
    b.setAttribute("data-key", label);
    if (w) b.style.width = w + "px";
    if (label === "delete") {
      b.innerHTML = '<svg viewBox="0 0 24 18" width="22" height="16"><path fill="currentColor" d="M8.2 1.2h13.2A1.6 1.6 0 0 1 23 2.8v12.4a1.6 1.6 0 0 1-1.6 1.6H8.2L1.2 9 8.2 1.2Z"/><path d="M11 5.5 17 12.5M17 5.5 11 12.5" stroke="#1C1C1E" stroke-width="1.8" stroke-linecap="round"/></svg>';
    } else if (label === "emoji") {
      b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="10" r="1.1" fill="currentColor"/><circle cx="15" cy="10" r="1.1" fill="currentColor"/><path d="M8.2 14.5c1.2 1.6 2.5 2.3 3.8 2.3s2.6-.7 3.8-2.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    } else if (label === "shift") {
      b.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" d="M10 2.2 2.8 10.2h4V17.2h6.4v-7h4L10 2.2Z"/></svg>';
    } else {
      b.textContent = label;
    }
    return b;
  }

  function buildRow(parent, items) {
    var row = document.createElement("div");
    row.className = "kb-row";
    items.forEach(function (it) {
      row.appendChild(typeof it === "string" ? keyEl(it, "is-letter") : keyEl(it[0], it[1], it[2]));
    });
    parent.appendChild(row);
  }

  function buildKeyboard() {
    if (kbReady || !kbAbc) return;
    kbReady = true;
    buildRow(kbAbc, "qwertyuiop".split(""));
    buildRow(kbAbc, "asdfghjkl".split(""));
    var row3 = document.createElement("div");
    row3.className = "kb-row";
    row3.appendChild(keyEl("shift", "is-mod", 44));
    "zxcvbnm".split("").forEach(function (ch) { row3.appendChild(keyEl(ch, "is-letter")); });
    row3.appendChild(keyEl("delete", "is-mod", 44));
    kbAbc.appendChild(row3);
    var row4 = document.createElement("div");
    row4.className = "kb-row";
    row4.appendChild(keyEl("123", "is-wide", 50));
    row4.appendChild(keyEl("emoji", "is-mod", 42));
    row4.appendChild(keyEl("space", "is-space", 168));
    row4.appendChild(keyEl("return", "is-return", 74));
    kbAbc.appendChild(row4);

    buildRow(kbNum, "1234567890".split(""));
    buildRow(kbNum, ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"']);
    var n3 = document.createElement("div");
    n3.className = "kb-row";
    n3.appendChild(keyEl("#+=", "is-wide", 50));
    [".", ",", "?", "!", "'"].forEach(function (ch) {
      var k = keyEl(ch, "is-letter");
      k.style.width = "42px";
      n3.appendChild(k);
    });
    n3.appendChild(keyEl("delete", "is-mod", 44));
    kbNum.appendChild(n3);
    var n4 = document.createElement("div");
    n4.className = "kb-row";
    n4.appendChild(keyEl("ABC", "is-wide", 50));
    n4.appendChild(keyEl("emoji", "is-mod", 42));
    n4.appendChild(keyEl("space", "is-space", 168));
    n4.appendChild(keyEl("return", "is-return", 74));
    kbNum.appendChild(n4);

    var search = document.createElement("div");
    search.className = "kb-emoji-search";
    search.textContent = "Search Emoji";
    kbEmoji.appendChild(search);
    var grid = document.createElement("div");
    grid.className = "kb-emoji-grid";
    var emojis = ["😂","😭","😍","🤣","😊","🥺","😅","😘","❤️","🔥","✨","👍","👎","💕","🙏","😎","🤩","😢","😏","😤","🥰","😆","🙂","😉","💀","🎉","💯","👏"];
    emojis.forEach(function (e) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kb-emoji";
      b.setAttribute("data-emoji", e);
      b.textContent = e;
      grid.appendChild(b);
    });
    kbEmoji.appendChild(grid);
    var tabs = document.createElement("div");
    tabs.className = "kb-emoji-tabs";
    tabs.innerHTML = "<span>🕒</span><span>😊</span><span>🐻</span><span>🍔</span><span>⚽</span><span>🚗</span><span>💡</span><span>🏳️</span>";
    var abcRow = document.createElement("div");
    abcRow.className = "kb-row";
    abcRow.style.marginTop = "4px";
    abcRow.appendChild(keyEl("ABC", "is-wide", 50));
    abcRow.appendChild(keyEl("delete", "is-mod", 44));
    kbEmoji.appendChild(tabs);
    kbEmoji.appendChild(abcRow);
  }

  function showPage(name) {
    if (kbAbc) kbAbc.classList.toggle("is-on", name === "abc");
    if (kbNum) kbNum.classList.toggle("is-on", name === "num");
    if (kbEmoji) kbEmoji.classList.toggle("is-on", name === "emoji");
  }

  function findKey(label) {
    var pages = [kbAbc, kbNum, kbEmoji];
    for (var i = 0; i < pages.length; i++) {
      if (!pages[i] || !pages[i].classList.contains("is-on")) continue;
      var nodes = pages[i].querySelectorAll("[data-key]");
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].getAttribute("data-key") === label) return nodes[j];
      }
    }
    return null;
  }

  function popupOn(el, glyph) {
    if (!kbPopup || !el || !imKb) return;
    var kr = el.getBoundingClientRect();
    var br = imKb.getBoundingClientRect();
    kbPopup.hidden = false;
    kbPopup.textContent = glyph;
    kbPopup.style.left = (kr.left + kr.width / 2 - br.left) + "px";
    kbPopup.style.top = (kr.top - br.top) + "px";
  }

  function popupOff() {
    if (kbPopup) kbPopup.hidden = true;
  }

  function pressKey(label, glyph, hold) {
    var el = findKey(label);
    if (el) el.classList.add("is-down");
    if (glyph && label !== "delete" && label !== "123" && label !== "ABC" && label !== "emoji" && label !== "shift" && label !== "return") {
      popupOn(el, glyph);
    }
    return sleep(hold || 70).then(function () {
      if (el) el.classList.remove("is-down");
      popupOff();
    });
  }

  function pressEmoji(emo) {
    var el = kbEmoji && kbEmoji.querySelector('[data-emoji="' + emo + '"]');
    if (el) el.classList.add("is-down");
    return sleep(110).then(function () {
      if (el) el.classList.remove("is-down");
    });
  }

  function openKeyboard() {
    buildKeyboard();
    if (!imKb) return Promise.resolve();
    imKb.hidden = false;
    imKb.style.transform = "translateY(100%)";
    if (msgs) msgs.classList.add("is-kb");
    if (imField) imField.classList.add("is-active");
    if (imPh && !draft) imPh.style.display = "";
    updatePredict();
    if (thread) thread.scrollTop = thread.scrollHeight;
    return animate(300, function (t) {
      var u = easeOutCubic(t);
      imKb.style.transform = "translateY(" + ((1 - u) * 100) + "%)";
    }).then(function () {
      imKb.style.transform = "translateY(0)";
      if (thread) thread.scrollTop = thread.scrollHeight;
    });
  }

  function typeEnding() {
    var first = "i've opened 4 apps for 3 videos 😭";
    var second = "yes!! 😍";
    function typeSeq(seq) {
      var p = Promise.resolve();
      seq.forEach(function (step) {
        p = p.then(function () {
          if (step.page) {
            var label = step.page === "num" ? "123" : (step.page === "emoji" ? "emoji" : "ABC");
            return pressKey(label, "", 55).then(function () {
              showPage(step.page);
              return sleep(step.page === "emoji" ? 80 : 45);
            });
          }
          if (step.emoji) {
            return pressEmoji(step.emoji).then(function () {
              setDraft(draft + step.emoji);
              return sleep(90);
            });
          }
          var ch = step.k;
          var label = ch === " " ? "space" : ch;
          var shown = ch === " " ? " " : ch;
          var hold = 60;
          return pressKey(label, shown, hold).then(function () {
            setDraft(draft + (ch === " " ? " " : ch));
            return sleep(step.wait || 12);
          });
        });
      });
      return p;
    }
    function backspaceAll() {
      var p = Promise.resolve();
      var n = draft.length;
      for (var i = 0; i < n; i++) {
        p = p.then(function () {
          return pressKey("delete", "", 40).then(function () {
            setDraft(draft.slice(0, -1));
            return sleep(0);
          });
        });
      }
      return p;
    }
    var seq1 = [
      {k:"i"}, {page:"num"}, {k:"'"}, {page:"abc"}, {k:"v"}, {k:"e"}, {k:" "},
      {k:"o"}, {k:"p"}, {k:"e"}, {k:"n"}, {k:"e"}, {k:"d"}, {k:" "},
      {page:"num"}, {k:"4"}, {k:" "}, {page:"abc"},
      {k:"a"}, {k:"p"}, {k:"p"}, {k:"s"}, {k:" "},
      {k:"f"}, {k:"o"}, {k:"r"}, {k:" "},
      {page:"num"}, {k:"3"}, {k:" "}, {page:"abc"},
      {k:"v"}, {k:"i"}, {k:"d"}, {k:"e"}, {k:"o"}, {k:"s"}, {k:" "},
      {page:"emoji"}, {emoji:"😭"}
    ];
    var seq2 = [
      {k:"y"}, {k:"e"}, {k:"s"},
      {page:"num"}, {k:"!"}, {k:"!"}, {k:" "},
      {page:"emoji"}, {emoji:"😍"}
    ];

    if (imField) imField.classList.add("is-press");
    return sleep(120).then(function () {
      if (imField) imField.classList.remove("is-press");
      return openKeyboard();
    }).then(function () { return sleep(180); })
      .then(function () { showPage("abc"); return typeSeq(seq1); })
      .then(function () { return sleep(520); })
      .then(function () { showPage("abc"); return sleep(80); })
      .then(function () { return backspaceAll(); })
      .then(function () { return sleep(220); })
      .then(function () { return typeSeq(seq2); })
      .then(function () { return sleep(200); })
      .then(function () {
        if (imSend) imSend.classList.add("is-press");
        return sleep(120);
      })
      .then(function () {
        if (imSend) imSend.classList.remove("is-press");
        setDraft("");
        if (imField) imField.classList.add("is-active");
        if (imPh) imPh.style.display = "";
        if (imDelivered) imDelivered.style.visibility = "hidden";
        if (imReplyText) imReplyText.textContent = second;
        if (imReplyDelivered) imReplyDelivered.style.opacity = "0";
        if (imReply) {
          imReply.classList.add("is-on");
          imReply.style.opacity = "0";
          imReply.style.transform = "translateY(10px) scale(0.96)";
        }
        if (thread) thread.scrollTop = thread.scrollHeight;
        return animate(360, function (t) {
          var u = easeOutExpo(t);
          if (imReply) {
            imReply.style.opacity = String(u);
            imReply.style.transform = "translateY(" + (10 * (1 - u)) + "px) scale(" + (0.96 + 0.04 * u) + ")";
          }
          if (thread) thread.scrollTop = thread.scrollHeight;
        });
      })
      .then(function () {
        if (imReply) { imReply.style.opacity = "1"; imReply.style.transform = ""; }
        return sleep(220);
      })
      .then(function () {
        return animate(240, function (t) {
          if (imReplyDelivered) imReplyDelivered.style.opacity = String(easeOutCubic(t));
        });
      })
      .then(function () {
        if (imReplyDelivered) imReplyDelivered.style.opacity = "1";
        showPage("abc");
        return sleep(160);
      })
      .then(function () { return closeKeyboard(); });
  }

  var asw = document.getElementById("appSwitcher");
  var aswTrack = document.getElementById("aswTrack");
  var aswDim = asw ? asw.querySelector(".asw-dim") : null;
  var aswWall = asw ? asw.querySelector(".asw-wall") : null;
  var switcherOrder = ["messages"];
  var switcherTime = { tt: 1.1, reels: 1.1, shorts: 1.1 };
  var ASW_META = {
    messages: { icon: "assets/img/icons/messages.png", name: "Messages" },
    tt: { icon: "assets/img/icons/tiktok.png", name: "TikTok" },
    reels: { icon: "assets/img/icons/instagram.png", name: "Instagram" },
    shorts: { icon: "assets/img/icons/youtube.png", name: "YouTube" }
  };
  var ASW_CARD_W = 248;
  var ASW_CARD_H = 536;
  var ASW_SLOT = 208;
  var ASW_TOP = 108;

  function rememberSwitcher(app) {
    if (switcherOrder.indexOf(app) === -1) switcherOrder.push(app);
    if (app !== "messages" && video && !isNaN(video.currentTime)) {
      switcherTime[app] = Math.max(0.2, video.currentTime);
    }
  }

  function stripIds(node) {
    if (!node || node.nodeType !== 1) return;
    node.removeAttribute("id");
    var all = node.querySelectorAll("[id]");
    for (var i = 0; i < all.length; i++) all[i].removeAttribute("id");
  }

  function miniStatus() {
    var el = document.createElement("div");
    el.className = "asw-mini-status";
    el.innerHTML = '<span class="t">11:42</span><i class="asw-mini-island"></i>';
    return el;
  }

  function snapshotMessages() {
    var face = document.createElement("div");
    face.className = "asw-face";
    var clone = msgs.cloneNode(true);
    stripIds(clone);
    clone.style.cssText = "position:absolute;inset:0;visibility:visible;opacity:1;transform:none;filter:none;border-radius:0;overflow:hidden";
    var kb = clone.querySelector(".im-kb");
    if (kb) kb.remove();
    clone.classList.remove("is-kb", "is-back");
    face.appendChild(clone);
    face.appendChild(miniStatus());
    return face;
  }

  function snapshotPlayer(app) {
    var face = document.createElement("div");
    face.className = "asw-face";
    var pack = src[app];
    var vid = document.createElement("video");
    vid.setAttribute("playsinline", "");
    vid.muted = true;
    vid.preload = "auto";
    if (pack) {
      vid.setAttribute("poster", pack.poster);
      vid.src = pack.video;
    }
    var t = switcherTime[app] || 1.1;
    try { vid.currentTime = t; } catch (e) {}
    vid.pause && vid.pause();
    var ov = player.querySelector('.ov[data-ov="' + app + '"]');
    if (ov) {
      var cov = ov.cloneNode(true);
      stripIds(cov);
      cov.style.cssText = "position:absolute;inset:0;display:block;opacity:1;visibility:visible";
      face.appendChild(vid);
      face.appendChild(cov);
    } else {
      face.appendChild(vid);
    }
    face.appendChild(miniStatus());
    return face;
  }

  function aswCenterX(focus) {
    return 195 - ASW_CARD_W / 2 - focus * ASW_SLOT;
  }

  function buildSwitcherCards(apps) {
    if (!aswTrack) return [];
    aswTrack.innerHTML = "";
    var n = apps.length;
    var cardW = ASW_CARD_W;
    var cardH = ASW_CARD_H;
    var slot = ASW_SLOT;
    if (n >= 4) {
      cardW = 210;
      cardH = 454;
      slot = 158;
    }
    aswTrack._slot = slot;
    aswTrack._cardW = cardW;
    var nodes = [];
    apps.forEach(function (app, i) {
      var meta = ASW_META[app] || { icon: "", name: app };
      var card = document.createElement("div");
      card.className = "asw-card";
      card.dataset.app = app;
      card.style.width = cardW + "px";
      card.style.left = "0";
      card.style.top = ASW_TOP + "px";
      card.style.transform = "translateX(" + (i * slot) + "px)";
      var lab = document.createElement("div");
      lab.className = "asw-meta";
      lab.innerHTML = '<img src="' + meta.icon + '" alt=""><span>' + meta.name + "</span>";
      var screen = document.createElement("div");
      screen.className = "asw-screen";
      screen.style.width = cardW + "px";
      screen.style.height = cardH + "px";
      var face = app === "messages" ? snapshotMessages() : snapshotPlayer(app);
      var sc = cardW / 390;
      face.style.transform = "scale(" + sc + ")";
      screen.appendChild(face);
      card.appendChild(lab);
      card.appendChild(screen);
      aswTrack.appendChild(card);
      nodes.push(card);
      var v = face.querySelector("video");
      if (v) {
        try { v.currentTime = switcherTime[app] || 1.1; } catch (e) {}
      }
    });
    return nodes;
  }

  function setTrackFocus(focus, n) {
    var slot = (aswTrack && aswTrack._slot) || ASW_SLOT;
    var cardW = (aswTrack && aswTrack._cardW) || ASW_CARD_W;
    var x = 195 - cardW / 2 - focus * slot;
    if (aswTrack) aswTrack.style.transform = "translateX(" + x + "px)";
  }

  function openSwitcher(fromApp) {
    rememberSwitcher("messages");
    rememberSwitcher(fromApp);
    stopProgress();
    try { video.pause(); } catch (e) {}
    if (!asw || !aswTrack) return Promise.resolve();
    var apps = switcherOrder.slice();
    var fromIndex = apps.indexOf(fromApp);
    if (fromIndex < 0) fromIndex = apps.length - 1;
    var nodes = buildSwitcherCards(apps);
    var slot = aswTrack._slot || ASW_SLOT;
    var cardW = aswTrack._cardW || ASW_CARD_W;
    var cardH = (nodes[0] && nodes[0].querySelector(".asw-screen")) ? parseFloat(nodes[0].querySelector(".asw-screen").style.height) : ASW_CARD_H;
    asw.hidden = false;
    asw.style.opacity = "1";
    if (aswWall) aswWall.style.opacity = "0";
    if (aswDim) aswDim.style.opacity = "0";
    setTrackFocus(fromIndex, apps.length);

    var fromCard = nodes[fromIndex];
    var fromScreen = fromCard && fromCard.querySelector(".asw-screen");
    var fromMeta = fromCard && fromCard.querySelector(".asw-meta");
    var fromFace = fromCard && fromCard.querySelector(".asw-face");

    /* Current app starts full-bleed, then shrinks into its card. */
    if (fromScreen) {
      fromScreen.style.width = "390px";
      fromScreen.style.height = "844px";
      fromScreen.style.borderRadius = "0px";
      fromScreen.style.boxShadow = "none";
    }
    if (fromFace) fromFace.style.transform = "scale(1)";
    if (fromMeta) {
      fromMeta.style.opacity = "0";
      fromMeta.style.height = "0px";
      fromMeta.style.margin = "0px";
      fromMeta.style.overflow = "hidden";
    }
    if (fromCard) {
      fromCard.style.top = "0px";
      fromCard.style.width = "390px";
      fromCard.style.zIndex = "3";
      /* pin this card at viewport 0 so it covers the screen at t=0 */
      fromCard.style.transform = "translateX(" + (fromIndex * slot) + "px)";
    }
    /* shift the track so the from-card's left is 0 at start */
    var startTX = -fromIndex * slot;
    var endTX = 195 - cardW / 2 - fromIndex * slot;
    if (aswTrack) aswTrack.style.transform = "translateX(" + startTX + "px)";

    nodes.forEach(function (c, i) {
      if (i === fromIndex) return;
      c.style.opacity = "0";
      c.style.transform = "translateX(" + (i * slot + (i < fromIndex ? -30 : 30)) + "px)";
    });

    /* hide the live player once the snapshot covers it */
    player.style.visibility = "hidden";

    return animate(560, function (t) {
      var u = easeOutCubic(t);
      var ev = t < 0.12 ? t * 0.45 : u; /* hold-and-lift lead-in, like a thumb on the home bar */
      if (aswWall) aswWall.style.opacity = String(Math.min(1, ev * 1.2));
      if (aswDim) aswDim.style.opacity = String(Math.min(1, ev * 1.2));
      if (aswTrack) aswTrack.style.transform = "translateX(" + (startTX + (endTX - startTX) * ev) + "px)";
      if (fromCard) {
        fromCard.style.top = (ASW_TOP * ev) + "px";
        fromCard.style.width = (390 + (cardW - 390) * ev) + "px";
      }
      if (fromScreen) {
        fromScreen.style.width = (390 + (cardW - 390) * ev) + "px";
        fromScreen.style.height = (844 + (cardH - 844) * ev) + "px";
        fromScreen.style.borderRadius = (32 * ev) + "px";
        fromScreen.style.boxShadow = ev > 0.2 ? "0 16px 48px rgba(0,0,0," + (0.5 * ev) + ")" : "none";
      }
      if (fromFace) fromFace.style.transform = "scale(" + (1 + (cardW / 390 - 1) * ev) + ")";
      if (fromMeta) {
        fromMeta.style.opacity = String(Math.max(0, (ev - 0.55) / 0.45));
        fromMeta.style.height = (32 * Math.max(0, (ev - 0.45) / 0.55)) + "px";
        fromMeta.style.marginBottom = (8 * Math.max(0, (ev - 0.45) / 0.55)) + "px";
      }
      nodes.forEach(function (c, i) {
        if (i === fromIndex) return;
        var a = Math.max(0, (ev - 0.28) / 0.72);
        c.style.opacity = String(a);
        var slide = (i < fromIndex ? -30 : 30) * (1 - a);
        c.style.transform = "translateX(" + (i * slot + slide) + "px)";
      });
    }).then(function () {
      if (fromCard) {
        fromCard.style.top = ASW_TOP + "px";
        fromCard.style.width = cardW + "px";
        fromCard.style.transform = "translateX(" + (fromIndex * slot) + "px)";
        fromCard.style.zIndex = "";
      }
      if (fromScreen) {
        fromScreen.style.width = cardW + "px";
        fromScreen.style.height = cardH + "px";
        fromScreen.style.borderRadius = "32px";
      }
      if (fromFace) fromFace.style.transform = "scale(" + (cardW / 390) + ")";
      if (fromMeta) {
        fromMeta.style.opacity = "1";
        fromMeta.style.height = "32px";
        fromMeta.style.marginBottom = "8px";
        fromMeta.style.overflow = "";
      }
      nodes.forEach(function (c, i) {
        c.style.opacity = "1";
        c.style.transform = "translateX(" + (i * slot) + "px)";
      });
      setTrackFocus(fromIndex, apps.length);
      aswTrack._focus = fromIndex;
      resetPlayerInstant();
    });
  }

  function flickToMessages() {
    if (!aswTrack) return Promise.resolve();
    var start = aswTrack._focus || 0;
    var end = 0;
    if (start <= end) return Promise.resolve();
    var slot = aswTrack._slot || ASW_SLOT;
    var cardW = aswTrack._cardW || ASW_CARD_W;
    var startTX = 195 - cardW / 2 - start * slot;
    var endTX = 195 - cardW / 2 - end * slot;
    var dur = 380 + Math.max(0, start - 1) * 240;
    return animate(dur, function (t) {
      /* a flick: quick start, coast, settle — overshoot a hair */
      var u = easeOutCubic(t);
      var ev = t > 0.85 ? u + 0.03 * Math.sin((t - 0.85) / 0.15 * Math.PI) * (1 - u) : u;
      ev = t < 0.1 ? t * 0.35 : ev;
      var x = startTX + (endTX - startTX) * ev;
      aswTrack.style.transform = "translateX(" + x + "px)";
    }).then(function () {
      setTrackFocus(0);
      aswTrack._focus = 0;
    });
  }

  function selectSwitcherCard() {
    if (!aswTrack || !asw) return Promise.resolve();
    var slot = aswTrack._slot || ASW_SLOT;
    var cardW = aswTrack._cardW || ASW_CARD_W;
    var card = aswTrack.querySelector('.asw-card[data-app="messages"]') || aswTrack.querySelector(".asw-card");
    var screen = card && card.querySelector(".asw-screen");
    var face = card && card.querySelector(".asw-face");
    var meta = card && card.querySelector(".asw-meta");
    var others = [];
    if (aswTrack) {
      aswTrack.querySelectorAll(".asw-card").forEach(function (c) {
        if (c !== card) others.push(c);
      });
    }
    /* card is at translateX(0) in a track already focused on messages */
    var startTX = 195 - cardW / 2;
    if (card) card.style.zIndex = "4";
    return animate(480, function (t) {
      var u = easeOutExpo(t);
      if (aswWall) aswWall.style.opacity = String(1 - u);
      if (aswDim) aswDim.style.opacity = String(1 - u);
      if (aswTrack) aswTrack.style.transform = "translateX(" + (startTX * (1 - u)) + "px)";
      if (card) {
        card.style.top = (ASW_TOP * (1 - u)) + "px";
        card.style.width = (cardW + (390 - cardW) * u) + "px";
      }
      if (screen) {
        var ch = parseFloat(screen.style.height) || ASW_CARD_H;
        if (!screen._h0) screen._h0 = ch;
        screen.style.width = (cardW + (390 - cardW) * u) + "px";
        screen.style.height = (screen._h0 + (844 - screen._h0) * u) + "px";
        screen.style.borderRadius = (32 * (1 - u)) + "px";
      }
      if (face) face.style.transform = "scale(" + ((cardW / 390) + (1 - cardW / 390) * u) + ")";
      if (meta) meta.style.opacity = String(Math.max(0, 1 - u * 2));
      others.forEach(function (c) { c.style.opacity = String(1 - u); });
    }).then(function () {
      if (screen) screen._h0 = 0;
      asw.hidden = true;
      aswTrack.innerHTML = "";
      aswTrack.style.transform = "";
      msgs.classList.remove("is-back");
      msgs.style.transform = "";
      msgs.style.filter = "";
      msgs.style.visibility = "visible";
      if (thread) thread.scrollTop = thread.scrollHeight;
    });
  }

  function switchBackToMessages(fromApp) {
    return openSwitcher(fromApp)
      .then(function () { return sleep(260); })
      .then(function () { return flickToMessages(); })
      .then(function () { return sleep(200); })
      .then(function () { return selectSwitcherCard(); });
  }

  function closeKeyboard() {
    showPage("abc");
    if (!imKb) {
      if (msgs) msgs.classList.remove("is-kb");
      return Promise.resolve();
    }
    var compose = document.getElementById("imCompose");
    return animate(360, function (t) {
      var u = easeOutCubic(t);
      imKb.style.transform = "translateY(" + (u * 100) + "%)";
      /* composer rides down with the keyboard, like real iOS */
      if (compose) {
        compose.style.bottom = (292 * (1 - u)) + "px";
        compose.style.paddingBottom = (8 + 26 * u) + "px";
      }
      if (thread) thread.style.paddingBottom = (356 - 264 * u) + "px";
    }).then(function () {
      imKb.hidden = true;
      imKb.style.transform = "";
      if (compose) { compose.style.bottom = ""; compose.style.paddingBottom = ""; }
      if (thread) thread.style.paddingBottom = "";
      if (msgs) msgs.classList.remove("is-kb");
      if (imField) imField.classList.remove("is-active");
      if (thread) thread.scrollTop = thread.scrollHeight;
    });
  }

  function arriveLate() {
    if (!imLate) return Promise.resolve();
    imLate.classList.add("is-on");
    imLate.style.opacity = "0";
    imLate.style.maxHeight = "0px";
    imLate.style.transform = "translateY(12px) scale(0.96)";
    /* scroll to bottom so the new bubble is visible */
    var target = thread.scrollHeight;
    return animate(420, function (t) {
      var u = easeOutExpo(t);
      imLate.style.opacity = String(u);
      imLate.style.maxHeight = (80 * u) + "px";
      imLate.style.transform = "translateY(" + (12 * (1 - u)) + "px) scale(" + (0.96 + 0.04 * u) + ")";
      thread.scrollTop = thread.scrollTop + (Math.max(thread.scrollHeight - thread.clientHeight, thread.scrollTop) - thread.scrollTop) * u;
    }).then(function () {
      imLate.style.opacity = "1";
      imLate.style.maxHeight = "";
      imLate.style.transform = "";
      thread.scrollTop = thread.scrollHeight;
    });
  }

  function problemRun() {
    running = true;
    root.classList.add("is-locked");
    if (lockScreen) lockScreen.hidden = false;
    if (homeScreen) homeScreen.hidden = true;
    if (lsDim) lsDim.style.opacity = "0.38";
    thread.scrollTop = 0;
    if (imLate) imLate.classList.remove("is-on");
    return sleep(700)
      .then(function () { return showNote(0); })
      .then(function () { return sleep(700); })
      .then(function () { return showNote(1); })
      .then(function () { return sleep(640); })
      .then(function () { return showNote(2); })
      .then(function () { return sleep(900); })
      .then(function () { return pickup(); })
      .then(function () { return sleep(220); })
      .then(function () { return faceId(); })
      .then(function () { return sleep(380); })
      .then(function () { return swipeToHome(); })
      .then(function () { return sleep(420); })
      .then(function () { return openMessagesFromDock(); })
      .then(function () { return sleep(520); })
      .then(function () { return rubberScroll(thread, -6, 360); })
      .then(function () { return sleep(280); })
      .then(function () { return hop("tt"); })
      .then(function () { return hop("reels"); })
      .then(function () { return hop("shorts"); })
      .then(function () { return sleep(280); })
      .then(function () { return arriveLate(); })
      .then(function () { return sleep(220); })
      .then(function () { return typeEnding(); })
      .then(function () { return sleep(1100); })
      .then(function () { window.__demoDone = true; });
  }

  function captureRun() {
    running = true;
    thread.scrollTop = 0;
    return rubberScroll(thread, -8, 400)
      .then(function () { return sleep(800); })
      .then(function () { return hop("tt"); })
      .then(function () { return hop("reels"); })
      .then(function () { return hop("shorts"); })
      .then(function () { return sleep(550); })
      .then(function () { return payoff(); })
      .then(function () {
        window.__demoDone = true;
      });
  }

  window.__demoBegin = function () {
    if (running) return;
    if (problem) problemRun();
    else captureRun();
  };

  function holdApp(app) {
    var pack = src[app];
    player.hidden = false;
    player.dataset.app = app;
    player.classList.add("is-open");
    player.style.cssText = "position:absolute;left:0;top:0;width:390px;height:844px;visibility:visible;border-radius:0;z-index:8";
    video.setAttribute("poster", pack.poster);
    video.src = pack.video;
    video.currentTime = 0.4;
    video.play().catch(function () {});
    startProgress();
  }

  if (reduce && !capture) {
    thread.scrollTop = 0;
    return;
  }
  if (demoMode === "tt" || demoMode === "reels" || demoMode === "shorts") {
    holdApp(demoMode);
    return;
  }
  if (capture) {
    /* preload every clip, then wait for the capturer to call __demoBegin */
    var ready = [];
    function preload(v) {
      if (!v) return;
      v.muted = true;
      v.playsInline = true;
      v.pause();
      ready.push(new Promise(function (resolve) {
        if (v.readyState >= 2) { resolve(); return; }
        v.addEventListener("loadeddata", function () { resolve(); }, { once: true });
        setTimeout(resolve, 4000);
      }));
    }
    preload(video);
    ["tt", "reels", "shorts"].forEach(function (k) {
      var el = document.createElement("video");
      el.preload = "auto";
      el.muted = true;
      el.src = src[k].video;
      preload(el);
    });
    slItems.forEach(function (it) { preload(it.querySelector("video")); });
    Promise.all(ready).then(function () { window.__demoReady = true; });
    setTimeout(function () { window.__demoReady = true; }, 2500);
    window.__demoCapture = true;
    return;
  }

  /* preload clips so the first open is immediate */
  ["tt", "reels", "shorts"].forEach(function (k) {
    var v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = src[k].video;
  });

  var started = false;
  function start() {
    if (started) return;
    started = true;
    loop();
  }

  if (typeof IntersectionObserver === "function") {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) start();
      });
    }, { threshold: 0.25 });
    io.observe(root);
  } else {
    start();
  }
})();
