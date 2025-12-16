class CurveeReactor {
    constructor() {
        this.canvas = document.getElementById('curveCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Initialize
        this.initCanvas();
        this.initControlPoints();
        this.initPhysics();
        this.initParticles();
        this.initEventListeners();
        this.initUI();
        
        // Start animation
        this.animate();
    }

    initCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Set up high-quality rendering
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = 600;
        
        // Update DPI for retina displays
        const dpi = window.devicePixelRatio || 1;
        this.canvas.style.width = this.canvas.width + 'px';
        this.canvas.style.height = this.canvas.height + 'px';
        this.canvas.width *= dpi;
        this.canvas.height *= dpi;
        this.ctx.scale(dpi, dpi);
        
        // Recalculate control points for new size
        if (!this.mouse?.isDown) {
            this.calculateInitialPoints();
        }
    }

    calculateInitialPoints() {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        this.initialPoints = [
            { x: width * 0.15, y: height * 0.6 },  // P0
            { x: width * 0.35, y: height * 0.2 },  // P1
            { x: width * 0.65, y: height * 0.2 },  // P2
            { x: width * 0.85, y: height * 0.6 }   // P3
        ];
        
        if (!this.controlPoints) {
            this.controlPoints = JSON.parse(JSON.stringify(this.initialPoints));
        }
    }

    initControlPoints() {
        this.calculateInitialPoints();
        this.controlPoints = JSON.parse(JSON.stringify(this.initialPoints));
        
        // Color scheme for points
        this.pointColors = ['#ef4444', '#3b82f6', '#3b82f6', '#ef4444'];
        this.pointRadii = [10, 12, 12, 10];
    }

    initPhysics() {
        // Physics state
        this.physics = {
            enabled: true,
            stiffness: 0.05,
            damping: 0.90,
            mouseInfluence: 0.5,
            velocities: [{ x: 0, y: 0 }, { x: 0, y: 0 }]
        };
        
        // Mouse state
        this.mouse = {
            x: this.canvas.width / (2 * (window.devicePixelRatio || 1)),
            y: this.canvas.height / (2 * (window.devicePixelRatio || 1)),
            px: 0, py: 0,
            vx: 0, vy: 0,
            isDown: false,
            targetPoint: null
        };
        
        // Performance tracking
        this.performance = {
            fps: 60,
            frameCount: 0,
            lastTime: 0,
            lastFpsUpdate: 0
        };
    }

    initParticles() {
        this.particles = {
            enabled: true,
            list: [],
            colors: ['#06b6d4', '#8b5cf6', '#3b82f6', '#10b981']
        };
        
        this.effects = {
            glow: true,
            trails: true
        };
    }

    initEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        
        // Touch events for mobile
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.handleTouchEnd());
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    initUI() {
        // Sliders
        document.getElementById('stiffnessSlider').addEventListener('input', (e) => {
            this.physics.stiffness = parseFloat(e.target.value);
            document.getElementById('stiffnessValue').textContent = this.physics.stiffness.toFixed(2);
        });
        
        document.getElementById('dampingSlider').addEventListener('input', (e) => {
            this.physics.damping = parseFloat(e.target.value);
            document.getElementById('dampingValue').textContent = this.physics.damping.toFixed(2);
        });
        
        document.getElementById('influenceSlider').addEventListener('input', (e) => {
            this.physics.mouseInfluence = parseFloat(e.target.value);
            document.getElementById('influenceValue').textContent = this.physics.mouseInfluence.toFixed(1);
        });
        
        // Toggles
        document.getElementById('particlesToggle').addEventListener('change', (e) => {
            this.particles.enabled = e.target.checked;
        });
        
        document.getElementById('glowToggle').addEventListener('change', (e) => {
            this.effects.glow = e.target.checked;
        });
        
        // Buttons
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('togglePhysicsBtn').addEventListener('click', () => this.togglePhysics());
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
        
        // Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.applyPreset(e.target.dataset.preset));
        });
    }

    // Input Handlers
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const dpi = window.devicePixelRatio || 1;
        
        this.mouse.px = this.mouse.x;
        this.mouse.py = this.mouse.y;
        this.mouse.x = (e.clientX - rect.left) * dpi;
        this.mouse.y = (e.clientY - rect.top) * dpi;
        
        // Calculate velocity
        this.mouse.vx = (this.mouse.x - this.mouse.px) * 0.5;
        this.mouse.vy = (this.mouse.y - this.mouse.py) * 0.5;
        
        if (this.mouse.isDown && this.mouse.targetPoint) {
            this.mouse.targetPoint.x = this.mouse.x / dpi;
            this.mouse.targetPoint.y = this.mouse.y / dpi;
        }
        
        // Create particles on fast movement
        if (Math.abs(this.mouse.vx) > 2 || Math.abs(this.mouse.vy) > 2) {
            this.createParticles(this.mouse.x / dpi, this.mouse.y / dpi, 2);
        }
    }

    handleMouseDown(e) {
        this.mouse.isDown = true;
        const rect = this.canvas.getBoundingClientRect();
        const dpi = window.devicePixelRatio || 1;
        const x = (e.clientX - rect.left) * dpi;
        const y = (e.clientY - rect.top) * dpi;
        
        // Check for point selection
        this.mouse.targetPoint = this.getNearestControlPoint(x / dpi, y / dpi);
        
        // Visual feedback
        if (this.particles.enabled) {
            this.createParticles(x / dpi, y / dpi, 15);
        }
    }

    handleMouseUp() {
        this.mouse.isDown = false;
        this.mouse.targetPoint = null;
    }

    handleMouseLeave() {
        this.mouse.isDown = false;
        this.mouse.targetPoint = null;
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const dpi = window.devicePixelRatio || 1;
        
        this.mouse.x = (touch.clientX - rect.left) * dpi;
        this.mouse.y = (touch.clientY - rect.top) * dpi;
        
        if (this.mouse.isDown && this.mouse.targetPoint) {
            this.mouse.targetPoint.x = this.mouse.x / dpi;
            this.mouse.targetPoint.y = this.mouse.y / dpi;
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const dpi = window.devicePixelRatio || 1;
        
        this.mouse.x = (touch.clientX - rect.left) * dpi;
        this.mouse.y = (touch.clientY - rect.top) * dpi;
        this.mouse.isDown = true;
        
        this.mouse.targetPoint = this.getNearestControlPoint(this.mouse.x / dpi, this.mouse.y / dpi);
    }

    handleTouchEnd() {
        this.mouse.isDown = false;
        this.mouse.targetPoint = null;
    }

    // Core Math Functions
    calculateBezierPoint(t) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;
        
        const p0 = this.controlPoints[0];
        const p1 = this.controlPoints[1];
        const p2 = this.controlPoints[2];
        const p3 = this.controlPoints[3];
        
        return {
            x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
            y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
        };
    }

    calculateBezierTangent(t) {
        const u = 1 - t;
        
        const p0 = this.controlPoints[0];
        const p1 = this.controlPoints[1];
        const p2 = this.controlPoints[2];
        const p3 = this.controlPoints[3];
        
        return {
            x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
            y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
        };
    }

    // Physics Simulation
    updatePhysics() {
        if (!this.physics.enabled) return;
        
        for (let i = 1; i <= 2; i++) {
            const pointIndex = i - 1;
            const point = this.controlPoints[i];
            const velocity = this.physics.velocities[pointIndex];
            
            // Skip if being dragged
            if (this.mouse.targetPoint === point) {
                velocity.x = velocity.y = 0;
                continue;
            }
            
            // Calculate target position with mouse influence
            const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
            const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
            
            const mouseX = this.mouse.x / (window.devicePixelRatio || 1);
            const mouseY = this.mouse.y / (window.devicePixelRatio || 1);
            
            let targetX = this.initialPoints[i].x;
            let targetY = this.initialPoints[i].y;
            
            // Add mouse influence
            const influence = this.physics.mouseInfluence * 0.01;
            if (i === 1) {
                targetX += (mouseX - canvasWidth / 2) * influence;
                targetY += (mouseY - canvasHeight / 2) * influence;
            } else {
                targetX -= (mouseX - canvasWidth / 2) * influence;
                targetY += (mouseY - canvasHeight / 2) * influence;
            }
            
            // Add mouse velocity for dynamic response
            targetX += this.mouse.vx * 0.5;
            targetY += this.mouse.vy * 0.5;
            
            // Spring physics
            const springForceX = -this.physics.stiffness * (point.x - targetX);
            const springForceY = -this.physics.stiffness * (point.y - targetY);
            
            // Update velocity with damping
            velocity.x = velocity.x * this.physics.damping + springForceX;
            velocity.y = velocity.y * this.physics.damping + springForceY;
            
            // Update position
            point.x += velocity.x;
            point.y += velocity.y;
            
            // Boundary constraints
            this.applyBoundaries(point, velocity);
            
            // Create particles based on velocity
            if (this.particles.enabled && Math.abs(velocity.x) + Math.abs(velocity.y) > 0.5) {
                this.createParticles(point.x, point.y, 1);
            }
        }
        
        // Update existing particles
        this.updateParticles();
    }

    applyBoundaries(point, velocity) {
        const margin = 30;
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        if (point.x < margin) {
            point.x = margin;
            velocity.x *= -0.3;
        }
        if (point.x > width - margin) {
            point.x = width - margin;
            velocity.x *= -0.3;
        }
        if (point.y < margin) {
            point.y = margin;
            velocity.y *= -0.3;
        }
        if (point.y > height - margin) {
            point.y = height - margin;
            velocity.y *= -0.3;
        }
    }

    // Particle System
    createParticles(x, y, count) {
        if (!this.particles.enabled) return;
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            const life = 0.5 + Math.random() * 0.5;
            
            this.particles.list.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life,
                decay: 0.01 + Math.random() * 0.02,
                size: 2 + Math.random() * 4,
                color: this.particles.colors[Math.floor(Math.random() * this.particles.colors.length)],
                rotation: Math.random() * Math.PI * 2
            });
        }
    }

    updateParticles() {
        for (let i = this.particles.list.length - 1; i >= 0; i--) {
            const p = this.particles.list[i];
            
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // Gravity
            p.vx *= 0.98; // Air resistance
            p.vy *= 0.98;
            p.life -= p.decay;
            p.rotation += 0.05;
            
            if (p.life <= 0) {
                this.particles.list.splice(i, 1);
            }
        }
    }

    // Rendering
    render() {
        const ctx = this.ctx;
        const dpi = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpi;
        const height = this.canvas.height / dpi;
        
        // Clear with fade effect
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        
        // Draw control lines
        this.drawControlLines();
        
        // Draw Bézier curve
        this.drawBezierCurve();
        
        // Draw tangents
        this.drawTangents();
        
        // Draw particles
        if (this.particles.enabled) {
            this.drawParticles();
        }
        
        // Draw control points
        this.drawControlPoints();
        
        // Draw glow effects
        if (this.effects.glow) {
            this.drawGlowEffects();
        }
        
        // Update performance metrics
        this.updatePerformance();
    }

    drawControlLines() {
        const ctx = this.ctx;
        const points = this.controlPoints;
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    drawBezierCurve() {
        const ctx = this.ctx;
        
        ctx.beginPath();
        const firstPoint = this.calculateBezierPoint(0);
        ctx.moveTo(firstPoint.x, firstPoint.y);
        
        // Draw curve with gradient
        const gradient = ctx.createLinearGradient(
            this.controlPoints[0].x, this.controlPoints[0].y,
            this.controlPoints[3].x, this.controlPoints[3].y
        );
        gradient.addColorStop(0, '#06b6d4');
        gradient.addColorStop(0.5, '#8b5cf6');
        gradient.addColorStop(1, '#3b82f6');
        
        // Sample curve points
        for (let t = 0.01; t <= 1; t += 0.01) {
            const point = this.calculateBezierPoint(t);
            ctx.lineTo(point.x, point.y);
        }
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Add inner glow
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawTangents() {
        const ctx = this.ctx;
        const tangentPoints = [0.1, 0.3, 0.5, 0.7, 0.9];
        
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        for (const t of tangentPoints) {
            const point = this.calculateBezierPoint(t);
            const tangent = this.calculateBezierTangent(t);
            
            // Normalize tangent
            const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
            if (length === 0) continue;
            
            const nx = tangent.x / length;
            const ny = tangent.y / length;
            
            // Draw tangent line
            ctx.beginPath();
            ctx.moveTo(point.x - nx * 25, point.y - ny * 25);
            ctx.lineTo(point.x + nx * 25, point.y + ny * 25);
            ctx.stroke();
            
            // Draw tangent point
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
        }
    }

    drawControlPoints() {
        const ctx = this.ctx;
        
        for (let i = 0; i < this.controlPoints.length; i++) {
            const point = this.controlPoints[i];
            const color = this.pointColors[i];
            const radius = this.pointRadii[i];
            
            // Draw glow
            if (this.effects.glow) {
                const gradient = ctx.createRadialGradient(
                    point.x, point.y, 0,
                    point.x, point.y, radius * 3
                );
                gradient.addColorStop(0, color + '80');
                gradient.addColorStop(1, 'transparent');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(point.x, point.y, radius * 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw point
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            
            // Draw outline
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw label
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`P${i}`, point.x, point.y - radius - 20);
        }
    }

    drawParticles() {
        const ctx = this.ctx;
        
        for (const p of this.particles.list) {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            
            // Draw particle as a small rectangle
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            
            ctx.restore();
        }
    }

    drawGlowEffects() {
        const ctx = this.ctx;
        
        // Add glow to control points
        for (let i = 1; i <= 2; i++) {
            const point = this.controlPoints[i];
            const gradient = ctx.createRadialGradient(
                point.x, point.y, 0,
                point.x, point.y, 50
            );
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
            gradient.addColorStop(1, 'transparent');
            
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 50, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // UI Methods
    getNearestControlPoint(x, y, threshold = 30) {
        for (let i = 1; i <= 2; i++) { // Only check P1 and P2
            const point = this.controlPoints[i];
            const distance = Math.sqrt(
                Math.pow(point.x - x, 2) + 
                Math.pow(point.y - y, 2)
            );
            if (distance < threshold) {
                return point;
            }
        }
        return null;
    }

    reset() {
        this.controlPoints = JSON.parse(JSON.stringify(this.initialPoints));
        this.physics.velocities = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
        this.particles.list = [];
        
        // Visual feedback
        if (this.particles.enabled) {
            const width = this.canvas.width / (window.devicePixelRatio || 1);
            const height = this.canvas.height / (window.devicePixelRatio || 1);
            this.createParticles(width / 2, height / 2, 30);
        }
    }

    togglePhysics() {
        this.physics.enabled = !this.physics.enabled;
        const statusEl = document.getElementById('physicsStatus');
        const buttonEl = document.getElementById('togglePhysicsBtn');
        
        statusEl.textContent = this.physics.enabled ? 'ON' : 'OFF';
        buttonEl.innerHTML = this.physics.enabled ? 
            '<i class="fas fa-pause"></i> Pause Physics' : 
            '<i class="fas fa-play"></i> Resume Physics';
    }

    applyPreset(preset) {
        const presets = {
            bouncy: { stiffness: 0.02, damping: 0.85, influence: 0.8 },
            stiff: { stiffness: 0.1, damping: 0.95, influence: 0.3 },
            fluid: { stiffness: 0.03, damping: 0.9, influence: 1.2 },
            magnetic: { stiffness: 0.05, damping: 0.92, influence: 1.5 },
            heavy: { stiffness: 0.08, damping: 0.98, influence: 0.4 },
            light: { stiffness: 0.01, damping: 0.8, influence: 2.0 }
        };
        
        if (presets[preset]) {
            const { stiffness, damping, influence } = presets[preset];
            
            this.physics.stiffness = stiffness;
            this.physics.damping = damping;
            this.physics.mouseInfluence = influence;
            
            // Update UI
            document.getElementById('stiffnessSlider').value = stiffness;
            document.getElementById('dampingSlider').value = damping;
            document.getElementById('influenceSlider').value = influence;
            
            document.getElementById('stiffnessValue').textContent = stiffness.toFixed(2);
            document.getElementById('dampingValue').textContent = damping.toFixed(2);
            document.getElementById('influenceValue').textContent = influence.toFixed(1);
            
            // Visual feedback
            if (this.particles.enabled) {
                this.createParticles(
                    this.canvas.width / (2 * (window.devicePixelRatio || 1)),
                    this.canvas.height / (2 * (window.devicePixelRatio || 1)),
                    20
                );
            }
        }
    }

    showHelp() {
        alert(`Curvee Reactor - Controls:
        
• Move mouse: Influence curve physics
• Click & drag: Direct control of P₁ & P₂
• Adjust sliders: Fine-tune physics behavior
• Presets: Quick physics configurations
• Toggles: Enable/disable visual effects

The orange lines show tangent vectors - these indicate the direction of the curve at each point.
`);
    }

    updatePerformance() {
        const now = performance.now();
        this.performance.frameCount++;
        
        if (now - this.performance.lastFpsUpdate >= 1000) {
            this.performance.fps = Math.round(
                (this.performance.frameCount * 1000) / (now - this.performance.lastFpsUpdate)
            );
            this.performance.frameCount = 0;
            this.performance.lastFpsUpdate = now;
            
            document.getElementById('fpsCounter').textContent = this.performance.fps;
        }
        
        this.performance.lastTime = now;
    }

    // Main Animation Loop
    animate() {
        this.updatePhysics();
        this.render();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize application when page loads
window.addEventListener('load', () => {
    const app = new CurveeReactor();
    window.curveeReactor = app; // Make available globally for debugging
});