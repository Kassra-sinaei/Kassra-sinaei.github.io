/* =========================================================================
   Kasra Sinaei — site behaviour
   ========================================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------------
     Signature: a control barrier function safety filter, running live.

     Blue trajectories follow a nominal drift to the right. An amber contour
     marks the boundary of the admissible set. Whenever a trajectory would
     cross it, the min-norm correction

         u = u_nom + max(0, -(h_dot + alpha*h)) * n

     pushes it back along the outward normal, so it glides along the
     boundary instead of entering.
     --------------------------------------------------------------------- */
  function safeSetField(canvas) {
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = 1;
    var particles = [];
    var obstacles = [];
    var raf = null, running = false;

    var COUNT = 42;
    var TRAIL = 135;
    var SPEED = 0.8;
    var ALPHA = 1.5;     // CBF class-K gain
    var MARGIN = 26;     // keep-out cushion, px

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var s = Math.min(W, H);
      obstacles = [
        { x: W * 0.62, y: H * 0.44, r: s * 0.155 },
        { x: W * 0.86, y: H * 0.74, r: s * 0.085 }
      ];
      seed();
    }

    function spawn(atEdge) {
      return {
        x: atEdge ? -20 - Math.random() * W * 0.4 : Math.random() * W,
        y: Math.random() * H,
        phase: Math.random() * Math.PI * 2,
        speed: SPEED * (0.72 + Math.random() * 0.6),
        trail: []
      };
    }

    function seed() {
      particles = [];
      for (var i = 0; i < COUNT; i++) particles.push(spawn(false));
    }

    /* one integration step, with the safety filter applied */
    function step(p, dt) {
      // nominal control: drift right with a slow vertical weave
      p.phase += 0.006 * dt;
      var vx = p.speed, vy = Math.sin(p.phase) * 0.30;

      // safety filter — one constraint per obstacle, applied in sequence
      for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        var dx = p.x - o.x, dy = p.y - o.y;
        var d = Math.hypot(dx, dy) || 1e-6;
        var h = d - (o.r + MARGIN);          // h(x) >= 0 is safe
        if (h > 90) continue;                // constraint inactive, skip
        var nx = dx / d, ny = dy / d;        // outward normal
        var hdot = vx * nx + vy * ny;
        var slack = -(hdot + ALPHA * h);
        if (slack > 0) { vx += slack * nx; vy += slack * ny; }
      }

      // renormalise so the glide reads at a steady pace
      var m = Math.hypot(vx, vy) || 1e-6;
      vx = (vx / m) * p.speed;
      vy = (vy / m) * p.speed;

      p.x += vx * dt;
      p.y += vy * dt;

      p.trail.push(p.x, p.y);
      if (p.trail.length > TRAIL * 2) p.trail.splice(0, 2);
    }

    function drawBoundaries() {
      for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(232, 163, 61, 0.045)";
        ctx.fill();
        ctx.strokeStyle = "rgba(232, 163, 61, 0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // the cushion the filter actually enforces
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r + MARGIN, 0, Math.PI * 2);
        ctx.setLineDash([3, 6]);
        ctx.strokeStyle = "rgba(232, 163, 61, 0.22)";
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    function drawTrails() {
      var BANDS = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (var i = 0; i < particles.length; i++) {
        var t = particles[i].trail;
        var n = t.length / 2;
        if (n < 3) continue;

        for (var b = 0; b < BANDS; b++) {
          var from = Math.floor((b / BANDS) * (n - 1));
          var to = Math.floor(((b + 1) / BANDS) * (n - 1));
          if (to - from < 1) continue;
          var f = (b + 1) / BANDS;

          ctx.beginPath();
          ctx.moveTo(t[from * 2], t[from * 2 + 1]);
          for (var j = from + 1; j <= to; j++) ctx.lineTo(t[j * 2], t[j * 2 + 1]);
          ctx.strokeStyle = "rgba(61, 139, 253," + (f * f * 0.55).toFixed(3) + ")";
          ctx.lineWidth = 0.5 + f * 1.6;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(t[t.length - 2], t[t.length - 1], 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(158, 199, 255, 0.9)";
        ctx.fill();
      }
    }

    function frame() {
      ctx.clearRect(0, 0, W, H);
      drawBoundaries();
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        step(p, 1);
        if (p.x > W + 40) particles[i] = spawn(true);
      }
      drawTrails();
      raf = requestAnimationFrame(frame);
    }

    function still() {
      // reduced motion: integrate silently, then render the finished picture
      ctx.clearRect(0, 0, W, H);
      drawBoundaries();
      for (var i = 0; i < particles.length; i++) {
        particles[i].x = -30;
        particles[i].trail = [];
        for (var k = 0; k < 320; k++) step(particles[i], 1.6);
      }
      drawTrails();
    }

    function start() { if (!running && !reduceMotion) { running = true; frame(); } }
    function stop() { if (running) { running = false; cancelAnimationFrame(raf); } }

    function preroll() {
      for (var i = 0; i < particles.length; i++) {
        for (var k = 0; k < TRAIL; k++) step(particles[i], 1);
      }
    }

    resize();
    if (reduceMotion) { still(); } else { preroll(); start(); }

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); if (reduceMotion) still(); }, 200);
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0.01 }).observe(canvas);
    }
  }

  var heroCanvas = document.getElementById("field");
  if (heroCanvas && heroCanvas.getContext) {
    try { safeSetField(heroCanvas); } catch (e) { heroCanvas.style.display = "none"; }
  }

  /* --------------------------- mobile drawer --------------------------- */

  var rail = document.getElementById("rail");
  var toggle = document.getElementById("navToggle");
  var scrim = document.getElementById("scrim");

  function setNav(open) {
    rail.classList.toggle("is-open", open);
    scrim.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      setNav(toggle.getAttribute("aria-expanded") !== "true");
    });
    scrim.addEventListener("click", function () { setNav(false); });
  }

  /* ------------------------ nav + scroll spy --------------------------- */

  var links = Array.prototype.slice.call(document.querySelectorAll(".rail__nav a"));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  links.forEach(function (a) {
    a.addEventListener("click", function () {
      if (window.innerWidth <= 1000) setNav(false);
    });
  });

  function spy() {
    var y = window.scrollY + window.innerHeight * 0.32;
    var current = sections[0];
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= y) current = sections[i];
    }
    links.forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("href") === "#" + current.id);
    });
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { spy(); ticking = false; });
  }, { passive: true });
  spy();

  /* --------------------------- scroll reveal --------------------------- */

  var reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }


  /* ---------------------------- slideshow ------------------------------ */

  var deck = document.getElementById("slides");
  if (deck) {
    var imgs = Array.prototype.slice.call(deck.querySelectorAll(".slides__img"));
    var dots = Array.prototype.slice.call(deck.querySelectorAll(".slides__dot"));
    var wait = parseInt(deck.dataset.interval, 10) || 5000;
    var at = 0, timer = null, held = false, seen = true;

    if (reduceMotion) deck.classList.add("is-static");

    function go(next) {
      if (next === at) return;
      imgs[at].classList.remove("is-on");
      dots[at].classList.remove("is-on");
      at = (next + imgs.length) % imgs.length;
      // re-adding the class restarts the drift on the incoming slide
      void imgs[at].offsetWidth;
      imgs[at].classList.add("is-on");
      dots[at].classList.add("is-on");
    }

    function play() {
      stop();
      if (reduceMotion || held || !seen) return;
      timer = setInterval(function () { go(at + 1); }, wait);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    dots.forEach(function (d, i) {
      d.addEventListener("click", function () { go(i); play(); });
    });

    // don't advance under the reader's cursor, or while a dot has focus
    deck.addEventListener("mouseenter", function () { held = true; stop(); });
    deck.addEventListener("mouseleave", function () { held = false; play(); });
    deck.addEventListener("focusin", function () { held = true; stop(); });
    deck.addEventListener("focusout", function () { held = false; play(); });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        seen = es[0].isIntersecting;
        seen ? play() : stop();
      }, { threshold: 0.15 }).observe(deck);
    }
    play();
  }

  /* ---------------------------- figures -------------------------------- */

  var figs = Array.prototype.slice.call(document.querySelectorAll(".figure__n"));
  if (figs.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      figs.forEach(function (n) { n.textContent = n.dataset.to; });
    } else {
      var fio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          fio.unobserve(en.target);
          var el = en.target, to = parseInt(el.dataset.to, 10) || 0, t0 = null;
          el.textContent = "0";
          (function tick(ts) {
            if (t0 === null) t0 = ts;
            var k = Math.min((ts - t0) / 1100, 1);
            el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
            if (k < 1) requestAnimationFrame(tick);
          })(performance.now());
        });
      }, { threshold: 0.5 });
      figs.forEach(function (n) { fio.observe(n); });
    }
  }

  /* ----------------------------- lightbox ------------------------------ */

  var box = document.getElementById("lightbox");
  var boxImg = box.querySelector("img");
  var shots = Array.prototype.slice.call(document.querySelectorAll(".shot"));
  var index = -1;

  function show(i) {
    index = (i + shots.length) % shots.length;
    var fig = shots[index];
    boxImg.src = fig.dataset.full;
    boxImg.alt = fig.querySelector("img").alt;
    box.classList.add("is-open");
    document.body.style.overflow = "hidden";
    box.querySelector(".lightbox__close").focus();
  }

  function hide() {
    box.classList.remove("is-open");
    document.body.style.overflow = "";
    if (index > -1) shots[index].focus();
  }

  shots.forEach(function (fig, i) {
    fig.setAttribute("tabindex", "0");
    fig.setAttribute("role", "button");
    fig.addEventListener("click", function () { show(i); });
    fig.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(i); }
    });
  });

  box.querySelector(".lightbox__close").addEventListener("click", hide);
  box.addEventListener("click", function (e) { if (e.target === box) hide(); });

  document.addEventListener("keydown", function (e) {
    if (!box.classList.contains("is-open")) return;
    if (e.key === "Escape") hide();
    if (e.key === "ArrowRight") show(index + 1);
    if (e.key === "ArrowLeft") show(index - 1);
  });

  /* ------------------------------ year --------------------------------- */

  var yr = String(new Date().getFullYear());
  Array.prototype.forEach.call(document.querySelectorAll(".year"), function (el) {
    el.textContent = yr;
  });
})();
