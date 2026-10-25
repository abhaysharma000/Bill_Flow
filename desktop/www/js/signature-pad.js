/**
 * BillFlow Digital Signature Engine
 * Interactive touch & stylus canvas drawing pad, cursive type-to-sign, & file upload
 * Produces crisp, transparent PNG digital signatures for invoices
 */

class BillFlowSignaturePad {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.hasContent = false;
        this.penColor = options.penColor || '#1e3a8a';
        this.lineWidth = options.lineWidth || 3;
        this.points = [];

        this.initCanvas();
        this.bindEvents();
    }

    initCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.width = rect.width || 380;
        this.height = rect.height || 180;

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);

        this.ctx.strokeStyle = this.penColor;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    bindEvents() {
        // Touch events for mobile phones and tablets
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleEnd(e), { passive: false });

        // Mouse events for desktop testing
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleEnd(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleEnd(e));
    }

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    handleStart(e) {
        e.preventDefault();
        this.isDrawing = true;
        this.hasContent = true;
        const pos = this.getPos(e);
        this.points = [pos];
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }

    handleMove(e) {
        if (!this.isDrawing) return;
        e.preventDefault();
        const pos = this.getPos(e);
        this.points.push(pos);

        // Smooth curve drawing using quadratic bezier
        if (this.points.length > 2) {
            const p1 = this.points[this.points.length - 2];
            const p2 = this.points[this.points.length - 1];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            this.ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
            this.ctx.stroke();
        } else {
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        }
    }

    handleEnd(e) {
        if (!this.isDrawing) return;
        e.preventDefault();
        this.isDrawing = false;
        this.ctx.closePath();
    }

    setPenColor(color) {
        this.penColor = color;
        this.ctx.strokeStyle = color;
    }

    setLineWidth(width) {
        this.lineWidth = width;
        this.ctx.lineWidth = width;
    }

    clear() {
        const dpr = window.devicePixelRatio || 1;
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.hasContent = false;
        this.points = [];
    }

    isEmpty() {
        return !this.hasContent;
    }

    // Render cursive text signature onto canvas
    renderTypedSignature(name, fontStyle = 'cursive') {
        this.clear();
        if (!name || !name.trim()) return;

        this.hasContent = true;
        this.ctx.save();
        this.ctx.fillStyle = this.penColor;
        this.ctx.font = `italic 36px 'Brush Script MT', 'Dancing Script', 'Caveat', cursive, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(name.trim(), this.width / 2, this.height / 2);

        // Subtle underline flourish
        const textMetrics = this.ctx.measureText(name.trim());
        const lineStart = Math.max(20, (this.width - textMetrics.width) / 2 - 10);
        const lineEnd = Math.min(this.width - 20, (this.width + textMetrics.width) / 2 + 15);
        const lineY = this.height / 2 + 20;

        this.ctx.beginPath();
        this.ctx.strokeStyle = this.penColor;
        this.ctx.lineWidth = 2;
        this.ctx.moveTo(lineStart, lineY);
        this.ctx.quadraticCurveTo((lineStart + lineEnd) / 2, lineY + 6, lineEnd, lineY - 2);
        this.ctx.stroke();

        this.ctx.restore();
    }

    // Load uploaded image onto canvas
    loadSignatureImage(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.clear();
                this.hasContent = true;
                const aspect = img.width / img.height;
                let drawW = this.width * 0.8;
                let drawH = drawW / aspect;
                if (drawH > this.height * 0.8) {
                    drawH = this.height * 0.8;
                    drawW = drawH * aspect;
                }
                const drawX = (this.width - drawW) / 2;
                const drawY = (this.height - drawH) / 2;
                this.ctx.drawImage(img, drawX, drawY, drawW, drawH);
                resolve();
            };
            img.src = dataUrl;
        });
    }

    // Export trimmed transparent PNG
    toDataURL() {
        if (!this.hasContent) return '';
        return this.canvas.toDataURL('image/png');
    }
}

window.BillFlowSignaturePad = BillFlowSignaturePad;
