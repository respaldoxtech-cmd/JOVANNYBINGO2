/**
 * Liquid Mesh Gradient Animation
 * Creates a smooth, organic background animation for the login split layout.
 */

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('liquid-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let time = 0;

    // Configuration
    const colors = [
        { r: 99, g: 102, b: 241 },  // Indigo (Primary)
        { r: 236, g: 72, b: 153 },  // Pink (Secondary)
        { r: 15, g: 23, b: 42 },    // Dark Blue (Background)
        { r: 124, g: 58, b: 237 }   // Violet
    ];

    function resize() {
        width = canvas.width = canvas.parentElement.offsetWidth;
        height = canvas.height = canvas.parentElement.offsetHeight;
    }

    window.addEventListener('resize', resize);
    resize();

    // Blobs for organic movement
    const blobs = [
        { x: 0.2, y: 0.2, r: 0.4, color: 0, speed: 0.002, angle: 0 },
        { x: 0.8, y: 0.3, r: 0.35, color: 1, speed: 0.003, angle: 2 },
        { x: 0.6, y: 0.8, r: 0.45, color: 3, speed: 0.002, angle: 4 },
        { x: 0.3, y: 0.7, r: 0.3, color: 1, speed: 0.004, angle: 1 }
    ];

    function draw() {
        ctx.fillStyle = '#0f172a'; // Base background
        ctx.fillRect(0, 0, width, height);

        // Time evolution
        time += 0.005;

        // Draw soft blobs
        blobs.forEach(blob => {
            // Move blobs in circular paths
            const movementX = Math.cos(time * blob.speed + blob.angle) * 0.1;
            const movementY = Math.sin(time * blob.speed + blob.angle) * 0.1;
            
            const x = (blob.x + movementX) * width;
            const y = (blob.y + movementY) * height;
            const r = blob.r * Math.min(width, height);

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
            const c = colors[blob.color];
            
            // Fade out
            gradient.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0.6)`);
            gradient.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, 0.2)`);
            gradient.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);

            ctx.globalCompositeOperation = 'screen'; // Blend mode
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, r * 2, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalCompositeOperation = 'source-over'; // Reset blend mode

        // Minimal overlay grid or noise (optional, keeping it clean for now)
        
        requestAnimationFrame(draw);
    }

    draw();
});
