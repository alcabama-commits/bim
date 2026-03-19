import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import AdmZip from 'adm-zip';

const require = createRequire(import.meta.url);
const WebIFC = require('web-ifc');
const { IfcImporter } = require('@thatopen/fragments');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = 3000;

// Serve static files
app.use(express.static('public'));

// Ensure directories exist
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('converted')) fs.mkdirSync('converted');

// Regex patterns
const EXCLUDE_TYPES_PATTERN = /POINT|DIRECTION|PLACEMENT|SHAPE|SOLID|FACE|LOOP|VERTEX|EDGE|CURVE|SURFACE|VECTOR|STYLE|COLOR|COLOUR|CONTEXT|REPRESENTATION|UNIT|MEASURE|DIMENSION/;
const FORCE_KEEP_PATTERN = /PROPERTY|REL|QUANTITY|MATERIAL|TYPE|STYLE|PRESENTATION/;

async function convertIfcToFrag(filePath, outputDir, originalName) {
    const ifcApi = new WebIFC.IfcAPI();
    
    // Configurar COORDINATE_TO_ORIGIN para mejorar precisión de snapping
    ifcApi.SetWasmPath(path.resolve(__dirname, 'node_modules/web-ifc/') + '/');
    await ifcApi.Init();
    
    const importer = new IfcImporter();
    // Locate WASM for importer
    const wasmPath = path.resolve(__dirname, 'node_modules/web-ifc/');
    importer.wasm = { path: wasmPath + '/', absolute: true };

    // Configurar ajustes de importación para geometría precisa
    if (importer.settings) {
        importer.settings.webIfc = {
            COORDINATE_TO_ORIGIN: true, // CRUCIAL para snapping (evita jitter en coordenadas grandes)
            USE_FAST_BOOLS: false // Desactivar para mayor precisión geométrica si es necesario
        };
    }

    const buffer = fs.readFileSync(filePath);
    const data = new Uint8Array(buffer);
    
    // 1. Generate JSON
    let modelID;
    try {
        modelID = ifcApi.OpenModel(data, { COORDINATE_TO_ORIGIN: true }); // Asegurar consistencia
    } catch (e) {
        throw new Error("Failed to open IFC model: " + e.message);
    }

    // Helper functions
    const getValue = (val) => {
        if (val === null || val === undefined) return null;
        if (val.value !== undefined) return val.value;
        return val;
    };

    const getString = (line, propName) => {
        if (!line || !line[propName]) return null;
        return getValue(line[propName]);
    };

    // Index Relationships
    const relMap = new Map();
    const relLines = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);
    for (let i = 0; i < relLines.size(); i++) {
        const id = relLines.get(i);
        const rel = ifcApi.GetLine(modelID, id);
        if (!rel || !rel.RelatedObjects || !rel.RelatingPropertyDefinition) continue;
        
        const psetId = rel.RelatingPropertyDefinition.value;
        for (const related of rel.RelatedObjects) {
            const objId = related.value;
            if (!relMap.has(objId)) relMap.set(objId, []);
            relMap.get(objId).push(psetId);
        }
    }

    const optimizedLines = {};
    const vector = ifcApi.GetAllLines(modelID);
    const size = vector.size();

    for (let i = 0; i < size; i++) {
        const id = vector.get(i);
        const line = ifcApi.GetLine(modelID, id);
        if (!line) continue;
        
        const typeName = ifcApi.GetNameFromTypeCode(line.type);
        if (!typeName) continue;
        
        const upperType = typeName.toUpperCase();
        
        let keep = true;
        if (EXCLUDE_TYPES_PATTERN.test(upperType)) keep = false;
        
        if (FORCE_KEEP_PATTERN.test(upperType) || 
            upperType.includes('PROJECT') || 
            upperType.includes('SITE') || 
            upperType.includes('BUILDING') || 
            upperType.includes('STOREY')) {
            keep = true;
        }
        
        if (keep) {
            const entity = { ...line };
            
            // Add resolved properties
            if (relMap.has(id)) {
                const psetIds = relMap.get(id);
                entity.psets = {};
                for (const psetId of psetIds) {
                    const pset = ifcApi.GetLine(modelID, psetId);
                    if (!pset) continue;
                    const psetName = getString(pset, 'Name') || `Pset_${psetId}`;
                    entity.psets[psetName] = {};
                    if (pset.HasProperties) {
                        for (const propRef of pset.HasProperties) {
                            const propId = propRef.value;
                            const prop = ifcApi.GetLine(modelID, propId);
                            if (prop && prop.Name && prop.NominalValue) {
                                const propName = getString(prop, 'Name');
                                const propVal = getValue(prop.NominalValue);
                                entity.psets[psetName][propName] = propVal;
                            }
                        }
                    }
                }
            }
            optimizedLines[id] = entity;
        }
    }
    
    if (vector.delete) vector.delete();
    ifcApi.CloseModel(modelID);

    const baseName = path.parse(originalName).name;
    const jsonPath = path.join(outputDir, baseName + '.json');
    const fragPath = path.join(outputDir, baseName + '.frag');

    fs.writeFileSync(jsonPath, JSON.stringify(optimizedLines, null, 2));

    // 2. Generate FRAG
    // Usar settings configurados previamente en importer
    const fragBinary = await importer.process({ 
        bytes: data,
        absolute: true 
    });
    fs.writeFileSync(fragPath, fragBinary);

    return { jsonPath, fragPath, baseName };
}

app.post('/convert', upload.single('ifcFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        console.log(`Processing ${req.file.originalname}...`);
        const result = await convertIfcToFrag(req.file.path, 'converted', req.file.originalname);
        
        // Create Zip
        const zip = new AdmZip();
        zip.addLocalFile(result.jsonPath);
        zip.addLocalFile(result.fragPath);
        
        const zipBuffer = zip.toBuffer();
        const zipName = `${result.baseName}_converted.zip`;

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename=${zipName}`);
        res.set('Content-Length', zipBuffer.length);
        res.send(zipBuffer);
        
        // Cleanup
        try {
            fs.unlinkSync(req.file.path);
            fs.unlinkSync(result.jsonPath);
            fs.unlinkSync(result.fragPath);
        } catch (e) {
            console.error("Error cleaning up files:", e);
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('Conversion failed: ' + error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Converter App running at http://localhost:${PORT}`);
});
