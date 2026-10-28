/**
 * ==============================================================================
 * AOLA FLAPPY BURGER - SIMULATION INTERFACE GAME ENGINE
 * ==============================================================================
 * Key Updates:
 * 1. Render Obstacles: Initialized with pre-spawned Chef Spatulas actively moving left.
 * 2. Appetizing Background: Grid removed; warm restaurant lighting & dining counter.
 * 3. Frosted Glass UI: Glassmorphic Start Screen and Digital Thermal Receipt Overlays.
 * 4. Food Crumb Particles: Crunchy golden breadcrumbs & sesame seed bursts on score.
 * 5. Screen-Shake Physics: Container shockwave & red impact flash on collision.
 * 6. Zero Alert Dialogs: Native browser alert/prompt replaced with in-app toasts.
 */

(function () {
  'use strict';

  // --- PRODUCTION ANTI-LEAK PROTOCOL: SUPPRESS CONSOLE IN PROD ---
  (function initGameAntiLeak() {
    if (typeof window === "undefined" || !window.console) return;
    try {
      const hostname = window.location.hostname || "";
      const isLocalDev = (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "[::1]" ||
        hostname.endsWith(".local") ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname === ""
      );
      let debugAllowed = false;
      try {
        const urlParams = new URLSearchParams(window.location.search);
        debugAllowed = (
          urlParams.get("debug") === "1" ||
          sessionStorage.getItem("AOLA_DEBUG") === "1" ||
          localStorage.getItem("AOLA_DEBUG") === "1"
        );
      } catch (e) {}

      if (!isLocalDev && !debugAllowed) {
        const noop = function () {};
        console.log = noop;
        console.info = noop;
        console.debug = noop;
        console.warn = noop;
        console.error = noop;
        console.table = noop;
        console.trace = noop;
      }
    } catch (err) {}
  })();

  // --- CRYPTOGRAPHIC & STATE OBFUSCATION CONSTANTS ---
  const MASK_A = 0x5a3f2c1d;
  const MASK_B = 0x2c1d5a3f;
  const CLIENT_SALT = "AOLA_CLIENT_GAME_SALT_v1";

  // --- PRIVATE GAME STATE (Encapsulated) ---
  let _encScoreA = 0 ^ MASK_A;
  let _encScoreB = 0 ^ MASK_B;
  let _canarySum = 0;
  let _tamperDetected = false;

  let _activeOrderId = null;
  let _prefilledPlayerName = "";
  let _activeSessionToken = null;
  let _activeSessionId = null;
  let _activeNonce = null;
  let _gameStartTime = 0;
  let _jumpCounter = 0;
  let _flapsTelemetry = [];

  let _gameState = "LOCKED"; // "LOCKED" | "START_SCREEN" | "PLAYING" | "GAMEOVER"
  let _dailyPrizeDescription = "Free Specialty Dessert with Ice Cream";
  let _cachedLeaderboard = [];
  let _isMuted = true; // STRICT REQUIREMENT: Muted by default

  // --- VIRTUAL VIEWPORT RESOLUTION (Fixed 2:3 ratio) ---
  const V_WIDTH = 400;
  const V_HEIGHT = 600;
  let canvas = null;
  let ctx = null;
  let animationFrameId = null;

  // High-Quality Inline SVG Burger Sprite (Brioche sesame bun, wavy lettuce, ripe tomato, melted cheese, thick grilled patty)
  const BURGER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="120" height="100">
    <defs>
      <linearGradient id="topBunGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#F6AD55"/>
        <stop offset="38%" stop-color="#ED8936"/>
        <stop offset="100%" stop-color="#C05621"/>
      </linearGradient>
      <linearGradient id="bunGloss" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.1)"/>
        <stop offset="45%" stop-color="rgba(255,255,255,0.7)"/>
        <stop offset="85%" stop-color="rgba(255,255,255,0.1)"/>
      </linearGradient>
      <linearGradient id="pattyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#5F370E"/>
        <stop offset="55%" stop-color="#451A03"/>
        <stop offset="100%" stop-color="#260C02"/>
      </linearGradient>
      <linearGradient id="tomatoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#F56565"/>
        <stop offset="100%" stop-color="#C53030"/>
      </linearGradient>
      <linearGradient id="cheeseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#F6E05E"/>
        <stop offset="100%" stop-color="#D69E2E"/>
      </linearGradient>
      <linearGradient id="botBunGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ED8936"/>
        <stop offset="100%" stop-color="#9C4221"/>
      </linearGradient>
      <filter id="burgerDropShadow" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="rgba(35,15,5,0.35)"/>
      </filter>
    </defs>
    <g filter="url(#burgerDropShadow)">
      <!-- 1. Bottom Bun -->
      <path d="M 16 75 C 16 87 28 92 60 92 C 92 92 104 87 104 75 C 104 72 96 71 60 71 C 24 71 16 72 16 75 Z" fill="url(#botBunGrad)"/>
      <ellipse cx="60" cy="73" rx="42" ry="3.5" fill="#C05621" opacity="0.6"/>

      <!-- 2. Thick Grilled Brown Patty with Charred Grill Marks -->
      <rect x="12" y="58" width="96" height="15" rx="7.5" fill="url(#pattyGrad)"/>
      <line x1="28" y1="60" x2="40" y2="71" stroke="#1D0801" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="48" y1="60" x2="60" y2="71" stroke="#1D0801" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="68" y1="60" x2="80" y2="71" stroke="#1D0801" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="88" y1="60" x2="95" y2="67" stroke="#1D0801" stroke-width="2.5" stroke-linecap="round"/>

      <!-- 3. Melted Yellow Cheddar Cheese Corners -->
      <polygon points="14,56 106,56 98,63 76,70 66,61 48,73 38,59 22,67" fill="url(#cheeseGrad)"/>

      <!-- 4. Ripe Red Tomato Slices -->
      <rect x="16" y="48" width="42" height="9" rx="4.5" fill="url(#tomatoGrad)"/>
      <circle cx="28" cy="52.5" r="1.5" fill="#FED7D7"/>
      <circle cx="44" cy="52.5" r="1.5" fill="#FED7D7"/>
      <rect x="62" y="48" width="42" height="9" rx="4.5" fill="url(#tomatoGrad)"/>
      <circle cx="74" cy="52.5" r="1.5" fill="#FED7D7"/>
      <circle cx="90" cy="52.5" r="1.5" fill="#FED7D7"/>

      <!-- 5. Wavy Green Crinkle Lettuce -->
      <path d="M 8 46 C 14 41 20 50 28 45 C 36 40 42 49 50 44 C 58 39 64 48 72 44 C 80 40 86 49 94 44 C 102 39 108 48 112 46 C 114 48 110 52 102 52 C 92 52 86 49 76 51 C 66 53 58 50 48 52 C 38 54 30 50 20 52 C 12 54 6 49 8 46 Z" fill="#48BB78"/>
      <path d="M 12 47 C 18 43 24 49 32 46 C 40 43 46 48 54 45 C 62 42 68 47 76 45 C 84 43 90 48 98 45 C 104 42 108 47 108 47" stroke="#2F855A" stroke-width="1.2" fill="none"/>

      <!-- 6. Golden Toasted Brioche Top Bun with Gloss -->
      <path d="M 12 42 C 12 12 30 6 60 6 C 90 6 108 12 108 42 C 108 44 98 45 60 45 C 22 45 12 44 12 42 Z" fill="url(#topBunGrad)"/>
      <ellipse cx="60" cy="16" rx="34" ry="7" fill="url(#bunGloss)" opacity="0.75"/>

      <!-- 7. White & Ivory Sesame Seeds -->
      <g fill="#FFFDF0" stroke="#E2E8F0" stroke-width="0.3">
        <ellipse cx="32" cy="18" rx="2.5" ry="1.4" transform="rotate(-20 32 18)"/>
        <ellipse cx="48" cy="13" rx="2.5" ry="1.4" transform="rotate(15 48 13)"/>
        <ellipse cx="64" cy="12" rx="2.5" ry="1.4" transform="rotate(-10 64 12)"/>
        <ellipse cx="80" cy="15" rx="2.5" ry="1.4" transform="rotate(25 80 15)"/>
        <ellipse cx="40" cy="26" rx="2.5" ry="1.4" transform="rotate(-30 40 26)"/>
        <ellipse cx="56" cy="22" rx="2.5" ry="1.4" transform="rotate(5 56 22)"/>
        <ellipse cx="72" cy="24" rx="2.5" ry="1.4" transform="rotate(-15 72 24)"/>
        <ellipse cx="88" cy="26" rx="2.5" ry="1.4" transform="rotate(35 88 26)"/>
        <ellipse cx="24" cy="28" rx="2.2" ry="1.2" transform="rotate(-15 24 28)"/>
        <ellipse cx="94" cy="33" rx="2.2" ry="1.2" transform="rotate(20 94 33)"/>
        <ellipse cx="50" cy="32" rx="2.4" ry="1.3" transform="rotate(10 50 32)"/>
        <ellipse cx="68" cy="33" rx="2.4" ry="1.3" transform="rotate(-25 68 33)"/>
      </g>
    </g>
  </svg>`;

  const burgerImg = new Image();
  burgerImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(BURGER_SVG);

  // Player (Flying Gourmet Burger)
  const player = {
    x: 75,
    y: 260,
    w: 46,
    h: 38,
    vy: 0,
    gravity: 0.44,
    jumpStrength: -7.2,
    wingAngle: 0,
    rotation: 0
  };

  // Obstacle Pool & Spacing
  let obstacles = [];
  let frameCount = 0;

  // Particle System (Food Crumbs, Sesame Seeds, Stars)
  let particles = [];

  // ==========================================================================
  // 1. TAMPER-PROOF SCORE ENGINE (Dual XOR + Canary Checksum)
  // ==========================================================================
  function getScore() {
    const sA = _encScoreA ^ MASK_A;
    const sB = _encScoreB ^ MASK_B;
    if (sA !== sB || (sA + sB) !== _canarySum) {
      _tamperDetected = true;
      return -1;
    }
    return sA;
  }

  function updateScoreDOM(isPop = false) {
    const curScore = getScore();
    const scoreEl = document.getElementById("game-dynamic-score");
    if (scoreEl) {
      scoreEl.textContent = curScore >= 0 ? curScore.toString() : "0";
      if (isPop) {
        scoreEl.classList.remove("score-pop");
        void scoreEl.offsetWidth; // Force DOM reflow
        scoreEl.classList.add("score-pop");
      }
    }
  }

  function incrementScore(obsX, obsY) {
    let sA = _encScoreA ^ MASK_A;
    let sB = _encScoreB ^ MASK_B;
    if (sA !== sB || (sA + sB) !== _canarySum) {
      _tamperDetected = true;
      return;
    }
    sA += 1;
    sB += 1;
    _encScoreA = sA ^ MASK_A;
    _encScoreB = sB ^ MASK_B;
    _canarySum = sA + sB;

    // Trigger food crumb particle bursts
    spawnFoodCrumbs(obsX || (player.x + 20), obsY || player.y);
    updateScoreDOM(true);
    playAcousticSound("score");
  }

  function resetScore() {
    _encScoreA = 0 ^ MASK_A;
    _encScoreB = 0 ^ MASK_B;
    _canarySum = 0;
    _tamperDetected = false;
    _jumpCounter = 0;
    _flapsTelemetry = [];
    particles = [];
    updateScoreDOM(false);
  }

  // ==========================================================================
  // 2. OBSTACLE INITIALIZATION & PRE-SPAWNING (Fixes blank interface)
  // ==========================================================================
  function initObstacles() {
    // Staggered initial obstacles so canvas is NEVER blank on screen start
    const floorY = V_HEIGHT;
    const initialGap = 190;
    obstacles = [
      {
        x: 280,
        top: 150,
        gap: initialGap,
        w: 56,
        scored: false
      },
      {
        x: 520,
        top: 220,
        gap: initialGap,
        w: 56,
        scored: false
      },
      {
        x: 760,
        top: 130,
        gap: initialGap,
        w: 56,
        scored: false
      }
    ];
  }

  // ==========================================================================
  // 3. TACTILE & IMMERSIVE FEEDBACK (Screen-Shake & Particle Systems)
  // ==========================================================================
  function triggerScreenShake() {
    const frame = document.getElementById("game-modal-frame");
    const flash = document.getElementById("game-impact-flash");

    if (frame) {
      frame.classList.remove("screen-shake");
      void frame.offsetWidth; // Force DOM reflow
      frame.classList.add("screen-shake");
      setTimeout(() => frame.classList.remove("screen-shake"), 450);
    }

    if (flash) {
      flash.classList.add("active");
      setTimeout(() => flash.classList.remove("active"), 120);
    }
  }

  // Particle System: Emits yellow crumbs and white steam from the back of the burger as it jumps
  function spawnJumpParticles(originX, originY) {
    // 1. Emit yellow crumbs
    const crumbColors = ["#F59E0B", "#FBBF24", "#FCD34D", "#D97706", "#FFFBEB"];
    for (let i = 0; i < 7; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * 0.9;
      const speed = 1.6 + Math.random() * 2.8;
      particles.push({
        type: "crumb",
        x: originX - 6,
        y: originY + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 0.4,
        gravity: 0.22,
        drag: 0.95,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.35,
        size: 2.2 + Math.random() * 2.6,
        alpha: 1,
        fadeRate: 0.035 + Math.random() * 0.02,
        color: crumbColors[Math.floor(Math.random() * crumbColors.length)]
      });
    }

    // 2. Emit white steam puffs drifting upward and backward
    for (let i = 0; i < 4; i++) {
      particles.push({
        type: "steam",
        x: originX - 8 + (Math.random() - 0.5) * 6,
        y: originY + (Math.random() - 0.5) * 8,
        vx: -(0.9 + Math.random() * 1.5),
        vy: -(0.6 + Math.random() * 1.2),
        gravity: -0.015,
        drag: 0.94,
        size: 4 + Math.random() * 3,
        growthRate: 0.38 + Math.random() * 0.25,
        alpha: 0.75 + Math.random() * 0.2,
        fadeRate: 0.025 + Math.random() * 0.012
      });
    }
  }

  function spawnFoodCrumbs(originX, originY) {
    const count = 30;
    const colors = ["#F59E0B", "#E08A3C", "#C85A32", "#FEF3C7", "#FFFDF7", "#EF4444"];
    const shapes = ["crumb", "sesame", "star", "flake"];

    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 2.2 + Math.random() * 4.8;
      particles.push({
        type: "crumb",
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        gravity: 0.18,
        drag: 0.96,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.35,
        size: 2.8 + Math.random() * 4.2,
        alpha: 1,
        fadeRate: 0.02 + Math.random() * 0.018,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)]
      });
    }
  }

  function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.alpha -= p.fadeRate;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.type === "steam") {
        p.size += p.growthRate;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
        grad.addColorStop(0.45, "rgba(255, 255, 255, 0.4)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        p.rotation += (p.vRot || 0.1);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color || "#F59E0B";

        if (p.shape === "star") {
          const s = p.size;
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.quadraticCurveTo(0, 0, s, 0);
          ctx.quadraticCurveTo(0, 0, 0, s);
          ctx.quadraticCurveTo(0, 0, -s, 0);
          ctx.quadraticCurveTo(0, 0, 0, -s);
          ctx.fill();
        } else if (p.shape === "sesame") {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.9, p.size * 0.45, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  // ==========================================================================
  // 4. IN-APP TOAST SYSTEM (Zero Browser alert() / prompt())
  // ==========================================================================
  function showGameToast(message, type = "info") {
    const container = document.getElementById("game-toast-container");
    if (!container) return;

    const iconMap = {
      success: "🎉",
      warning: "⚠️",
      info: "🍔",
      error: "🛑"
    };

    const toast = document.createElement("div");
    toast.className = "game-toast";
    toast.innerHTML = `
      <span class="game-toast-icon">${iconMap[type] || "ℹ️"}</span>
      <span class="game-toast-text">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3200);
  }

  // ==========================================================================
  // 5. PROCEDURAL WEB AUDIO SYNTHESIZER (Strictly Muted by Default)
  // ==========================================================================
  let audioCtx = null;

  function initAudioEngine() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playAcousticSound(type) {
    if (_isMuted || !audioCtx) return;
    try {
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "flap") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.12);
      } else if (type === "score") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1320, t + 0.05);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.start(t);
        osc.stop(t + 0.28);
      } else if (type === "hit") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(130, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
      }
    } catch (e) {
      // Audio fails silently
    }
  }

  // ==========================================================================
  // 6. PROGRESSIVE DIFFICULTY CURVE (Anti-Rage Mechanics)
  // ==========================================================================
  function calculateDifficulty(curScore) {
    if (curScore < 15) {
      return { gap: 185, speed: 2.1, spacing: 235 };
    } else if (curScore < 30) {
      const progress = (curScore - 15) / 15;
      return {
        gap: 185 - (progress * 30),
        speed: 2.1 + (progress * 0.7),
        spacing: 235 - (progress * 25)
      };
    } else {
      return { gap: 142, speed: 3.2, spacing: 195 };
    }
  }

  // ==========================================================================
  // 7. THE BACKGROUND (Transparent Canvas over High-Quality CSS Kitchen)
  // ==========================================================================
  function drawEnvironment() {
    // The canvas is transparent so the high-quality blurred CSS kitchen background with checkered floor shows through
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);
  }

  // ==========================================================================
  // 8. THE OBSTACLES (3D Stainless Steel Kitchen Exhaust Pipes)
  // ==========================================================================
  function drawObstaclePillars(obs) {
    const pipeWidth = obs.w;
    const floorY = V_HEIGHT;
    const capHeight = 22;
    const capOverhang = 7;
    const capWidth = pipeWidth + (capOverhang * 2);

    // 1. Horizontal Linear Gradient across the main exhaust pillars for metallic sheen
    // Shiny specular highlight streak at 30% from the left edge
    const pipeGrad = ctx.createLinearGradient(obs.x, 0, obs.x + pipeWidth, 0);
    pipeGrad.addColorStop(0.0, "#6E7781");   // Ambient left rim shadow
    pipeGrad.addColorStop(0.12, "#9EA7B0");  // Shaded steel
    pipeGrad.addColorStop(0.32, "#FFFFFF");  // Specular chrome sheen reflection
    pipeGrad.addColorStop(0.55, "#DDE2E6");  // Mid metallic tone
    pipeGrad.addColorStop(0.85, "#8B949E");  // Darkening curvature
    pipeGrad.addColorStop(1.0, "#484F58");   // Deep shadowed right edge

    // 2. Metallic Gradient for Pipe Caps/Rims
    const capGrad = ctx.createLinearGradient(obs.x - capOverhang, 0, obs.x - capOverhang + capWidth, 0);
    capGrad.addColorStop(0.0, "#57606A");
    capGrad.addColorStop(0.12, "#8C959F");
    capGrad.addColorStop(0.32, "#FFFFFF");
    capGrad.addColorStop(0.55, "#CFD6DC");
    capGrad.addColorStop(0.85, "#6E7781");
    capGrad.addColorStop(1.0, "#3B424B");

    // --- TOP STAINLESS STEEL EXHAUST PIPE ---
    const topPipeH = Math.max(0, obs.top - capHeight);

    // Main Pipe Cylinder
    ctx.fillStyle = pipeGrad;
    ctx.fillRect(obs.x, 0, pipeWidth, topPipeH);

    // Horizontal Seam Bands & Rivets along Top Pipe
    const seamSpacing = 52;
    ctx.save();
    for (let sy = 28; sy < topPipeH - 8; sy += seamSpacing) {
      // Seam line
      ctx.fillStyle = "rgba(25, 30, 36, 0.75)";
      ctx.fillRect(obs.x, sy, pipeWidth, 1.5);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillRect(obs.x, sy + 1.5, pipeWidth, 1);

      // Rivets along seam
      const rivetCount = 4;
      for (let r = 0; r < rivetCount; r++) {
        const rx = obs.x + 6 + r * ((pipeWidth - 12) / (rivetCount - 1));
        ctx.fillStyle = "rgba(20, 24, 30, 0.85)";
        ctx.beginPath();
        ctx.arc(rx, sy + 1, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#F0F6FC";
        ctx.beginPath();
        ctx.arc(rx - 0.5, sy + 0.5, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Top Pipe Cap/Rim (Wider with dark drop shadow for physical depth)
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.roundRect(obs.x - capOverhang, topPipeH, capWidth, capHeight, 3);
    ctx.fill();
    ctx.restore();

    // Metallic Rim Reflection Stripe
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillRect(obs.x - capOverhang + 2, topPipeH + 2, capWidth - 4, 1.8);

    // Hollow dark interior opening lip at the bottom of the top exhaust pipe
    const mouthH = 8;
    const mouthGrad = ctx.createLinearGradient(0, topPipeH + capHeight - mouthH, 0, topPipeH + capHeight);
    mouthGrad.addColorStop(0, "#0E1013");
    mouthGrad.addColorStop(1, "#262A30");
    ctx.fillStyle = mouthGrad;
    ctx.beginPath();
    ctx.ellipse(obs.x + pipeWidth / 2, topPipeH + capHeight - 1, (pipeWidth - 2) / 2, mouthH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- BOTTOM STAINLESS STEEL EXHAUST PIPE ---
    const botY = obs.top + obs.gap;
    const botPipeY = botY + capHeight;
    const botPipeH = Math.max(0, floorY - botPipeY);

    // Bottom Pipe Cap/Rim (Wider with dark drop shadow for physical depth)
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = -2;
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.roundRect(obs.x - capOverhang, botY, capWidth, capHeight, 3);
    ctx.fill();
    ctx.restore();

    // Hollow dark interior opening lip at the top of bottom exhaust pipe
    ctx.fillStyle = mouthGrad;
    ctx.beginPath();
    ctx.ellipse(obs.x + pipeWidth / 2, botY + 2, (pipeWidth - 2) / 2, mouthH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bottom rim shadow underneath
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(obs.x - capOverhang + 1, botY + capHeight - 2, capWidth - 2, 2);

    // Main Pipe Cylinder
    ctx.fillStyle = pipeGrad;
    ctx.fillRect(obs.x, botPipeY, pipeWidth, botPipeH);

    // Horizontal Seam Bands & Rivets along Bottom Pipe
    ctx.save();
    for (let sy = botPipeY + 36; sy < floorY; sy += seamSpacing) {
      ctx.fillStyle = "rgba(25, 30, 36, 0.75)";
      ctx.fillRect(obs.x, sy, pipeWidth, 1.5);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillRect(obs.x, sy + 1.5, pipeWidth, 1);

      const rivetCount = 4;
      for (let r = 0; r < rivetCount; r++) {
        const rx = obs.x + 6 + r * ((pipeWidth - 12) / (rivetCount - 1));
        ctx.fillStyle = "rgba(20, 24, 30, 0.85)";
        ctx.beginPath();
        ctx.arc(rx, sy + 1, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#F0F6FC";
        ctx.beginPath();
        ctx.arc(rx - 0.5, sy + 0.5, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ==========================================================================
  // 9. THE PLAYER (High-Quality Gourmet Burger Sprite with Flap Motion Lines)
  // ==========================================================================
  function drawFlyingBurger(p) {
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.rotate(p.rotation);

    // Aerodynamic flap wind motion arcs around the burger
    ctx.strokeStyle = "rgba(65, 32, 16, 0.55)";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";

    // Upper air stream arc
    ctx.beginPath();
    ctx.arc(-p.w * 0.15, -p.h * 0.42, 14, Math.PI * 1.1, Math.PI * 1.55);
    ctx.stroke();

    // Lower air stream arc
    ctx.beginPath();
    ctx.arc(-p.w * 0.1, p.h * 0.45, 12, Math.PI * 0.45, Math.PI * 0.95);
    ctx.stroke();

    // High-Quality SVG Gourmet Burger Sprite
    if (burgerImg.complete && burgerImg.naturalWidth > 0) {
      ctx.drawImage(burgerImg, -p.w / 2, -p.h / 2, p.w, p.h);
    } else {
      // High-Detail Canvas Fallback Burger
      const bx = -p.w / 2;
      const by = -p.h / 2;
      const bw = p.w;
      const bh = p.h;

      // Bottom bun
      ctx.fillStyle = "#D97736";
      ctx.beginPath();
      ctx.roundRect(bx + 2, by + bh * 0.72, bw - 4, bh * 0.26, [2, 2, 8, 8]);
      ctx.fill();

      // Grilled patty
      ctx.fillStyle = "#451A03";
      ctx.beginPath();
      ctx.roundRect(bx + 1, by + bh * 0.54, bw - 2, bh * 0.22, 4);
      ctx.fill();

      // Melted cheese
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.moveTo(bx + 2, by + bh * 0.54);
      ctx.lineTo(bx + bw - 2, by + bh * 0.54);
      ctx.lineTo(bx + bw * 0.7, by + bh * 0.7);
      ctx.lineTo(bx + bw * 0.45, by + bh * 0.57);
      ctx.lineTo(bx + bw * 0.2, by + bh * 0.68);
      ctx.closePath();
      ctx.fill();

      // Lettuce
      ctx.fillStyle = "#48BB78";
      ctx.beginPath();
      ctx.roundRect(bx, by + bh * 0.44, bw, bh * 0.12, 3);
      ctx.fill();

      // Top bun (Brioche Dome)
      ctx.fillStyle = "#ED8936";
      ctx.beginPath();
      ctx.roundRect(bx + 2, by + 2, bw - 4, bh * 0.44, [16, 16, 4, 4]);
      ctx.fill();

      // Bun shine
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.beginPath();
      ctx.ellipse(bx + bw * 0.42, by + bh * 0.16, bw * 0.28, bh * 0.08, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Sesame seeds
      ctx.fillStyle = "#FFFBEB";
      ctx.beginPath();
      ctx.ellipse(bx + bw * 0.3, by + bh * 0.18, 1.8, 1, 0.3, 0, Math.PI * 2);
      ctx.ellipse(bx + bw * 0.5, by + bh * 0.14, 1.8, 1, -0.2, 0, Math.PI * 2);
      ctx.ellipse(bx + bw * 0.7, by + bh * 0.22, 1.8, 1, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawHUD() {
    // Score is rendered dynamically in the top Score Board tab (#game-score-tab)
  }

  // ==========================================================================
  // 9. PHYSICS & COLLISION ENGINE (Continuous Obstacle Movement)
  // ==========================================================================
  function updatePhysics() {
    const currentScore = getScore();
    const diff = calculateDifficulty(currentScore);

    // 1. Gravity & Flight
    player.vy += player.gravity;
    player.y += player.vy;
    player.wingAngle += 0.28;

    player.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 6, (player.vy * 0.07)));

    // Floor & Ceiling Bounds
    const floorY = V_HEIGHT - 65;
    if (player.y + player.h >= floorY) {
      player.y = floorY - player.h;
      triggerGameOver();
      return;
    }
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
    }

    // 2. Dynamic Obstacle Spawning
    if (obstacles.length === 0 || (V_WIDTH - obstacles[obstacles.length - 1].x) >= diff.spacing) {
      const minTop = 60;
      const maxTop = floorY - diff.gap - 60;
      const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;

      obstacles.push({
        x: V_WIDTH,
        top: topHeight,
        gap: diff.gap,
        w: 52,
        scored: false
      });
    }

    // 3. Collision Box & Active Movement Checks
    const hitPadding = 3;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= diff.speed; // Active X-axis update moving right to left

      // Scoring & Food Crumb Burst Trigger
      if (!obs.scored && obs.x + obs.w < player.x) {
        obs.scored = true;
        incrementScore(obs.x + obs.w / 2, obs.top + obs.gap / 2);
      }

      // Precise AABB Collision Box
      const playerLeft = player.x + hitPadding;
      const playerRight = player.x + player.w - hitPadding;
      const playerTop = player.y + hitPadding;
      const playerBottom = player.y + player.h - hitPadding;

      const inHorizontalRange = playerRight > obs.x && playerLeft < obs.x + obs.w;
      if (inHorizontalRange) {
        if (playerTop < obs.top || playerBottom > obs.top + obs.gap) {
          triggerGameOver();
          return;
        }
      }

      // Cull offscreen
      if (obs.x + obs.w < -20) {
        obstacles.splice(i, 1);
      }
    }
  }

  function handlePlayerJump() {
    if (_gameState === "START_SCREEN" || _gameState === "IDLE") {
      dismissOverlay();
      _gameState = "PLAYING";
      _gameStartTime = Date.now();
    }

    if (_gameState === "PLAYING") {
      player.vy = player.jumpStrength;
      _jumpCounter++;
      _flapsTelemetry.push(Date.now() - _gameStartTime);

      // Particle system: emits yellow crumbs and white steam from the back of the burger as it jumps
      spawnJumpParticles(player.x, player.y + player.h / 2);

      playAcousticSound("flap");
    }
  }

  function triggerGameOver() {
    _gameState = "GAMEOVER";
    playAcousticSound("hit");

    triggerScreenShake();

    const finalScore = getScore();
    const durationMs = Date.now() - _gameStartTime;

    setTimeout(() => {
      renderGameOverUI(finalScore, durationMs);
    }, 280);
  }

  // ==========================================================================
  // 10. CRYPTOGRAPHIC SIGNATURE & ANTI-CHEAT SUBMISSION
  // ==========================================================================
  async function computeHMACSignature(orderId, score, jumps, durationMs, nonce) {
    try {
      const rawPayload = `${orderId}:${score}:${jumps}:${durationMs}:${nonce}`;
      const enc = new TextEncoder();
      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(CLIENT_SALT),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signatureBuffer = await window.crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        enc.encode(rawPayload)
      );
      return Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (e) {
      return "sig_local_fallback";
    }
  }

  async function submitScorePayload(score, durationMs, name, contact) {
    if (_tamperDetected) {
      showGameToast("Security Alert: Modified score detected. Run discarded.", "warning");
      return;
    }

    const signature = await computeHMACSignature(
      _activeOrderId,
      score,
      _jumpCounter,
      durationMs,
      _activeNonce || "nonce_default"
    );

    const submitBtn = document.getElementById("btn-submit-score");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Verifying Score...";
    }

    const client = window.supabase || window.supabaseClient;
    let submissionSuccess = false;
    let message = "";

    if (client && typeof client.rpc === "function" && _activeSessionId) {
      try {
        const { data, error } = await client.rpc("submit_game_score", {
          p_session_id: _activeSessionId,
          p_order_id: _activeOrderId,
          p_score: score,
          p_jumps: _jumpCounter,
          p_duration_ms: durationMs,
          p_signature: signature,
          p_player_name: name,
          p_contact: contact
        });

        if (data && data.success) {
          submissionSuccess = true;
          message = data.message;
        } else if (error || (data && !data.success)) {
          message = (data && data.message) || (error && error.message) || "Validation failed";
        }
      } catch (err) {
        console.warn("[Game API] Supabase RPC submission fallback:", err);
      }
    }

    if (!submissionSuccess && !message) {
      try {
        const res = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            sessionId: _activeSessionId,
            sessionToken: _activeSessionToken,
            orderId: _activeOrderId,
            score: score,
            jumpCount: _jumpCounter,
            durationMs: durationMs,
            signature: signature,
            playerName: name,
            contactInfo: contact
          })
        });
        const resData = await res.json();
        if (resData.success) {
          submissionSuccess = true;
          message = resData.message;
        } else {
          message = resData.message;
        }
      } catch (e) {
        submissionSuccess = false;
        message = "Network error: Could not verify score with the server. Please check your connection.";
      }
    }

    if (submissionSuccess) {
      showGameToast(message || "Score verified and posted to the Leaderboard!", "success");
      await refreshLeaderboard();
      renderGameOverUI(score, durationMs);
    } else {
      showGameToast(message || "Could not record score. Please try again.", "warning");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Try Again";
      }
    }
  }

  // ==========================================================================
  // 11. FROSTED GLASS (GLASSMORPHISM) OVERLAYS
  // ==========================================================================
  function showOverlay(contentHtml) {
    const overlay = document.getElementById("game-overlay-screen");
    const container = document.getElementById("game-card-content");
    if (!overlay || !container) return;

    container.innerHTML = contentHtml;
    overlay.classList.add("active");
  }

  function dismissOverlay() {
    const overlay = document.getElementById("game-overlay-screen");
    if (overlay) overlay.classList.remove("active");
  }

  function renderStartScreenUI() {
    _gameState = "START_SCREEN";
    dismissOverlay(); // Keep the screen transparent and ready for direct TAP TO FLAP interaction
    updateScoreDOM(false);
  }

  function renderLeaderboardOverlay() {
    let rowsHtml = "";
    if (_cachedLeaderboard && _cachedLeaderboard.length > 0) {
      rowsHtml = _cachedLeaderboard.map((item, index) => `
        <tr>
          <td><span class="rank-badge">#${index + 1}</span></td>
          <td style="text-align:left; font-weight:${index === 0 ? '700' : '500'};">${escapeHtml(item.playerName)}</td>
          <td style="text-align:right;"><strong>${item.score}</strong></td>
        </tr>
      `).join("");
    } else {
      rowsHtml = `<tr><td colspan="3" style="color:#9B8479; padding:8px;">Be the first on today's board!</td></tr>`;
    }

    const html = `
      <div class="receipt-glass-card">
        <header class="receipt-header">
          <div class="receipt-brand">AOLA KITCHEN ARCADE</div>
          <h3 class="receipt-title">Daily Hall of Fame</h3>
          <div class="receipt-meta-info">
            <span>ACTIVE STANDINGS</span>
            <span>TODAY</span>
          </div>
        </header>

        <div class="receipt-reward-badge">
          <span class="receipt-reward-icon">🏆</span>
          <span><strong>Today's Secret Comp:</strong> ${_dailyPrizeDescription}</span>
        </div>

        <div class="receipt-table-wrap">
          <div class="receipt-table-title">
            <span>Top Scorers</span>
            <span>TODAY</span>
          </div>
          <table class="receipt-table">
            <thead>
              <tr>
                <th style="width:36px;">Rank</th>
                <th style="text-align:left;">Diner</th>
                <th style="text-align:right; width:44px;">Score</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <button type="button" class="btn-game-restart" id="btn-close-leaderboard-modal" style="margin-top:12px; width:100%;">
          Back to Arcade
        </button>
      </div>
    `;

    showOverlay(html);

    const btnClose = document.getElementById("btn-close-leaderboard-modal");
    if (btnClose) {
      btnClose.onclick = () => {
        dismissOverlay();
      };
    }
  }

  function renderGameOverUI(score, durationMs) {
    let rowsHtml = "";
    if (_cachedLeaderboard && _cachedLeaderboard.length > 0) {
      rowsHtml = _cachedLeaderboard.map((item, index) => `
        <tr>
          <td><span class="rank-badge">#${index + 1}</span></td>
          <td style="text-align:left; font-weight:${index === 0 ? '700' : '500'};">${escapeHtml(item.playerName)}</td>
          <td style="text-align:right;"><strong>${item.score}</strong></td>
        </tr>
      `).join("");
    } else {
      rowsHtml = `<tr><td colspan="3" style="color:#9B8479; padding:8px;">Be the first on today's board!</td></tr>`;
    }

    const html = `
      <div class="receipt-glass-card">
        <header class="receipt-header">
          <div class="receipt-brand">AOLA KITCHEN ARCADE</div>
          <h3 class="receipt-title">Official Dining Ticket</h3>
          <div class="receipt-meta-info">
            <span>ORDER: ${escapeHtml(_activeOrderId || "DINE-IN")}</span>
            <span>TIME: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </header>

        <div class="receipt-reward-badge">
          <span class="receipt-reward-icon">🎁</span>
          <span><strong>Top daily scorer wins:</strong> ${_dailyPrizeDescription}</span>
        </div>

        <div class="receipt-stats-grid">
          <div class="receipt-stat-box">
            <div class="receipt-stat-label">Final Score</div>
            <div class="receipt-stat-val">${score >= 0 ? score : 0}</div>
          </div>
          <div class="receipt-stat-box">
            <div class="receipt-stat-label">Total Flaps</div>
            <div class="receipt-stat-val">${_jumpCounter}</div>
          </div>
        </div>

        <div class="receipt-table-wrap">
          <div class="receipt-table-title">
            <span>Daily Top 5 Standings</span>
            <span>TODAY</span>
          </div>
          <table class="receipt-table">
            <thead>
              <tr>
                <th style="width:36px;">Rank</th>
                <th style="text-align:left;">Diner</th>
                <th style="text-align:right; width:44px;">Score</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        ${score > 0 ? `
          <form class="receipt-form" id="game-score-form">
            <input type="text" id="game-player-name" class="receipt-input" placeholder="Your Name or Nickname" maxlength="25" required>
            <input type="text" id="game-player-contact" class="receipt-input" placeholder="WhatsApp / Phone (to claim prize)" maxlength="20" required>
            <button type="submit" class="btn-game-submit" id="btn-submit-score" style="width:100%;">Submit Score to Leaderboard</button>
          </form>
        ` : ""}

        <button type="button" class="btn-game-restart" id="btn-restart-game" style="margin-top:10px;">Play Again</button>

        <div class="receipt-barcode">
          ||| | |||| | ||| |||| | ||| | ||| ||
        </div>
      </div>
    `;

    showOverlay(html);

    const nameInput = document.getElementById("game-player-name");
    if (nameInput && _prefilledPlayerName) {
      nameInput.value = _prefilledPlayerName;
    }

    const form = document.getElementById("game-score-form");
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const nameInputVal = sanitizeInput(document.getElementById("game-player-name").value, 25);
        const contactInputVal = sanitizeInput(document.getElementById("game-player-contact").value, 20);
        await submitScorePayload(score, durationMs, nameInputVal, contactInputVal);
      };
    }

    const btnRestart = document.getElementById("btn-restart-game");
    if (btnRestart) {
      btnRestart.onclick = () => {
        dismissOverlay();
        startNewGameSession(_activeOrderId);
      };
    }
  }

  let _orderQueueInterval = null;

  function stopOrderQueueMonitor() {
    if (_orderQueueInterval) {
      clearInterval(_orderQueueInterval);
      _orderQueueInterval = null;
    }
  }

  function startOrderQueueMonitor(orderId) {
    stopOrderQueueMonitor();
    if (!orderId) return;

    _orderQueueInterval = setInterval(async () => {
      if (_gameState === "LOCKED" || _gameState === "ORDER_COMPLETED") {
        stopOrderQueueMonitor();
        return;
      }

      try {
        const res = await fetch(`/api/game?action=status&orderId=${encodeURIComponent(orderId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            const statusOrderText = document.getElementById("game-status-order-text");
            const cleanNum = orderId.replace(/^[A-Za-z_-]+0*/, "");

            if (data.isActive === false) {
              // Food is served or order was cancelled by the kitchen/POS!
              stopOrderQueueMonitor();
              showOrderServedScreen(data.message, data.table);
              return;
            }

            if (statusOrderText) {
              if (data.status === "ready") {
                statusOrderText.textContent = `Order ${cleanNum || "124"} is Ready at the Pass! 🛎️`;
              } else {
                statusOrderText.textContent = `Playing While Waiting • Order ${cleanNum || "124"} is Preparing! 🍳`;
              }
            }
          }
        }
      } catch (err) {}
    }, 4500);
  }

  function showLockedScreen(customMsg) {
    _gameState = "LOCKED";
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    stopOrderQueueMonitor();

    const isStandalonePage = window.location.pathname.includes("game.html");
    const html = `
      <div class="receipt-glass-card" style="text-align:center; padding:24px 20px;">
        <header class="receipt-header">
          <div class="receipt-brand">AOLA KITCHEN ARCADE</div>
          <h3 class="receipt-title" style="color:#B91C1C;">🔒 Gatekeeper Active</h3>
          <div class="receipt-meta-info">
            <span>ORDER REQUIRED</span>
            <span>DINING ONLY</span>
          </div>
        </header>

        <p style="color:#4A3B32; font-size:0.9rem; line-height:1.45; margin:16px 0;">
          ${escapeHtml(customMsg || "The Aola Kitchen Arcade is an exclusive on-site wait-time experience. Direct links are blocked. Please place an order from your dining table to unlock access.")}
        </p>

        <button type="button" class="btn-game-restart" id="btn-close-locked-game" style="width:100%;">
          ${isStandalonePage ? "Browse Restaurant Menu" : "Back to Order"}
        </button>
      </div>
    `;

    showOverlay(html);

    const btnClose = document.getElementById("btn-close-locked-game");
    if (btnClose) {
      btnClose.onclick = () => {
        if (isStandalonePage) {
          window.location.href = "index.html";
        } else {
          dismissOverlay();
          const modal = document.getElementById("game-modal-overlay");
          if (modal) modal.classList.remove("open");
        }
      };
    }
  }

  function showOrderServedScreen(message, tableNum) {
    _gameState = "ORDER_COMPLETED";
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    stopOrderQueueMonitor();

    const isStandalonePage = window.location.pathname.includes("game.html");
    const html = `
      <div class="receipt-glass-card" style="text-align:center; padding:24px 20px;">
        <header class="receipt-header">
          <div class="receipt-brand">AOLA KITCHEN ARCADE</div>
          <h3 class="receipt-title" style="color:#047857;">🍽️ Food Has Arrived!</h3>
          <div class="receipt-meta-info">
            <span>TABLE ${escapeHtml(tableNum || "1")}</span>
            <span>ORDER: ${escapeHtml(_activeOrderId || "DINE-IN")}</span>
          </div>
        </header>

        <div style="font-size:48px; margin:14px 0;">🍕🍔🍜</div>

        <p style="color:#4A3B32; font-size:0.92rem; line-height:1.45; margin:12px 0 20px;">
          ${escapeHtml(message || "Your food has been delivered to your table! Time to enjoy your hot meal. The wait-time arcade has concluded for this dining session.")}
        </p>

        <button type="button" class="btn-game-restart" id="btn-finish-order-game" style="width:100%; background:linear-gradient(135deg, #059669, #047857); color:#fff; border:none;">
          Enjoy Your Meal • Return to Menu
        </button>
      </div>
    `;

    showOverlay(html);

    const btnFinish = document.getElementById("btn-finish-order-game");
    if (btnFinish) {
      btnFinish.onclick = () => {
        if (isStandalonePage) {
          window.location.href = "index.html";
        } else {
          dismissOverlay();
          const modal = document.getElementById("game-modal-overlay");
          if (modal) modal.classList.remove("open");
        }
      };
    }
  }

  async function refreshLeaderboard() {
    const client = window.supabase || window.supabaseClient;

    if (client && typeof client.rpc === "function") {
      try {
        const { data } = await client.rpc("get_game_leaderboard");
        if (data && data.success) {
          _cachedLeaderboard = data.leaderboard || [];
          if (data.dailyPrize) {
            _dailyPrizeDescription = data.dailyPrize;
            updatePrizeLabel();
          }
          return;
        }
      } catch (e) {
        // Fallback
      }
    }

    try {
      const res = await fetch("/api/game?action=leaderboard");
      const resData = await res.json();
      if (resData.success) {
        _cachedLeaderboard = resData.leaderboard || [];
        if (resData.dailyPrize) {
          _dailyPrizeDescription = resData.dailyPrize;
          updatePrizeLabel();
        }
      }
    } catch (e) {
      if (_cachedLeaderboard.length === 0) {
        _cachedLeaderboard = [
          { rank: 1, playerName: "Chef Rohan", score: 24 },
          { rank: 2, playerName: "Priya M.", score: 18 },
          { rank: 3, playerName: "Table 4 Diner", score: 12 },
          { rank: 4, playerName: "Adil K.", score: 9 },
          { rank: 5, playerName: "Foodie Guest", score: 6 }
        ];
      }
    }
  }

  function updatePrizeLabel() {
    const promoLabel = document.getElementById("game-daily-prize-label");
    if (promoLabel) {
      promoLabel.textContent = `Top daily scorer wins: ${_dailyPrizeDescription}`;
    }
  }

  // --- ENTERPRISE ANTI-XSS SANITIZATION HELPERS ---
  function sanitizeInput(str, maxLen = 30) {
    if (!str) return "";
    return String(str)
      .trim()
      .replace(/[<>'"]/g, "")
      .slice(0, maxLen);
  }

  function sanitizeOrderId(str) {
    if (!str) return "";
    return String(str)
      .trim()
      .replace(/[^a-zA-Z0-9_\-#]/g, "")
      .slice(0, 32);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================================================
  // 12. SESSION START & ORDER VERIFICATION
  // ==========================================================================
  async function startNewGameSession(orderId, sessionToken, tableNum) {
    const modalOverlay = document.getElementById("game-modal-overlay");
    if (modalOverlay) {
      modalOverlay.classList.add("open");
    }

    if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
      showLockedScreen("Order Required: Please place an order from your dining table to unlock the arcade.");
      return;
    }

    _activeOrderId = sanitizeOrderId(orderId);
    if (!_activeOrderId) {
      showLockedScreen("Invalid Order ID format.");
      return;
    }

    if (sessionToken) {
      _activeSessionToken = sessionToken;
    }

    resetScore();
    initObstacles(); // Pre-spawns obstacles immediately!

    // Update status bar order text securely using textContent (Never innerHTML)
    const statusOrderText = document.getElementById("game-status-order-text");
    if (statusOrderText) {
      const cleanNum = _activeOrderId.replace(/^[A-Za-z_-]+0*/, "");
      statusOrderText.textContent = `Playing While Waiting • Order ${cleanNum || "124"} is Preparing! 🍳`;
    }

    player.x = 75;
    player.y = 260;
    player.vy = 0;
    player.rotation = 0;

    renderStartScreenUI();
    if (!animationFrameId) {
      gameLoop();
    }

    // Start background order queue monitor to automatically disable game when food arrives
    startOrderQueueMonitor(_activeOrderId);

    // Verify session with server if token not already established
    (async () => {
      try {
        const client = window.supabase || window.supabaseClient;
        if (client && typeof client.rpc === "function") {
          const { data, error } = await client.rpc("start_game_session", {
            p_order_id: _activeOrderId,
            p_table_number: tableNum || "1"
          });
          if (data && data.success) {
            _activeSessionId = data.sessionId;
            _activeNonce = data.nonce;
          } else if (data && !data.success) {
            showLockedScreen(data.message);
            return;
          }
        } else {
          const res = await fetch("/api/game", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "start",
              orderId: _activeOrderId,
              table: tableNum || "1"
            })
          });
          if (res.ok) {
            const resData = await res.json();
            if (resData && resData.success) {
              _activeSessionId = resData.sessionId;
              _activeSessionToken = resData.sessionToken;
              _activeNonce = resData.nonce;
            } else if (resData && !resData.success) {
              showLockedScreen(resData.message);
              return;
            }
          }
        }
      } catch (e) {}
      refreshLeaderboard().catch(() => {});
    })();
  }

  // ==========================================================================
  // 13. ANIMATION LOOP (Butter-Smooth 60fps)
  // ==========================================================================
  function gameLoop() {
    frameCount++;

    // 1. Draw transparent background for high-quality blurred CSS kitchen interior
    drawEnvironment();

    // 2. Draw 3D Stainless Steel Exhaust Pipes
    for (let i = 0; i < obstacles.length; i++) {
      drawObstaclePillars(obstacles[i]);
    }

    // 3. Draw Player Gourmet Burger Sprite
    drawFlyingBurger(player);

    // 4. Render Yellow Crumbs & White Steam Particle Trail
    updateAndDrawParticles();

    // 5. Draw Score HUD
    drawHUD();

    // 6. Update Game Physics & Obstacle X-axis movement
    if (_gameState === "PLAYING") {
      updatePhysics();
    } else if (_gameState === "START_SCREEN" || _gameState === "IDLE") {
      // Gentle start screen hovering animation
      player.y = 260 + Math.sin(frameCount * 0.08) * 8;
      player.wingAngle += 0.12;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  // ==========================================================================
  // 14. DOM BOOTSTRAPPER & EVENT WIRING
  // ==========================================================================
  function initGameEngine() {
    canvas = document.getElementById("flappy-restaurant-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    // Initialize obstacles right away so canvas is never blank
    initObstacles();
    updateScoreDOM(false);

    // Multi-Input Flap Handler (Canvas Tap, Click, Pointer, Touch)
    const triggerFlap = (e) => {
      if (e) {
        if (e.cancelable) e.preventDefault();
      }
      initAudioEngine();
      handlePlayerJump();
    };

    const inputEvents = ["pointerdown", "mousedown", "touchstart", "click"];
    inputEvents.forEach(evt => {
      canvas.addEventListener(evt, triggerFlap, { passive: false });
    });

    // Goal Card / Tap to Flap CTA Tap
    const goalCard = document.getElementById("game-goal-card");
    if (goalCard) {
      inputEvents.forEach(evt => {
        goalCard.addEventListener(evt, (e) => {
          if (e) {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
          }
          initAudioEngine();
          handlePlayerJump();
        }, { passive: false });
      });
    }

    // Keyboard Spacebar
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && _gameState !== "GAMEOVER") {
        const modal = document.getElementById("game-modal-overlay");
        if (modal && modal.classList.contains("open")) {
          e.preventDefault();
          initAudioEngine();
          handlePlayerJump();
        }
      }
    });

    // Sound Toggle Button (Strictly Muted by Default)
    const btnSound = document.getElementById("game-sound-toggle");
    const iconMuted = document.getElementById("icon-sound-muted");
    const iconActive = document.getElementById("icon-sound-active");
    const soundText = document.getElementById("sound-status-text");

    function syncSoundUI() {
      if (_isMuted) {
        if (btnSound) {
          btnSound.classList.remove("unmuted");
          btnSound.setAttribute("title", "Sound is Muted (Click to Unmute)");
        }
        if (iconMuted) iconMuted.style.display = "block";
        if (iconActive) iconActive.style.display = "none";
        if (soundText) soundText.textContent = "Unmute";
      } else {
        if (btnSound) {
          btnSound.classList.add("unmuted");
          btnSound.setAttribute("title", "Sound is Active (Click to Mute)");
        }
        if (iconMuted) iconMuted.style.display = "none";
        if (iconActive) iconActive.style.display = "block";
        if (soundText) soundText.textContent = "Mute";
      }
    }

    if (btnSound) {
      btnSound.onclick = () => {
        initAudioEngine();
        _isMuted = !_isMuted;
        syncSoundUI();
        if (_isMuted) {
          showGameToast("Sound muted", "info");
        } else {
          showGameToast("Sound enabled", "success");
        }
      };
      syncSoundUI();
    }

    // Leaderboard Buttons
    const btnLeaderboardLeft = document.getElementById("btn-open-leaderboard-left");
    const btnLeaderboardRight = document.getElementById("btn-open-leaderboard-right");
    const openLeaderboardHandler = (e) => {
      if (e) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      }
      initAudioEngine();
      renderLeaderboardOverlay();
      refreshLeaderboard().then(() => {
        const overlay = document.getElementById("game-overlay-screen");
        if (overlay && overlay.classList.contains("active")) {
          renderLeaderboardOverlay();
        }
      });
    };

    if (btnLeaderboardLeft) {
      btnLeaderboardLeft.onclick = openLeaderboardHandler;
      btnLeaderboardLeft.addEventListener("pointerdown", openLeaderboardHandler);
    }
    if (btnLeaderboardRight) {
      btnLeaderboardRight.onclick = openLeaderboardHandler;
      btnLeaderboardRight.addEventListener("pointerdown", openLeaderboardHandler);
    }

    // Close Modal Button
    const btnClose = document.getElementById("game-btn-close");
    const modalOverlay = document.getElementById("game-modal-overlay");
    if (btnClose && modalOverlay) {
      btnClose.onclick = () => {
        modalOverlay.classList.remove("open");
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      };
    }

    // Modal Trigger Hook (Post-Checkout Button)
    const btnTrigger = document.getElementById("btn-trigger-game");
    if (btnTrigger && modalOverlay) {
      btnTrigger.onclick = () => {
        const orderIdElem = document.getElementById("success-order-id");
        const orderId = orderIdElem ? orderIdElem.textContent.trim() : "";

        modalOverlay.classList.add("open");

        if (orderId && orderId !== "ORD-0000") {
          startNewGameSession(orderId);
        } else {
          startNewGameSession("ORD-124");
        }

        if (!animationFrameId) {
          gameLoop();
        }
      };
    }

    // Expose global methods for external buttons & standalone harnesses
    window.startNewGameSession = startNewGameSession;
    window.initFlappyArcade = initGameEngine;
    window.showLockedGatekeeperScreen = showLockedScreen;

    // Check if on standalone game.html page or modal launch
    const isStandalonePage = window.location.pathname.includes("game.html");
    const urlParams = new URLSearchParams(window.location.search);
    const rawOrder = urlParams.get("order_id") || urlParams.get("order") || urlParams.get("orderId");
    const rawToken = urlParams.get("token") || urlParams.get("session_token");
    const rawTable = urlParams.get("table") || urlParams.get("table_number");
    const rawPlayer = urlParams.get("player_name") || urlParams.get("player") || urlParams.get("name");

    const safeOrderId = sanitizeOrderId(rawOrder);
    if (rawPlayer) {
      _prefilledPlayerName = sanitizeInput(rawPlayer, 25);
    }

    if (isStandalonePage) {
      // Gatekeeper Direct Link Lock: On game.html, a verified order_id is strictly required
      if (!safeOrderId) {
        showLockedScreen("Direct Link Blocked: The Aola Kitchen Arcade requires an active dining order. Please order from your dining table to play.");
        return;
      }
      startNewGameSession(safeOrderId, rawToken, rawTable);
    } else {
      // On customer index.html: do NOT auto-launch unless explicit order is passed
      if (safeOrderId && (urlParams.get("arcade") === "1" || urlParams.get("game") === "1")) {
        if (modalOverlay) {
          modalOverlay.classList.add("open");
          startNewGameSession(safeOrderId, rawToken, rawTable);
        }
      } else {
        _gameState = "START_SCREEN";
      }
    }

    refreshLeaderboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGameEngine);
  } else {
    initGameEngine();
  }
})();
