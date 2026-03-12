import React, { useState, useCallback, useRef, useMemo } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import BIMViewer from './components/BIMViewer';
import { BIMElement, CategorySummary } from './types';
import { Upload, Box } from 'lucide-react';
import Sidebar from './components/Sidebar';
import LevelGrid from './components/LevelGrid';
import DataTable from './components/DataTable';

const PRIORITY_PROPS = [
  "AREA INTEGRADO",
  "LONGITUD INTEGRADO",
  "MATERIAL INTEGRADO",
  "NIVEL INTEGRADO",
  "NOMBRE INTEGRADO",
  "VOLUMEN INTEGRADO",
  "DETALLE",
  "CLASIFICACIÓN"
];

export default function App() {
  const [elements, setElements] = useState<BIMElement[]>([]);
  const [summaries, setSummaries] = useState<CategorySummary[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const componentsRef = useRef<OBC.Components | null>(null);

  // Filter states
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('Todas');

  const getProp = (el: BIMElement, key: string) => {
    if (!el.properties) return undefined;
    const val = el.properties[key];
    if (val === undefined || val === null) return undefined;
    
    // Si es un objeto con 'value', extraerlo
    if (typeof val === 'object' && val !== null) {
      if ('value' in val) return String(val.value);
      if ('NominalValue' in val) {
        const nv = val.NominalValue;
        return (typeof nv === 'object' && nv !== null && 'value' in nv) ? String(nv.value) : String(nv);
      }
      if ('QuantityValue' in val) {
        const qv = val.QuantityValue;
        return (typeof qv === 'object' && qv !== null && 'value' in qv) ? String(qv.value) : String(qv);
      }
    }
    return String(val);
  };

  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      const classif = getProp(el, "CLASIFICACIÓN") || "SIN CLASIFICAR";
      const cat = el.category;
      const subCat = getProp(el, "NOMBRE INTEGRADO") || el.name;
      const level = getProp(el, "NIVEL INTEGRADO") || "";
      const material = getProp(el, "MATERIAL INTEGRADO") || "";

      const classificationMatch = selectedClassifications.length === 0 || selectedClassifications.includes(classif);
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(cat);
      const subCategoryMatch = selectedSubCategories.length === 0 || selectedSubCategories.includes(subCat);
      const levelMatch = selectedLevels.length === 0 || selectedLevels.includes(level);
      const materialMatch = selectedMaterial === 'Todas' || material === selectedMaterial;

      return classificationMatch && categoryMatch && subCategoryMatch && levelMatch && materialMatch;
    });
  }, [elements, selectedClassifications, selectedCategories, selectedSubCategories, selectedLevels, selectedMaterial]);

  const sidebarData = useMemo(() => {
    const classificationMap: Record<string, Record<string, Set<string>>> = {};
    
    elements.forEach(el => {
      const classification = getProp(el, "CLASIFICACIÓN") || "SIN CLASIFICAR";
      const category = el.category;
      const subCategory = getProp(el, "NOMBRE INTEGRADO") || el.name;

      if (!classificationMap[classification]) {
        classificationMap[classification] = {};
      }
      if (!classificationMap[classification][category]) {
        classificationMap[classification][category] = new Set();
      }
      classificationMap[classification][category].add(subCategory);
    });

    return Object.entries(classificationMap).map(([classifName, categories]) => ({
      name: classifName,
      categories: Object.entries(categories).map(([catName, subCats]) => ({
        name: catName,
        children: Array.from(subCats).sort()
      })).sort((a, b) => a.name.localeCompare(b.name))
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [elements]);

  const levels = useMemo(() => {
    const levelSet = new Set<string>();
    elements.forEach(el => {
      const level = getProp(el, "NIVEL INTEGRADO");
      if (level) levelSet.add(level);
    });
    return Array.from(levelSet);
  }, [elements]);

  const materials = useMemo(() => {
    const materialSet = new Set<string>();
    elements.forEach(el => {
      const material = getProp(el, "MATERIAL INTEGRADO");
      if (material) materialSet.add(material);
    });
    return Array.from(materialSet).sort();
  }, [elements]);

  const toggleClassification = (name: string) => {
    setSelectedClassifications(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const toggleCategory = (name: string) => {
    setSelectedCategories(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const toggleSubCategory = (name: string) => {
    setSelectedSubCategories(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const processModel = useCallback(async (model: any) => {
    console.log("Procesando modelo cargado ID:", model.uuid || model.modelId);
    const extractedElements: BIMElement[] = [];
    const categoryMap: Record<string, { totalVolume: number; count: number }> = {};

    try {
      const ids = await model.getLocalIds();
      console.log(`Modelo con ${ids.length} elementos locales.`);

      // Intentar obtener datos básicos de los elementos
      const itemsData = await model.getItemsData(ids, {
        attributesDefault: true,
      });

      const getValue = (attr: any) => {
        if (attr === undefined || attr === null) return undefined;
        if (typeof attr === 'object') {
          if ('value' in attr) return attr.value;
          if ('NominalValue' in attr) {
            const nv = attr.NominalValue;
            return (nv && typeof nv === 'object' && 'value' in nv) ? nv.value : nv;
          }
          if ('QuantityValue' in attr) {
            const qv = attr.QuantityValue;
            return (qv && typeof qv === 'object' && 'value' in qv) ? qv.value : qv;
          }
        }
        return attr;
      };

      // Búsqueda profunda de parámetros integrados para asegurar que estén disponibles en el nivel superior
      const findDeep = (obj: any, target: string): any => {
        if (!obj || typeof obj !== 'object') return undefined;
        
        // 1. Buscar coincidencia exacta o normalizada en el nivel actual
        const normalizedTarget = target.trim().toLowerCase();
        for (const key in obj) {
          if (key === target || key.trim().toLowerCase() === normalizedTarget) {
            return getValue(obj[key]);
          }
        }

        // 2. Recorrer recursivamente
        for (const key in obj) {
          const val = obj[key];
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            // Evitar recursión infinita o en objetos de valor simple
            if (!('value' in val) && !('NominalValue' in val) && !('QuantityValue' in val)) {
              const found = findDeep(val, target);
              if (found !== undefined) return found;
            }
          } else if (Array.isArray(val)) {
            for (const item of val) {
              const found = findDeep(item, target);
              if (found !== undefined) return found;
            }
          }
        }
        return undefined;
      };

      for (let i = 0; i < ids.length; i++) {
        const localId = ids[i];
        const data = itemsData[i] || {};
        
        // Extraer todos los IDs posibles para asegurar vinculación
        const rawId = getValue(data.expressID || data.ExpressID || data.id || localId);
        const expressId = rawId !== undefined && rawId !== null ? rawId.toString() : localId.toString();
        
        const rawGlobalId = getValue(data.GlobalId || data.globalId || data.guid || data.Guid || data.GlobalID);
        const globalId = rawGlobalId?.toString();
        
        const category = getValue(data.type || data.Category || data.ObjectType || 'Elemento').toString();
        
        // Extraer parámetros prioritarios al nivel superior de propiedades
        const integratedProps: any = {};
        PRIORITY_PROPS.forEach(p => {
          const val = findDeep(data, p);
          if (val !== undefined) integratedProps[p] = val;
        });

        // Prioridad a NOMBRE INTEGRADO
        const name = integratedProps["NOMBRE INTEGRADO"] || getValue(data.Name || data.name || `${category} - ${expressId}`).toString();
        
        // Intentar extraer volumen si está en el frag
        let volume = 0;
        const volVal = integratedProps["VOLUMEN INTEGRADO"];
        if (volVal !== undefined) {
          if (typeof volVal === 'number' && volVal > 0) volume = volVal;
          else if (!isNaN(Number(volVal)) && Number(volVal) > 0) volume = Number(volVal);
        }

        if (volume === 0) {
          const findVol = (obj: any): number | null => {
            if (!obj || typeof obj !== 'object') return null;
            for (const key in obj) {
              const k = key.toLowerCase();
              if (k.includes('volume') || k.includes('volumen')) {
                const val = getValue(obj[key]);
                if (typeof val === 'number' && val > 0) return val;
                if (!isNaN(Number(val)) && Number(val) > 0) return Number(val);
              }
            }
            return null;
          };
          volume = findVol(data) || 0;
        }

        extractedElements.push({
          id: expressId, 
          globalId: globalId,
          name: volume > 0 ? name : `${name} (Cargando datos...)`,
          category,
          volume: volume,
          unit: 'm³',
          properties: { ...data, ...integratedProps },
          modelId: model.id,
          localId: localId
        });

        if (!categoryMap[category]) {
          categoryMap[category] = { totalVolume: 0, count: 0 };
        }
        categoryMap[category].count += 1;
        categoryMap[category].totalVolume += volume;
      }

      setElements(extractedElements);
      setSummaries(Object.entries(categoryMap).map(([category, data]) => ({
        category,
        totalVolume: data.totalVolume,
        count: data.count
      })));
      
      console.log(`Preparados ${extractedElements.length} elementos para vinculación.`);
    } catch (err) {
      console.error("Error en processModel:", err);
    }
  }, []);

  const handleModelLoaded = useCallback((components: OBC.Components) => {
    componentsRef.current = components;
  }, []);

  const clearScene = async () => {
    console.log("Limpiando escena...");
    if (!componentsRef.current) return;
    const fragments = componentsRef.current.get(OBC.FragmentsManager);
    
    // En v3, usamos fragments.list y fragments.core.disposeModel()
    const modelIds = Array.from(fragments.list.keys());
    for (const id of modelIds) {
      await fragments.core.disposeModel(id);
    }
    
    // También limpiar cualquier grupo manual (como el de ejemplo)
    const worlds = componentsRef.current.get(OBC.Worlds);
    const world = worlds.list.values().next().value;
    if (world) {
      const toRemove: THREE.Object3D[] = [];
      world.scene.three.traverse((obj) => {
        if (obj instanceof THREE.Group && obj.name === "SampleGroup") {
          toRemove.push(obj);
        }
      });
      toRemove.forEach(obj => {
        world.scene.three.remove(obj);
        console.log("Removido objeto de ejemplo.");
      });
    }
    setElements([]);
    setSummaries([]);
  };

  const handleJsonUpload = async (file: File) => {
    console.log("Procesando JSON de propiedades...");
    setIsLoading(true);
    try {
      const text = await file.text();
      const rawData = JSON.parse(text);
      
      let propertiesMap: Record<string, any> = {};
      
      // Normalizar JSON: si es un arreglo, convertirlo a mapa por ID
      if (Array.isArray(rawData)) {
        console.log(`JSON es un arreglo con ${rawData.length} elementos.`);
        rawData.forEach(item => {
          const id = item.ExpressID || item.expressID || item.id || item.Id || item.GlobalId || item.globalId || item.Guid || item.GUID;
          if (id !== undefined && id !== null) {
            propertiesMap[id.toString()] = item;
          }
        });
      } else {
        propertiesMap = rawData;
      }
      
      const jsonKeys = Object.keys(propertiesMap);
      console.log(`Mapa de propiedades listo con ${jsonKeys.length} llaves.`);
      
      setElements(prevElements => {
        if (prevElements.length === 0) {
          console.warn("No hay elementos cargados en el visor para vincular.");
          return prevElements;
        }

        console.log(`Intentando vincular ${prevElements.length} elementos del visor con el JSON.`);
        let matchCount = 0;

        const updatedElements = prevElements.map(el => {
          // Intentar vincular por ExpressID (el.id) o por GlobalID (el.globalId)
          let props = propertiesMap[el.id];
          if (!props && el.globalId) {
            props = propertiesMap[el.globalId];
          }
          
          if (!props) return el;

          matchCount++;
          
          const getValueLocal = (attr: any) => {
            if (attr === undefined || attr === null) return undefined;
            if (typeof attr === 'object') {
              if ('value' in attr) return attr.value;
              if ('NominalValue' in attr) {
                const nv = attr.NominalValue;
                return (nv && typeof nv === 'object' && 'value' in nv) ? nv.value : nv;
              }
              if ('QuantityValue' in attr) {
                const qv = attr.QuantityValue;
                return (qv && typeof qv === 'object' && 'value' in qv) ? qv.value : qv;
              }
            }
            return attr;
          };

          // Búsqueda profunda de parámetros integrados en el JSON
          const findDeepLocal = (obj: any, target: string): any => {
            if (!obj || typeof obj !== 'object') return undefined;
            
            const normalizedTarget = target.trim().toLowerCase();
            for (const key in obj) {
              if (key === target || key.trim().toLowerCase() === normalizedTarget) {
                return getValueLocal(obj[key]);
              }
            }
            
            for (const key in obj) {
              const val = obj[key];
              if (val && typeof val === 'object' && !Array.isArray(val)) {
                if (!('value' in val) && !('NominalValue' in val) && !('QuantityValue' in val)) {
                  const found = findDeepLocal(val, target);
                  if (found !== undefined) return found;
                }
              } else if (Array.isArray(val)) {
                for (const item of val) {
                  const found = findDeepLocal(item, target);
                  if (found !== undefined) return found;
                }
              }
            }
            return undefined;
          };

          const integratedProps: any = {};
          PRIORITY_PROPS.forEach(p => {
            const val = findDeepLocal(props, p);
            if (val !== undefined) integratedProps[p] = val;
          });

          const findVolume = (obj: any): number | null => {
            if (!obj || typeof obj !== 'object') return null;
            
            // Prioridad a VOLUMEN INTEGRADO
            const volVal = integratedProps["VOLUMEN INTEGRADO"];
            if (volVal !== undefined) {
              if (typeof volVal === 'number' && volVal > 0) return volVal;
              if (!isNaN(Number(volVal)) && Number(volVal) > 0) return Number(volVal);
            }

            // 1. Buscar directamente en el objeto
            for (const key in obj) {
              const k = key.toLowerCase();
              if (k.includes('volume') || k.includes('volumen')) {
                const val = getValueLocal(obj[key]);
                if (typeof val === 'number' && val > 0) return val;
                if (!isNaN(Number(val)) && Number(val) > 0) return Number(val);
              }
            }

            // 2. Recorrer recursivamente
            for (const key in obj) {
              const val = obj[key];
              if (val && typeof val === 'object' && !Array.isArray(val)) {
                const found = findVolume(val);
                if (found !== null) return found;
              } else if (Array.isArray(val)) {
                for (const item of val) {
                  const found = findVolume(item);
                  if (found !== null) return found;
                }
              }
            }
            return null;
          };

          const realVolume = findVolume(props);
          const updatedEl = {
            ...el,
            properties: { ...el.properties, ...props, ...integratedProps }
          };

          if (realVolume !== null) {
            updatedEl.volume = realVolume;
            updatedEl.name = (integratedProps["NOMBRE INTEGRADO"] || el.name).replace(' (Cargando datos...)', '');
          } else if (integratedProps["NOMBRE INTEGRADO"]) {
            updatedEl.name = integratedProps["NOMBRE INTEGRADO"];
          }

          return updatedEl;
        });

        console.log(`Vinculación exitosa: ${matchCount} de ${prevElements.length} elementos encontrados en el JSON.`);
        if (matchCount === 0) {
          console.warn("¡ATENCIÓN! Ningún ID del visor coincidió con las llaves del JSON. Comprueba si el JSON usa ExpressID o GlobalID.");
        }

        const newCategoryMap: Record<string, { totalVolume: number; count: number }> = {};
        updatedElements.forEach(el => {
          if (!newCategoryMap[el.category]) {
            newCategoryMap[el.category] = { totalVolume: 0, count: 0 };
          }
          newCategoryMap[el.category].totalVolume += el.volume;
          newCategoryMap[el.category].count += 1;
        });

        setSummaries(Object.entries(newCategoryMap).map(([category, data]) => ({
          category,
          totalVolume: data.totalVolume,
          count: data.count
        })));

        return updatedElements;
      });
    } catch (error) {
      console.error("Error procesando JSON:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !componentsRef.current) return;

    const fileList = Array.from(files) as File[];
    const fragFile = fileList.find(f => f.name.toLowerCase().endsWith('.frag'));
    const jsonFile = fileList.find(f => f.name.toLowerCase().endsWith('.json'));

    if (!fragFile && !jsonFile) {
      alert("Por favor selecciona al menos un archivo .frag o .json");
      return;
    }

    setIsLoading(true);
    setShowWelcome(false);

    try {
      // 1. Si hay un FRAG, cargarlo primero
      if (fragFile) {
        console.log("Cargando archivo FRAG:", fragFile.name);
        await clearScene();
        const fragments = componentsRef.current.get(OBC.FragmentsManager);
        
        if (!fragments.initialized) {
          console.log("Esperando inicialización de FragmentsManager...");
          let attempts = 0;
          while (!fragments.initialized && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
        }

        const buffer = await fragFile.arrayBuffer();
        const data = new Uint8Array(buffer);
        const model = await fragments.core.load(data, { modelId: fragFile.name });
        
        if (model) {
          const worlds = componentsRef.current.get(OBC.Worlds);
          const world = worlds.list.values().next().value;
          if (world) {
            if (!world.scene.three.children.includes(model.object)) {
              world.scene.three.add(model.object);
            }
            setTimeout(() => {
              if (world.camera.hasCameraControls()) {
                world.camera.controls.fitToSphere(model.object, true);
              }
              fragments.core.update(true);
            }, 500);
          }
          await processModel(model);
        }
      }

      // 2. Si hay un JSON, procesarlo después (para que tenga elementos a los cuales asignar datos)
      if (jsonFile) {
        // Pequeña espera para asegurar que el procesamiento del modelo terminó
        await new Promise(resolve => setTimeout(resolve, 500));
        await handleJsonUpload(jsonFile);
      }
    } catch (error) {
      console.error('Error en la carga combinada:', error);
      alert('Error al procesar los archivos.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSample = async () => {
    if (!componentsRef.current) return;
    setIsLoading(true);
    setShowWelcome(false);
    await clearScene();
    
    const worlds = componentsRef.current.get(OBC.Worlds);
    const world = worlds.list.values().next().value;

    if (world) {
      const group = new THREE.Group();
      group.name = "SampleGroup";
      const mockCategories = ['Slabs', 'Walls', 'Columns', 'Beams'];
      const colors = [0x10b981, 0x3b82f6, 0xf59e0b, 0xef4444];

      for (let i = 0; i < 15; i++) {
        const catIdx = i % mockCategories.length;
        const geometry = new THREE.BoxGeometry(
          Math.random() * 2 + 1, 
          Math.random() * 3 + 1, 
          Math.random() * 2 + 1
        );
        const material = new THREE.MeshStandardMaterial({ 
          color: colors[catIdx],
          transparent: true,
          opacity: 0.9
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set((Math.random() - 0.5) * 10, Math.random() * 5, (Math.random() - 0.5) * 10);
        group.add(mesh);
      }

      world.scene.three.add(group);
      if (world.camera.hasCameraControls()) {
        world.camera.controls.fitToSphere(group, true);
      }
    }

    // Generar datos de ejemplo para el tablero
    const mockElements: BIMElement[] = [];
    const catMap: Record<string, { totalVolume: number; count: number }> = {};
    const mockLevels = ['1. NE 0.00 - CIMENTACIÓN', '2. NE +2.70 - PISO 2', '3. NE +5.12 - PISO 3', '4. NE +7.54 - PISO 4'];
    const mockMaterials = ['Concreto 3000 psi', 'Concreto 4000 psi', 'Acero A36'];
    const mockClassifications = ['OBRA GRUESA', 'TERMINACIONES', 'INSTALACIONES'];
    
    ['CIMENTACIÓN', 'COLUMNAS', 'VIGAS', 'LOSAS'].forEach((cat, cIdx) => {
      const classification = mockClassifications[cIdx % mockClassifications.length];
      const count = Math.floor(Math.random() * 5 + 3);
      let totalVol = 0;
      for (let i = 0; i < count; i++) {
        const vol = Math.random() * 5 + 2;
        totalVol += vol;
        const level = mockLevels[Math.floor(Math.random() * mockLevels.length)];
        const material = mockMaterials[Math.floor(Math.random() * mockMaterials.length)];
        const name = `${cat} Type ${i + 1}`;
        
        mockElements.push({ 
          id: crypto.randomUUID(), 
          name: name, 
          category: cat, 
          volume: vol, 
          unit: 'm³',
          properties: {
            "NOMBRE INTEGRADO": name,
            "NIVEL INTEGRADO": level,
            "MATERIAL INTEGRADO": material,
            "AREA INTEGRADO": (vol * 2.5).toFixed(2),
            "LONGITUD INTEGRADO": (vol * 1.5).toFixed(2),
            "VOLUMEN INTEGRADO": vol.toFixed(2),
            "DETALLE": `Detalle ${cat}-${i}`,
            "CLASIFICACIÓN": classification
          }
        });
      }
      catMap[cat] = { totalVolume: totalVol, count };
    });

    setElements(mockElements);
    setSummaries(Object.entries(catMap).map(([category, data]) => ({
      category,
      totalVolume: data.totalVolume,
      count: data.count
    })));
    
    setIsLoading(false);
  };

  const resetFilters = () => {
    setSelectedClassifications([]);
    setSelectedCategories([]);
    setSelectedSubCategories([]);
    setSelectedLevels([]);
    setSelectedMaterial('Todas');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-white overflow-hidden font-sans">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="h-12 flex items-center">
             <span className="text-2xl font-black text-[#f27d26] tracking-tighter">ARTIS</span>
             <span className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-widest mt-2">URBANO</span>
          </div>
        </div>
        
        <div className="flex-1 max-w-2xl mx-8">
          <div className="bg-[#003d4d] text-white py-1.5 px-6 rounded-sm text-center font-bold uppercase tracking-widest text-sm shadow-inner">
            ESTRUCTURA - TORRE 1
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-10 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-emerald-500 rounded-full" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">TRÉVOLY</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar 
          categories={sidebarData}
          selectedClassifications={selectedClassifications}
          selectedCategories={selectedCategories}
          selectedSubCategories={selectedSubCategories}
          onToggleClassification={toggleClassification}
          onToggleCategory={toggleCategory}
          onToggleSubCategory={toggleSubCategory}
          materials={materials}
          selectedMaterial={selectedMaterial}
          onMaterialChange={setSelectedMaterial}
          onResetFilters={resetFilters}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* 3D Viewer */}
          <div className="flex-1 relative bg-slate-50">
            {showWelcome && !isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-slate-200 max-w-md text-center pointer-events-auto">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Box className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-light text-slate-900 mb-2">Extractor de Cantidades</h2>
                  <p className="text-slate-500 text-sm mb-8">
                    Carga un archivo <b>.frag</b> y <b>.json</b> para filtrar por parámetros integrados.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={loadSample}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                    >
                      Cargar Modelo de Ejemplo
                    </button>
                    <label className="w-full py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-50 transition-all cursor-pointer">
                      Subir Archivos
                      <input type="file" accept=".frag,.json" multiple className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>
              </div>
            )}
            
            <BIMViewer 
              onModelLoaded={handleModelLoaded} 
              elements={filteredElements}
              isLoading={isLoading}
              selectedElementId={selectedElementId || undefined}
              selectedElementIds={selectedElementIds}
              onElementSelect={setSelectedElementId}
            />

            {/* Floating Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button 
                onClick={loadSample}
                className="p-2 bg-white/90 backdrop-blur-md text-slate-700 rounded-lg shadow border border-slate-200 hover:bg-white transition-all"
                title="Cargar Ejemplo"
              >
                <Box className="w-5 h-5 text-blue-600" />
              </button>
              <label className="p-2 bg-blue-600 text-white rounded-lg shadow shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer" title="Subir Archivos">
                <Upload className="w-5 h-5" />
                <input type="file" accept=".frag,.json" multiple className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          {/* Level Grid */}
          <LevelGrid 
            levels={levels}
            selectedLevels={selectedLevels}
            onToggleLevel={toggleLevel}
          />

          {/* Data Table */}
          <div className="h-1/3 min-h-[250px] flex flex-col border-t border-slate-200">
            <DataTable 
              elements={filteredElements}
              onSelectElement={setSelectedElementId}
              selectedElementId={selectedElementId || undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
