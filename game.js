// ============================================================
// MOEBOID - "Eat or be Eaten"
// Browser clone of ZapSpot's Moeboid (2000)
// v2: Food Chain / Level-Up System
// Pure HTML5 Canvas + vanilla JavaScript
// ============================================================

// ============================================================
// SECTION 0: PLATFORM DETECTION
// ============================================================
const IS_MOBILE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// ============================================================
// SECTION 1: CONFIGURATION
// ============================================================
const CONFIG = {
    // Player
    PLAYER_ACCELERATION: 1200,
    PLAYER_FRICTION: 0.88,
    PLAYER_MAX_SPEED: 320,
    PLAYER_SPEED_SIZE_EXPONENT: 0.25,

    // Game
    START_LIVES: 3,
    INVINCIBILITY_TIME: 2.0,
    RESPAWN_TIME: 1.0,

    // Dish
    BASE_DISH_RADIUS: 265,
    DISH_GROWTH_PER_LEVEL: 35,

    // Visual
    WOBBLE_POINTS: 10,
    WOBBLE_AMPLITUDE_MIN: 0.04,
    WOBBLE_AMPLITUDE_MAX: 0.12,
    CAMERA_SMOOTHING: 4.0,
    BASE_ZOOM: 1.0,
    ZOOM_FACTOR: 0.003,
    MIN_ZOOM: 0.35,

    // Audio
    MASTER_VOLUME: 0.4,

    // Particles
    MAX_PARTICLES: 300,

    // Population
    SPAWN_INTERVAL: 1.5,
    FAST_SPAWN_INTERVAL: 0.3,
    LEVEL_UP_RESPITE: 3.0,
    LEVEL_UP_BOOST_DURATION: 8.0,
    LEVEL_UP_BOOST_MULTIPLIER: 3.0,

    // Growth animation
    GROWTH_ANIM_SPEED: 0.08,
};

// Tunable parameters (read by AI, physics, and juice systems; updated by tuning panel)
const TUNING = {
    // Enemy global
    enemySpeedMult: 1.0,
    enemyFriction: 0.97,
    wanderRate: 8.0,
    burstChance: 0.10,
    fleeRange: 160,
    fleeForce: 120,
    // Dash (Pulser)
    dashCooldownMin: 0.8,
    dashCooldownMax: 2.5,
    dashForce: 5,
    // Seek/Hunt
    seekRange: 300,
    seekForce: 2.2,
    huntForce: 2.5,
    // Wall bounce
    bounceMult: 2.0,
    bounceScatter: 1.05,
    bounceBoost: 1.15,
    wallMargin: 25,
    wallForce: 100,
    // Game juice
    eatPulseScale: 1.12,
    eatPulseDuration: 0.15,
    eatSpeedBoost: 1.15,
    eatSpeedDuration: 0.3,
};

// UI Theme (Bioluminescent Lab design system from Stitch)
const THEME = {
    primary: '#69fea5',
    primaryDim: '#59ef98',
    primaryCtr: '#14c16f',
    secondary: '#75f6f6',
    surface: '#050f1a',
    surfaceCtr: '#0d1b28',
    surfaceHi: '#12212f',
    surfaceHighest: '#172737',
    onSurface: '#e1ecfc',
    onSurfaceVar: '#a1acbb',
    outline: '#6c7684',
    error: '#ff716c',
    errorDim: '#d7383b',
    fontHeadline: "'Space Grotesk', sans-serif",
    fontBody: "'Inter', sans-serif",
    fontLabel: "'Manrope', sans-serif",
};

// Player radius at each level (index = level, 1-7)
const PLAYER_RADII = [0, 18, 22, 28, 36, 48, 64, 86];

// XP needed to reach each level (index = target level)
// XP curve: steep exponential to compensate for higher XP rewards at higher levels
const XP_TABLE = [0, 0, 40, 150, 450, 1200, 3000, 7000];

// Species definitions (8 species in the food chain)
const SPECIES_TABLE = [
    {
        level: 1, name: 'Mote', radius: 10,
        colors: { base: '#88ddff', light: '#bbf0ff', dark: '#55aacc' },
        xpReward: 5, speed: 100, behavior: 'wander',
    },
    {
        level: 2, name: 'Drifter', radius: 14,
        colors: { base: '#ff9966', light: '#ffbb99', dark: '#cc6633' },
        xpReward: 12, speed: 110, behavior: 'wander',
    },
    {
        level: 3, name: 'Pulser', radius: 20,
        colors: { base: '#ffdd44', light: '#ffee88', dark: '#ccaa22' },
        xpReward: 25, speed: 135, behavior: 'dasher',
    },
    {
        level: 4, name: 'Seeker', radius: 28,
        colors: { base: '#ff6699', light: '#ff99bb', dark: '#cc3366' },
        xpReward: 50, speed: 115, behavior: 'seek_prey',
    },
    {
        level: 5, name: 'Bloater', radius: 40,
        colors: { base: '#aa55cc', light: '#cc88ee', dark: '#7733aa' },
        xpReward: 100, speed: 60, behavior: 'slow_wander',
    },
    {
        level: 6, name: 'Stalker', radius: 56,
        colors: { base: '#44cccc', light: '#88eeee', dark: '#228888' },
        xpReward: 200, speed: 125, behavior: 'seek_prey',
    },
    {
        level: 7, name: 'Apex', radius: 78,
        colors: { base: '#dd4444', light: '#ff7777', dark: '#aa2222' },
        xpReward: 400, speed: 145, behavior: 'hunt_player',
    },
    {
        level: 8, name: 'Titan', radius: 110,
        colors: { base: '#ccccee', light: '#eeeeff', dark: '#9999bb' },
        xpReward: 0, speed: 90, behavior: 'patrol',
    },
];

const PLAYER_COLORS = { base: '#44dd88', light: '#88ffbb', dark: '#228855' };

const DISH_COLORS = {
    bg: '#060a10',
    center: '#0c1520',
    rim: '#2a3a50',
};

// ============================================================
// SECTION 2: UTILITY FUNCTIONS
// ============================================================
const TWO_PI = Math.PI * 2;
const { sin, cos, sqrt, atan2, abs, min, max, floor, random, PI } = Math;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return sqrt(dx * dx + dy * dy); }
function distSq(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }
function randRange(lo, hi) { return lo + random() * (hi - lo); }
function randInt(lo, hi) { return floor(randRange(lo, hi + 1)); }

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function rgbStr(r, g, b, a = 1) {
    return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

function colorWithAlpha(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return rgbStr(r, g, b, a);
}

function getSpecies(level) {
    return SPECIES_TABLE[level - 1];
}

// ============================================================
// SECTION 3: SOUND MANAGER (Web Audio API - Procedural)
// ============================================================
class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.muted = false;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = CONFIG.MASTER_VOLUME;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio not available');
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : CONFIG.MASTER_VOLUME;
        }
    }

    playEat(speciesLevel) {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const pitch = 350 - speciesLevel * 30;
        osc.frequency.setValueAtTime(pitch + 150, now);
        osc.frequency.exponentialRampToValueAtTime(pitch, now + 0.15);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.22);
    }

    playDeath() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.7);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.85);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(80, now);
        osc2.frequency.exponentialRampToValueAtTime(20, now + 0.4);
        gain2.gain.setValueAtTime(0.1, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start(now);
        osc2.stop(now + 0.55);
    }

    playLevelUp() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        const notes = [261, 329, 392, 523, 659];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    }

    playMenuSelect() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playSpawn(speciesLevel) {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const pitch = 280 - (speciesLevel - 1) * 15;
        osc.frequency.setValueAtTime(pitch * 0.7, now);
        osc.frequency.exponentialRampToValueAtTime(pitch, now + 0.04);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, now + 0.15);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.10, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.20);
    }
}

const sound = new SoundManager();

// ============================================================
// SECTION 3b: PROCEDURAL MUSIC
// ============================================================
class MusicManager {
    constructor() {
        this.playing = false;
        this.ctx = null;
        this.masterGain = null;
        this.layers = {};
        this.currentMood = 'menu'; // menu, playing, gameover
        this.targetLevel = 1;
        this.intensity = 0; // 0-1, ramps toward target
    }

    init(audioCtx, masterGain) {
        if (this.playing) return;
        this.ctx = audioCtx;
        // Separate gain for music (lower than SFX)
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.18;
        this.masterGain.connect(masterGain);
    }

    start() {
        if (this.playing || !this.ctx) return;
        this.playing = true;
        this._buildLayers();
    }

    _buildLayers() {
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // ── Layer 1: Deep drone pad (C2 ~65Hz) ──
        const drone = ctx.createOscillator();
        const droneGain = ctx.createGain();
        const droneFilter = ctx.createBiquadFilter();
        drone.type = 'triangle';
        drone.frequency.value = 65.41; // C2
        droneFilter.type = 'lowpass';
        droneFilter.frequency.value = 200;
        droneFilter.Q.value = 1;
        droneGain.gain.value = 0.35;
        drone.connect(droneFilter);
        droneFilter.connect(droneGain);
        droneGain.connect(this.masterGain);
        drone.start(now);

        // ── Layer 2: Slow evolving pad (5th above, G2) ──
        const pad = ctx.createOscillator();
        const padGain = ctx.createGain();
        const padFilter = ctx.createBiquadFilter();
        pad.type = 'sine';
        pad.frequency.value = 98; // G2
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 400;
        padGain.gain.value = 0.2;
        pad.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(this.masterGain);
        pad.start(now);

        // ── Layer 3: High shimmer (ethereal harmonics) ──
        const shimmer = ctx.createOscillator();
        const shimmerGain = ctx.createGain();
        const shimmerFilter = ctx.createBiquadFilter();
        shimmer.type = 'sine';
        shimmer.frequency.value = 523.25; // C5
        shimmerFilter.type = 'bandpass';
        shimmerFilter.frequency.value = 600;
        shimmerFilter.Q.value = 3;
        shimmerGain.gain.value = 0;
        shimmer.connect(shimmerFilter);
        shimmerFilter.connect(shimmerGain);
        shimmerGain.connect(this.masterGain);
        shimmer.start(now);

        // ── Layer 4: Sub pulse (rhythmic heartbeat) ──
        const pulse = ctx.createOscillator();
        const pulseGain = ctx.createGain();
        const pulseShaper = ctx.createWaveShaper();
        pulse.type = 'sine';
        pulse.frequency.value = 0.4; // LFO: 0.4 Hz = pulse every 2.5s
        pulseGain.gain.value = 0;
        // Use LFO to modulate a sub-bass
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.value = 55; // A1
        subGain.gain.value = 0;
        sub.connect(subGain);
        subGain.connect(this.masterGain);
        sub.start(now);

        // ── Layer 5: Tension oscillator (appears at higher levels) ──
        const tension = ctx.createOscillator();
        const tensionGain = ctx.createGain();
        const tensionFilter = ctx.createBiquadFilter();
        tension.type = 'sawtooth';
        tension.frequency.value = 130.81; // C3
        tensionFilter.type = 'lowpass';
        tensionFilter.frequency.value = 150;
        tensionFilter.Q.value = 5;
        tensionGain.gain.value = 0;
        tension.connect(tensionFilter);
        tensionFilter.connect(tensionGain);
        tensionGain.connect(this.masterGain);
        tension.start(now);

        // ── Noise layer (ambient hiss/atmosphere) ──
        const noiseSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseSize; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * 0.015;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        const noiseGain = ctx.createGain();
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 800;
        noiseFilter.Q.value = 0.5;
        noiseGain.gain.value = 0.5;
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(now);

        this.layers = {
            drone: { osc: drone, gain: droneGain, filter: droneFilter },
            pad: { osc: pad, gain: padGain, filter: padFilter },
            shimmer: { osc: shimmer, gain: shimmerGain, filter: shimmerFilter },
            sub: { osc: sub, gain: subGain },
            tension: { osc: tension, gain: tensionGain, filter: tensionFilter },
            noise: { source: noise, gain: noiseGain, filter: noiseFilter },
            pulse: { osc: pulse, gain: pulseGain },
        };

        // Start the LFO modulation loop
        this._lfoLoop();
    }

    _lfoLoop() {
        if (!this.playing || !this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Sub pulse: rhythmic volume swell
        if (this.layers.sub) {
            const rate = this.currentMood === 'playing' ? 0.6 + this.intensity * 0.4 : 0.3;
            const vol = this.currentMood === 'playing' ? 0.08 + this.intensity * 0.12 : 0.03;
            const t = now * rate * Math.PI * 2;
            const pulse = Math.max(0, Math.sin(t)) * vol;
            this.layers.sub.gain.gain.setTargetAtTime(pulse, now, 0.05);
        }

        // Schedule next tick
        setTimeout(() => this._lfoLoop(), 80);
    }

    setMood(mood, level) {
        if (!this.playing || !this.ctx) return;
        this.currentMood = mood;
        this.targetLevel = level || 1;
        const now = this.ctx.currentTime;
        const ramp = 2.0; // seconds to transition

        const L = this.layers;
        if (!L.drone) return;

        if (mood === 'menu') {
            // Calm, spacious
            L.drone.gain.gain.setTargetAtTime(0.3, now, ramp);
            L.drone.filter.frequency.setTargetAtTime(180, now, ramp);
            L.pad.gain.gain.setTargetAtTime(0.15, now, ramp);
            L.pad.osc.frequency.setTargetAtTime(98, now, ramp);
            L.shimmer.gain.gain.setTargetAtTime(0.06, now, ramp);
            L.shimmer.osc.frequency.setTargetAtTime(523, now, ramp);
            L.tension.gain.gain.setTargetAtTime(0, now, ramp);
            L.noise.gain.gain.setTargetAtTime(0.4, now, ramp);
            this.intensity = 0;
        } else if (mood === 'playing') {
            // Intensity scales with level 1-7
            const t = clamp((level - 1) / 6, 0, 1);
            this.intensity = t;

            // Drone gets richer at higher levels
            L.drone.gain.gain.setTargetAtTime(0.25 + t * 0.15, now, ramp);
            L.drone.filter.frequency.setTargetAtTime(200 + t * 300, now, ramp);

            // Pad shifts up in pitch as player grows
            const padFreqs = [98, 110, 123.47, 130.81, 146.83, 164.81, 196];
            L.pad.gain.gain.setTargetAtTime(0.15 + t * 0.1, now, ramp);
            L.pad.osc.frequency.setTargetAtTime(padFreqs[min(level-1, 6)], now, ramp);

            // Shimmer appears mid-game
            L.shimmer.gain.gain.setTargetAtTime(t > 0.3 ? 0.04 + t * 0.06 : 0, now, ramp);
            const shimmerFreqs = [523, 587, 659, 698, 784, 880, 1047];
            L.shimmer.osc.frequency.setTargetAtTime(shimmerFreqs[min(level-1, 6)], now, ramp);

            // Tension builds from level 4+
            L.tension.gain.gain.setTargetAtTime(t > 0.4 ? (t - 0.4) * 0.15 : 0, now, ramp);
            L.tension.filter.frequency.setTargetAtTime(150 + t * 400, now, ramp);

            // Noise gets slightly brighter
            L.noise.gain.gain.setTargetAtTime(0.3 + t * 0.3, now, ramp);
            L.noise.filter.frequency.setTargetAtTime(800 + t * 600, now, ramp);

        } else if (mood === 'gameover') {
            // Everything dims, detuned, sad
            L.drone.gain.gain.setTargetAtTime(0.2, now, ramp);
            L.drone.filter.frequency.setTargetAtTime(120, now, ramp);
            L.drone.osc.frequency.setTargetAtTime(61.74, now, ramp); // Eb2 — minor
            L.pad.gain.gain.setTargetAtTime(0.1, now, ramp);
            L.pad.osc.frequency.setTargetAtTime(92.5, now, ramp); // Gb2
            L.shimmer.gain.gain.setTargetAtTime(0.03, now, ramp);
            L.shimmer.osc.frequency.setTargetAtTime(466, now, ramp); // Bb4
            L.tension.gain.gain.setTargetAtTime(0, now, ramp * 0.5);
            L.noise.gain.gain.setTargetAtTime(0.15, now, ramp);
            this.intensity = 0;

        } else if (mood === 'paused') {
            // Muted, just drone + noise
            L.drone.gain.gain.setTargetAtTime(0.15, now, ramp * 0.5);
            L.pad.gain.gain.setTargetAtTime(0.05, now, ramp * 0.5);
            L.shimmer.gain.gain.setTargetAtTime(0, now, ramp * 0.5);
            L.tension.gain.gain.setTargetAtTime(0, now, ramp * 0.5);
            L.sub.gain.gain.setTargetAtTime(0, now, ramp * 0.5);
            L.noise.gain.gain.setTargetAtTime(0.2, now, ramp * 0.5);
        }
    }

    // Called from game loop to keep music evolving
    update(state, level) {
        if (!this.playing) return;
        const mood = state === 'MENU' || state === 'ONBOARDING' || state === 'TILT_CALIBRATING' ? 'menu' :
                     state === 'PLAYING' || state === 'DYING' ? 'playing' :
                     state === 'PAUSED' ? 'paused' :
                     state === 'GAME_OVER' ? 'gameover' : 'menu';
        if (mood !== this.currentMood || (mood === 'playing' && level !== this.targetLevel)) {
            this.setMood(mood, level);
        }
    }
}

const music = new MusicManager();

// ============================================================
// SECTION 4: PARTICLE SYSTEM
// ============================================================
class Particle {
    constructor(x, y, vx, vy, radius, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.alive = true;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.96;
        this.vy *= 0.96;
        this.life -= dt;
        if (this.life <= 0) this.alive = false;
    }

    draw(ctx) {
        const alpha = clamp(this.life / this.maxLife, 0, 1);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * alpha, 0, TWO_PI);
        ctx.fillStyle = colorWithAlpha(this.color, alpha * 0.7);
        ctx.fill();
    }
}

const particles = [];

function spawnEatParticles(x, y, color, count = 10) {
    for (let i = 0; i < count && particles.length < CONFIG.MAX_PARTICLES; i++) {
        const angle = random() * TWO_PI;
        const speed = randRange(60, 180);
        particles.push(new Particle(
            x, y, cos(angle) * speed, sin(angle) * speed,
            randRange(2, 5), color, randRange(0.3, 0.6)
        ));
    }
}

function spawnDeathParticles(x, y, color, count = 20) {
    for (let i = 0; i < count && particles.length < CONFIG.MAX_PARTICLES; i++) {
        const angle = random() * TWO_PI;
        const speed = randRange(30, 120);
        particles.push(new Particle(
            x, y, cos(angle) * speed, sin(angle) * speed,
            randRange(3, 8), color, randRange(0.5, 1.2)
        ));
    }
}

function spawnLevelUpParticles(x, y, count = 25) {
    for (let i = 0; i < count && particles.length < CONFIG.MAX_PARTICLES; i++) {
        const angle = random() * TWO_PI;
        const speed = randRange(80, 200);
        particles.push(new Particle(
            x, y, cos(angle) * speed, sin(angle) * speed,
            randRange(2, 6), '#ffffff', randRange(0.4, 0.9)
        ));
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(dt);
        if (!particles[i].alive) particles.splice(i, 1);
    }
}

function drawParticles(ctx) {
    for (const p of particles) p.draw(ctx);
}

// ============================================================
// SECTION 5: AMOEBA ENTITY
// ============================================================
class Amoeba {
    constructor(x, y, speciesLevel) {
        const spec = getSpecies(speciesLevel);
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.vx = 0;
        this.vy = 0;
        this.speciesLevel = speciesLevel;
        this.radius = spec.radius;
        this.targetRadius = spec.radius;
        this.colors = spec.colors;
        this.alive = true;
        this.spawning = true;
        this.spawnTimer = 0.5;
        this.mass = PI * spec.radius * spec.radius;

        // Wobble parameters
        this.wobbleCount = CONFIG.WOBBLE_POINTS;
        this.wobbleOffsets = [];
        this.wobbleAmplitudes = [];
        this.wobbleSpeed = randRange(0.8, 2.0);
        for (let i = 0; i < this.wobbleCount; i++) {
            this.wobbleOffsets.push(random() * TWO_PI);
            this.wobbleAmplitudes.push(randRange(CONFIG.WOBBLE_AMPLITUDE_MIN, CONFIG.WOBBLE_AMPLITUDE_MAX));
        }

        // Nucleus wobble
        this.nucleusPhaseX = random() * TWO_PI;
        this.nucleusPhaseY = random() * TWO_PI;

        // AI state
        this.wanderAngle = random() * TWO_PI;
        this.dashTimer = 0;
        this.dashCooldown = randRange(2, 5);
        this.isDashing = false;
        this.patrolAngle = random() * TWO_PI;
    }

    updateRadius() {
        this.radius = lerp(this.radius, this.targetRadius, CONFIG.GROWTH_ANIM_SPEED);
        this.mass = PI * this.radius * this.radius;
    }

    constrainToDish(dishRadius) {
        const d = dist(0, 0, this.x, this.y);
        const maxD = dishRadius - this.radius;
        if (maxD <= 0) return;
        if (d > maxD) {
            const angle = atan2(this.y, this.x);
            this.x = cos(angle) * maxD;
            this.y = sin(angle) * maxD;
            const nx = cos(angle);
            const ny = sin(angle);
            const dot = this.vx * nx + this.vy * ny;
            this.vx -= TUNING.bounceMult * dot * nx;
            this.vy -= TUNING.bounceMult * dot * ny;
            const scatter = (random() - 0.5) * TUNING.bounceScatter;
            const cvx = this.vx, cvy = this.vy;
            const cs = cos(scatter), ss = sin(scatter);
            this.vx = cvx * cs - cvy * ss;
            this.vy = cvx * ss + cvy * cs;
            this.vx *= TUNING.bounceBoost;
            this.vy *= TUNING.bounceBoost;
            this.wanderAngle = atan2(this.vy, this.vx);
        }
    }

    steerAwayFromWalls(dishRadius, dt) {
        const d = dist(0, 0, this.x, this.y);
        const margin = this.radius + TUNING.wallMargin;
        const maxD = dishRadius - margin;
        if (maxD > 0 && d > maxD) {
            const strength = ((d - maxD) / margin) * TUNING.wallForce;
            const angle = atan2(-this.y, -this.x);
            this.vx += cos(angle) * strength * dt;
            this.vy += sin(angle) * strength * dt;
        }
    }

    draw(ctx, time, playerLevel) {
        const spawnScale = this.spawning ? clamp(1 - this.spawnTimer / 0.5, 0, 1) : 1;
        const drawRadius = this.radius * spawnScale;
        if (drawRadius < 1) return;

        // Level-based indicator
        let glowColor = null;
        if (playerLevel > 0) {
            if (this.speciesLevel <= playerLevel) {
                glowColor = 'rgba(68,255,120,0.15)'; // green = edible
            } else if (this.speciesLevel === playerLevel + 1) {
                glowColor = 'rgba(255,60,60,0.18)'; // red = predator
            }
        }

        // Build organic shape path
        const points = [];
        for (let i = 0; i < this.wobbleCount; i++) {
            const baseAngle = (i / this.wobbleCount) * TWO_PI;
            let wobble = 0;
            for (let h = 1; h <= 3; h++) {
                wobble += this.wobbleAmplitudes[i] * sin(
                    time * this.wobbleSpeed * h + this.wobbleOffsets[i] * h
                ) / h;
            }
            const r = drawRadius * (1 + wobble);
            points.push({
                x: this.x + cos(baseAngle) * r,
                y: this.y + sin(baseAngle) * r,
            });
        }

        // Draw smooth curve through points
        ctx.beginPath();
        const last = points.length - 1;
        ctx.moveTo(
            (points[last].x + points[0].x) / 2,
            (points[last].y + points[0].y) / 2
        );
        for (let i = 0; i < points.length; i++) {
            const curr = points[i];
            const next = points[(i + 1) % points.length];
            ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
        }
        ctx.closePath();

        // Fill with radial gradient
        const spawnAlpha = this.spawning ? clamp(1 - this.spawnTimer / 0.5, 0, 1) : 1;
        const grad = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, drawRadius * 1.1
        );
        grad.addColorStop(0, colorWithAlpha(this.colors.light, 0.9 * spawnAlpha));
        grad.addColorStop(0.6, colorWithAlpha(this.colors.base, 0.8 * spawnAlpha));
        grad.addColorStop(1, colorWithAlpha(this.colors.dark, 0.6 * spawnAlpha));
        ctx.fillStyle = grad;
        ctx.fill();

        // Membrane outline
        ctx.strokeStyle = colorWithAlpha(this.colors.light, 0.3 * spawnAlpha);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Size indicator glow
        if (glowColor) {
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Nucleus
        const nucX = this.x + sin(time * 0.7 + this.nucleusPhaseX) * drawRadius * 0.1;
        const nucY = this.y + cos(time * 0.9 + this.nucleusPhaseY) * drawRadius * 0.1;
        const nucR = drawRadius * 0.22;
        if (nucR > 1) {
            ctx.beginPath();
            ctx.arc(nucX, nucY, nucR, 0, TWO_PI);
            ctx.fillStyle = colorWithAlpha(this.colors.dark, 0.45 * spawnAlpha);
            ctx.fill();
        }
    }
}

// ============================================================
// SECTION 6: PLAYER
// ============================================================
class Player extends Amoeba {
    constructor(x, y) {
        // Player uses a special constructor -- not a species
        const tmpSpec = SPECIES_TABLE[0]; // temporary, we override below
        super(x, y, 1);
        // Override with player-specific properties
        this.speciesLevel = 0; // player is not a species
        this.colors = PLAYER_COLORS;
        this.radius = PLAYER_RADII[1];
        this.targetRadius = PLAYER_RADII[1];
        this.mass = PI * this.radius * this.radius;

        this.level = 1;
        this.xp = 0;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.spawning = false;
        this.totalEaten = 0;
        this.maxLevel = 1;

        // Juice
        this.eatPulseTimer = 0;
        this.speedBurstTimer = 0;

        // Trail
        this.trail = [];
    }

    get xpToNext() {
        if (this.level >= 7) return Infinity;
        return XP_TABLE[this.level + 1];
    }

    get xpProgress() {
        if (this.level >= 7) return 1;
        return clamp(this.xp / this.xpToNext, 0, 1);
    }

    addXP(amount) {
        if (this.level >= 7) return false;
        this.xp += amount;
        if (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.levelUp();
            return true; // leveled up
        }
        return false;
    }

    levelUp() {
        this.level++;
        this.maxLevel = max(this.maxLevel, this.level);
        this.targetRadius = PLAYER_RADII[this.level];
        sound.playLevelUp();
        triggerShake(8, 0.4);
        spawnLevelUpParticles(this.x, this.y, 30);
    }

    update(dt, input, dishRadius) {
        this.prevX = this.x;
        this.prevY = this.y;

        // Invincibility
        if (this.invincible) {
            this.invincibleTimer -= dt;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }

        const moveX = input.moveX;
        const moveY = input.moveY;
        const isMoving = moveX !== 0 || moveY !== 0;

        if (isMoving) {
            const mag = sqrt(moveX * moveX + moveY * moveY);
            const nx = moveX / mag;
            const ny = moveY / mag;
            this.vx += nx * CONFIG.PLAYER_ACCELERATION * dt;
            this.vy += ny * CONFIG.PLAYER_ACCELERATION * dt;
        }

        // Friction
        this.vx *= CONFIG.PLAYER_FRICTION;
        this.vy *= CONFIG.PLAYER_FRICTION;

        // Juice timers
        if (this.eatPulseTimer > 0) this.eatPulseTimer -= dt;
        if (this.speedBurstTimer > 0) this.speedBurstTimer -= dt;

        // Speed cap based on size
        const sizeFactor = Math.pow(PLAYER_RADII[1] / this.radius, CONFIG.PLAYER_SPEED_SIZE_EXPONENT);
        let currentMaxSpeed = CONFIG.PLAYER_MAX_SPEED * sizeFactor;
        if (this.speedBurstTimer > 0) currentMaxSpeed *= TUNING.eatSpeedBoost;
        const speed = sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > currentMaxSpeed) {
            this.vx = (this.vx / speed) * currentMaxSpeed;
            this.vy = (this.vy / speed) * currentMaxSpeed;
        }

        // Position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Dish boundary
        this.constrainToDish(dishRadius);

        // Radius animation (smooth growth on level-up)
        this.updateRadius();

        // Trail
        if (speed > 20) {
            this.trail.push({ x: this.x, y: this.y, r: this.radius * 0.4, life: 0.25 });
            if (this.trail.length > 15) this.trail.shift();
        }
        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].life -= dt;
            if (this.trail[i].life <= 0) this.trail.splice(i, 1);
        }
    }

    drawTrail(ctx) {
        for (const t of this.trail) {
            const alpha = clamp(t.life / 0.25, 0, 1) * 0.2;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r, 0, TWO_PI);
            ctx.fillStyle = colorWithAlpha(this.colors.base, alpha);
            ctx.fill();
        }
    }

    draw(ctx, time) {
        // Invincibility flash
        if (this.invincible && Math.floor(time * 8) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        // Eat pulse: scale up then back down
        let pulseScale = 1;
        if (this.eatPulseTimer > 0) {
            const t = 1 - this.eatPulseTimer / TUNING.eatPulseDuration;
            pulseScale = 1 + (TUNING.eatPulseScale - 1) * (1 - t * t); // ease-out
        }

        // Player glow
        ctx.save();
        if (pulseScale !== 1) {
            ctx.translate(this.x, this.y);
            ctx.scale(pulseScale, pulseScale);
            ctx.translate(-this.x, -this.y);
        }
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.colors.base;
        super.draw(ctx, time, 0);
        ctx.restore();

        ctx.globalAlpha = 1;
    }

    makeInvincible() {
        this.invincible = true;
        this.invincibleTimer = CONFIG.INVINCIBILITY_TIME;
    }
}

// ============================================================
// SECTION 7: ENEMY AI
// ============================================================
function updateSpeciesAI(amoeba, dt, player, allAmoebas) {
    // Spawn phase
    if (amoeba.spawning) {
        amoeba.spawnTimer -= dt;
        if (amoeba.spawnTimer <= 0) amoeba.spawning = false;
        return;
    }

    const spec = getSpecies(amoeba.speciesLevel);
    const speed = spec.speed * TUNING.enemySpeedMult;

    switch (spec.behavior) {
        case 'wander':
            aiWander(amoeba, dt, speed);
            break;
        case 'dasher':
            aiDasher(amoeba, dt, speed);
            break;
        case 'seek_prey':
            aiSeekPrey(amoeba, dt, speed, player, allAmoebas);
            break;
        case 'slow_wander':
            aiSlowWander(amoeba, dt, speed);
            break;
        case 'hunt_player':
            aiHuntPlayer(amoeba, dt, speed, player);
            break;
        case 'patrol':
            aiPatrol(amoeba, dt, speed);
            break;
    }

    // All species flee from their predator (species one level above)
    aiFleeFromPredator(amoeba, dt, allAmoebas, player);

    // Steer away from dish walls to prevent sticking
    amoeba.steerAwayFromWalls(game.dishRadius, dt);

    // Common: friction, speed cap, position update
    amoeba.vx *= TUNING.enemyFriction;
    amoeba.vy *= TUNING.enemyFriction;

    const spd = sqrt(amoeba.vx * amoeba.vx + amoeba.vy * amoeba.vy);
    const maxSpd = speed * (amoeba.isDashing ? 2.5 : 1);
    if (spd > maxSpd) {
        amoeba.vx = (amoeba.vx / spd) * maxSpd;
        amoeba.vy = (amoeba.vy / spd) * maxSpd;
    }

    amoeba.prevX = amoeba.x;
    amoeba.prevY = amoeba.y;
    amoeba.x += amoeba.vx * dt;
    amoeba.y += amoeba.vy * dt;
}

function aiWander(amoeba, dt, speed) {
    amoeba.wanderAngle += (random() - 0.5) * TUNING.wanderRate * dt;
    if (random() < TUNING.burstChance) amoeba.wanderAngle += (random() - 0.5) * 3.0;
    amoeba.vx += cos(amoeba.wanderAngle) * speed * 1.2 * dt;
    amoeba.vy += sin(amoeba.wanderAngle) * speed * 1.2 * dt;
}

function aiDasher(amoeba, dt, speed) {
    amoeba.dashCooldown -= dt;
    if (amoeba.isDashing) {
        amoeba.dashTimer -= dt;
        if (amoeba.dashTimer <= 0) {
            amoeba.isDashing = false;
            amoeba.dashCooldown = randRange(TUNING.dashCooldownMin, TUNING.dashCooldownMax);
        }
    } else if (amoeba.dashCooldown <= 0) {
        amoeba.isDashing = true;
        amoeba.dashTimer = randRange(0.3, 0.6);
        amoeba.wanderAngle = random() * TWO_PI;
    }
    const force = amoeba.isDashing ? speed * TUNING.dashForce : speed * 0.8;
    amoeba.wanderAngle += (random() - 0.5) * (amoeba.isDashing ? 0.5 : 6) * dt;
    if (!amoeba.isDashing && random() < TUNING.burstChance) amoeba.wanderAngle += (random() - 0.5) * 3.0;
    amoeba.vx += cos(amoeba.wanderAngle) * force * dt;
    amoeba.vy += sin(amoeba.wanderAngle) * force * dt;
}

function aiSeekPrey(amoeba, dt, speed, player, allAmoebas) {
    let target = null;
    let minD = TUNING.seekRange;

    if (player && player.alive && player.level < amoeba.speciesLevel) {
        const d = dist(amoeba.x, amoeba.y, player.x, player.y);
        if (d < minD) { minD = d; target = player; }
    }

    for (const other of allAmoebas) {
        if (other === amoeba || !other.alive || other.speciesLevel >= amoeba.speciesLevel) continue;
        const d = dist(amoeba.x, amoeba.y, other.x, other.y);
        if (d < minD) { minD = d; target = other; }
    }

    if (target) {
        const angle = atan2(target.y - amoeba.y, target.x - amoeba.x);
        amoeba.vx += cos(angle) * speed * TUNING.seekForce * dt;
        amoeba.vy += sin(angle) * speed * TUNING.seekForce * dt;
    } else {
        aiWander(amoeba, dt, speed * 0.8);
    }
}

function aiSlowWander(amoeba, dt, speed) {
    amoeba.wanderAngle += (random() - 0.5) * (TUNING.wanderRate * 0.625) * dt;
    if (random() < TUNING.burstChance * 0.8) amoeba.wanderAngle += (random() - 0.5) * 3.0;
    amoeba.vx += cos(amoeba.wanderAngle) * speed * 0.9 * dt;
    amoeba.vy += sin(amoeba.wanderAngle) * speed * 0.9 * dt;
}

function aiHuntPlayer(amoeba, dt, speed, player) {
    if (player && player.alive && player.level < amoeba.speciesLevel) {
        const angle = atan2(player.y - amoeba.y, player.x - amoeba.x) + sin(gameTime * 4) * 0.3;
        amoeba.vx += cos(angle) * speed * TUNING.huntForce * dt;
        amoeba.vy += sin(angle) * speed * TUNING.huntForce * dt;
    } else {
        aiWander(amoeba, dt, speed * 0.7);
    }
}

function aiPatrol(amoeba, dt, speed) {
    amoeba.patrolAngle += 0.5 * dt;
    const cx = cos(amoeba.patrolAngle) * 100;
    const cy = sin(amoeba.patrolAngle) * 100;
    const angle = atan2(cy - amoeba.y, cx - amoeba.x);
    amoeba.vx += cos(angle) * speed * 1.1 * dt;
    amoeba.vy += sin(angle) * speed * 1.1 * dt;
}

function aiFleeFromPredator(amoeba, dt, allAmoebas, player) {
    const predatorLevel = amoeba.speciesLevel + 1;

    if (player && player.alive && player.level >= amoeba.speciesLevel) {
        const d = dist(amoeba.x, amoeba.y, player.x, player.y);
        if (d < TUNING.fleeRange && d > 0) {
            const angle = atan2(amoeba.y - player.y, amoeba.x - player.x);
            const strength = (1 - d / TUNING.fleeRange) * TUNING.fleeForce * 2;
            amoeba.vx += cos(angle) * strength * dt;
            amoeba.vy += sin(angle) * strength * dt;
        }
    }

    for (const other of allAmoebas) {
        if (!other.alive || other.speciesLevel !== predatorLevel) continue;
        const d = dist(amoeba.x, amoeba.y, other.x, other.y);
        if (d < TUNING.fleeRange && d > 0) {
            const angle = atan2(amoeba.y - other.y, amoeba.x - other.x);
            const strength = (1 - d / TUNING.fleeRange) * TUNING.fleeForce;
            amoeba.vx += cos(angle) * strength * dt;
            amoeba.vy += sin(angle) * strength * dt;
        }
    }
}

// ============================================================
// SECTION 8: SPATIAL GRID
// ============================================================
class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    clear() {
        this.cells.clear();
    }

    _key(cx, cy) {
        return cx * 73856093 ^ cy * 19349663;
    }

    insert(entity) {
        const cx = floor(entity.x / this.cellSize);
        const cy = floor(entity.y / this.cellSize);
        const key = this._key(cx, cy);
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(entity);
    }

    query(entity) {
        const cx = floor(entity.x / this.cellSize);
        const cy = floor(entity.y / this.cellSize);
        const nearby = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = this._key(cx + dx, cy + dy);
                const cell = this.cells.get(key);
                if (cell) {
                    for (const e of cell) {
                        if (e !== entity) nearby.push(e);
                    }
                }
            }
        }
        return nearby;
    }
}

// ============================================================
// SECTION 9: POPULATION MANAGER
// ============================================================
function getPopulationTarget(speciesLevel, playerLevel) {
    // Only species up to playerLevel+1 are active
    if (speciesLevel > playerLevel + 1) return 0;

    const diff = speciesLevel - playerLevel;
    if (diff <= -3) return 1;
    if (diff === -2) return 2;
    if (diff === -1) return 4;
    if (diff === 0) return 5;
    if (diff === 1) return 3;
    return 1;
}

class PopulationManager {
    constructor() {
        this.spawnCooldowns = {};
        this.levelUpTimer = 0; // tracks time since last level-up
        this.boostActive = false;
        this.respiteActive = false;
    }

    onLevelUp() {
        this.levelUpTimer = 0;
        this.respiteActive = true;
        this.boostActive = false;
    }

    update(dt, playerLevel, amoebas, dishRadius) {
        // Level-up timing
        this.levelUpTimer += dt;

        if (this.respiteActive && this.levelUpTimer >= CONFIG.LEVEL_UP_RESPITE) {
            this.respiteActive = false;
            this.boostActive = true;
        }
        if (this.boostActive && this.levelUpTimer >= CONFIG.LEVEL_UP_RESPITE + CONFIG.LEVEL_UP_BOOST_DURATION) {
            this.boostActive = false;
        }

        const newAmoebas = [];

        for (let sl = 1; sl <= 8; sl++) {
            const target = getPopulationTarget(sl, playerLevel);
            if (target <= 0) continue;

            const current = amoebas.filter(a => a.alive && a.speciesLevel === sl).length;
            const deficit = target - current;
            if (deficit <= 0) continue;

            // Predator spawn logic during level-up phases
            const isPredator = sl === playerLevel + 1;
            if (isPredator && this.respiteActive) continue; // no predator spawn during respite

            // Determine spawn interval
            let interval = deficit >= 3 ? CONFIG.FAST_SPAWN_INTERVAL : CONFIG.SPAWN_INTERVAL;
            if (isPredator && this.boostActive) {
                interval /= CONFIG.LEVEL_UP_BOOST_MULTIPLIER;
            }

            if (!this.spawnCooldowns[sl]) this.spawnCooldowns[sl] = 0;
            this.spawnCooldowns[sl] -= dt;

            if (this.spawnCooldowns[sl] <= 0) {
                this.spawnCooldowns[sl] = interval;
                // Spawn at dish edge
                const angle = random() * TWO_PI;
                const spawnDist = dishRadius * randRange(0.85, 0.95);
                const x = cos(angle) * spawnDist;
                const y = sin(angle) * spawnDist;
                const a = new Amoeba(x, y, sl);
                a.vx = randRange(-20, 20);
                a.vy = randRange(-20, 20);
                sound.playSpawn(sl);
                newAmoebas.push(a);
            }
        }

        return newAmoebas;
    }
}

// ============================================================
// SECTION 10: INPUT HANDLER
// ============================================================
class InputHandler {
    constructor() {
        this.keys = {};
        // Touch input (set by TouchController)
        this.touchMoveX = 0;
        this.touchMoveY = 0;
        this.touchActive = false;
        this._tapFlag = false;

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    isPressed(code) { return this.keys[code] === true; }

    consumeTap() {
        if (this._tapFlag) { this._tapFlag = false; return true; }
        return false;
    }

    get moveX() {
        if (this.touchActive) return this.touchMoveX;
        return (this.isPressed('ArrowRight') ? 1 : 0) - (this.isPressed('ArrowLeft') ? 1 : 0);
    }

    get moveY() {
        if (this.touchActive) return this.touchMoveY;
        return (this.isPressed('ArrowDown') ? 1 : 0) - (this.isPressed('ArrowUp') ? 1 : 0);
    }
}

// ============================================================
// SECTION 10b: TOUCH CONTROLLER (mobile joystick)
// ============================================================
class TouchController {
    constructor(inputHandler) {
        this.input = inputHandler;
        this.zone = document.getElementById('joystick-zone');
        this.base = document.getElementById('joystick-base');
        this.nub = document.getElementById('joystick-nub');
        this.activeId = null;    // touch identifier being tracked
        this.originX = 0;
        this.originY = 0;
        this.startTime = 0;
        this.startX = 0;
        this.startY = 0;
        this.maxRadius = 55;     // max nub displacement from center
        this.deadZone = 10;      // pixels

        this.zone.addEventListener('touchstart', e => this.onStart(e), { passive: false });
        this.zone.addEventListener('touchmove', e => this.onMove(e), { passive: false });
        this.zone.addEventListener('touchend', e => this.onEnd(e), { passive: false });
        this.zone.addEventListener('touchcancel', e => this.onEnd(e), { passive: false });
    }

    onStart(e) {
        e.preventDefault();
        if (this.activeId !== null) return; // already tracking a touch

        const t = e.changedTouches[0];
        this.activeId = t.identifier;
        this.originX = t.clientX;
        this.originY = t.clientY;
        this.startX = t.clientX;
        this.startY = t.clientY;
        this.startTime = performance.now();

        // Show joystick at touch point
        this.base.style.left = t.clientX + 'px';
        this.base.style.top = t.clientY + 'px';
        this.base.style.display = 'block';
        this.nub.style.left = t.clientX + 'px';
        this.nub.style.top = t.clientY + 'px';
        this.nub.style.display = 'block';

        this.input.touchActive = true;
    }

    onMove(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier !== this.activeId) continue;

            const dx = t.clientX - this.originX;
            const dy = t.clientY - this.originY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Clamp nub position
            let clampedX, clampedY;
            if (dist > this.maxRadius) {
                clampedX = this.originX + (dx / dist) * this.maxRadius;
                clampedY = this.originY + (dy / dist) * this.maxRadius;
            } else {
                clampedX = t.clientX;
                clampedY = t.clientY;
            }
            this.nub.style.left = clampedX + 'px';
            this.nub.style.top = clampedY + 'px';

            // Calculate analog input with dead zone
            if (dist < this.deadZone) {
                this.input.touchMoveX = 0;
                this.input.touchMoveY = 0;
            } else {
                const mag = Math.min((dist - this.deadZone) / (this.maxRadius - this.deadZone), 1);
                this.input.touchMoveX = (dx / dist) * mag;
                this.input.touchMoveY = (dy / dist) * mag;
            }
        }
    }

    onEnd(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier !== this.activeId) continue;

            // Detect tap: short duration + small movement
            const elapsed = performance.now() - this.startTime;
            const movedX = t.clientX - this.startX;
            const movedY = t.clientY - this.startY;
            const moved = Math.sqrt(movedX * movedX + movedY * movedY);
            if (elapsed < 250 && moved < 20) {
                this.input._tapFlag = true;
            }

            // Reset
            this.activeId = null;
            this.input.touchMoveX = 0;
            this.input.touchMoveY = 0;
            this.input.touchActive = false;
            this.base.style.display = 'none';
            this.nub.style.display = 'none';
        }
    }
}

// ============================================================
// SECTION 10c: TILT CONTROLLER (DeviceOrientation)
// ============================================================
class TiltController {
    constructor(inputHandler) {
        this.input = inputHandler;
        this.calibration = { beta: 0, gamma: 0 };
        this.calibrated = false;
        this.maxAngle = 30;   // degrees for full speed
        this.deadZone = 3;    // degrees ignored (hand tremor)
        this.latestBeta = 0;
        this.latestGamma = 0;
        this.listening = false;
        this._requestPermission();
    }

    _requestPermission() {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ requires explicit permission from a user gesture
            // We'll defer to the calibration screen tap
            this._needsPermission = true;
        } else {
            this._needsPermission = false;
            this._listen();
        }
    }

    requestiOSPermission(onGranted) {
        if (!this._needsPermission) { onGranted(); return; }
        DeviceOrientationEvent.requestPermission()
            .then(state => {
                console.log('[Tilt] permission state:', state);
                if (state === 'granted') {
                    this._listen();
                    this._needsPermission = false;
                    onGranted();
                } else {
                    console.warn('[Tilt] permission denied:', state);
                }
            })
            .catch(e => console.warn('[Tilt] permission error:', e));
    }

    _listen() {
        if (this.listening) return;
        this.listening = true;
        window.addEventListener('deviceorientation', e => this._onTilt(e));
    }

    calibrate() {
        this.calibration.beta = this.latestBeta;
        this.calibration.gamma = this.latestGamma;
        this.calibrated = true;
        this.input.touchActive = true;
    }

    _onTilt(e) {
        this.latestBeta = e.beta || 0;
        this.latestGamma = e.gamma || 0;

        if (!this.calibrated) return;

        let rawX = this.latestGamma - this.calibration.gamma; // left/right
        let rawY = this.latestBeta - this.calibration.beta;   // forward/back

        this.input.touchMoveX = this._normalize(rawX);
        this.input.touchMoveY = this._normalize(rawY);
    }

    _normalize(angle) {
        if (Math.abs(angle) < this.deadZone) return 0;
        const sign = Math.sign(angle);
        const mag = Math.min(
            (Math.abs(angle) - this.deadZone) / (this.maxAngle - this.deadZone), 1
        );
        return sign * mag;
    }
}

// ============================================================
// SECTION 11: SCREEN SHAKE
// ============================================================
const screenShake = { x: 0, y: 0, intensity: 0, duration: 0, maxDuration: 0 };

function triggerShake(intensity, duration) {
    screenShake.intensity = intensity;
    screenShake.duration = duration;
    screenShake.maxDuration = duration;
}

function updateShake(dt) {
    if (screenShake.duration > 0) {
        screenShake.duration -= dt;
        const decay = clamp(screenShake.duration / screenShake.maxDuration, 0, 1);
        screenShake.x = (random() * 2 - 1) * screenShake.intensity * decay;
        screenShake.y = (random() * 2 - 1) * screenShake.intensity * decay;
    } else {
        screenShake.x = 0;
        screenShake.y = 0;
    }
}

// ============================================================
// SECTION 12: GAME STATE & MAIN LOGIC
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const input = new InputHandler();

const game = {
    state: 'MENU',
    score: 0,
    lives: CONFIG.START_LIVES,
    player: null,
    amoebas: [],
    dishRadius: CONFIG.BASE_DISH_RADIUS,
    camera: { x: 0, y: 0, zoom: CONFIG.BASE_ZOOM },
    respawnTimer: 0,
    menuTime: 0,
    menuAmoebas: [],
    populationManager: null,
    totalEaten: 0,
    levelUpFlashTimer: 0,
    levelUpFlashLevel: 0,
    onboardingCard: 0,
};

// Decorative menu amoebas
function initMenuAmoebas() {
    game.menuAmoebas = [];
    for (let i = 0; i < 12; i++) {
        const angle = random() * TWO_PI;
        const d = random() * 200;
        const sl = randInt(1, 8);
        const a = new Amoeba(cos(angle) * d, sin(angle) * d, sl);
        a.spawning = false;
        a.vx = randRange(-15, 15);
        a.vy = randRange(-15, 15);
        game.menuAmoebas.push(a);
    }
}

function getDishRadius(playerLevel) {
    return CONFIG.BASE_DISH_RADIUS + (playerLevel - 1) * CONFIG.DISH_GROWTH_PER_LEVEL;
}

function startGame() {
    sound.init();
    sound.resume();
    sound.playMenuSelect();
    // Start music if not already
    if (sound.initialized && !music.playing) {
        music.init(sound.ctx, sound.masterGain);
        music.start();
    }

    // On mobile with tilt: go to calibration first
    if (IS_MOBILE && window._tiltCtrl && !window._tiltCtrl.calibrated) {
        game.state = 'TILT_CALIBRATING';
    } else {
        game.state = 'PLAYING';
    }
    game.score = 0;
    game.lives = CONFIG.START_LIVES;
    game.totalEaten = 0;
    game.levelUpFlashTimer = 0;

    game.player = new Player(0, 0);
    game.dishRadius = getDishRadius(1);
    game.amoebas = [];
    game.populationManager = new PopulationManager();
    game.populationManager.levelUpTimer = 999; // skip initial respite

    // Initial spawn: fill population targets immediately
    for (let sl = 1; sl <= 2; sl++) { // level 1 + predator (level 2)
        const target = getPopulationTarget(sl, 1);
        for (let i = 0; i < target; i++) {
            const angle = random() * TWO_PI;
            const d = randRange(80, game.dishRadius * 0.9);
            const a = new Amoeba(cos(angle) * d, sin(angle) * d, sl);
            a.vx = randRange(-20, 20);
            a.vy = randRange(-20, 20);
            game.amoebas.push(a);
        }
    }

    particles.length = 0;
}

function playerDie() {
    sound.playDeath();
    spawnDeathParticles(game.player.x, game.player.y, PLAYER_COLORS.base, 25);
    triggerShake(12, 0.6);

    game.lives--;
    if (game.lives <= 0) {
        game.state = 'GAME_OVER';
    } else {
        game.state = 'DYING';
        game.respawnTimer = CONFIG.RESPAWN_TIME;
    }
}

function respawnPlayer() {
    // Respawn in place (game continues like a pause)
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.makeInvincible();
    game.state = 'PLAYING';
}

// Collision handling
const grid = new SpatialGrid(100);

function handleCollisions() {
    const player = game.player;
    const amoebas = game.amoebas;

    // Build grid
    grid.clear();
    for (const a of amoebas) {
        if (a.alive && !a.spawning) grid.insert(a);
    }

    // Player vs enemies
    if (player.alive) {
        for (const a of amoebas) {
            if (!a.alive || a.spawning) continue;
            const dSq = distSq(player.x, player.y, a.x, a.y);
            const rSum = player.radius + a.radius;

            if (dSq < rSum * rSum) {
                if (a.speciesLevel <= player.level) {
                    // Player eats this species
                    eatAmoeba(player, a);
                } else if (a.speciesLevel === player.level + 1) {
                    // Predator kills player
                    if (!player.invincible) {
                        playerDie();
                        return;
                    }
                } else {
                    // Higher species: bounce
                    softBounce(player, a);
                }
            }
        }
    }

    // Enemies pass through each other (no collision between them)

    // Remove dead
    game.amoebas = amoebas.filter(a => a.alive);
}

function eatAmoeba(player, prey) {
    prey.alive = false;

    const spec = getSpecies(prey.speciesLevel);

    // Score
    game.score += spec.xpReward;
    game.totalEaten++;
    player.totalEaten++;

    // Effects
    spawnEatParticles(prey.x, prey.y, prey.colors.base, 8);
    sound.playEat(prey.speciesLevel);
    player.eatPulseTimer = TUNING.eatPulseDuration;
    player.speedBurstTimer = TUNING.eatSpeedDuration;

    if (prey.speciesLevel >= player.level) {
        triggerShake(4, 0.2);
    }

    // Award XP and check level-up
    const leveled = player.addXP(spec.xpReward);
    if (leveled) {
        // Update dish radius
        game.dishRadius = getDishRadius(player.level);
        // Notify population manager
        game.populationManager.onLevelUp();
        // Level-up flash
        game.levelUpFlashTimer = 2.0;
        game.levelUpFlashLevel = player.level;
    }
}

function softBounce(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = sqrt(dx * dx + dy * dy);
    if (d === 0) return;
    const overlap = (a.radius + b.radius) - d;
    if (overlap <= 0) return;
    const nx = dx / d;
    const ny = dy / d;
    const totalMass = a.mass + b.mass;
    const aRatio = b.mass / totalMass;
    const bRatio = a.mass / totalMass;
    a.x -= nx * overlap * aRatio * 0.5;
    a.y -= ny * overlap * aRatio * 0.5;
    b.x += nx * overlap * bRatio * 0.5;
    b.y += ny * overlap * bRatio * 0.5;

    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const dvDotN = dvx * nx + dvy * ny;
    if (dvDotN > 0) {
        a.vx -= dvDotN * nx * aRatio;
        a.vy -= dvDotN * ny * aRatio;
        b.vx += dvDotN * nx * bRatio;
        b.vy += dvDotN * ny * bRatio;
    }
}

// ============================================================
// SECTION 13: UPDATE
// ============================================================
function update(dt) {
    switch (game.state) {
        case 'MENU':
            game.menuTime += dt;
            for (const a of game.menuAmoebas) {
                a.wanderAngle += (random() - 0.5) * 2 * dt;
                a.vx += cos(a.wanderAngle) * 25 * dt;
                a.vy += sin(a.wanderAngle) * 25 * dt;
                a.vx *= 0.96;
                a.vy *= 0.96;
                a.x += a.vx * dt;
                a.y += a.vy * dt;
                a.constrainToDish(240);
            }
            if (input.isPressed('Enter') || input.isPressed('Space') || input.consumeTap()) {
                // Init audio on first user gesture
                sound.init();
                sound.resume();
                if (sound.initialized && !music.playing) {
                    music.init(sound.ctx, sound.masterGain);
                    music.start();
                }
                if (!localStorage.getItem('moeboid_onboarded')) {
                    game.state = 'ONBOARDING';
                    game.onboardingCard = 0;
                    input.keys['Enter'] = false;
                    input.keys['Space'] = false;
                } else {
                    startGame();
                }
            }
            break;

        case 'ONBOARDING':
            // Debounce: wait for key release before accepting next press
            if (!input.isPressed('Enter') && !input.isPressed('Space')) {
                game._onboardReady = true;
            }
            if (game._onboardReady && (input.isPressed('Enter') || input.isPressed('Space') || input.consumeTap())) {
                input.keys['Enter'] = false;
                input.keys['Space'] = false;
                game._onboardReady = false;
                game.onboardingCard++;
                if (game.onboardingCard >= 3) {
                    localStorage.setItem('moeboid_onboarded', '1');
                    startGame();
                }
            }
            break;

        case 'TILT_CALIBRATING':
            // Calibration is handled directly in the touchstart handler
            // (iOS requires permission request inside user gesture context)
            // This state just renders the calibration screen and waits.
            break;

        case 'PLAYING':
            // Player
            game.player.update(dt, input, game.dishRadius);

            // Enemies
            for (const a of game.amoebas) {
                if (a.alive) {
                    updateSpeciesAI(a, dt, game.player, game.amoebas);
                    a.constrainToDish(game.dishRadius);
                }
            }

            // Collisions
            handleCollisions();

            // Population manager
            const newAmoebas = game.populationManager.update(
                dt, game.player.level, game.amoebas, game.dishRadius
            );
            if (newAmoebas.length > 0) {
                game.amoebas.push(...newAmoebas);
            }

            // Camera: fixed, always show entire map
            game.camera.x = 0;
            game.camera.y = 0;

            // Level-up flash
            if (game.levelUpFlashTimer > 0) {
                game.levelUpFlashTimer -= dt;
            }

            // Particles & shake
            updateParticles(dt);
            updateShake(dt);

            // Pause
            if (input.isPressed('KeyP') || input.isPressed('Escape')) {
                game.state = 'PAUSED';
                input.keys['KeyP'] = false;
                input.keys['Escape'] = false;
            }

            // Mute
            if (input.isPressed('KeyM')) {
                sound.toggleMute();
                input.keys['KeyM'] = false;
            }
            break;

        case 'DYING':
            game.respawnTimer -= dt;
            updateParticles(dt);
            updateShake(dt);
            // Enemies keep moving
            for (const a of game.amoebas) {
                if (a.alive) {
                    updateSpeciesAI(a, dt, null, game.amoebas);
                    a.constrainToDish(game.dishRadius);
                }
            }
            if (game.respawnTimer <= 0) {
                respawnPlayer();
            }
            break;

        case 'GAME_OVER':
            updateParticles(dt);
            for (const a of game.amoebas) {
                if (a.alive) {
                    a.vx *= 0.99;
                    a.vy *= 0.99;
                    a.x += a.vx * dt;
                    a.y += a.vy * dt;
                }
            }
            if (input.isPressed('Enter') || input.isPressed('Space') || input.consumeTap()) {
                input.keys['Enter'] = false;
                input.keys['Space'] = false;
                startGame();
            }
            if (input.isPressed('KeyM') && !input._menuHeld) {
                input._menuHeld = true;
                game.state = 'MENU';
                initMenuAmoebas();
            }
            if (!input.isPressed('KeyM')) input._menuHeld = false;
            break;

        case 'PAUSED':
            if (input.isPressed('KeyP') || input.isPressed('Escape') || input.consumeTap()) {
                game.state = 'PLAYING';
                input.keys['KeyP'] = false;
                input.keys['Escape'] = false;
            }
            break;
    }
}

// ============================================================
// SECTION 14: RENDERER
// ============================================================
function render(time) {
    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.fillStyle = THEME.surface;
    ctx.fillRect(0, 0, W, H);
    renderBackground(W, H, dpr, time);

    if (game.state === 'MENU') {
        renderMenu(W, H, dpr, time);
        return;
    }

    if (game.state === 'ONBOARDING') {
        renderOnboarding(W, H, dpr, time);
        return;
    }

    if (game.state === 'TILT_CALIBRATING') {
        renderTiltCalibration(W, H, dpr, time);
        return;
    }

    // Camera transform: fixed, fit entire dish with padding for UI
    ctx.save();
    const padding = 30 * dpr;
    const availW = W - padding * 2;
    const availH = H - padding * 2;
    const fitZoom = min(availW, availH) / (game.dishRadius * 2);
    ctx.translate(W / 2, H / 2);
    ctx.scale(fitZoom, fitZoom);
    ctx.translate(screenShake.x, screenShake.y);

    // Draw dish
    drawDish(game.dishRadius, time);
    drawAmbientSpecs(time, game.dishRadius);

    // Draw player trail
    if (game.player && game.state !== 'GAME_OVER') {
        game.player.drawTrail(ctx);
    }

    // Draw enemies sorted by radius
    const sortedAmoebas = [...game.amoebas].filter(a => a.alive).sort((a, b) => a.radius - b.radius);
    const playerLvl = game.player ? game.player.level : 0;
    for (const a of sortedAmoebas) {
        a.draw(ctx, time, playerLvl);
    }

    // Draw particles
    drawParticles(ctx);

    // Draw player
    if (game.player && game.state !== 'DYING') {
        game.player.draw(ctx, time);
    }

    ctx.restore();

    // HUD
    if (game.state === 'PLAYING' || game.state === 'DYING') {
        renderHUD(W, H, dpr, time);
    }

    // Level-up flash overlay
    if (game.levelUpFlashTimer > 0 && game.state === 'PLAYING') {
        renderLevelUpFlash(W, H, dpr);
    }

    // Overlays
    if (game.state === 'GAME_OVER') {
        renderGameOver(W, H, dpr);
    } else if (game.state === 'PAUSED') {
        renderPaused(W, H, dpr);
    }
}

function drawDish(radius, time) {
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    grad.addColorStop(0, DISH_COLORS.center);
    grad.addColorStop(0.85, DISH_COLORS.bg);
    grad.addColorStop(1, DISH_COLORS.bg);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TWO_PI);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = colorWithAlpha(DISH_COLORS.rim, 0.4);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Faint grid
    ctx.strokeStyle = colorWithAlpha('#1a2a3a', 0.08);
    ctx.lineWidth = 0.5;
    const gridSpacing = 50;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius - 2, 0, TWO_PI);
    ctx.clip();
    for (let x = -radius; x <= radius; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, -radius);
        ctx.lineTo(x, radius);
        ctx.stroke();
    }
    for (let y = -radius; y <= radius; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(-radius, y);
        ctx.lineTo(radius, y);
        ctx.stroke();
    }
    ctx.restore();
}

const ambientSpecs = [];
for (let i = 0; i < 40; i++) {
    ambientSpecs.push({
        angle: random() * TWO_PI,
        dist: random(),
        speed: randRange(0.02, 0.08),
        size: randRange(0.5, 1.5),
        phase: random() * TWO_PI,
    });
}

function drawAmbientSpecs(time, dishRadius) {
    ctx.fillStyle = 'rgba(100,150,200,0.06)';
    for (const s of ambientSpecs) {
        const a = s.angle + time * s.speed;
        const d = s.dist * dishRadius * 0.9;
        const x = cos(a) * d;
        const y = sin(a) * d;
        const r = s.size + sin(time * 2 + s.phase) * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TWO_PI);
        ctx.fill();
    }
}

// ---- BACKGROUND (vignette, viewfinder, metadata) ----
function renderBackground(W, H, dpr, time) {
    const s = dpr;
    // Vignette
    const vg = ctx.createRadialGradient(W/2, H/2, min(W,H)*0.25, W/2, H/2, max(W,H)*0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,W,H);

    // Viewfinder corners
    const cLen = 20*s, cOff = 16*s;
    ctx.strokeStyle = colorWithAlpha(THEME.secondary, 0.2);
    ctx.lineWidth = 1.5*s;
    // top-left
    ctx.beginPath(); ctx.moveTo(cOff, cOff+cLen); ctx.lineTo(cOff, cOff); ctx.lineTo(cOff+cLen, cOff); ctx.stroke();
    // top-right
    ctx.beginPath(); ctx.moveTo(W-cOff-cLen, cOff); ctx.lineTo(W-cOff, cOff); ctx.lineTo(W-cOff, cOff+cLen); ctx.stroke();
    // bottom-left
    ctx.beginPath(); ctx.moveTo(cOff, H-cOff-cLen); ctx.lineTo(cOff, H-cOff); ctx.lineTo(cOff+cLen, H-cOff); ctx.stroke();
    // bottom-right
    ctx.beginPath(); ctx.moveTo(W-cOff-cLen, H-cOff); ctx.lineTo(W-cOff, H-cOff); ctx.lineTo(W-cOff, H-cOff-cLen); ctx.stroke();
}

// ---- GLASS PANEL helper ----
function drawGlassPanel(x, y, w, h, r) {
    ctx.fillStyle = 'rgba(13,27,40,0.6)';
    roundRect(ctx, x, y, w, h, r || 6);
    ctx.fill();
}

// ---- GRADIENT BUTTON helper ----
function drawButton(cx, cy, text, s, wide) {
    const tw = ctx.measureText(text).width;
    const bw = (wide || tw + 48*s);
    const bh = 44*s;
    const bx = cx - bw/2, by = cy - bh/2;
    const grad = ctx.createLinearGradient(bx, by, bx+bw, by+bh);
    grad.addColorStop(0, THEME.primaryDim);
    grad.addColorStop(1, THEME.primaryCtr);
    ctx.fillStyle = grad;
    roundRect(ctx, bx, by, bw, bh, 6*s);
    ctx.fill();
    // glow
    ctx.shadowBlur = 20*s;
    ctx.shadowColor = colorWithAlpha(THEME.primary, 0.35);
    ctx.fillStyle = grad;
    roundRect(ctx, bx, by, bw, bh, 6*s);
    ctx.fill();
    ctx.shadowBlur = 0;
    // text
    ctx.fillStyle = '#003218';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${14*s}px ${THEME.fontHeadline}`;
    ctx.fillText(text, cx, cy);
}

function renderHUD(W, H, dpr, time) {
    const s = dpr;
    ctx.save();
    ctx.textBaseline = 'top';

    // ── DEBUG: Tilt info (temporary) ──
    if (IS_MOBILE && window._tiltCtrl) {
        const tc = window._tiltCtrl;
        ctx.font = `${10*s}px monospace`;
        ctx.fillStyle = '#ff0';
        ctx.textAlign = 'left';
        const dbg = [
            `listening:${tc.listening} cal:${tc.calibrated} needsPerm:${tc._needsPermission}`,
            `beta:${tc.latestBeta.toFixed(1)} gamma:${tc.latestGamma.toFixed(1)}`,
            `calB:${tc.calibration.beta.toFixed(1)} calG:${tc.calibration.gamma.toFixed(1)}`,
            `moveX:${input.touchMoveX.toFixed(2)} moveY:${input.touchMoveY.toFixed(2)}`,
            `touchActive:${input.touchActive}`
        ];
        dbg.forEach((line, i) => ctx.fillText(line, 10*s, (H - 120*s) + i * 14*s));
    }

    // ── Top-left: Score ──
    ctx.textAlign = 'left';
    ctx.font = `500 ${9*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.secondary, 0.5);
    ctx.fillText('DATA POINTS', 18*s, 16*s);
    ctx.font = `700 ${26*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = THEME.onSurface;
    ctx.fillText(game.score.toLocaleString(), 18*s, 28*s);
    ctx.font = `500 ${12*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.primary, 0.7);
    ctx.fillText(' PTS', 18*s + ctx.measureText(game.score.toLocaleString()).width + 2*s, 36*s);

    // ── Top-center: Level ──
    const specName = game.player.level <= 8 ? getSpecies(min(game.player.level, 8)).name.toUpperCase() : 'TITAN';
    const lvlText = `LV.${game.player.level} ${specName}`;
    ctx.textAlign = 'center';
    ctx.font = `italic 700 ${15*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = THEME.primary;
    const lvlW = ctx.measureText(lvlText).width + 24*s;
    // box
    ctx.strokeStyle = colorWithAlpha(THEME.primary, 0.3);
    ctx.lineWidth = 1;
    const lvlBx = W/2 - lvlW/2, lvlBy = 14*s;
    roundRect(ctx, lvlBx, lvlBy, lvlW, 26*s, 3*s);
    ctx.stroke();
    ctx.fillStyle = colorWithAlpha(THEME.primary, 0.05);
    roundRect(ctx, lvlBx, lvlBy, lvlW, 26*s, 3*s);
    ctx.fill();
    ctx.fillStyle = THEME.primary;
    ctx.fillText(lvlText, W/2, 17*s);
    // decorative line
    const lineW = 50*s;
    const lineGrad = ctx.createLinearGradient(W/2-lineW, 0, W/2+lineW, 0);
    lineGrad.addColorStop(0, 'rgba(105,254,165,0)');
    lineGrad.addColorStop(0.5, 'rgba(105,254,165,0.35)');
    lineGrad.addColorStop(1, 'rgba(105,254,165,0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(W/2-lineW, 42*s, lineW*2, 1*s);

    // ── Top-right: Predator warning ──
    ctx.textAlign = 'right';
    if (game.player.level < 7) {
        const predatorSpec = getSpecies(game.player.level + 1);
        if (predatorSpec) {
            const rx = W - 18*s;
            ctx.font = `500 ${9*s}px ${THEME.fontLabel}`;
            ctx.fillStyle = colorWithAlpha(THEME.error, 0.6);
            ctx.fillText('HAZARD WARNING', rx, 16*s);
            // warning box
            const warnText = `AVOID: ${predatorSpec.name.toLowerCase()}`;
            ctx.font = `700 ${13*s}px ${THEME.fontHeadline}`;
            const warnW = ctx.measureText(warnText).width + 36*s;
            const warnBx = rx - warnW, warnBy = 30*s;
            ctx.fillStyle = colorWithAlpha(THEME.error, 0.08);
            roundRect(ctx, warnBx, warnBy, warnW, 24*s, 3*s);
            ctx.fill();
            // red right border
            ctx.fillStyle = colorWithAlpha(THEME.error, 0.5);
            ctx.fillRect(rx - 2*s, warnBy, 2*s, 24*s);
            // warning icon (triangle)
            ctx.fillStyle = colorWithAlpha(THEME.error, 0.7 + 0.3*sin(time*4));
            ctx.font = `700 ${13*s}px ${THEME.fontHeadline}`;
            ctx.textAlign = 'left';
            ctx.fillText('⚠', warnBx + 8*s, 33*s);
            ctx.textAlign = 'right';
            ctx.fillStyle = THEME.onSurface;
            ctx.fillText(warnText, rx - 6*s, 33*s);
        }
    } else {
        ctx.font = `700 ${13*s}px ${THEME.fontHeadline}`;
        ctx.fillStyle = colorWithAlpha(THEME.primary, 0.7);
        ctx.fillText('⬢ APEX PREDATOR', W - 18*s, 30*s);
    }

    // ── Bottom-left: Lives ──
    for (let i = 0; i < CONFIG.START_LIVES; i++) {
        const lx = (22 + i*30)*s;
        const ly = H - 80*s;
        const lr = 10*s;
        ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TWO_PI);
        if (i < game.lives) {
            ctx.fillStyle = colorWithAlpha(THEME.primary, 0.12);
            ctx.fill();
            ctx.strokeStyle = colorWithAlpha(THEME.primary, 0.4);
            ctx.lineWidth = 1.5*s;
            ctx.stroke();
            ctx.shadowBlur = 8*s;
            ctx.shadowColor = colorWithAlpha(THEME.primary, 0.3);
            ctx.beginPath(); ctx.arc(lx, ly, 4*s, 0, TWO_PI);
            ctx.fillStyle = THEME.primary;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = colorWithAlpha(THEME.outline, 0.15);
            ctx.fill();
            ctx.strokeStyle = colorWithAlpha(THEME.outline, 0.2);
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    // ── Bottom-left: XP Bar ──
    renderXPBar(W, H, dpr);

    // ── Mute indicator ──
    if (sound.muted) {
        ctx.textAlign = 'right';
        ctx.font = `500 ${10*s}px ${THEME.fontLabel}`;
        ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.5);
        ctx.fillText('🔇 MUTED', W - 18*s, H - 18*s);
    }

    ctx.restore();
}

function renderXPBar(W, H, dpr) {
    const s = dpr;
    const barWidth = min(220*s, W*0.5);
    const barHeight = 7*s;
    const barX = 18*s;
    const barY = H - 32*s;

    // Label
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = `500 ${9*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.primary, 0.6);
    ctx.fillText('CELLULAR EVOLUTION', barX, barY - 16*s);

    // XP numbers on right of bar
    ctx.textAlign = 'right';
    ctx.fillStyle = colorWithAlpha(THEME.primaryDim, 0.8);
    ctx.font = `500 ${10*s}px ${THEME.fontLabel}`;
    if (game.player.level < 7) {
        ctx.fillText(`${game.player.xp} / ${game.player.xpToNext}`, barX + barWidth, barY - 16*s);
    } else {
        ctx.fillStyle = colorWithAlpha(THEME.primary, 0.7);
        ctx.fillText('MAX LEVEL', barX + barWidth, barY - 16*s);
    }

    // Background
    ctx.fillStyle = THEME.surfaceHighest;
    roundRect(ctx, barX, barY, barWidth, barHeight, 2*s);
    ctx.fill();

    // Fill
    const progress = game.player.xpProgress;
    if (progress > 0) {
        const grad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
        grad.addColorStop(0, THEME.primaryCtr);
        grad.addColorStop(1, THEME.primary);
        ctx.fillStyle = grad;
        roundRect(ctx, barX, barY, barWidth * progress, barHeight, 2*s);
        ctx.fill();
        // leading edge pulse
        const pulseX = barX + barWidth*progress;
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(pulseX - 3*s, barY, 3*s, barHeight);
    }
}

function roundRect(ctx, x, y, w, h, r) {
    if (w < 0) w = 0;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function renderMinimap(W, H, dpr, time) {
    const s = dpr;
    const mapRadius = 50*s;
    const cx = W - mapRadius - 18*s;
    const cy = H - mapRadius - 55*s;
    const mapScale = mapRadius / game.dishRadius;

    ctx.save();
    // Glass background
    ctx.beginPath(); ctx.arc(cx, cy, mapRadius+3*s, 0, TWO_PI);
    ctx.fillStyle = 'rgba(13,27,40,0.5)';
    ctx.fill();

    ctx.beginPath(); ctx.arc(cx, cy, mapRadius, 0, TWO_PI);
    ctx.fillStyle = THEME.surfaceCtr;
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha(THEME.secondary, 0.2);
    ctx.lineWidth = 1;
    ctx.stroke();

    // sweep line
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, mapRadius, 0, TWO_PI); ctx.clip();
    const sweepAngle = time * 0.8;
    const sweepGrad = ctx.createConicGradient(sweepAngle, cx, cy);
    sweepGrad.addColorStop(0, 'rgba(105,254,165,0.08)');
    sweepGrad.addColorStop(0.15, 'rgba(105,254,165,0)');
    sweepGrad.addColorStop(1, 'rgba(105,254,165,0)');
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(cx-mapRadius, cy-mapRadius, mapRadius*2, mapRadius*2);
    ctx.restore();

    ctx.globalAlpha = 0.6;
    for (const a of game.amoebas) {
        if (!a.alive) continue;
        const mx = cx + a.x*mapScale;
        const my = cy + a.y*mapScale;
        const mr = max(1.5, a.radius*mapScale);
        ctx.fillStyle = a.speciesLevel <= game.player.level ? THEME.primary :
                        a.speciesLevel === game.player.level+1 ? THEME.error : THEME.outline;
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, TWO_PI); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player dot
    if (game.player && game.state !== 'DYING') {
        ctx.shadowBlur = 6*s; ctx.shadowColor = THEME.primary;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx + game.player.x*mapScale, cy + game.player.y*mapScale, 3*s, 0, TWO_PI);
        ctx.fill(); ctx.shadowBlur = 0;
    }

    // Label
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `700 ${7*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = THEME.secondary;
    ctx.fillText('SCANNING PROXIMITY', cx, cy + mapRadius + 6*s);

    ctx.restore();
}

function renderLevelUpFlash(W, H, dpr) {
    const s = dpr;
    const alpha = clamp(game.levelUpFlashTimer / 2.0, 0, 1);

    ctx.save();
    // Overlay
    ctx.fillStyle = colorWithAlpha('#000', alpha * 0.35);
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Radial burst
    const burstGrad = ctx.createRadialGradient(W/2, H*0.35, 0, W/2, H*0.35, 250*s);
    burstGrad.addColorStop(0, colorWithAlpha(THEME.primary, 0.12*alpha));
    burstGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = burstGrad;
    ctx.fillRect(0, 0, W, H);

    // "SEQUENCE COMPLETE" label
    ctx.font = `500 ${10*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.primary, 0.5*alpha);
    ctx.letterSpacing = `${3*s}px`;
    ctx.fillText('SEQUENCE COMPLETE', W/2, H*0.35 - 50*s);
    ctx.letterSpacing = '0px';

    // "LEVEL X!" text
    ctx.font = `700 ${64*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = colorWithAlpha(THEME.primary, alpha*0.95);
    ctx.shadowBlur = 25*s;
    ctx.shadowColor = colorWithAlpha(THEME.primary, 0.7);
    ctx.fillText(`LEVEL ${game.levelUpFlashLevel}!`, W/2, H*0.35);
    ctx.shadowBlur = 0;

    // Unlock card
    if (game.levelUpFlashLevel <= 7) {
        const nowEdible = getSpecies(game.levelUpFlashLevel);
        const cardW = 260*s, cardH = 80*s;
        const cardX = W/2 - cardW/2, cardY = H*0.35 + 45*s;

        // glass panel
        ctx.globalAlpha = alpha;
        drawGlassPanel(cardX, cardY, cardW, cardH, 8*s);
        ctx.globalAlpha = 1;

        // "EVOLUTIONARY UNLOCK"
        ctx.font = `700 ${9*s}px ${THEME.fontLabel}`;
        ctx.fillStyle = colorWithAlpha(THEME.primary, 0.6*alpha);
        ctx.fillText('EVOLUTIONARY UNLOCK', W/2, cardY + 14*s);

        // Species circle
        const circR = 16*s;
        const circX = W/2 - 60*s, circY = cardY + 50*s;
        ctx.beginPath(); ctx.arc(circX, circY, circR, 0, TWO_PI);
        ctx.fillStyle = colorWithAlpha(nowEdible.colors.base, 0.8*alpha);
        ctx.fill();
        ctx.shadowBlur = 12*s;
        ctx.shadowColor = colorWithAlpha(nowEdible.colors.base, 0.5);
        ctx.beginPath(); ctx.arc(circX, circY, circR, 0, TWO_PI);
        ctx.fill();
        ctx.shadowBlur = 0;

        // "You can now eat: PULSER"
        ctx.textAlign = 'left';
        ctx.font = `400 ${12*s}px ${THEME.fontBody}`;
        ctx.fillStyle = colorWithAlpha(THEME.onSurface, 0.6*alpha);
        ctx.fillText('You can now eat:', circX + circR + 12*s, circY - 8*s);
        ctx.font = `700 ${18*s}px ${THEME.fontHeadline}`;
        ctx.fillStyle = colorWithAlpha(nowEdible.colors.base, alpha);
        ctx.fillText(nowEdible.name.toUpperCase(), circX + circR + 12*s, circY + 10*s);
    }

    ctx.restore();
}

function renderMenu(W, H, dpr, time) {
    const s = dpr;
    ctx.save();

    // Draw dish in center
    ctx.save();
    ctx.translate(W/2, H/2);
    drawDish(240, time);
    for (const a of game.menuAmoebas) {
        ctx.globalAlpha = 0.5;
        a.draw(ctx, time, 0);
        ctx.globalAlpha = 1;
    }
    // Crosshairs on dish
    ctx.strokeStyle = colorWithAlpha(THEME.secondary, 0.25);
    ctx.lineWidth = 1;
    const chLen = 25;
    ctx.beginPath(); ctx.moveTo(0, -240); ctx.lineTo(0, -240+chLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 240); ctx.lineTo(0, 240-chLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-240, 0); ctx.lineTo(-240+chLen, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(240, 0); ctx.lineTo(240-chLen, 0); ctx.stroke();
    ctx.restore();

    // Lab metadata decoration
    ctx.save();
    ctx.font = `500 ${8*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.outline, 0.35);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('LIVE_SPECIMEN_FEED', 22*s, 22*s);
    ctx.fillText('MAGNIFICATION: 400X', 22*s, 34*s);
    ctx.fillText('STATUS: OBSERVING', 22*s, 46*s);
    ctx.textAlign = 'right';
    ctx.fillText('ENVIRONMENT: STABLE', W - 22*s, H - 50*s);
    ctx.fillText('ENZYME_LEVELS: NOMINAL', W - 22*s, H - 38*s);
    ctx.restore();

    // Title
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    const titleY = H * 0.22;
    ctx.font = `italic 700 ${48*s}px ${THEME.fontHeadline}`;
    ctx.shadowBlur = 20*s;
    ctx.shadowColor = colorWithAlpha(THEME.primary, 0.7);
    ctx.fillStyle = THEME.primary;

    const title = 'MOEBOID';
    const titleWidth = ctx.measureText(title).width;
    let xOff = -titleWidth / 2;
    for (let i = 0; i < title.length; i++) {
        const charW = ctx.measureText(title[i]).width;
        const wobbleY = sin(time * 2 + i * 0.7) * 3 * s;
        ctx.fillText(title[i], W/2 + xOff + charW/2, titleY + wobbleY);
        xOff += charW;
    }
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = `500 ${13*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = THEME.secondary;
    ctx.letterSpacing = `${4*s}px`;
    ctx.fillText('EAT OR BE EATEN', W/2, titleY + 38*s);
    ctx.letterSpacing = '0px';

    // Start button
    const btnY = H * 0.78;
    ctx.font = `700 ${15*s}px ${THEME.fontHeadline}`;
    const pulse = 0.85 + 0.15*sin(time*3);
    ctx.globalAlpha = pulse;
    drawButton(W/2, btnY, IS_MOBILE ? 'TAP TO START' : 'PRESS ENTER TO START', s, 220*s);
    ctx.globalAlpha = 1;

    // Credit
    ctx.font = `500 ${9*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.3);
    ctx.fillText("Inspired by ZapSpot's Moeboid (2000)", W/2, H - 20*s);

    ctx.restore();
}

function renderTiltCalibration(W, H, dpr, time) {
    const s = dpr;
    const cx = W / 2;
    const cy = H / 2;

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    // Glass panel
    const pw = 320 * s;
    const ph = 220 * s;
    drawGlassPanel(cx - pw / 2, cy - ph / 2, pw, ph, 12 * s);

    // Phone icon (simple tilt illustration)
    const iconY = cy - 40 * s;
    const wobble = Math.sin(time / 600) * 0.15;
    ctx.save();
    ctx.translate(cx, iconY);
    ctx.rotate(wobble);
    ctx.strokeStyle = THEME.primary;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.roundRect(-20 * s, -30 * s, 40 * s, 60 * s, 6 * s);
    ctx.stroke();
    // Screen dot
    ctx.fillStyle = THEME.primary;
    ctx.beginPath();
    ctx.arc(0, 5 * s, 3 * s, 0, TWO_PI);
    ctx.fill();
    ctx.restore();

    // Tilt arrows
    ctx.strokeStyle = THEME.secondary;
    ctx.lineWidth = 1.5 * s;
    const arrowR = 45 * s;
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const ax = cx + Math.cos(a) * arrowR;
        const ay = iconY + Math.sin(a) * arrowR;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 30 * s, iconY + Math.sin(a) * 30 * s);
        ctx.lineTo(ax, ay);
        ctx.stroke();
    }

    // Title
    ctx.fillStyle = THEME.onSurface;
    ctx.font = `bold ${18 * s}px ${THEME.fontHeadline}`;
    ctx.textAlign = 'center';
    ctx.fillText('TILT CONTROL', cx, cy + 30 * s);

    // Instruction
    ctx.fillStyle = THEME.onSurfaceVar;
    ctx.font = `${13 * s}px ${THEME.fontBody}`;
    ctx.fillText('Hold your device in your', cx, cy + 52 * s);
    ctx.fillText('preferred playing position', cx, cy + 68 * s);

    // Button
    const btnW = 200 * s;
    const btnH = 44 * s;
    const btnX = cx - btnW / 2;
    const btnY = cy + 80 * s;
    const pulse = 0.5 + 0.5 * Math.sin(time / 400);
    drawButton(btnX, btnY, btnW, btnH, 'CALIBRATE & START', 14 * s, pulse);
}

function renderOnboarding(W, H, dpr, time) {
    const s = dpr;
    const card = game.onboardingCard;
    ctx.save();

    // Background overlay
    ctx.fillStyle = 'rgba(5,15,26,0.92)';
    ctx.fillRect(0,0,W,H);

    // Viewfinder corners
    const cLen = 16*s, cOff = 16*s;
    ctx.strokeStyle = colorWithAlpha(THEME.secondary, 0.2);
    ctx.lineWidth = 1.5*s;
    ctx.beginPath(); ctx.moveTo(cOff, cOff+cLen); ctx.lineTo(cOff, cOff); ctx.lineTo(cOff+cLen, cOff); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W-cOff-cLen, cOff); ctx.lineTo(W-cOff, cOff); ctx.lineTo(W-cOff, cOff+cLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cOff, H-cOff-cLen); ctx.lineTo(cOff, H-cOff); ctx.lineTo(cOff+cLen, H-cOff); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W-cOff-cLen, H-cOff); ctx.lineTo(W-cOff, H-cOff); ctx.lineTo(W-cOff, H-cOff-cLen); ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Card indicator
    ctx.font = `500 ${10*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.secondary, 0.4);
    ctx.fillText(`0${card+1} / 03`, W - 40*s, 30*s);

    // Dot indicators at bottom
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(W/2 + (i-1)*20*s, H - 50*s, 4*s, 0, TWO_PI);
        ctx.fillStyle = i === card ? THEME.primary : colorWithAlpha(THEME.surfaceHighest, 0.8);
        if (i === card) {
            ctx.shadowBlur = 8*s; ctx.shadowColor = colorWithAlpha(THEME.primary, 0.5);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    if (card === 0) {
        // ── Card 1: Controls ──
        ctx.font = `700 ${26*s}px ${THEME.fontHeadline}`;
        ctx.fillStyle = THEME.primary;
        ctx.fillText('Touch anywhere', W/2, H*0.2);
        ctx.fillText('and drag to move', W/2, H*0.2 + 34*s);

        // Joystick animation
        const joyY = H*0.45;
        const baseR = 50*s;
        const nubR = 18*s;
        const angle = time * 1.2;
        const reach = 28*s;
        const nubX = W/2 + cos(angle)*reach;
        const nubY = joyY + sin(angle)*reach;

        // Base circle
        ctx.beginPath(); ctx.arc(W/2, joyY, baseR, 0, TWO_PI);
        ctx.fillStyle = colorWithAlpha(THEME.primary, 0.06);
        ctx.fill();
        ctx.strokeStyle = colorWithAlpha(THEME.primary, 0.2);
        ctx.lineWidth = 2*s;
        ctx.stroke();

        // Trail arc
        ctx.beginPath();
        ctx.arc(W/2, joyY, reach, angle - 1.5, angle);
        ctx.strokeStyle = colorWithAlpha(THEME.primary, 0.15);
        ctx.lineWidth = 3*s;
        ctx.stroke();

        // Nub
        ctx.beginPath(); ctx.arc(nubX, nubY, nubR, 0, TWO_PI);
        ctx.fillStyle = colorWithAlpha(THEME.primary, 0.3);
        ctx.fill();
        ctx.strokeStyle = colorWithAlpha(THEME.primary, 0.5);
        ctx.lineWidth = 1.5*s;
        ctx.stroke();

        // Finger icon (touch_app substitute)
        ctx.font = `700 ${28*s}px ${THEME.fontHeadline}`;
        ctx.fillStyle = colorWithAlpha(THEME.primary, 0.7);
        ctx.fillText('👆', nubX, nubY - 2*s);

        // Description
        ctx.font = `400 ${12*s}px ${THEME.fontBody}`;
        ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.7);
        ctx.fillText('Precise fluid movement is key to survival.', W/2, H*0.65);
        ctx.fillText('Your organism follows your touch with inertia.', W/2, H*0.65 + 20*s);

    } else if (card === 1) {
        // ── Card 2: Rules ──
        ctx.font = `700 ${24*s}px ${THEME.fontHeadline}`;
        ctx.fillStyle = THEME.primary;
        ctx.fillText('Eat creatures your', W/2, H*0.16);
        ctx.fillText('size or smaller.', W/2, H*0.16 + 32*s);
        ctx.fillText('Avoid bigger ones.', W/2, H*0.16 + 64*s);

        // Example 1: Player eats smaller ✓
        const exY1 = H*0.42;
        const cardW = min(280*s, W*0.8), cardH = 52*s;
        drawGlassPanel(W/2-cardW/2, exY1, cardW, cardH, 6*s);

        // Player circle
        ctx.beginPath(); ctx.arc(W/2 - 60*s, exY1+cardH/2, 16*s, 0, TWO_PI);
        ctx.fillStyle = THEME.primary;
        ctx.fill();
        ctx.shadowBlur = 8*s; ctx.shadowColor = colorWithAlpha(THEME.primary, 0.4);
        ctx.fill(); ctx.shadowBlur = 0;

        // Arrow
        ctx.font = `600 ${18*s}px ${THEME.fontBody}`;
        ctx.fillStyle = THEME.secondary;
        ctx.fillText('→', W/2 - 20*s, exY1+cardH/2);

        // Smaller prey
        ctx.beginPath(); ctx.arc(W/2 + 20*s, exY1+cardH/2, 10*s, 0, TWO_PI);
        ctx.fillStyle = colorWithAlpha(THEME.primary, 0.4);
        ctx.fill();

        // Check
        ctx.font = `700 ${22*s}px ${THEME.fontBody}`;
        ctx.fillStyle = THEME.primary;
        ctx.fillText('✓', W/2 + 80*s, exY1+cardH/2);

        // Example 2: Player vs bigger ✗
        const exY2 = exY1 + cardH + 12*s;
        drawGlassPanel(W/2-cardW/2, exY2, cardW, cardH, 6*s);

        ctx.beginPath(); ctx.arc(W/2 - 60*s, exY2+cardH/2, 16*s, 0, TWO_PI);
        ctx.fillStyle = THEME.primary;
        ctx.fill();

        ctx.font = `600 ${18*s}px ${THEME.fontBody}`;
        ctx.fillStyle = THEME.secondary;
        ctx.fillText('→', W/2 - 20*s, exY2+cardH/2);

        // Bigger predator
        ctx.beginPath(); ctx.arc(W/2 + 25*s, exY2+cardH/2, 24*s, 0, TWO_PI);
        ctx.fillStyle = colorWithAlpha(THEME.error, 0.2);
        ctx.fill();
        ctx.strokeStyle = colorWithAlpha(THEME.error, 0.4);
        ctx.lineWidth = 1.5*s;
        ctx.stroke();

        // X
        ctx.font = `700 ${22*s}px ${THEME.fontBody}`;
        ctx.fillStyle = THEME.error;
        ctx.fillText('✗', W/2 + 80*s, exY2+cardH/2);

        // Description
        ctx.font = `400 ${12*s}px ${THEME.fontBody}`;
        ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.6);
        ctx.fillText('Eat enough to level up and grow!', W/2, exY2 + cardH + 30*s);

    } else if (card === 2) {
        // ── Card 3: Goal ──
        ctx.font = `700 ${22*s}px ${THEME.fontHeadline}`;
        ctx.fillStyle = THEME.primary;
        ctx.fillText('Climb the food chain', W/2, H*0.16);
        ctx.fillText('from Mote to Titan', W/2, H*0.16 + 30*s);

        // Species progression
        const progY = H*0.42;
        const species = [0, 1, 2, 3, 4, 5, 6, 7]; // all 8
        const totalW = min(300*s, W*0.85);
        const spacing = totalW / 7;
        const startX = W/2 - totalW/2;

        for (let i = 0; i < 8; i++) {
            const sp = SPECIES_TABLE[i];
            const dx = startX + i*spacing;
            const r = (5 + i*2.5)*s;

            ctx.beginPath(); ctx.arc(dx, progY, r, 0, TWO_PI);
            ctx.fillStyle = colorWithAlpha(sp.colors.base, 0.6);
            ctx.fill();

            if (i < 7) {
                ctx.strokeStyle = colorWithAlpha(THEME.primary, 0.15);
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(dx+r+2*s, progY); ctx.lineTo(dx+spacing-r-2*s, progY); ctx.stroke();
            }

            ctx.font = `700 ${6*s}px ${THEME.fontLabel}`;
            ctx.fillStyle = colorWithAlpha(sp.colors.base, 0.7);
            ctx.fillText(sp.name.toUpperCase().slice(0,4), dx, progY + r + 12*s);
        }

        // Lives
        const livesY = H*0.58;
        drawGlassPanel(W/2-100*s, livesY, 200*s, 40*s, 20*s);
        ctx.font = `500 ${10*s}px ${THEME.fontLabel}`;
        ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.7);
        ctx.fillText('VITALITY UNITS:', W/2 - 30*s, livesY+20*s);
        for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.arc(W/2 + 30*s + i*18*s, livesY+20*s, 6*s, 0, TWO_PI);
            ctx.fillStyle = THEME.primary;
            ctx.fill();
            ctx.shadowBlur = 4*s; ctx.shadowColor = colorWithAlpha(THEME.primary, 0.4);
            ctx.fill(); ctx.shadowBlur = 0;
        }

        // "Let's go!" button
        ctx.font = `700 ${15*s}px ${THEME.fontHeadline}`;
        drawButton(W/2, H*0.72, "LET'S GO!", s, 200*s);
    }

    // Tap hint
    ctx.font = `400 ${11*s}px ${THEME.fontBody}`;
    ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.35);
    ctx.fillText(card < 2 ? (IS_MOBILE ? 'Tap to continue' : 'Press ENTER to continue') : '', W/2, H - 80*s);

    ctx.restore();
}

function renderGameOver(W, H, dpr) {
    const s = dpr;
    ctx.save();

    // Red vignette overlay
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0,0,W,H);
    const redVg = ctx.createRadialGradient(W/2, H/2, min(W,H)*0.2, W/2, H/2, max(W,H)*0.7);
    redVg.addColorStop(0, 'rgba(0,0,0,0)');
    redVg.addColorStop(1, 'rgba(159,5,25,0.35)');
    ctx.fillStyle = redVg;
    ctx.fillRect(0,0,W,H);

    // Viewfinder corners
    const cLen = 16*s, cOff = 20*s;
    ctx.strokeStyle = colorWithAlpha(THEME.secondary, 0.2);
    ctx.lineWidth = 1.5*s;
    ctx.beginPath(); ctx.moveTo(cOff, cOff+cLen); ctx.lineTo(cOff, cOff); ctx.lineTo(cOff+cLen, cOff); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W-cOff-cLen, cOff); ctx.lineTo(W-cOff, cOff); ctx.lineTo(W-cOff, cOff+cLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cOff, H-cOff-cLen); ctx.lineTo(cOff, H-cOff); ctx.lineTo(cOff+cLen, H-cOff); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W-cOff-cLen, H-cOff); ctx.lineTo(W-cOff, H-cOff); ctx.lineTo(W-cOff, H-cOff-cLen); ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Label
    ctx.font = `500 ${10*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = THEME.errorDim;
    ctx.letterSpacing = `${3*s}px`;
    ctx.fillText('BIOLOGICAL SYSTEM FAILURE', W/2, H*0.18);
    ctx.letterSpacing = '0px';

    // "GAME OVER"
    ctx.font = `700 ${56*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = THEME.error;
    ctx.shadowBlur = 25*s;
    ctx.shadowColor = colorWithAlpha(THEME.error, 0.6);
    ctx.fillText('GAME OVER', W/2, H*0.26);
    ctx.shadowBlur = 0;

    // Stat cards
    const cardW = min(280*s, W*0.8);
    const cardH = 55*s;
    const cardX = W/2 - cardW/2;
    const cardGap = 8*s;
    let cy = H*0.36;

    // Score card
    drawGlassPanel(cardX, cy, cardW, cardH, 8*s);
    ctx.font = `500 ${9*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.7);
    ctx.fillText('FINAL SCORE', W/2, cy + 16*s);
    ctx.font = `700 ${24*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = THEME.primary;
    ctx.fillText(game.score.toLocaleString(), W/2, cy + 38*s);
    cy += cardH + cardGap;

    // Level card
    drawGlassPanel(cardX, cy, cardW, cardH, 8*s);
    ctx.font = `500 ${9*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.7);
    ctx.fillText('STATUS REACHED', W/2, cy + 16*s);
    const reachedSpec = getSpecies(min(game.player.maxLevel, 8));
    ctx.font = `700 ${20*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = THEME.secondary;
    ctx.fillText(`LEVEL ${game.player.maxLevel} — ${reachedSpec.name.toUpperCase()}`, W/2, cy + 38*s);
    cy += cardH + cardGap;

    // Eaten card
    drawGlassPanel(cardX, cy, cardW, cardH, 8*s);
    ctx.font = `500 ${9*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.7);
    ctx.fillText('AMOEBAS ASSIMILATED', W/2, cy + 16*s);
    ctx.font = `700 ${24*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = THEME.onSurface;
    ctx.fillText(game.totalEaten.toString(), W/2, cy + 38*s);
    cy += cardH + cardGap + 8*s;

    // Evolution progress chain
    const chainW = min(300*s, W*0.85);
    const chainX = W/2 - chainW/2;
    drawGlassPanel(chainX, cy, chainW, 75*s, 8*s);
    ctx.font = `700 ${8*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.5);
    ctx.fillText('EVOLUTIONARY PROGRESS', W/2, cy + 12*s);

    const specCount = min(game.player.maxLevel + 1, 8);
    const dotSpacing = chainW / 6;
    const dotY = cy + 48*s;
    for (let i = 0; i < min(5, 8); i++) {
        const sp = getSpecies(i + 1);
        const dx = chainX + 30*s + i*dotSpacing;
        const conquered = (i+1) <= game.player.maxLevel;
        const isCurrent = (i+1) === game.player.maxLevel;

        const dotR = isCurrent ? 14*s : 10*s;
        ctx.beginPath(); ctx.arc(dx, dotY, dotR, 0, TWO_PI);
        if (conquered) {
            ctx.fillStyle = colorWithAlpha(sp.colors.base, isCurrent ? 0.3 : 0.15);
            ctx.fill();
            ctx.strokeStyle = colorWithAlpha(sp.colors.base, isCurrent ? 0.8 : 0.5);
            ctx.lineWidth = isCurrent ? 2*s : 1*s;
            ctx.stroke();
            if (isCurrent) {
                ctx.shadowBlur = 10*s; ctx.shadowColor = colorWithAlpha(sp.colors.base, 0.4);
                ctx.stroke(); ctx.shadowBlur = 0;
            }
        } else {
            ctx.fillStyle = colorWithAlpha(THEME.outline, 0.1);
            ctx.fill();
            ctx.strokeStyle = colorWithAlpha(THEME.outline, 0.2);
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.font = `700 ${7*s}px ${THEME.fontLabel}`;
        ctx.fillStyle = conquered ? colorWithAlpha(sp.colors.base, 0.8) : colorWithAlpha(THEME.outline, 0.3);
        ctx.fillText(sp.name.toUpperCase().slice(0,4), dx, dotY + dotR + 10*s);

        // connector line
        if (i < 4) {
            ctx.strokeStyle = conquered && (i+2)<=game.player.maxLevel ?
                colorWithAlpha(THEME.primary, 0.25) : colorWithAlpha(THEME.outline, 0.1);
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(dx+dotR+2*s, dotY); ctx.lineTo(dx+dotSpacing-dotR-2*s, dotY); ctx.stroke();
        }
    }
    cy += 85*s;

    // Play again button
    ctx.font = `700 ${14*s}px ${THEME.fontHeadline}`;
    drawButton(W/2, cy, IS_MOBILE ? 'TAP TO PLAY AGAIN' : 'PLAY AGAIN', s, 220*s);

    // Menu link
    if (!IS_MOBILE) {
        ctx.font = `500 ${10*s}px ${THEME.fontLabel}`;
        ctx.fillStyle = colorWithAlpha(THEME.onSurfaceVar, 0.5);
        ctx.fillText('Press N for menu', W/2, cy + 34*s);
    }

    ctx.restore();
}

function renderPaused(W, H, dpr) {
    const s = dpr;
    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0,0,W,H);

    // Viewfinder corners
    const cLen = 16*s, cOff = 20*s;
    ctx.strokeStyle = colorWithAlpha(THEME.secondary, 0.25);
    ctx.lineWidth = 1.5*s;
    ctx.beginPath(); ctx.moveTo(cOff, cOff+cLen); ctx.lineTo(cOff, cOff); ctx.lineTo(cOff+cLen, cOff); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W-cOff-cLen, cOff); ctx.lineTo(W-cOff, cOff); ctx.lineTo(W-cOff, cOff+cLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cOff, H-cOff-cLen); ctx.lineTo(cOff, H-cOff); ctx.lineTo(cOff+cLen, H-cOff); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W-cOff-cLen, H-cOff); ctx.lineTo(W-cOff, H-cOff); ctx.lineTo(W-cOff, H-cOff-cLen); ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Label
    ctx.font = `500 ${10*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.secondary, 0.5);
    ctx.letterSpacing = `${3*s}px`;
    ctx.fillText('SYSTEM STATE: STANDBY', W/2, H*0.28);
    ctx.letterSpacing = '0px';

    // "PAUSED"
    ctx.font = `700 ${58*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = THEME.onSurface;
    ctx.shadowBlur = 15*s;
    ctx.shadowColor = 'rgba(255,255,255,0.08)';
    ctx.fillText('PAUSED', W/2, H*0.36);
    ctx.shadowBlur = 0;

    // Stat cards
    const cardW = min(260*s, W*0.75);
    const cardH = 60*s;
    const cardX = W/2 - cardW/2;
    const gap = 8*s;
    let cy = H*0.46;

    // Score
    drawGlassPanel(cardX, cy, cardW, cardH, 6*s);
    ctx.font = `500 ${9*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.secondary, 0.45);
    ctx.fillText('CURRENT YIELD', W/2, cy + 18*s);
    ctx.font = `700 ${26*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = THEME.primary;
    ctx.fillText(game.score.toLocaleString(), W/2, cy + 42*s);
    cy += cardH + gap;

    // Level
    drawGlassPanel(cardX, cy, cardW, cardH, 6*s);
    ctx.font = `500 ${9*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.secondary, 0.45);
    ctx.fillText('OBSERVATION DEPTH', W/2, cy + 18*s);
    ctx.font = `700 ${26*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = THEME.onSurface;
    ctx.fillText(`LVL 0${game.player.level}`, W/2, cy + 42*s);
    cy += cardH + gap;

    // Eaten
    drawGlassPanel(cardX, cy, cardW, cardH, 6*s);
    ctx.font = `500 ${9*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.secondary, 0.45);
    ctx.fillText('SPECIMENS EATEN', W/2, cy + 18*s);
    ctx.font = `700 ${26*s}px ${THEME.fontHeadline}`;
    ctx.fillStyle = '#cfffdd';
    ctx.fillText(game.totalEaten.toString(), W/2, cy + 42*s);
    cy += cardH + 20*s;

    // Resume button
    ctx.font = `700 ${14*s}px ${THEME.fontHeadline}`;
    drawButton(W/2, cy, IS_MOBILE ? '▶  TAP TO RESUME' : '▶  RESUME', s, 220*s);

    // Metadata
    ctx.font = `500 ${8*s}px ${THEME.fontLabel}`;
    ctx.fillStyle = colorWithAlpha(THEME.outline, 0.3);
    ctx.fillText('SESSION ACTIVE • AUTOSAVED', W/2, H - 30*s);

    ctx.restore();
}

// ============================================================
// SECTION 15: GAME LOOP
// ============================================================
const FIXED_DT = 1 / 60;
let lastTimestamp = 0;
let accumulator = 0;
let gameTime = 0;

function handleResize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
}

window.addEventListener('resize', handleResize);
handleResize();

document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'PLAYING') {
        game.state = 'PAUSED';
    }
});

initMenuAmoebas();

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    if (lastTimestamp === 0) {
        lastTimestamp = timestamp;
        return;
    }

    let elapsed = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    if (elapsed > 0.1) elapsed = 0.1;

    accumulator += elapsed;

    while (accumulator >= FIXED_DT) {
        update(FIXED_DT);
        gameTime += FIXED_DT;
        accumulator -= FIXED_DT;
    }

    render(gameTime);

    // Update music mood
    music.update(game.state, game.player ? game.player.level : 1);
}

requestAnimationFrame(gameLoop);

// ============================================================
// SECTION: LIVE TUNING PANEL (temporary debug tool)
// ============================================================
(() => {
    if (IS_MOBILE) return; // No tuning panel on mobile

    const DEFAULTS = {
        config: JSON.parse(JSON.stringify(CONFIG)),
        tuning: JSON.parse(JSON.stringify(TUNING)),
        speeds: SPECIES_TABLE.map(s => s.speed),
    };

    const panel = document.createElement('div');
    panel.id = 'tuningPanel';
    panel.style.cssText = `
        position: fixed; right: 0; top: 0; bottom: 0; width: 300px;
        background: rgba(10,10,20,0.92); color: #ccc; font: 11px/1.4 monospace;
        overflow-y: auto; z-index: 9999; padding: 8px 14px 8px 8px; display: none;
        border-left: 1px solid rgba(255,255,255,0.1);
        user-select: none; box-sizing: border-box;
    `;
    document.body.appendChild(panel);

    let visible = false;
    window.addEventListener('keydown', e => {
        if (e.key === 't' || e.key === 'T') {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            visible = !visible;
            panel.style.display = visible ? 'block' : 'none';
            e.preventDefault();
        }
    });

    function makeSlider(label, value, min, max, step, onChange) {
        const row = document.createElement('div');
        row.style.cssText = 'margin: 3px 0; display: flex; align-items: center; gap: 4px;';
        const lbl = document.createElement('span');
        lbl.style.cssText = 'flex: 0 0 90px; font-size: 10px; color: #aaa;';
        lbl.textContent = label;
        const inp = document.createElement('input');
        inp.type = 'range';
        inp.min = min; inp.max = max; inp.step = step; inp.value = value;
        inp.style.cssText = 'flex: 1; height: 14px; cursor: pointer; accent-color: #44dd88;';
        inp.tabIndex = -1;
        const val = document.createElement('span');
        val.style.cssText = 'flex: 0 0 48px; text-align: right; font-size: 10px; color: #8f8;';
        const decimals = step < 0.01 ? 3 : step < 1 ? 2 : 0;
        val.textContent = Number(value).toFixed(decimals);
        inp.addEventListener('input', () => {
            const v = parseFloat(inp.value);
            val.textContent = v.toFixed(decimals);
            onChange(v);
        });
        row.append(lbl, inp, val);
        return row;
    }

    function makeSection(title, collapsed) {
        const details = document.createElement('details');
        if (!collapsed) details.open = true;
        const summary = document.createElement('summary');
        summary.style.cssText = 'cursor: pointer; color: #44dd88; font-size: 12px; font-weight: bold; margin: 6px 0 2px; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.1);';
        summary.textContent = title;
        details.appendChild(summary);
        return details;
    }

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'color: #44dd88; font-size: 13px; font-weight: bold; margin-bottom: 6px; text-align: center;';
    title.textContent = 'TUNING PANEL [T]';
    panel.appendChild(title);

    // Player
    const secPlayer = makeSection('Player', false);
    secPlayer.appendChild(makeSlider('Accel', CONFIG.PLAYER_ACCELERATION, 200, 3000, 50, v => CONFIG.PLAYER_ACCELERATION = v));
    secPlayer.appendChild(makeSlider('Friction', CONFIG.PLAYER_FRICTION, 0.70, 0.99, 0.01, v => CONFIG.PLAYER_FRICTION = v));
    secPlayer.appendChild(makeSlider('Max Speed', CONFIG.PLAYER_MAX_SPEED, 100, 600, 10, v => CONFIG.PLAYER_MAX_SPEED = v));
    secPlayer.appendChild(makeSlider('Size Exp', CONFIG.PLAYER_SPEED_SIZE_EXPONENT, 0, 0.50, 0.05, v => CONFIG.PLAYER_SPEED_SIZE_EXPONENT = v));
    panel.appendChild(secPlayer);

    // Enemy Global
    const secEnemy = makeSection('Enemy Global', false);
    secEnemy.appendChild(makeSlider('Speed Mult', TUNING.enemySpeedMult, 0.3, 3.0, 0.1, v => TUNING.enemySpeedMult = v));
    secEnemy.appendChild(makeSlider('Friction', TUNING.enemyFriction, 0.85, 0.995, 0.005, v => TUNING.enemyFriction = v));
    secEnemy.appendChild(makeSlider('Wander Rate', TUNING.wanderRate, 1, 20, 0.5, v => TUNING.wanderRate = v));
    secEnemy.appendChild(makeSlider('Burst Chance', TUNING.burstChance, 0, 0.30, 0.01, v => TUNING.burstChance = v));
    secEnemy.appendChild(makeSlider('Flee Range', TUNING.fleeRange, 50, 400, 10, v => TUNING.fleeRange = v));
    secEnemy.appendChild(makeSlider('Flee Force', TUNING.fleeForce, 20, 300, 10, v => TUNING.fleeForce = v));
    panel.appendChild(secEnemy);

    // Per-Species Speeds
    const secSpeeds = makeSection('Species Speeds', true);
    SPECIES_TABLE.forEach((sp, i) => {
        secSpeeds.appendChild(makeSlider(sp.name, sp.speed, 20, 300, 5, v => SPECIES_TABLE[i].speed = v));
    });
    panel.appendChild(secSpeeds);

    // Dash
    const secDash = makeSection('Dash (Pulser)', true);
    secDash.appendChild(makeSlider('CD Min', TUNING.dashCooldownMin, 0.2, 5, 0.1, v => TUNING.dashCooldownMin = v));
    secDash.appendChild(makeSlider('CD Max', TUNING.dashCooldownMax, 0.5, 8, 0.1, v => TUNING.dashCooldownMax = v));
    secDash.appendChild(makeSlider('Dash Force', TUNING.dashForce, 1, 10, 0.5, v => TUNING.dashForce = v));
    panel.appendChild(secDash);

    // Seek/Hunt
    const secSeek = makeSection('Seek / Hunt', true);
    secSeek.appendChild(makeSlider('Seek Range', TUNING.seekRange, 50, 600, 10, v => TUNING.seekRange = v));
    secSeek.appendChild(makeSlider('Seek Force', TUNING.seekForce, 0.5, 5, 0.1, v => TUNING.seekForce = v));
    secSeek.appendChild(makeSlider('Hunt Force', TUNING.huntForce, 0.5, 5, 0.1, v => TUNING.huntForce = v));
    panel.appendChild(secSeek);

    // Population
    const secPop = makeSection('Population', true);
    secPop.appendChild(makeSlider('Spawn Int', CONFIG.SPAWN_INTERVAL, 0.2, 5, 0.1, v => CONFIG.SPAWN_INTERVAL = v));
    secPop.appendChild(makeSlider('Fast Spawn', CONFIG.FAST_SPAWN_INTERVAL, 0.05, 2, 0.05, v => CONFIG.FAST_SPAWN_INTERVAL = v));
    secPop.appendChild(makeSlider('Respite', CONFIG.LEVEL_UP_RESPITE, 0, 10, 0.5, v => CONFIG.LEVEL_UP_RESPITE = v));
    secPop.appendChild(makeSlider('Boost Dur', CONFIG.LEVEL_UP_BOOST_DURATION, 0, 20, 1, v => CONFIG.LEVEL_UP_BOOST_DURATION = v));
    secPop.appendChild(makeSlider('Boost Mult', CONFIG.LEVEL_UP_BOOST_MULTIPLIER, 1, 10, 0.5, v => CONFIG.LEVEL_UP_BOOST_MULTIPLIER = v));
    panel.appendChild(secPop);

    // Dish
    const secDish = makeSection('Dish', true);
    secDish.appendChild(makeSlider('Base Radius', CONFIG.BASE_DISH_RADIUS, 150, 500, 5, v => {
        CONFIG.BASE_DISH_RADIUS = v;
        if (game.player) game.dishRadius = getDishRadius(game.player.level);
    }));
    secDish.appendChild(makeSlider('Growth/Lvl', CONFIG.DISH_GROWTH_PER_LEVEL, 10, 80, 5, v => {
        CONFIG.DISH_GROWTH_PER_LEVEL = v;
        if (game.player) game.dishRadius = getDishRadius(game.player.level);
    }));
    panel.appendChild(secDish);

    // Wall Bounce
    const secWall = makeSection('Wall Bounce', true);
    secWall.appendChild(makeSlider('Bounce Mult', TUNING.bounceMult, 1.0, 3.0, 0.1, v => TUNING.bounceMult = v));
    secWall.appendChild(makeSlider('Scatter', TUNING.bounceScatter, 0, 2.0, 0.05, v => TUNING.bounceScatter = v));
    secWall.appendChild(makeSlider('Boost', TUNING.bounceBoost, 1.0, 1.5, 0.05, v => TUNING.bounceBoost = v));
    secWall.appendChild(makeSlider('Wall Margin', TUNING.wallMargin, 10, 80, 5, v => TUNING.wallMargin = v));
    secWall.appendChild(makeSlider('Wall Force', TUNING.wallForce, 20, 300, 10, v => TUNING.wallForce = v));
    panel.appendChild(secWall);

    // Game Juice
    const secJuice = makeSection('Game Juice', true);
    secJuice.appendChild(makeSlider('Eat Pulse', TUNING.eatPulseScale, 1.0, 1.3, 0.01, v => TUNING.eatPulseScale = v));
    secJuice.appendChild(makeSlider('Pulse Dur', TUNING.eatPulseDuration, 0.05, 0.5, 0.01, v => TUNING.eatPulseDuration = v));
    secJuice.appendChild(makeSlider('Speed Boost', TUNING.eatSpeedBoost, 1.0, 1.5, 0.05, v => TUNING.eatSpeedBoost = v));
    secJuice.appendChild(makeSlider('Boost Dur', TUNING.eatSpeedDuration, 0.1, 1.0, 0.05, v => TUNING.eatSpeedDuration = v));
    panel.appendChild(secJuice);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'margin-top: 10px; display: flex; gap: 6px;';

    const btnCopy = document.createElement('button');
    btnCopy.textContent = 'Copy Config';
    btnCopy.style.cssText = 'flex:1; padding: 6px; background: #228855; color: #fff; border: none; border-radius: 4px; cursor: pointer; font: 11px monospace;';
    btnCopy.addEventListener('click', () => {
        const cfg = {
            CONFIG: {
                PLAYER_ACCELERATION: CONFIG.PLAYER_ACCELERATION,
                PLAYER_FRICTION: CONFIG.PLAYER_FRICTION,
                PLAYER_MAX_SPEED: CONFIG.PLAYER_MAX_SPEED,
                PLAYER_SPEED_SIZE_EXPONENT: CONFIG.PLAYER_SPEED_SIZE_EXPONENT,
                BASE_DISH_RADIUS: CONFIG.BASE_DISH_RADIUS,
                DISH_GROWTH_PER_LEVEL: CONFIG.DISH_GROWTH_PER_LEVEL,
                SPAWN_INTERVAL: CONFIG.SPAWN_INTERVAL,
                FAST_SPAWN_INTERVAL: CONFIG.FAST_SPAWN_INTERVAL,
                LEVEL_UP_RESPITE: CONFIG.LEVEL_UP_RESPITE,
                LEVEL_UP_BOOST_DURATION: CONFIG.LEVEL_UP_BOOST_DURATION,
                LEVEL_UP_BOOST_MULTIPLIER: CONFIG.LEVEL_UP_BOOST_MULTIPLIER,
            },
            TUNING: { ...TUNING },
            SPECIES_SPEEDS: Object.fromEntries(SPECIES_TABLE.map(s => [s.name, s.speed])),
        };
        navigator.clipboard.writeText(JSON.stringify(cfg, null, 2)).then(() => {
            btnCopy.textContent = 'Copied!';
            setTimeout(() => btnCopy.textContent = 'Copy Config', 1500);
        });
    });

    const btnReset = document.createElement('button');
    btnReset.textContent = 'Reset';
    btnReset.style.cssText = 'flex:1; padding: 6px; background: #663333; color: #fff; border: none; border-radius: 4px; cursor: pointer; font: 11px monospace;';
    btnReset.addEventListener('click', () => {
        Object.assign(CONFIG, DEFAULTS.config);
        Object.assign(TUNING, DEFAULTS.tuning);
        SPECIES_TABLE.forEach((s, i) => s.speed = DEFAULTS.speeds[i]);
        if (game.player) game.dishRadius = getDishRadius(game.player.level);
        location.reload();
    });

    btnRow.append(btnCopy, btnReset);
    panel.appendChild(btnRow);
})();

// ============================================================
// SECTION: MOBILE CONTROLS INIT
// ============================================================
if (IS_MOBILE) {
    // Tilt mode: hide joystick, keep pause button
    const pauseBtn = document.getElementById('mobile-pause');
    pauseBtn.style.display = 'block';
    pauseBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (game.state === 'PLAYING') {
            game.state = 'PAUSED';
        } else if (game.state === 'PAUSED') {
            game.state = 'PLAYING';
        }
    }, { passive: false });

    // Initialize tilt controller (replaces touch controller)
    const tiltCtrl = new TiltController(input);
    window._tiltCtrl = tiltCtrl; // expose for calibration screen

    // Tap on canvas: handle menu taps AND tilt calibration (all in user gesture)
    document.querySelector('canvas').addEventListener('touchstart', (e) => {
        if (e.target !== document.querySelector('canvas')) return;

        if (game.state === 'TILT_CALIBRATING') {
            e.preventDefault();
            const doCalibrate = () => {
                // Wait for orientation data to arrive, then calibrate
                setTimeout(() => {
                    tiltCtrl.calibrate();
                    game.state = 'PLAYING';
                    console.log('[Tilt] Calibrated!', tiltCtrl.calibration);
                }, 300);
            };
            if (tiltCtrl._needsPermission) {
                // iOS: must call requestPermission synchronously in gesture handler
                tiltCtrl.requestiOSPermission(doCalibrate);
            } else {
                if (!tiltCtrl.listening) tiltCtrl._listen();
                doCalibrate();
            }
            return; // don't set tapFlag, we handle state change here
        }

        input._tapFlag = true;
    }, { passive: false });

    // Hide cursor style on mobile
    document.querySelector('canvas').style.cursor = 'default';
}
