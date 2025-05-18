# Ideal Gas Simulation

An interactive web application that simulates particles in an ideal gas within a container, demonstrating gas laws and particle behavior. Users can adjust various parameters to observe changes in the gas properties in real-time.

## Features

- **Dynamic Particle System**: Visual representation of gas particles with adjustable properties
- **Temperature Control**: Adjust the temperature in Kelvin to change particle speeds
- **Volume Control**: Resize the container to observe pressure changes
- **Particle Customization**:
  - Adjust the number of particles
  - Set minimum and maximum particle sizes
- **Advanced Physics**:
  - Realistic particle-wall collisions with configurable damping
  - Elastic particle-particle collisions
  - Pressure calculation and display (collisions per minute)
- **Interactive Controls**:
  - Pause/Resume simulation
  - Reset to default values
- **Responsive Design**: Canvas adapts to container size

## Technologies Used

-   HTML5
-   CSS3
-   JavaScript (ES6+)
-   p5.js library for graphics and interaction

## How to Run

1.  Clone this repository or download the files (`index.html`, `style.css`, `sketch.js`).
2.  Open the `index.html` file in a modern web browser (e.g., Chrome, Firefox, Safari, Edge).

No special build steps are required as it's a client-side application using CDN for p5.js.

## Controls

- **Number of Particles**: Adjusts the total number of particles (0-200)
- **Temperature (K)**: Sets the temperature in Kelvin (0-600K), affecting particle speeds
- **Volume (%)**: Adjusts the container size (50-150% of original)
- **Min/Max Particle Radius**: Controls the size range of particles (1-20px)
- **Damping Factor**: Adjusts energy retention during collisions (0.00-1.00)
  - 1.00: Perfectly elastic collisions (no energy loss)
  - 0.90-0.99: Some energy loss (more realistic)
  - 0.00: Particles stop on collision
- **Pause/Resume**: Temporarily stop or continue the simulation
- **Reset**: Restore all settings to default values

## Physics Notes

- **Pressure** is calculated as the number of wall collisions per minute
- **Temperature** directly affects the average kinetic energy of particles
- **Volume** changes affect pressure according to Boyle's Law (inverse relationship)
- **Damping** simulates energy loss in real systems (friction, heat, etc.)

## Technical Implementation

- Uses p5.js for 2D rendering and animation
- Implements basic physics for elastic collisions
- Real-time parameter updates without page reload
- Efficient collision detection and handling
