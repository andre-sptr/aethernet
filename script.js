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
        this.earthTexture = new Image();
        this.earthTexture.src = '/2k_earth_daymap.jpg';
        this.earthTexture.onload = () => {
            console.log('Earth texture loaded.');
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }
            this.startAnimation(); 
        };
        this.earthTexture.onerror = () => {
            console.error('Failed to load earth texture.');
            this.startAnimation(); 
        };
        this.rotationAngle = 0;
        this.init();
    }
    
    init() {
        this.updateCanvasSize();
        this.updateBallPosition();
        this.initStars();
        const tabIdElement = document.getElementById('tabId');
        if (tabIdElement) {
             tabIdElement.textContent = this.myId;
        }
        this.setupEventListeners();
        this.setupCommunication();
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
        window.addEventListener('keydown', (e) => {
            if (e.key === 'd') {
                this.showDebug = !this.showDebug;
                const infoBox = document.querySelector('.info');
                if (infoBox) {
                    infoBox.style.display = this.showDebug ? 'block' : 'none';
                }
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
                        ...this.peers[data.id],
                        x: peerCanvasX,
                        y: peerCanvasY,
                        originalScreenX: data.screenX,
                        originalScreenY: data.screenY,
                        lastSeen: Date.now()
                    };
                    break;   
                case 'disconnect':
                    if (this.peers[data.id]) {
                        delete this.peers[data.id];
                        console.log(`Peer ${data.id} disconnected`);
                    }
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
        if (document.visibilityState === 'visible') {
            this.bc.postMessage({
                type: 'position_update',
                id: this.myId,
                screenX: window.screenX,
                screenY: window.screenY
            });
        }
    }
    
    cleanupInactivePeers() {
        const now = Date.now();
        const timeout = 5000; 
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
        this.lightningOffset += 0.05;
        this.drawStars();
        this.drawConnections();
        this.drawMainBall();
        this.drawInfo();
    }

    drawStars() {
        const ctx = this.ctx;
        ctx.save();   
        this.stars.forEach(star => {
            star.alpha = star.baseAlpha * (Math.sin(this.lightningOffset * 5 * star.twinkleSpeed) * 0.5 + 0.5);
            ctx.fillStyle = `hsla(${star.hue}, 100%, 90%, ${star.alpha})`;
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
                twinkleSpeed: 0.01 + Math.random() * 0.02,
                hue: 190 + Math.random() * 30
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
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);     
        if (length === 0) {
             ctx.lineTo(x2, y2);
             return;
        }
        const perpX = -dy / length;
        const perpY = dx / length;
        for (let i = 1; i <= segments; i++) {
            const progress = i / segments;
            const baseX = x1 + dx * progress;
            const baseY = y1 + dy * progress;
            const sinProgress = Math.sin(progress * Math.PI);
            const wiggle = Math.sin(progress * 20 + anim * 5);
            const totalZigzag = wiggle * maxDeviation * sinProgress;
            const finalX = baseX + perpX * totalZigzag;
            const finalY = baseY + perpY * totalZigzag;
            ctx.lineTo(finalX, finalY);
        }
    }
    
    drawLightning(x1, y1, x2, y2, index) {
        const ctx = this.ctx;
        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
            console.error('Invalid lightning coordinates:', { x1, y1, x2, y2 });
            return;
        }
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        if (distance < 10) return;   
        const segments = 25;
        const anim = this.lightningOffset + index * 1.2;
        const maxDeviation = 15 + Math.sin(anim * 1.5) * 5; 
        const mainBallHue = 200;
        const ghostHue = 120 + index * 20;
        const glowGradient = ctx.createLinearGradient(x1, y1, x2, y2);
        glowGradient.addColorStop(0, `hsla(${mainBallHue}, 100%, 70%, 0.4)`);
        glowGradient.addColorStop(1, `hsla(${ghostHue}, 80%, 70%, 0.4)`);
        const coreGradient = ctx.createLinearGradient(x1, y1, x2, y2);
        coreGradient.addColorStop(0, 'white');
        coreGradient.addColorStop(1, `hsl(${ghostHue}, 80%, 90%)`);
        ctx.save();
        ctx.strokeStyle = glowGradient;
        ctx.lineWidth = 12;
        ctx.shadowColor = `hsl(${mainBallHue}, 100%, 50%)`; 
        ctx.shadowBlur = 25;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        this.drawJaggedLine(ctx, x1, y1, x2, y2, segments, maxDeviation, anim);
        ctx.stroke();
        ctx.strokeStyle = coreGradient; 
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'white'; 
        ctx.beginPath();
        this.drawJaggedLine(ctx, x1, y1, x2, y2, segments, maxDeviation, anim);
        ctx.stroke();
        ctx.restore();
    }

    drawMainBall() {
        const ctx = this.ctx;
        const x = this.myBall.x;
        const y = this.myBall.y;
        const radius = 40;
        const pulse = Math.sin(this.lightningOffset * 1.2) * 0.05 + 0.95;
        const currentRadius = radius * pulse;
        this.rotationAngle += 0.002; 
        if (this.rotationAngle > Math.PI * 2) this.rotationAngle -= Math.PI * 2;
        
        ctx.save();
        ctx.translate(x, y); 
        
        if (this.earthTexture.complete && this.earthTexture.naturalWidth > 0) {
            
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.clip(); 

            const texWidth = this.earthTexture.naturalWidth; 
            const texHeight = this.earthTexture.naturalHeight; 
            
            let sWidth = texHeight; 

            let sx = (this.rotationAngle / (Math.PI * 2)) * texWidth;

            ctx.drawImage(
                this.earthTexture,
                sx,                 
                0,                  
                sWidth,             
                texHeight,          
                -currentRadius,     
                -currentRadius,     
                currentRadius * 2,  
                currentRadius * 2   
            );

            if (sx + sWidth > texWidth) {
                let sx2 = sx - texWidth;
                ctx.drawImage(
                    this.earthTexture,
                    sx2, 0,
                    sWidth, texHeight,
                    -currentRadius, -currentRadius,
                    currentRadius * 2, currentRadius * 2
                );
            }

            const gradient = ctx.createRadialGradient(0, 0, currentRadius * 0.5, 0, 0, currentRadius);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(0.7, 'rgba(0,0,0,0.2)');
            gradient.addColorStop(1, 'rgba(0,0,0,0.5)'); 
            ctx.fillStyle = gradient;
            ctx.fill();
        } else {
            ctx.fillStyle = 'navy';
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
            const glowRadius = currentRadius * (1.1 + i * 0.1);
            const opacity = 0.3 - i * 0.1;
            const blur = 10 + i * 5;
            ctx.beginPath();
            ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(135, 206, 250, ${opacity})`;
            ctx.shadowBlur = blur;
            ctx.fill();
        }
        
        ctx.globalCompositeOperation = 'source-over'; 
        
        ctx.shadowBlur = 0; 
        ctx.lineWidth = 1.5;
        const baseHue = 195; 
        
        const r1 = radius + (this.lightningOffset * 25) % 25;
        const alpha1 = 1.0 - (r1 - radius) / 25;
        ctx.strokeStyle = `hsla(${baseHue - 10}, 100%, 80%, ${alpha1 * 0.8})`; 
        ctx.beginPath();
        ctx.arc(0, 0, r1, 0, Math.PI * 2);
        ctx.stroke();
        
        const r2 = radius + 10 + (this.lightningOffset * 15) % 40;
        const alpha2 = 0.7 - (r2 - radius - 10) / 40;
        ctx.strokeStyle = `hsla(${baseHue + 10}, 100%, 80%, ${alpha2 * 0.5})`;
        ctx.beginPath();
        ctx.arc(0, 0, r2, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }
    
    drawGhostBall(x, y, index) {
        const ctx = this.ctx;
        const radius = 25;
        const anim = this.lightningOffset * 0.8 + index * 1.2;
        const pulse = Math.sin(anim) * 0.1 + 0.9; 
        const currentRadius = radius * pulse;
        const ghostHue = 120 + index * 20;
        
        ctx.save();
        ctx.translate(x, y); 
        
        if (this.earthTexture.complete && this.earthTexture.naturalWidth > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.clip(); 

            const texWidth = this.earthTexture.naturalWidth;
            const texHeight = this.earthTexture.naturalHeight;
            let sWidth = texHeight; 

            let sx = ((this.rotationAngle + index * 0.5) / (Math.PI * 2)) * texWidth;

            ctx.drawImage(
                this.earthTexture,
                sx, 0,
                sWidth, texHeight,
                -currentRadius, -currentRadius,
                currentRadius * 2, currentRadius * 2
            );

            if (sx + sWidth > texWidth) {
                let sx2 = sx - texWidth;
                ctx.drawImage(
                    this.earthTexture,
                    sx2, 0,
                    sWidth, texHeight,
                    -currentRadius, -currentRadius,
                    currentRadius * 2, currentRadius * 2
                );
            }

            const gradient = ctx.createRadialGradient(0, 0, currentRadius * 0.5, 0, 0, currentRadius);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(0.7, 'rgba(0,0,0,0.2)');
            gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
            ctx.fillStyle = gradient;
            ctx.fill();
        } else {
            ctx.fillStyle = `hsl(${ghostHue}, 80%, 50%)`;
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
            const glowRadius = currentRadius * (1.1 + i * 0.1);
            const opacity = 0.2 - i * 0.05;
            const blur = 8 + i * 4;
            ctx.beginPath();
            ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${ghostHue}, 80%, 70%, ${opacity})`;
            ctx.shadowColor = `hsla(${ghostHue}, 80%, 70%, 1)`;
            ctx.shadowBlur = blur;
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5;
        for (let i = 1; i <= 2; i++) {
            const ringRadius = radius + (anim * 10 + i * 20) % 30;
            const opacity = 1.0 - (ringRadius - radius) / 30; 
            ctx.strokeStyle = `hsla(${ghostHue}, 80%, 70%, ${opacity * 0.8 * pulse})`;
            ctx.beginPath();
            ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
    
    drawInfo() {
        const ctx = this.ctx;
        const peerCount = Object.keys(this.peers).length;
        ctx.save();
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.textAlign = 'right'; 
        const padding = 30;
        ctx.fillText(`Multiverses Connected: ${peerCount}`, this.canvas.width - padding, padding + 10);
        if (this.showDebug) { 
            ctx.fillStyle = '#aaaaaa'; 
            ctx.font = '12px "Consolas", "Courier New", monospace';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#aaaaaa';
            let debugY = padding + 40;
            ctx.fillText(`ID: ${this.myId}`, this.canvas.width - padding, debugY);
            debugY += 20;
            ctx.fillText(`Layar: ${window.innerWidth}x${window.innerHeight}`, this.canvas.width - padding, debugY);
            debugY += 20;
            ctx.fillText(`Posisi Jendela: (${window.screenX}, ${window.screenY})`, this.canvas.width - padding, debugY);
            debugY += 20;
            ctx.fillText(`Bola Utama: (${Math.round(this.myBall.x)}, ${Math.round(this.myBall.y)})`, this.canvas.width - padding, debugY);
            Object.entries(this.peers).forEach(([peerId, peer], index) => {
                debugY += 20;
                ctx.fillStyle = `hsl(${300 + index * 60}, 80%, 70%)`; // Warna peer
                ctx.fillText(`Peer ${peerId.substr(0, 4)}: (${Math.round(peer.x)}, ${Math.round(peer.y)})`, this.canvas.width - padding, debugY);
            });
        }
        ctx.restore();
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.bc.postMessage({ type: 'disconnect', id: this.myId }); 
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