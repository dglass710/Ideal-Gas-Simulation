let particles = [];
let numParticlesSlider, temperatureSlider, volumeSlider;
let numParticlesValSpan, temperatureValSpan, volumeValSpan;

const PARTICLE_RADIUS = 5;
const DAMPING_FACTOR = 0.99; // Slight energy loss for stability, realism
const K_TEMP_SCALAR = 0.05; // Scales Kelvin to a reasonable base speed

let baseCnvWidth, baseCnvHeight; // Initial canvas dimensions for volume scaling

// Default values for reset
const DEFAULT_NUM_PARTICLES = 100;
const DEFAULT_TEMPERATURE_K = 298;
const DEFAULT_VOLUME_PERCENT = 100;

class Particle {
    constructor(x, y, baseSpeed) {
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D();
        let actualSpeed = sqrt(baseSpeed * K_TEMP_SCALAR); // Speed proportional to sqrt(T)
        if (actualSpeed === 0) actualSpeed = 0.01; // avoid zero velocity if T=0
        this.vel.mult(random(0.7 * actualSpeed, 1.3 * actualSpeed));
        this.radius = PARTICLE_RADIUS;
        this.mass = this.radius * this.radius; // Mass proportional to area
        this.color = color(random(150, 255), random(100, 200), random(50, 150), 220);
        this.highlight = false;
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

    checkWalls(cnvWidth, cnvHeight) {
        if (this.pos.x - this.radius < 0) {
            this.pos.x = this.radius;
            this.vel.x *= -1 * DAMPING_FACTOR;
        } else if (this.pos.x + this.radius > cnvWidth) {
            this.pos.x = cnvWidth - this.radius;
            this.vel.x *= -1 * DAMPING_FACTOR;
        }
        if (this.pos.y - this.radius < 0) {
            this.pos.y = this.radius;
            this.vel.y *= -1 * DAMPING_FACTOR;
        } else if (this.pos.y + this.radius > cnvHeight) {
            this.pos.y = cnvHeight - this.radius;
            this.vel.y *= -1 * DAMPING_FACTOR;
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
        if (this.highlight) {
            fill(255, 255, 0, 250); // Bright yellow for collision
            this.highlight = false; // Reset highlight
        } else {
            fill(this.color);
        }
        ellipse(this.pos.x, this.pos.y, this.radius * 2);
    }
}

function setup() {
    let canvasContainer = select('#canvas-container');
    baseCnvWidth = canvasContainer.width; // Store initial width from CSS/HTML
    baseCnvHeight = Math.floor(baseCnvWidth * (9 / 16)); // Maintain 16:9 aspect ratio
    // Canvas itself will be created in updateVolume

    numParticlesSlider = select('#numParticles');
    temperatureSlider = select('#temperature');
    volumeSlider = select('#volume');
    numParticlesValSpan = select('#numParticlesVal');
    temperatureValSpan = select('#temperatureVal');
    volumeValSpan = select('#volumeVal');

    numParticlesSlider.input(updateParticleCount);
    temperatureSlider.input(updateTemperatureDisplay);
    volumeSlider.input(updateVolume);

    let resetButton = select('#resetButton');
    resetButton.mousePressed(resetSimulation);

    // Initial setup for canvas size based on volume slider
    updateVolume(); 
    initializeParticles();
}

function initializeParticles() {
    particles = [];
    let num = numParticlesSlider.value();
    let kelvinTemp = temperatureSlider.value();
    numParticlesValSpan.html(num);

    for (let i = 0; i < num; i++) {
        // Ensure particles are initialized within the current canvas dimensions
        particles.push(new Particle(random(PARTICLE_RADIUS, width - PARTICLE_RADIUS), 
                                    random(PARTICLE_RADIUS, height - PARTICLE_RADIUS),
                                    kelvinTemp)); // Pass Kelvin temp
    }
}

function updateParticleCount() {
    let num = numParticlesSlider.value();
    numParticlesValSpan.html(num);
    let kelvinTemp = temperatureSlider.value(); // Get Kelvin temp

    if (num > particles.length) {
        for (let i = particles.length; i < num; i++) {
            particles.push(new Particle(random(PARTICLE_RADIUS, width - PARTICLE_RADIUS), 
                                        random(PARTICLE_RADIUS, height - PARTICLE_RADIUS),
                                        kelvinTemp)); // Pass Kelvin temp
        }
    } else if (num < particles.length) {
        particles.splice(num); // Remove excess particles
    }
}

function updateTemperatureDisplay() {
    temperatureValSpan.html(temperatureSlider.value());
    // No need to directly update particle speeds here, Particle.update handles it
}

function draw() {
    background(30, 30, 47); // Dark blue-grey background
    let kelvinTemp = temperatureSlider.value(); // Get Kelvin temp

    for (let i = 0; i < particles.length; i++) {
        particles[i].update(kelvinTemp); // Pass Kelvin temp
        particles[i].checkWalls(width, height);
        for (let j = i + 1; j < particles.length; j++) {
            particles[i].checkCollision(particles[j]);
        }
    }

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

    // Scale particle positions before resizing canvas
    // This prevents particles from being clumped or lost if canvas shrinks
    for (let p of particles) {
        p.pos.x = p.pos.x * (newCnvWidth / width);
        p.pos.y = p.pos.y * (newCnvHeight / height);
    }

    if (typeof p5Instance !== 'undefined' && p5Instance.canvas) { // Check if canvas exists
        resizeCanvas(newCnvWidth, newCnvHeight);
    } else {
        let cnv = createCanvas(newCnvWidth, newCnvHeight);
        cnv.parent('canvas-container');
    }
    // Ensure particles stay within new bounds immediately
    for (let p of particles) {
        p.pos.x = constrain(p.pos.x, p.radius, width - p.radius);
        p.pos.y = constrain(p.pos.y, p.radius, height - p.radius);
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

function resetSimulation() {
    // Set sliders to default values
    numParticlesSlider.value(DEFAULT_NUM_PARTICLES);
    temperatureSlider.value(DEFAULT_TEMPERATURE_K);
    volumeSlider.value(DEFAULT_VOLUME_PERCENT);

    // Update display spans
    numParticlesValSpan.html(DEFAULT_NUM_PARTICLES);
    temperatureValSpan.html(DEFAULT_TEMPERATURE_K);
    // volumeValSpan is updated by updateVolume()

    // Apply changes
    updateVolume();         // Resizes canvas to default volume and updates volume span
    initializeParticles();  // Clears old particles, creates new ones with default settings
}
