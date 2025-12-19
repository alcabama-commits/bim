import { DXFParser } from './services/dxfParser.js';
class DXFViewer {
    constructor(canvasId) {
        this.drawing = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.zoomLevel = 100;
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas with id "${canvasId}" not found`);
        }
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = ctx;
        this.setupCanvas();
        this.setupEventListeners();
    }
    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.redraw();
        }
    }
    setupEventListeners() {
        // Zoom con rueda del mouse
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom(e.offsetX, e.offsetY, delta);
        });
        // Pan con mouse
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastX = e.offsetX;
            this.lastY = e.offsetY;
        });
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.offsetX - this.lastX;
                const dy = e.offsetY - this.lastY;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastX = e.offsetX;
                this.lastY = e.offsetY;
                this.redraw();
            }
        });
        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });
        // Touch events para móviles
        let touchStartDistance = 0;
        let touchStartScale = 1;
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                const touch = e.touches[0];
                this.lastX = touch.clientX;
                this.lastY = touch.clientY;
            }
            else if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                touchStartDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
                touchStartScale = this.scale;
            }
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && this.isDragging) {
                const touch = e.touches[0];
                const dx = touch.clientX - this.lastX;
                const dy = touch.clientY - this.lastY;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastX = touch.clientX;
                this.lastY = touch.clientY;
                this.redraw();
            }
            else if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
                const scale = touchStartScale * (distance / touchStartDistance);
                this.scale = Math.max(0.1, Math.min(10, scale));
                this.updateZoomLevel();
                this.redraw();
            }
        });
        this.canvas.addEventListener('touchend', () => {
            this.isDragging = false;
        });
    }
    loadDrawing(drawing) {
        this.drawing = drawing;
        this.fitToScreen();
    }
    zoom(centerX, centerY, factor) {
        const newScale = this.scale * factor;
        if (newScale < 0.1 || newScale > 10)
            return;
        // Zoom hacia el punto del mouse
        const worldX = (centerX - this.offsetX) / this.scale;
        const worldY = (centerY - this.offsetY) / this.scale;
        this.scale = newScale;
        this.updateZoomLevel();
        this.offsetX = centerX - worldX * this.scale;
        this.offsetY = centerY - worldY * this.scale;
        this.redraw();
    }
    zoomIn() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        this.zoom(centerX, centerY, 1.2);
    }
    zoomOut() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        this.zoom(centerX, centerY, 0.8);
    }
    resetView() {
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.updateZoomLevel();
        this.redraw();
    }
    fitToScreen() {
        if (!this.drawing)
            return;
        const bounds = this.drawing.bounds;
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        if (width === 0 || height === 0) {
            this.scale = 1;
            this.offsetX = this.canvas.width / 2;
            this.offsetY = this.canvas.height / 2;
        }
        else {
            const scaleX = (this.canvas.width * 0.9) / width;
            const scaleY = (this.canvas.height * 0.9) / height;
            this.scale = Math.min(scaleX, scaleY);
            const centerX = (bounds.minX + bounds.maxX) / 2;
            const centerY = (bounds.minY + bounds.maxY) / 2;
            this.offsetX = this.canvas.width / 2 - centerX * this.scale;
            this.offsetY = this.canvas.height / 2 - centerY * this.scale;
        }
        this.updateZoomLevel();
        this.redraw();
    }
    updateZoomLevel() {
        this.zoomLevel = Math.round(this.scale * 100);
        const zoomElement = document.getElementById('zoomLevel');
        if (zoomElement) {
            zoomElement.textContent = `${this.zoomLevel}%`;
        }
    }
    redraw() {
        if (!this.drawing)
            return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        // Transformar coordenadas
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);
        // Renderizar entidades
        for (const entity of this.drawing.entities) {
            this.renderEntity(entity);
        }
        this.ctx.restore();
    }
    renderEntity(entity) {
        this.ctx.strokeStyle = this.getEntityColor(entity);
        this.ctx.lineWidth = 1 / this.scale; // Mantener grosor de línea constante
        this.ctx.fillStyle = this.getEntityColor(entity);
        switch (entity.type) {
            case 'LINE':
                this.renderLine(entity);
                break;
            case 'CIRCLE':
                this.renderCircle(entity);
                break;
            case 'ARC':
                this.renderArc(entity);
                break;
            case 'POLYLINE':
            case 'LWPOLYLINE':
                this.renderPolyline(entity);
                break;
        }
    }
    renderLine(entity) {
        if (entity.x1 === undefined || entity.y1 === undefined ||
            entity.x2 === undefined || entity.y2 === undefined) {
            return;
        }
        this.ctx.beginPath();
        this.ctx.moveTo(entity.x1, entity.y1);
        this.ctx.lineTo(entity.x2, entity.y2);
        this.ctx.stroke();
    }
    renderCircle(entity) {
        if (entity.x1 === undefined || entity.y1 === undefined ||
            entity.radius === undefined) {
            return;
        }
        this.ctx.beginPath();
        this.ctx.arc(entity.x1, entity.y1, entity.radius, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    renderArc(entity) {
        if (entity.x1 === undefined || entity.y1 === undefined ||
            entity.radius === undefined) {
            return;
        }
        const startAngle = entity.startAngle !== undefined
            ? (entity.startAngle * Math.PI) / 180
            : 0;
        const endAngle = entity.endAngle !== undefined
            ? (entity.endAngle * Math.PI) / 180
            : Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.arc(entity.x1, entity.y1, entity.radius, startAngle, endAngle);
        this.ctx.stroke();
    }
    renderPolyline(entity) {
        // Implementación simplificada - en un parser completo se leerían los vértices
        // Por ahora, solo mostramos que existe la entidad
    }
    getEntityColor(entity) {
        // Colores DXF estándar (índice 0-255)
        const colorIndex = entity.color !== undefined ? entity.color : 7; // Blanco por defecto
        const dxfColors = {
            0: '#000000', // ByBlock
            1: '#FF0000', // Rojo
            2: '#FFFF00', // Amarillo
            3: '#00FF00', // Verde
            4: '#00FFFF', // Cyan
            5: '#0000FF', // Azul
            6: '#FF00FF', // Magenta
            7: '#FFFFFF', // Blanco/Negro
        };
        return dxfColors[colorIndex] || dxfColors[7];
    }
}
// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const viewerSection = document.getElementById('viewerSection');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const resetViewBtn = document.getElementById('resetView');
    const fitToScreenBtn = document.getElementById('fitToScreen');
    const statusText = document.getElementById('statusText');
    const entityCount = document.getElementById('entityCount');
    const fileName = document.getElementById('fileName');
    const viewer = new DXFViewer('dxfCanvas');
    const parser = new DXFParser();
    // Event listeners para carga de archivos
    uploadArea?.addEventListener('click', () => fileInput?.click());
    uploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea?.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    uploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer?.files[0];
        if (file && file.name.toLowerCase().endsWith('.dxf')) {
            loadFile(file);
        }
    });
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            loadFile(file);
        }
    });
    // Controles del visor
    zoomInBtn?.addEventListener('click', () => viewer.zoomIn());
    zoomOutBtn?.addEventListener('click', () => viewer.zoomOut());
    resetViewBtn?.addEventListener('click', () => viewer.resetView());
    fitToScreenBtn?.addEventListener('click', () => viewer.fitToScreen());
    function loadFile(file) {
        if (statusText)
            statusText.textContent = 'Cargando archivo...';
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result;
                const drawing = parser.parse(content);
                viewer.loadDrawing(drawing);
                if (viewerSection)
                    viewerSection.style.display = 'flex';
                if (fileName)
                    fileName.textContent = file.name;
                if (entityCount)
                    entityCount.textContent = `${drawing.entities.length} entidades`;
                if (statusText)
                    statusText.textContent = 'Archivo cargado correctamente';
                // Scroll a la sección del visor
                viewerSection?.scrollIntoView({ behavior: 'smooth' });
            }
            catch (error) {
                console.error('Error parsing DXF:', error);
                if (statusText)
                    statusText.textContent = 'Error al cargar el archivo DXF';
                alert('Error al cargar el archivo DXF. Por favor, verifica que el archivo sea válido.');
            }
        };
        reader.onerror = () => {
            if (statusText)
                statusText.textContent = 'Error al leer el archivo';
            alert('Error al leer el archivo.');
        };
        reader.readAsText(file);
    }
});
