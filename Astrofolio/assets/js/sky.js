/* =========================================================================
   Astrofolio
   ========================================================================= */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------------
     A long exposure on the celestial pole.

     Stars sit at a fixed radius from the pole and share one angular rate,
     so the sky turns rigidly the way it actually does: stars near the pole
     scribe short arcs, stars far from it sweep long ones. Each frame lays
     down a faint wash of sky colour before the stars are drawn, so the
     trails accumulate and then fade at the tail — the same thing that
     happens on the sensor during a stacked star-trail exposure.
     --------------------------------------------------------------------- */
  function starTrails(cv) {
    var ctx = cv.getContext("2d");
    var W = 0, H = 0, dpr = 1, stars = [], pole = { x: 0, y: 0 };
    var raf = null, running = false;

    var RATE = 0.00042;   // radians per frame
    var FADE = 0.0075;    // how fast the tail of a trail gives up

    /* rough main-sequence colours, hot to cool */
    var SPECTRAL = [
      [174, 198, 255], [202, 218, 255], [232, 238, 255],
      [255, 244, 232], [255, 233, 196], [255, 210, 161], [255, 176, 138]
    ];

    function seed() {
      var n = Math.round(Math.min(3600, (W * H) / 420));
      stars = [];
      for (var i = 0; i < n; i++) {
        // scatter over a box larger than the canvas so trails enter from off-frame
        var x = -W * 0.5 + Math.random() * W * 2;
        var y = -H * 0.6 + Math.random() * H * 2.2;
        var dx = x - pole.x, dy = y - pole.y;
        var r = Math.hypot(dx, dy);
        if (r < 4) continue;
        // a steep brightness distribution — a very few bright, most faint
        var m = Math.pow(Math.random(), 3.1);
        stars.push({
          r: r,
          a: Math.atan2(dy, dx),
          b: 0.16 + m * 0.84,
          c: SPECTRAL[(Math.random() * SPECTRAL.length) | 0]
        });
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pole.x = W * 0.80; pole.y = H * 0.30;
      ctx.fillStyle = "#05070E";
      ctx.fillRect(0, 0, W, H);
      seed();
    }

    /* one frame of the exposure */
    function step(rate) {
      ctx.fillStyle = "rgba(5, 7, 14, " + FADE + ")";
      ctx.fillRect(0, 0, W, H);

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.a += rate;
        var x = pole.x + Math.cos(s.a) * s.r;
        var y = pole.y + Math.sin(s.a) * s.r;
        if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
        ctx.fillStyle = "rgba(" + s.c[0] + "," + s.c[1] + "," + s.c[2] + "," + (s.b * 0.75).toFixed(3) + ")";
        var size = s.b > 0.82 ? 1.5 : 1;
        ctx.fillRect(x, y, size, size);
      }

      // the pole itself: nothing moves here
      ctx.fillStyle = "rgba(232, 163, 61, 0.55)";
      ctx.fillRect(pole.x - 1, pole.y - 1, 2, 2);
    }

    function draw() { step(RATE); raf = requestAnimationFrame(draw); }

    /* the exposure is already part-way along when the page arrives, so the
       sky reads as trails immediately rather than as a scatter of dots */
    function preroll(frames, rate) {
      ctx.fillStyle = "#05070E";
      ctx.fillRect(0, 0, W, H);
      for (var k = 0; k < frames; k++) step(rate);
    }

    function still() { preroll(700, RATE * 2.6); }

    function start() { if (!running && !reduce) { running = true; draw(); } }
    function stop() { if (running) { running = false; cancelAnimationFrame(raf); } }

    resize();
    if (reduce) { still(); } else { preroll(460, RATE * 1.5); start(); }

    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () { resize(); if (reduce) still(); }, 220);
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { e[0].isIntersecting ? start() : stop(); },
        { threshold: 0.01 }).observe(cv);
    }
  }

  var cv = document.getElementById("trails");
  if (cv && cv.getContext) { try { starTrails(cv); } catch (e) { cv.style.display = "none"; } }

  /* ----------------------------- plates -------------------------------- */

  var plates = Array.prototype.slice.call(document.querySelectorAll(".plate"));
  var shown = plates.slice();

  if (reduce || !("IntersectionObserver" in window)) {
    plates.forEach(function (p) { p.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
    plates.forEach(function (p) { io.observe(p); });
  }

  /* ----------------------------- filters ------------------------------- */

  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var count = document.getElementById("count");

  function filter(key) {
    shown = [];
    plates.forEach(function (p) {
      var on = key === "all" || p.dataset.filter === key;
      p.hidden = !on;
      if (on) { shown.push(p); p.classList.add("is-in"); }
    });
    if (count) count.textContent = shown.length + (shown.length === 1 ? " plate" : " plates");
  }

  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      chips.forEach(function (o) { o.classList.remove("is-on"); o.setAttribute("aria-pressed", "false"); });
      c.classList.add("is-on"); c.setAttribute("aria-pressed", "true");
      filter(c.dataset.key);
    });
  });
  filter("all");

  /* ---------------------------- the log -------------------------------- */

  var view = document.getElementById("view");
  var vImg = view.querySelector(".view__stage img");
  var vCat = view.querySelector(".view__cat");
  var vName = view.querySelector(".view__name");
  var vType = view.querySelector(".view__type");
  var vNote = view.querySelector(".view__note");
  var vLog = view.querySelector(".log");
  var idx = -1;

  var FIELDS = [
    ["con",   "Constellation"],
    ["radec", "RA / Dec"],
    ["site",  "Site"],
    ["gear",  "Optics"],
    ["exp",   "Integration"]
  ];

  function open(i) {
    if (!shown.length) return;
    idx = (i + shown.length) % shown.length;
    var p = shown[idx], d = p.dataset;

    vImg.src = d.full;
    vImg.alt = p.querySelector("img").alt;
    vCat.textContent = d.cat && d.cat !== "—" ? d.cat : "Uncatalogued";
    vName.textContent = d.name;
    vType.textContent = d.type;
    vNote.textContent = d.note || "";
    vNote.hidden = !d.note;

    var rows = "";
    FIELDS.forEach(function (f) {
      if (d[f[0]] && d[f[0]] !== "—") rows += "<tr><th>" + f[1] + "</th><td>" + d[f[0]] + "</td></tr>";
    });
    vLog.innerHTML = rows;

    view.classList.add("is-open");
    document.body.style.overflow = "hidden";
    view.querySelector(".view__close").focus();
  }

  function close() {
    view.classList.remove("is-open");
    document.body.style.overflow = "";
    if (idx > -1 && shown[idx]) shown[idx].focus();
  }

  plates.forEach(function (p) {
    p.addEventListener("click", function () { open(shown.indexOf(p)); });
  });

  view.querySelector(".view__close").addEventListener("click", close);
  view.querySelector(".view__prev").addEventListener("click", function () { open(idx - 1); });
  view.querySelector(".view__next").addEventListener("click", function () { open(idx + 1); });
  view.addEventListener("click", function (e) { if (e.target === view) close(); });

  document.addEventListener("keydown", function (e) {
    if (!view.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") open(idx + 1);
    if (e.key === "ArrowLeft") open(idx - 1);
  });

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
