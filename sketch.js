let particles = [];
let numParticlesSlider, temperatureSlider;
let numParticlesValSpan, temperatureValSpan;

const PARTICLE_RADIUS = 5;
const DAMPING_FACTOR = 0.99; // Slight energy loss for stability, realism

class Particle {
    constructor(x, y, baseSpeed) {
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D();
        this.vel.mult(random(0.5 * baseSpeed, 1.5 * baseSpeed));
        this.radius = PARTICLE_RADIUS;
        this.mass = this.radius * this.radius; // Mass proportional to area
        this.color = color(random(150, 255), random(100, 200), random(50, 150), 220);
        this.highlight = false;
    }

    update(baseSpeed) {
        this.pos.add(this.vel);

        // Adjust speed based on temperature, but maintain direction
        let currentSpeed = this.vel.mag();
        if (currentSpeed === 0) { // Avoid division by zero if particle is stationary
            this.vel = p5.Vector.random2D();
            this.vel.mult(random(0.5 * baseSpeed, 1.5 * baseSpeed));
        } else {
            // Gently nudge speed towards new baseSpeed distribution
            let targetSpeed = random(0.5 * baseSpeed, 1.5 * baseSpeed);
            this.vel.setMag(currentSpeed * 0.95 + targetSpeed * 0.05);
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
    let cnvWidth = canvasContainer.width;
    let cnvHeight = Math.floor(cnvWidth * (9 / 16)); // Maintain 16:9 aspect ratio
    canvasContainer.style('height', cnvHeight + 'px'); // Set container height for canvas

    let cnv = createCanvas(cnvWidth, cnvHeight);
    cnv.parent('canvas-container');

    numParticlesSlider = select('#numParticles');
    temperatureSlider = select('#temperature');
    numParticlesValSpan = select('#numParticlesVal');
    temperatureValSpan = select('#temperatureVal');

    numParticlesSlider.input(updateParticleCount);
    temperatureSlider.input(updateTemperatureDisplay);

    initializeParticles();
}

function initializeParticles() {
    particles = [];
    let num = numParticlesSlider.value();
    let baseSpeed = temperatureSlider.value();
    numParticlesValSpan.html(num);

    for (let i = 0; i < num; i++) {
        particles.push(new Particle(random(PARTICLE_RADIUS, width - PARTICLE_RADIUS), 
                                    random(PARTICLE_RADIUS, height - PARTICLE_RADIUS),
                                    baseSpeed));
    }
}

function updateParticleCount() {
    let num = numParticlesSlider.value();
    numParticlesValSpan.html(num);
    let baseSpeed = temperatureSlider.value();

    if (num > particles.length) {
        for (let i = particles.length; i < num; i++) {
            particles.push(new Particle(random(PARTICLE_RADIUS, width - PARTICLE_RADIUS), 
                                        random(PARTICLE_RADIUS, height - PARTICLE_RADIUS),
                                        baseSpeed));
        }
    } else if (num < particles.length) {
        particles.splice(num); // Remove excess particles
    }
}

function updateTemperatureDisplay() {
    temperatureValSpan.html(temperatureSlider.value());
}

function draw() {
    background(30, 30, 47); // Dark blue-grey background
    let baseSpeed = temperatureSlider.value();

    for (let i = 0; i < particles.length; i++) {
        particles[i].update(baseSpeed);
        particles[i].checkWalls(width, height);
        for (let j = i + 1; j < particles.length; j++) {
            particles[i].checkCollision(particles[j]);
        }
    }

    for (let p of particles) {
        p.display();
    }
}

// Resize canvas when window is resized
function windowResized() {
    let canvasContainer = select('#canvas-container');
    let cnvWidth = canvasContainer.width;
    let cnvHeight = Math.floor(cnvWidth * (9 / 16));
    canvasContainer.style('height', cnvHeight + 'px');
    resizeCanvas(cnvWidth, cnvHeight);
    // Optionally, re-distribute particles or re-initialize
    // initializeParticles(); // This would reset positions, might be jarring
}
