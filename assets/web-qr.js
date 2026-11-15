/* Desktop and any non-iPhone device: web CTAs and App Store badges
   open a QR panel instead of following the link. On iPhone, both
   kinds of button go through as usual. */
(function () {
  const PANELS = {
    web: {
      url: "https://web.seelater.app",
      qr: "/assets/img/qr-web.svg",
      title: "Open it on your iPhone",
      displayUrl: "web.seelater.app",
      note: "Works in Safari on iPhone",
    },
    store: {
      url: "https://seelater.app",
      qr: "/assets/img/qr-app.svg",
      title: "Get it on your iPhone",
      displayUrl: "seelater.app",
      note: "The SeeLater iPhone app",
    },
  };

  function isIPhone() {
    return /iPhone|iPod/.test(navigator.userAgent || "");
  }

  function shouldOpenPanel() {
    if (isIPhone()) return false;
    return true;
  }

  let dialog;

  function ensurePanel() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "web-qr";
    dialog.id = "web-qr";
    dialog.setAttribute("aria-labelledby", "web-qr-title");
    dialog.innerHTML =
      '<button type="button" class="web-qr-close" aria-label="Close">' +
        '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
          '<path d="M3.2 3.2 12.8 12.8M12.8 3.2 3.2 12.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
        "</svg>" +
      "</button>" +
      '<img class="web-qr-code" src="' + PANELS.web.qr + '" width="180" height="180" alt="">' +
      '<p class="web-qr-title" id="web-qr-title"></p>' +
      '<p class="web-qr-url"></p>' +
      '<p class="web-qr-note"></p>';
    document.body.appendChild(dialog);

    dialog.querySelector(".web-qr-close").addEventListener("click", close);
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) close();
    });
    return dialog;
  }

  function fill(kind) {
    const panel = PANELS[kind] || PANELS.web;
    const root = ensurePanel();
    const img = root.querySelector(".web-qr-code");
    img.src = panel.qr;
    img.alt = "QR code that opens " + panel.url;
    root.querySelector(".web-qr-title").textContent = panel.title;
    root.querySelector(".web-qr-url").textContent = panel.displayUrl;
    root.querySelector(".web-qr-note").textContent = panel.note;
  }

  function open(kind) {
    fill(kind || "web");
    ensurePanel().showModal();
  }

  function close() {
    if (dialog && dialog.open) dialog.close();
  }

  document.addEventListener("click", function (e) {
    const web = e.target.closest("a.web-cta");
    const store = e.target.closest("a.store-badge");
    if (!web && !store) return;
    if (!shouldOpenPanel()) return;
    e.preventDefault();
    open(web ? "web" : "store");
  });

  window.__webQr = { open, close, shouldOpenPanel, isIPhone };
})();
