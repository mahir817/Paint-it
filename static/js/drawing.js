/**
 * Canvas drawing functionality with mouse and touch support
 */

class DrawingCanvas {
    constructor(canvasId, socket, roomId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.socket = socket;
        this.roomId = roomId;
        
        this.isDrawing = false;
        this.currentColor = '#000000';
        this.currentLineWidth = 5;
        this.prevX = 0;
        this.prevY = 0;
        
        // Resize canvas to fit container
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup drawing controls
        this.setupControls();
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Set canvas size (maintain 16:9 aspect ratio or use available space)
        const maxWidth = rect.width - 16; // padding
        const maxHeight = Math.min(600, window.innerHeight * 0.6);
        
        this.canvas.width = maxWidth;
        this.canvas.height = maxHeight;
        
        // Set drawing properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }
    
    setupControls() {
        const colorPicker = document.getElementById('color-picker');
        const brushSize = document.getElementById('brush-size');
        const brushSizeDisplay = document.getElementById('brush-size-display');
        const clearBtn = document.getElementById('clear-btn');
        
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                this.currentColor = e.target.value;
            });
        }
        
        if (brushSize) {
            brushSize.addEventListener('input', (e) => {
                this.currentLineWidth = parseInt(e.target.value);
                if (brushSizeDisplay) {
                    brushSizeDisplay.textContent = this.currentLineWidth + 'px';
                }
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearCanvas();
            });
        }
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
    }
    
    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const coords = this.getCoordinates(e);
        this.prevX = coords.x;
        this.prevY = coords.y;
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const coords = this.getCoordinates(e);
        const currentX = coords.x;
        const currentY = coords.y;
        
        // Draw on local canvas
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentLineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(this.prevX, this.prevY);
        this.ctx.lineTo(currentX, currentY);
        this.ctx.stroke();
        
        // Send drawing data to server
        if (this.socket && this.roomId) {
            this.socket.emit('draw', {
                room_id: this.roomId,
                x: currentX,
                y: currentY,
                prevX: this.prevX,
                prevY: this.prevY,
                color: this.currentColor,
                lineWidth: this.currentLineWidth,
                isDrawing: true
            });
        }
        
        this.prevX = currentX;
        this.prevY = currentY;
    }
    
    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
        }
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.socket && this.roomId) {
            this.socket.emit('clear_canvas', {
                room_id: this.roomId
            });
        }
    }
    
    drawFromRemote(data) {
        if (data.isDrawing) {
            this.ctx.strokeStyle = data.color;
            this.ctx.lineWidth = data.lineWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(data.prevX, data.prevY);
            this.ctx.lineTo(data.x, data.y);
            this.ctx.stroke();
        }
    }
    
    clearFromRemote() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    setDrawerMode(isDrawer) {
        // Enable/disable drawing based on whether player is drawer
        this.canvas.style.cursor = isDrawer ? 'crosshair' : 'not-allowed';
        this.canvas.style.pointerEvents = isDrawer ? 'auto' : 'none';
        
        // Disable/enable drawing controls
        const controls = document.querySelectorAll('#color-picker, #brush-size, #clear-btn');
        controls.forEach(control => {
            control.disabled = !isDrawer;
        });
    }
}

// Global drawing canvas instance
let drawingCanvas = null;

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
    window.DrawingCanvas = DrawingCanvas;
}

