let particles = [];
let numParticlesSlider, temperatureSlider, volumeSlider, minRadiusSlider, maxRadiusSlider;
let numParticlesValSpan, temperatureValSpan, volumeValSpan, pressureDisplaySpan, minRadiusValSpan, maxRadiusValSpan;
let pausePlayButton;

let PARTICLE_RADIUS_MIN = 4;
let PARTICLE_RADIUS_MAX = 7;
const DAMPING_FACTOR = 0.99; // Slight energy loss for stability, realism
const K_TEMP_SCALAR = 0.05; // Scales Kelvin to a reasonable base speed

let baseCnvWidth, baseCnvHeight; // Initial canvas dimensions for volume scaling
let canvasInitialized = false; // Flag to ensure canvas is created only once
let isPaused = false;
// let wallCollisions = 0; // Replaced by new pressure logic
let collisionCountSinceLastUpdate = 0;
let lastPressureUpdateTime = 0;
const pressureUpdateInterval = 1000; // milliseconds (1 second)
let displayedPressure = 0;

// Colors for speed indication
let slowColor, fastColor;

const DEBUG_MODE = true; // Toggle console logs

// Default values for reset
const DEFAULT_NUM_PARTICLES = 100;
const DEFAULT_TEMPERATURE_K = 298;
const DEFAULT_VOLUME_PERCENT = 100;
const DEFAULT_MIN_RADIUS = 4;
const DEFAULT_MAX_RADIUS = 7;

class Particle {
    constructor(x, y, kelvinTemp) {
        // Radius is now determined by the global dynamic PARTICLE_RADIUS_MIN and PARTICLE_RADIUS_MAX
        this.radius = random(PARTICLE_RADIUS_MIN, PARTICLE_RADIUS_MAX);
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D();
        let actualSpeed = sqrt(kelvinTemp * K_TEMP_SCALAR); // Speed proportional to sqrt(T)
        if (actualSpeed === 0) actualSpeed = 0.01; // avoid zero velocity if T=0
        this.vel.mult(random(0.7 * actualSpeed, 1.3 * actualSpeed));
        this.radius = random(PARTICLE_RADIUS_MIN, PARTICLE_RADIUS_MAX);
        this.mass = this.radius * this.radius * 0.5; // Mass proportional to area, adjusted factor
        // this.color = color(random(150, 255), random(100, 200), random(50, 150), 220); // Color now dynamic
        this.highlight = false;
        if (DEBUG_MODE) {
            let speedMag = this.vel.mag();
            console.log(`Particle constructor: kelvinTemp=${kelvinTemp}, actualSpeedBase=${actualSpeed.toFixed(4)}, initial vel=(${this.vel.x.toFixed(2)}, ${this.vel.y.toFixed(2)}), mag=${speedMag.toFixed(4)}, radius=${this.radius.toFixed(2)}, x=${this.pos.x.toFixed(2)}, y=${this.pos.y.toFixed(2)}`);
            if (isNaN(speedMag) || (speedMag < 0.001 && kelvinTemp > 0)) {
                console.error(`Particle created with problematic speed or NaN position: x=${this.pos.x}, y=${this.pos.y}`);
            }
        }
    }

    update(baseSpeed) {
        this.pos.add(this.vel);

        // Adjust speed based on temperature, but maintain direction
        let currentSpeed = this.vel.mag();
        let actualSpeed = sqrt(baseSpeed * K_TEMP_SCALAR);
        if (actualSpeed === 0) actualSpeed = 0.01;

        if (currentSpeed === 0) { // Avoid division by zero if particle is stationary
            this.vel = p5.Vector.random2D();
            this.vel.mult(random(0.7 * actualSpeed, 1.3 * actualSpeed));
        } else {
            // Gently nudge speed towards new temperature's speed distribution
            let targetSpeedDistribution = random(0.7 * actualSpeed, 1.3 * actualSpeed);
            this.vel.setMag(currentSpeed * 0.95 + targetSpeedDistribution * 0.05);
        }
    }

    checkWalls() {
        if (this.pos.x > width - this.radius) {
            this.pos.x = width - this.radius;
            this.vel.x *= -1 * DAMPING_FACTOR;
            collisionCountSinceLastUpdate++;
        } else if (this.pos.x < this.radius) {
            this.pos.x = this.radius;
            this.vel.x *= -1 * DAMPING_FACTOR;
            collisionCountSinceLastUpdate++;
        }

        if (this.pos.y > height - this.radius) {
            this.pos.y = height - this.radius;
            this.vel.y *= -1 * DAMPING_FACTOR;
            collisionCountSinceLastUpdate++;
        } else if (this.pos.y < this.radius) {
            this.pos.y = this.radius;
            this.vel.y *= -1 * DAMPING_FACTOR;
            collisionCountSinceLastUpdate++;
        }
    }

    // Elastic collision with another particle
    checkCollision(other) {
        let distVec = p5.Vector.sub(other.pos, this.pos);
        let distMagSq = distVec.magSq();

        if (distMagSq < (this.radius + other.radius) * (this.radius + other.radius)) {
            let dist = sqrt(distMagSq);
            let overlap = 0.5 * (dist - (this.radius + other.radius));

            // Separate particles to prevent sticking
            this.pos.add(p5.Vector.mult(distVec, overlap / dist));
            other.pos.sub(p5.Vector.mult(distVec, overlap / dist));

            // Normal vector
            let normal = distVec.copy().normalize();
            // Tangential vector
            let tangent = createVector(-normal.y, normal.x);

            // Dot products of velocities with normal and tangent
            let v1n = this.vel.dot(normal);
            let v1t = this.vel.dot(tangent);
            let v2n = other.vel.dot(normal);
            let v2t = other.vel.dot(tangent);

            // Conservation of momentum in 1D (normal direction)
            let v1n_final = (v1n * (this.mass - other.mass) + 2 * other.mass * v2n) / (this.mass + other.mass);
            let v2n_final = (v2n * (other.mass - this.mass) + 2 * this.mass * v1n) / (this.mass + other.mass);
            
            v1n_final *= DAMPING_FACTOR;
            v2n_final *= DAMPING_FACTOR;

            // Convert scalar normal and tangential velocities back to vectors
            let v1nVecFinal = normal.copy().mult(v1n_final);
            let v1tVecFinal = tangent.copy().mult(v1t);
            let v2nVecFinal = normal.copy().mult(v2n_final);
            let v2tVecFinal = tangent.copy().mult(v2t);

            // Update velocities
            this.vel = p5.Vector.add(v1nVecFinal, v1tVecFinal);
            other.vel = p5.Vector.add(v2nVecFinal, v2tVecFinal);

            this.highlight = true;
            other.highlight = true;
        }
    }

    display() {
        noStroke();
        let speed = this.vel.mag();
        let maxSpeedConsidered = sqrt(500 * K_TEMP_SCALAR) * 1.5; // Approx max speed for 500K
        let speedFraction = constrain(map(speed, 0, maxSpeedConsidered, 0, 1), 0, 1);
        let particleColor = lerpColor(slowColor, fastColor, speedFraction);

        if (this.highlight) {
            fill(255, 255, 0, 255); // Brighter yellow for collision emphasis
            this.highlight = false; // Reset highlight
        } else {
            fill(particleColor);
        }
        if (DEBUG_MODE && frameCount % 60 === 0) { // Log once per second for a particle
            if (particles.indexOf(this) === 0) { // Log only for the first particle to avoid spam
                 console.log(`Particle.display: x=${this.pos.x.toFixed(2)}, y=${this.pos.y.toFixed(2)}, r=${this.radius.toFixed(2)}, color=${particleColor}`);
                 if (isNaN(this.pos.x) || isNaN(this.pos.y) || isNaN(this.radius)) {
                    console.error("Particle.display called with NaN values!");
                 }
            }
        }
        ellipse(this.pos.x, this.pos.y, this.radius * 2);
    }
}

function setup() {
    let canvasContainer = select('#canvas-container');
    // Use getBoundingClientRect for reliable initial dimensions
    baseCnvWidth = canvasContainer.elt.getBoundingClientRect().width;
    baseCnvHeight = Math.floor(baseCnvWidth * (9 / 16)); // Maintain 16:9 aspect ratio
    if (DEBUG_MODE) console.log(`Setup: baseCnvWidth=${baseCnvWidth.toFixed(2)}, baseCnvHeight=${baseCnvHeight.toFixed(2)}`);
    // Canvas itself will be created in updateVolume

    numParticlesSlider = select('#numParticles');
    temperatureSlider = select('#temperature');
    volumeSlider = select('#volume');
    numParticlesValSpan = select('#numParticlesVal');
    temperatureValSpan = select('#temperatureVal');
    volumeValSpan = select('#volumeVal');
    pressureDisplaySpan = select('#pressureVal'); // Corrected ID

    minRadiusSlider = select('#minParticleRadius');
    minRadiusValSpan = select('#minParticleRadiusVal');
    minRadiusSlider.value(PARTICLE_RADIUS_MIN);
    minRadiusValSpan.html(PARTICLE_RADIUS_MIN);

    maxRadiusSlider = select('#maxParticleRadius');
    maxRadiusValSpan = select('#maxParticleRadiusVal');
    maxRadiusSlider.value(PARTICLE_RADIUS_MAX);
    maxRadiusValSpan.html(PARTICLE_RADIUS_MAX);

    // Event Listenerssure span
    pausePlayButton = select('#pausePlayButton'); // Get pause/play button

    slowColor = color(0, 150, 255, 220); // Blueish for slow
    fastColor = color(255, 50, 50, 220);   // Reddish for fast

    numParticlesSlider.input(updateParticleCount);
    temperatureSlider.input(updateTemperatureDisplay);
    volumeSlider.input(updateVolume);
    minRadiusSlider.input(updateMinRadius);
    maxRadiusSlider.input(updateMaxRadius);

    let resetButton = select('#resetButton');
    resetButton.mousePressed(resetSimulation);

    pausePlayButton.mousePressed(togglePause);

    lastPressureUpdateTime = millis(); // Initialize pressure update timer
    pressureDisplaySpan.html(displayedPressure); // Initial pressure display

    // Initial setup for canvas size based on volume slider
    updateVolume(); 
    initializeParticles();
    if (DEBUG_MODE && particles.length > 0) {
        console.log(`Setup complete. Particle count: ${particles.length}. First particle: x=${particles[0].pos.x.toFixed(2)}, y=${particles[0].pos.y.toFixed(2)}, r=${particles[0].radius.toFixed(2)}, speed=${particles[0].vel.mag().toFixed(4)}`);
        console.log(`p5 canvas width/height after setup: ${width}, ${height}`);
    } else if (DEBUG_MODE && particles.length === 0) {
        console.warn("Setup complete, but NO particles were initialized!");
    }
}

function initializeParticles() {
    particles = [];
    let num = numParticlesSlider.value();
    let kelvinTemp = temperatureSlider.value();
    numParticlesValSpan.html(num);

    for (let i = 0; i < num; i++) {
        // Ensure particles are initialized within the current canvas dimensions
        particles.push(new Particle(random(PARTICLE_RADIUS_MAX, width - PARTICLE_RADIUS_MAX), 
                                    random(PARTICLE_RADIUS_MAX, height - PARTICLE_RADIUS_MAX),
                                    kelvinTemp)); // Pass Kelvin temp
    }
}

function updateParticleCount() {
    let num = numParticlesSlider.value();
    numParticlesValSpan.html(num);
    let kelvinTemp = temperatureSlider.value(); // Get Kelvin temp

    if (num > particles.length) {
        for (let i = particles.length; i < num; i++) {
            particles.push(new Particle(random(PARTICLE_RADIUS_MAX, width - PARTICLE_RADIUS_MAX), 
                                        random(PARTICLE_RADIUS_MAX, height - PARTICLE_RADIUS_MAX),
                                        kelvinTemp)); // Pass Kelvin temp
        }
    } else if (num < particles.length) {
        particles.splice(num); // Remove excess particles
    }
}

function updateMinRadius() {
    PARTICLE_RADIUS_MIN = minRadiusSlider.value();
    minRadiusValSpan.html(PARTICLE_RADIUS_MIN);
    if (PARTICLE_RADIUS_MIN > PARTICLE_RADIUS_MAX) {
        PARTICLE_RADIUS_MAX = PARTICLE_RADIUS_MIN;
        maxRadiusSlider.value(PARTICLE_RADIUS_MAX);
        maxRadiusValSpan.html(PARTICLE_RADIUS_MAX);
    }
    if (!isPaused) initializeParticles(); // Re-initialize if not paused
}

function updateMaxRadius() {
    PARTICLE_RADIUS_MAX = maxRadiusSlider.value();
    maxRadiusValSpan.html(PARTICLE_RADIUS_MAX);
    if (PARTICLE_RADIUS_MAX < PARTICLE_RADIUS_MIN) {
        PARTICLE_RADIUS_MIN = PARTICLE_RADIUS_MAX;
        minRadiusSlider.value(PARTICLE_RADIUS_MIN);
        minRadiusValSpan.html(PARTICLE_RADIUS_MIN);
    }
    if (!isPaused) initializeParticles(); // Re-initialize if not paused
}

function updateTemperatureDisplay() {
    temperatureValSpan.html(temperatureSlider.value());
    // No need to directly update particle speeds here, Particle.update handles it
}

function roundPressureForDisplay(value) {
    if (value < 10) {
        return Math.round(value); // Nearest whole number
    } else if (value < 100) { // 10 - 99
        return Math.round(value / 5) * 5; // Nearest 5
    } else if (value < 1000) { // 100 - 999
        return Math.round(value / 50) * 50; // Nearest 50
    } else if (value < 10000) { // 1000 - 9999
        return Math.round(value / 500) * 500; // Nearest 500
    } else if (value < 100000) { // 10000 - 99999
        return Math.round(value / 5000) * 5000; // Nearest 5000
    } else if (value < 1000000) { // 100000 - 999999
        return Math.round(value / 50000) * 50000; // Nearest 50,000
    } else { // 1000000+
        return Math.round(value / 500000) * 500000; // Nearest 500,000
    }
}

function draw() {
    if (DEBUG_MODE && frameCount % 120 === 0 && !isPaused) console.log(`Draw loop running, frame: ${frameCount}, Paused: ${isPaused}, Temp: ${temperatureSlider.value()}, Particles: ${particles.length}, p5_width: ${width}, p5_height: ${height}`);
    if (isPaused) {
        background(30, 30, 47); // Clear background even when paused for visual clarity
        displayParticles();     // Draw current particle positions
        return;                 // Skip physics updates and the rest of the draw loop
    }

    background(30, 30, 47); // Dark blue-grey background
    let kelvinTemp = temperatureSlider.value(); // Get Kelvin temp

    for (let i = 0; i < particles.length; i++) {
        particles[i].update(kelvinTemp); // Pass Kelvin temp
        particles[i].checkWalls(width, height);
        for (let j = i + 1; j < particles.length; j++) {
            particles[i].checkCollision(particles[j]);
        }
    }

    displayParticles();

    // Update pressure display periodically
    if (millis() - lastPressureUpdateTime > pressureUpdateInterval) {
        let collisionsPerSecond = collisionCountSinceLastUpdate / (pressureUpdateInterval / 1000.0);
        let collisionsPerMinute = collisionsPerSecond * 60;
        displayedPressure = roundPressureForDisplay(collisionsPerMinute);
        pressureDisplaySpan.html(displayedPressure);

        collisionCountSinceLastUpdate = 0;
        lastPressureUpdateTime = millis();
    }
}

function displayParticles() {
    for (let p of particles) {
        p.display();
    }
}

// Update volume and resize canvas
function updateVolume() {
    let volumePercent = volumeSlider.value();
    volumeValSpan.html(volumePercent);

    let scaleFactor = volumePercent / 100;
    let newCnvWidth = baseCnvWidth * scaleFactor;
    let newCnvHeight = baseCnvHeight * scaleFactor;

    let canvasContainer = select('#canvas-container');
    canvasContainer.style('width', newCnvWidth + 'px'); // Adjust container if needed or rely on CSS
    canvasContainer.style('height', newCnvHeight + 'px');
    if (DEBUG_MODE) console.log(`updateVolume: newCnvWidth=${newCnvWidth.toFixed(2)}, newCnvHeight=${newCnvHeight.toFixed(2)}. Old p5 width/height: ${width}/${height}`);

    // Scale particle positions only if canvas already exists and has dimensions
    if (canvasInitialized && width > 0 && height > 0) {
        for (let p of particles) {
            p.pos.x = p.pos.x * (newCnvWidth / width);
            p.pos.y = p.pos.y * (newCnvHeight / height);
        }
    }

    if (canvasInitialized) {
        resizeCanvas(newCnvWidth, newCnvHeight);
    } else {
        let cnv = createCanvas(newCnvWidth, newCnvHeight);
        cnv.parent('canvas-container');
        canvasInitialized = true;
    }
    // Ensure particles stay within new bounds immediately
    for (let p of particles) {
        p.pos.x = constrain(p.pos.x, p.radius, newCnvWidth - p.radius);
        p.pos.y = constrain(p.pos.y, p.radius, newCnvHeight - p.radius);
    }
}

// Resize canvas when window is resized
function windowResized() {
    let canvasContainer = select('#canvas-container');
    // Update base dimensions based on the container's current width (which might be responsive itself)
    baseCnvWidth = canvasContainer.elt.getBoundingClientRect().width;
    baseCnvHeight = Math.floor(baseCnvWidth * (9 / 16)); 
    
    // Now apply the current volume setting to these new base dimensions
    updateVolume(); 
    // No need to re-initialize particles, updateVolume handles position scaling.
}

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        pausePlayButton.html('Play');
        noLoop(); // Explicitly stop the p5.js draw loop
    } else {
        pausePlayButton.html('Pause');
        loop();   // Explicitly restart the p5.js draw loop
        redraw(); // Request a single redraw frame immediately
    }
}

function resetSimulation() {
    // Set sliders to default values
    numParticlesSlider.value(DEFAULT_NUM_PARTICLES);
    temperatureSlider.value(DEFAULT_TEMPERATURE_K);
    volumeSlider.value(DEFAULT_VOLUME_PERCENT);

    PARTICLE_RADIUS_MIN = DEFAULT_MIN_RADIUS;
    minRadiusSlider.value(DEFAULT_MIN_RADIUS);
    minRadiusValSpan.html(DEFAULT_MIN_RADIUS);

    PARTICLE_RADIUS_MAX = DEFAULT_MAX_RADIUS;
    maxRadiusSlider.value(DEFAULT_MAX_RADIUS);
    maxRadiusValSpan.html(DEFAULT_MAX_RADIUS);

    if (isPaused) { // If paused, unpause and restart loop for reset to take full effect
        togglePause();
    }
    numParticlesValSpan.html(DEFAULT_NUM_PARTICLES);
    temperatureValSpan.html(DEFAULT_TEMPERATURE_K);
    // volumeValSpan is updated by updateVolume()

    // Apply changes
    updateVolume();         // Resizes canvas to default volume and updates volume span
    initializeParticles();  // Clears old particles, creates new ones with default settings

    isPaused = false;
    pausePlayButton.html('Pause');
    collisionCountSinceLastUpdate = 0;
    lastPressureUpdateTime = millis();
    displayedPressure = 0;
    pressureDisplaySpan.html(displayedPressure);
}
