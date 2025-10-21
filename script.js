class MeshNetworkDemo {
    constructor() {
        this.myId = Math.random().toString(36).substr(2, 9);
        this.peers = {};
        this.myBall = { x: 0, y: 0 };

        this.canvas = document.getElementById('meshCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.bc = new BroadcastChannel('koneksi_mesh_demo');
        this.showDebug = false;
        
        this.animationId = null;
        this.lightningOffset = 0;

        this.stars = [];
        this.starCount = 500;

        this.init();
    }
    
    init() {
        this.updateCanvasSize();
        this.updateBallPosition();
        this.initStars();
 
        document.getElementById('tabId').textContent = this.myId;
        
        this.setupEventListeners();
        this.setupCommunication();
        this.startAnimation();
        
        console.log(`Tab initialized with ID: ${this.myId}`);
    }
    
    updateCanvasSize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    updateBallPosition() {
        this.myBall.x = window.innerWidth / 2;
        this.myBall.y = window.innerHeight / 2;
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            this.updateBallPosition();
            this.initStars();
            this.updateGhostBallPositions();
            this.broadcastPosition();
        });
        
        window.addEventListener('beforeunload', () => {
            this.bc.postMessage({
                type: 'disconnect',
                id: this.myId
            });
        });

        document.addEventListener('visibilitychange', () => { 
            if (document.visibilityState === 'visible') {
                console.log('Tab is visible again, broadcasting position!');
                this.broadcastPosition();
            }
        });
    }
    
    updateGhostBallPositions() {
        const myCurrentScreenX = window.screenX;
        const myCurrentScreenY = window.screenY;
    
        for (const peerId in this.peers) {
            const peer = this.peers[peerId];
            
            if (peer.originalScreenX !== undefined && peer.originalScreenY !== undefined) {

                const offsetX = peer.originalScreenX - myCurrentScreenX;
                const offsetY = peer.originalScreenY - myCurrentScreenY;

                peer.x = this.myBall.x + offsetX;
                peer.y = this.myBall.y + offsetY;
            }
        }
    }
    
    setupCommunication() {
        this.bc.onmessage = (event) => {
            const data = event.data;
            
            if (data.id === this.myId) return;
            
            switch (data.type) {
                case 'position_update':
                    const offsetX = data.screenX - window.screenX;
                    const offsetY = data.screenY - window.screenY;
                    const peerCanvasX = this.myBall.x + offsetX;
                    const peerCanvasY = this.myBall.y + offsetY;
                    
                    this.peers[data.id] = {
                        x: peerCanvasX,
                        y: peerCanvasY,
                        originalScreenX: data.screenX,
                        originalScreenY: data.screenY,
                        lastSeen: Date.now()
                    };
                    
                    break;
                
                case 'disconnect':
                    break;
            }
        };
        
        setInterval(() => {
            this.broadcastPosition();
        }, 100);

        setInterval(() => {
            this.cleanupInactivePeers();
        }, 3000);
        
        this.broadcastPosition();
    }
    
    broadcastPosition() {
        this.bc.postMessage({
            type: 'position_update',
            id: this.myId,
            screenX: window.screenX,
            screenY: window.screenY
        });
    }
    
    cleanupInactivePeers() {
        const now = Date.now();
        const timeout = 10000;
        
        for (const peerId in this.peers) {
            if (now - this.peers[peerId].lastSeen > timeout) {
                delete this.peers[peerId];
                console.log(`Peer ${peerId} removed due to inactivity`);
            }
        }
    }
    
    startAnimation() {
        const animate = () => {
            this.draw();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.lightningOffset += 0.15;
        this.drawStars();
        this.drawConnections();
        this.drawMainBall();
        this.drawInfo();
    }

    drawStars() {
        const ctx = this.ctx;
        ctx.save();
        
        this.stars.forEach(star => {
            star.alpha = star.baseAlpha * (Math.sin(this.lightningOffset * star.twinkleSpeed) * 0.5 + 0.5);

            ctx.fillStyle = `hsla(200, 100%, 90%, ${star.alpha})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
    }

    initStars() {
        this.stars = [];
        for (let i = 0; i < this.starCount; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: Math.random() * 1.2,
                baseAlpha: 0.3 + Math.random() * 0.5,
                alpha: 0,
                twinkleSpeed: 0.01 + Math.random() * 0.02
            });
        }
    }
    
    drawConnections() {
        const peerList = Object.values(this.peers);
        peerList.forEach((peer, index) => {
            this.drawLightning(this.myBall.x, this.myBall.y, peer.x, peer.y, index);
            this.drawGhostBall(peer.x, peer.y, index);
        });
    }

    drawJaggedLine(ctx, x1, y1, x2, y2, segments, maxDeviation, anim) {
        ctx.moveTo(x1, y1);
        
        for (let i = 1; i <= segments; i++) {
            const progress = i / segments;
            const baseX = x1 + (x2 - x1) * progress;
            const baseY = y1 + (y2 - y1) * progress;
            
            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length > 0) {
                const perpX = -dy / length;
                const perpY = dx / length;
                
                const zigzag1 = Math.sin(anim * 3 + progress * Math.PI * 8) * maxDeviation;
                const zigzag2 = Math.sin(anim * 5 + progress * Math.PI * 12) * maxDeviation * 0.5;
                const envelope = Math.sin(progress * Math.PI);
                
                const totalZigzag = (zigzag1 + zigzag2) * envelope;
                
                const finalX = baseX + perpX * totalZigzag;
                const finalY = baseY + perpY * totalZigzag;
                
                ctx.lineTo(finalX, finalY);
            } else {
                ctx.lineTo(baseX, baseY);
            }
        }
    }
    
    drawLightning(x1, y1, x2, y2, index) {
        const ctx = this.ctx;

        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
            console.error('Invalid lightning coordinates:', { x1, y1, x2, y2 });
            return;
        }
        
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        if (distance < 10) {
            return; 
        }
        
        const segments = 25;
        const maxDeviation = 20;
        const anim = this.lightningOffset + index * 1.2;
        const mainBallHue = 200;
        const ghostHue = 300 + index * 60;
        
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, `hsl(${mainBallHue}, 100%, 70%)`);
        gradient.addColorStop(1, `hsl(${ghostHue}, 80%, 70%)`);

        const glowGradient = ctx.createLinearGradient(x1, y1, x2, y2);
        glowGradient.addColorStop(0, `hsla(${mainBallHue}, 100%, 50%, 0.3)`);
        glowGradient.addColorStop(1, `hsla(${ghostHue}, 80%, 50%, 0.3)`);
    
        const coreGradient = ctx.createLinearGradient(x1, y1, x2, y2);
        coreGradient.addColorStop(0, `hsl(${mainBallHue}, 100%, 90%)`);
        coreGradient.addColorStop(0.5, '#ffffff');
        coreGradient.addColorStop(1, `hsl(${ghostHue}, 80%, 90%)`);

        ctx.save();
        
        ctx.strokeStyle = glowGradient;
        ctx.lineWidth = 10;
        ctx.shadowColor = `hsl(${mainBallHue}, 100%, 50%)`; 
        ctx.shadowBlur = 30;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        this.drawJaggedLine(ctx, x1, y1, x2, y2, segments, maxDeviation, anim);
        ctx.stroke();
        
        ctx.shadowBlur = 15;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.beginPath();

        this.drawJaggedLine(ctx, x1, y1, x2, y2, segments, maxDeviation, anim);
        ctx.stroke();

        ctx.strokeStyle = coreGradient; 
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.beginPath();

        this.drawJaggedLine(ctx, x1, y1, x2, y2, segments, maxDeviation, anim);
        ctx.stroke();

        const sparkCount = 3;
        for (let i = 0; i < sparkCount; i++) {
            const sparkProgress = (anim * 0.1 + i * 0.3) % 1;
            const sparkX = x1 + (x2 - x1) * sparkProgress;
            const sparkY = y1 + (y2 - y1) * sparkProgress;

            ctx.fillStyle = `hsla(60, 100%, 90%, ${Math.sin(sparkProgress * Math.PI)})`; 
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 8;
            
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    drawGhostBall(x, y, index) {
        const ctx = this.ctx;
        const radius = 22;
        const pulse = Math.sin(this.lightningOffset * 0.8 + index * 1.2) * 0.3 + 0.7;
        const anim = this.lightningOffset;
        const ghostHue = 300 + index * 60;

        if (isNaN(x) || isNaN(y)) {
            console.error('Invalid ghost ball coordinates:', { x, y });
            return;
        }

        ctx.save();
        ctx.shadowColor = `hsl(${ghostHue}, 80%, 70%)`;
        ctx.shadowBlur = 30 * pulse;

        ctx.globalAlpha = 0.7 + Math.sin(anim + index) * 0.2; 

        const outerGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
        outerGradient.addColorStop(0, `hsla(${ghostHue}, 80%, 60%, ${0.3 * pulse})`);
        outerGradient.addColorStop(0.7, `hsla(${ghostHue}, 80%, 60%, ${0.1 * pulse})`);
        outerGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
        ctx.fill();

        const ballGradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
        ballGradient.addColorStop(0, `hsla(${ghostHue}, 80%, 85%, ${0.8 * pulse})`);
        ballGradient.addColorStop(0.5, `hsla(${ghostHue}, 80%, 65%, ${0.6 * pulse})`);
        ballGradient.addColorStop(1, `hsla(${ghostHue}, 80%, 45%, ${0.4 * pulse})`);
        
        ctx.fillStyle = ballGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;

        for (let i = 1; i <= 2; i++) {
            const ringRadius = radius + (anim * 15 + i * 20) % 40;
            const opacity = 1.0 - (ringRadius - radius) / 40; 
            ctx.strokeStyle = `hsla(${ghostHue}, 80%, 70%, ${opacity * 0.8 * pulse})`;
            ctx.beginPath();
            ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    drawMainBall() {
        const ctx = this.ctx;
        const x = this.myBall.x;
        const y = this.myBall.y;
        const radius = 28;
        const pulse = Math.sin(this.lightningOffset * 1.2) * 0.1 + 0.9; 
        const anim = this.lightningOffset; 

        ctx.save();
        ctx.shadowColor = '#00BFFF';
        ctx.shadowBlur = 40;

        const outerRadius = radius * (2.5 + Math.sin(anim * 0.7) * 0.5);
        const outerGradient = ctx.createRadialGradient(x, y, radius, x, y, outerRadius);
        outerGradient.addColorStop(0, 'hsla(195, 100%, 70%, 0.3)');
        outerGradient.addColorStop(0.5, 'hsla(200, 100%, 50%, 0.1)');
        outerGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
        ctx.fill();

        const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
        gradient.addColorStop(0, '#FFFFFF'); // Highlight putih
        gradient.addColorStop(0.1, '#87CEEB'); // Biru muda
        gradient.addColorStop(0.7, '#0000FF'); // Biru pekat
        gradient.addColorStop(1, '#000080'); // Tepi gelap
        
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 15;
        const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.5);
        coreGradient.addColorStop(0, 'hsla(255, 100%, 95%, 1)');
        coreGradient.addColorStop(1, 'hsla(200, 100%, 70%, 0.3)');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.5 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#87CEEB';

        const r1 = radius + (anim * 20) % 20;
        ctx.strokeStyle = `rgba(135, 206, 235, ${1.0 - (r1 - radius) / 20})`; 
        ctx.beginPath();
        ctx.arc(x, y, r1, 0, Math.PI * 2);
        ctx.stroke();

        const r2 = radius + (anim * 10) % 40;
        ctx.strokeStyle = `rgba(135, 206, 235, ${0.7 - (r2 - radius) / 40})`;
        ctx.beginPath();
        ctx.arc(x, y, r2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
    
    drawInfo() {
        const ctx = this.ctx;
        const peerCount = Object.keys(this.peers).length;
        
        ctx.save();
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 16px Arial';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        
        ctx.fillText(`Koneksi Aktif: ${peerCount}`, this.canvas.width - 200, 30);

        if (this.showDebug) { 
            ctx.fillStyle = '#888888';
            ctx.font = '12px Arial';
            ctx.shadowBlur = 5;
            
            let debugY = 80;
            ctx.fillText(`Layar: ${window.innerWidth}x${window.innerHeight}`, this.canvas.width - 250, debugY);
            debugY += 20;
            ctx.fillText(`Bola Utama: (${Math.round(this.myBall.x)}, ${Math.round(this.myBall.y)})`, this.canvas.width - 250, debugY);

            Object.entries(this.peers).forEach(([peerId, peer], index) => {
                debugY += 20;
                ctx.fillStyle = `hsl(${300 + index * 60}, 80%, 70%)`;
                ctx.fillText(`Peer ${peerId.substr(0, 4)}: (${Math.round(peer.x)}, ${Math.round(peer.y)})`, this.canvas.width - 250, debugY);
            });
        }
        ctx.restore();
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.bc.close();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Mesh Network Demo...');
    
    if (!window.BroadcastChannel) {
        alert('Browser Anda tidak mendukung BroadcastChannel API. Silakan gunakan browser modern.');
        return;
    }
    
    window.meshDemo = new MeshNetworkDemo();
    
    console.log('Mesh Network Demo initialized successfully!');
});

window.addEventListener('beforeunload', () => {
    if (window.meshDemo) {
        window.meshDemo.destroy();
    }
});