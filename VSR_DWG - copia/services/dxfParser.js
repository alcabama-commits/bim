/**
 * Parser básico para archivos DXF
 * Soporta entidades comunes: LINE, CIRCLE, ARC, POLYLINE, LWPOLYLINE
 */
export class DXFParser {
    constructor() {
        this.lines = [];
        this.index = 0;
    }
    parse(dxfContent) {
        this.lines = dxfContent.split(/\r?\n/);
        this.index = 0;
        const drawing = {
            entities: [],
            layers: new Map(),
            bounds: {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            }
        };
        let inEntities = false;
        let currentEntity = null;
        while (this.index < this.lines.length) {
            const code = this.readLine();
            const value = this.readLine();
            if (code === '0') {
                if (value === 'SECTION') {
                    const sectionName = this.getNextValue();
                    if (sectionName === 'ENTITIES') {
                        inEntities = true;
                    }
                    else if (sectionName === 'ENDSEC') {
                        inEntities = false;
                    }
                }
                else if (inEntities && this.isEntityType(value)) {
                    if (currentEntity) {
                        drawing.entities.push(this.processEntity(currentEntity));
                    }
                    currentEntity = { type: value };
                }
                else if (value === 'ENDSEC') {
                    if (currentEntity) {
                        drawing.entities.push(this.processEntity(currentEntity));
                        currentEntity = null;
                    }
                    inEntities = false;
                }
            }
            else if (currentEntity && inEntities) {
                this.addEntityProperty(currentEntity, code, value);
            }
            else if (code === '2' && value) {
                // Layer name
                if (!drawing.layers.has(value)) {
                    drawing.layers.set(value, { name: value });
                }
            }
        }
        if (currentEntity) {
            drawing.entities.push(this.processEntity(currentEntity));
        }
        // Calcular bounds
        this.calculateBounds(drawing);
        return drawing;
    }
    readLine() {
        if (this.index >= this.lines.length)
            return '';
        return this.lines[this.index++].trim();
    }
    getNextValue() {
        this.index++;
        return this.readLine();
    }
    isEntityType(value) {
        const entityTypes = [
            'LINE', 'CIRCLE', 'ARC', 'POLYLINE', 'LWPOLYLINE',
            'POINT', 'TEXT', 'MTEXT', 'INSERT', 'DIMENSION'
        ];
        return entityTypes.includes(value);
    }
    addEntityProperty(entity, code, value) {
        const codeMap = {
            '8': 'layer',
            '62': 'color',
            '10': 'x1',
            '20': 'y1',
            '11': 'x2',
            '21': 'y2',
            '40': 'radius',
            '50': 'startAngle',
            '51': 'endAngle',
            '70': 'flags',
            '90': 'vertexCount'
        };
        const propName = codeMap[code];
        if (propName) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                entity[propName] = numValue;
            }
            else {
                entity[propName] = value;
            }
        }
    }
    processEntity(entity) {
        // Convertir coordenadas y normalizar
        if (entity.x1 !== undefined)
            entity.x1 = parseFloat(entity.x1);
        if (entity.y1 !== undefined)
            entity.y1 = parseFloat(entity.y1);
        if (entity.x2 !== undefined)
            entity.x2 = parseFloat(entity.x2);
        if (entity.y2 !== undefined)
            entity.y2 = parseFloat(entity.y2);
        if (entity.radius !== undefined)
            entity.radius = parseFloat(entity.radius);
        if (entity.startAngle !== undefined)
            entity.startAngle = parseFloat(entity.startAngle);
        if (entity.endAngle !== undefined)
            entity.endAngle = parseFloat(entity.endAngle);
        return entity;
    }
    calculateBounds(drawing) {
        const bounds = drawing.bounds;
        for (const entity of drawing.entities) {
            switch (entity.type) {
                case 'LINE':
                    if (entity.x1 !== undefined) {
                        bounds.minX = Math.min(bounds.minX, entity.x1, entity.x2 || entity.x1);
                        bounds.maxX = Math.max(bounds.maxX, entity.x1, entity.x2 || entity.x1);
                    }
                    if (entity.y1 !== undefined) {
                        bounds.minY = Math.min(bounds.minY, entity.y1, entity.y2 || entity.y1);
                        bounds.maxY = Math.max(bounds.maxY, entity.y1, entity.y2 || entity.y1);
                    }
                    break;
                case 'CIRCLE':
                    if (entity.x1 !== undefined && entity.radius !== undefined) {
                        bounds.minX = Math.min(bounds.minX, entity.x1 - entity.radius);
                        bounds.maxX = Math.max(bounds.maxX, entity.x1 + entity.radius);
                    }
                    if (entity.y1 !== undefined && entity.radius !== undefined) {
                        bounds.minY = Math.min(bounds.minY, entity.y1 - entity.radius);
                        bounds.maxY = Math.max(bounds.maxY, entity.y1 + entity.radius);
                    }
                    break;
                case 'ARC':
                    // Simplificado - usar el círculo completo para bounds
                    if (entity.x1 !== undefined && entity.radius !== undefined) {
                        bounds.minX = Math.min(bounds.minX, entity.x1 - entity.radius);
                        bounds.maxX = Math.max(bounds.maxX, entity.x1 + entity.radius);
                    }
                    if (entity.y1 !== undefined && entity.radius !== undefined) {
                        bounds.minY = Math.min(bounds.minY, entity.y1 - entity.radius);
                        bounds.maxY = Math.max(bounds.maxY, entity.y1 + entity.radius);
                    }
                    break;
            }
        }
        // Asegurar que hay bounds válidos
        if (!isFinite(bounds.minX)) {
            bounds.minX = bounds.minY = -100;
            bounds.maxX = bounds.maxY = 100;
        }
    }
}
