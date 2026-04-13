// ============================================================
// MOEBOID - "Eat or be Eaten"
// Browser clone of ZapSpot's Moeboid (2000)
// v2: Food Chain / Level-Up System
// Pure HTML5 Canvas + vanilla JavaScript
// ============================================================

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

    get moveX() {
        return (this.isPressed('ArrowRight') ? 1 : 0) - (this.isPressed('ArrowLeft') ? 1 : 0);
    }

    get moveY() {
        return (this.isPressed('ArrowDown') ? 1 : 0) - (this.isPressed('ArrowUp') ? 1 : 0);
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

    game.state = 'PLAYING';
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
            if (input.isPressed('Enter') || input.isPressed('Space')) {
                startGame();
            }
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
            if (input.isPressed('Enter') || input.isPressed('Space')) {
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
            if (input.isPressed('KeyP') || input.isPressed('Escape')) {
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

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (game.state === 'MENU') {
        renderMenu(W, H, dpr, time);
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

function renderHUD(W, H, dpr, time) {
    const s = dpr;
    ctx.save();

    // Score - top left
    ctx.font = `bold ${20 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 8 * s;
    ctx.shadowColor = 'rgba(68,221,136,0.5)';
    ctx.fillText(`Score: ${game.score.toLocaleString()}`, 20 * s, 20 * s);
    ctx.shadowBlur = 0;

    // Level - top right
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${18 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillText(`Level ${game.player.level}`, (W / dpr - 20) * s, 20 * s);

    // Predator indicator - top right with colored circle preview
    if (game.player.level < 7) {
        const predatorSpec = getSpecies(game.player.level + 1);
        if (predatorSpec) {
            const indicatorX = (W / dpr - 20) * s;
            const indicatorY = 50 * s;

            // Label
            ctx.font = `${11 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
            ctx.fillStyle = 'rgba(255,100,100,0.7)';
            ctx.fillText('AVOID:', indicatorX - 22 * s, indicatorY);

            // Small colored circle showing the predator
            const circleR = 9 * s;
            const circleX = indicatorX - 10 * s;
            const circleY = indicatorY + 20 * s;
            ctx.beginPath();
            ctx.arc(circleX, circleY, circleR, 0, TWO_PI);
            const pGrad = ctx.createRadialGradient(circleX, circleY, 0, circleX, circleY, circleR);
            pGrad.addColorStop(0, predatorSpec.colors.light);
            pGrad.addColorStop(1, predatorSpec.colors.dark);
            ctx.fillStyle = pGrad;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,60,60,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Name
            ctx.fillStyle = colorWithAlpha(predatorSpec.colors.base, 0.8);
            ctx.font = `bold ${12 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
            ctx.fillText(predatorSpec.name, circleX - circleR - 6 * s, circleY + 4 * s);
        }
    } else {
        ctx.font = `${12 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
        ctx.fillStyle = 'rgba(68,255,120,0.6)';
        ctx.fillText('APEX PREDATOR', (W / dpr - 20) * s, 50 * s);
    }

    // Lives - bottom left
    ctx.textAlign = 'left';
    for (let i = 0; i < CONFIG.START_LIVES; i++) {
        const lx = (25 + i * 28) * s;
        const ly = (H / dpr - 35) * s;
        const lr = 8 * s;
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, TWO_PI);
        ctx.fillStyle = i < game.lives ? PLAYER_COLORS.base : 'rgba(80,80,80,0.5)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // XP Bar - bottom center
    renderXPBar(W, H, dpr);

    // Mute indicator
    if (sound.muted) {
        ctx.textAlign = 'right';
        ctx.font = `${12 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('MUTED [M]', (W / dpr - 20) * s, (H / dpr - 28) * s);
    }

    ctx.restore();
}

function renderXPBar(W, H, dpr) {
    const s = dpr;
    const barWidth = 200 * s;
    const barHeight = 8 * s;
    const barX = (W - barWidth) / 2;
    const barY = H - 22 * s;

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, barX, barY, barWidth, barHeight, 4 * s);
    ctx.fill();

    // Fill
    const progress = game.player.xpProgress;
    if (progress > 0) {
        const grad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
        grad.addColorStop(0, '#44dd88');
        grad.addColorStop(1, '#88ffbb');
        ctx.fillStyle = grad;
        roundRect(ctx, barX, barY, barWidth * progress, barHeight, 4 * s);
        ctx.fill();
    }

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    roundRect(ctx, barX, barY, barWidth, barHeight, 4 * s);
    ctx.stroke();

    // XP text
    if (game.player.level < 7) {
        ctx.font = `${11 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(
            `XP: ${game.player.xp} / ${game.player.xpToNext}`,
            W / 2, barY - 4 * s
        );
    } else {
        ctx.font = `${11 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(68,255,120,0.6)';
        ctx.fillText('MAX LEVEL', W / 2, barY - 4 * s);
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

function renderMinimap(W, H, dpr) {
    const s = dpr;
    const mapRadius = 50 * s;
    const cx = W - mapRadius - 15 * s;
    const cy = H - mapRadius - 50 * s;
    const mapScale = mapRadius / game.dishRadius;

    ctx.save();
    ctx.globalAlpha = 0.3;

    ctx.beginPath();
    ctx.arc(cx, cy, mapRadius, 0, TWO_PI);
    ctx.fillStyle = '#0a1520';
    ctx.fill();
    ctx.strokeStyle = DISH_COLORS.rim;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.globalAlpha = 0.6;

    for (const a of game.amoebas) {
        if (!a.alive) continue;
        const mx = cx + a.x * mapScale;
        const my = cy + a.y * mapScale;
        const mr = max(1.5, a.radius * mapScale);

        if (a.speciesLevel <= game.player.level) {
            ctx.fillStyle = '#44ff88';
        } else if (a.speciesLevel === game.player.level + 1) {
            ctx.fillStyle = '#ff4444';
        } else {
            ctx.fillStyle = '#888';
        }
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, TWO_PI);
        ctx.fill();
    }

    // Player
    if (game.player && game.state !== 'DYING') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx + game.player.x * mapScale, cy + game.player.y * mapScale, 3 * s, 0, TWO_PI);
        ctx.fill();
    }

    ctx.restore();
}

function renderLevelUpFlash(W, H, dpr) {
    const s = dpr;
    const alpha = clamp(game.levelUpFlashTimer / 2.0, 0, 1);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${40 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = colorWithAlpha('#ffffff', alpha * 0.9);
    ctx.shadowBlur = 20 * s;
    ctx.shadowColor = PLAYER_COLORS.base;
    ctx.fillText(`LEVEL ${game.levelUpFlashLevel}!`, W / 2, H * 0.35);

    // Show what's new
    if (game.levelUpFlashLevel <= 7) {
        const nowEdible = getSpecies(game.levelUpFlashLevel);
        ctx.font = `${16 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
        ctx.shadowBlur = 0;
        ctx.fillStyle = colorWithAlpha(nowEdible.colors.base, alpha * 0.8);
        ctx.fillText(`You can now eat: ${nowEdible.name}`, W / 2, H * 0.35 + 35 * s);
    }

    ctx.restore();
}

function renderMenu(W, H, dpr, time) {
    const s = dpr;
    ctx.save();

    ctx.translate(W / 2, H / 2);
    drawDish(240, time);

    for (const a of game.menuAmoebas) {
        ctx.globalAlpha = 0.5;
        a.draw(ctx, time, 0);
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const titleY = H * 0.3;
    ctx.font = `bold ${52 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.shadowBlur = 20 * s;
    ctx.shadowColor = PLAYER_COLORS.base;
    ctx.fillStyle = '#fff';

    const title = 'MOEBOID';
    const titleWidth = ctx.measureText(title).width;
    let xOff = -titleWidth / 2;
    for (let i = 0; i < title.length; i++) {
        const charW = ctx.measureText(title[i]).width;
        const wobbleY = sin(time * 2 + i * 0.7) * 4 * s;
        ctx.fillText(title[i], W / 2 + xOff + charW / 2, titleY + wobbleY);
        xOff += charW;
    }

    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = `italic ${18 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = colorWithAlpha(PLAYER_COLORS.base, 0.8);
    ctx.fillText('"Eat or be Eaten"', W / 2, titleY + 42 * s);

    // Controls
    ctx.font = `${14 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const infoY = H * 0.52;
    ctx.fillText('Arrow Keys - Move', W / 2, infoY);
    ctx.fillText('P / Esc - Pause     M - Mute', W / 2, infoY + 24 * s);

    // Food chain preview
    ctx.font = `${11 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('Eat your way up the food chain!', W / 2, infoY + 55 * s);

    // Start
    const blink = sin(time * 3) > 0 ? 1 : 0.4;
    ctx.font = `bold ${20 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = colorWithAlpha('#fff', blink);
    ctx.fillText('Press ENTER or SPACE to start', W / 2, H * 0.72);

    // Credit
    ctx.font = `${11 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText("Inspired by ZapSpot's Moeboid (2000)", W / 2, H - 25 * s);

    ctx.restore();
}

function renderGameOver(W, H, dpr) {
    const s = dpr;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `bold ${48 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = '#ff4444';
    ctx.shadowBlur = 20 * s;
    ctx.shadowColor = '#ff0000';
    ctx.fillText('GAME OVER', W / 2, H * 0.28);
    ctx.shadowBlur = 0;

    ctx.font = `${18 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = '#ddd';
    const statY = H * 0.42;
    const lineH = 32 * s;
    ctx.fillText(`Score: ${game.score.toLocaleString()}`, W / 2, statY);
    ctx.fillText(`Level Reached: ${game.player.maxLevel}`, W / 2, statY + lineH);
    ctx.fillText(`Amoebas Eaten: ${game.totalEaten}`, W / 2, statY + lineH * 2);

    // Show species unlocked
    const speciesNames = [];
    for (let i = 1; i <= game.player.maxLevel && i <= 8; i++) {
        speciesNames.push(getSpecies(i).name);
    }
    ctx.font = `${14 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`Species conquered: ${speciesNames.join(', ')}`, W / 2, statY + lineH * 3.2);

    ctx.font = `bold ${16 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Press ENTER to play again', W / 2, H * 0.78);
    ctx.fillText('Press N for menu', W / 2, H * 0.78 + 28 * s);

    ctx.restore();
}

function renderPaused(W, H, dpr) {
    const s = dpr;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${40 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText('PAUSED', W / 2, H / 2 - 15 * s);

    ctx.font = `${16 * s}px 'Segoe UI', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Press P or ESC to resume', W / 2, H / 2 + 25 * s);

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
}

requestAnimationFrame(gameLoop);

// ============================================================
// SECTION: LIVE TUNING PANEL (temporary debug tool)
// ============================================================
(() => {
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
