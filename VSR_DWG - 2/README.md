# Visor DXF - Planos CAD

Un visor de archivos DXF moderno y funcional que funciona directamente en el navegador. Perfecto para visualizar planos CAD en GitHub Pages.

## 🚀 Características

- ✅ Visualización de archivos DXF directamente en el navegador
- ✅ Soporte para entidades comunes: Líneas, Círculos, Arcos, Polilíneas
- ✅ Zoom y pan interactivos (ratón y táctil)
- ✅ Interfaz moderna y responsive
- ✅ Carga de archivos por arrastrar y soltar o selección
- ✅ Sin dependencias externas pesadas
- ✅ Optimizado para GitHub Pages

## 📋 Requisitos

- Node.js 16+ (solo para desarrollo)
- Navegador moderno con soporte para ES6+

## 🛠️ Instalación

1. Clona este repositorio:
```bash
git clone <tu-repositorio>
cd VSR_DWG
```

2. Instala las dependencias:
```bash
npm install
```

3. Compila el TypeScript:
```bash
npm run build
```

## 🎯 Uso

### Desarrollo Local

1. Compila el proyecto:
```bash
npm run build
```

2. Sirve los archivos estáticos (opcional):
```bash
npm run serve
```

3. Abre `index.html` en tu navegador o visita `http://localhost:8080`

### GitHub Pages

1. Asegúrate de que todos los archivos están compilados (`npm run build`)
2. Ve a la configuración de tu repositorio en GitHub
3. Activa GitHub Pages en la sección "Pages"
4. Selecciona la rama principal (main/master) y la carpeta raíz
5. Tu visor estará disponible en `https://tu-usuario.github.io/tu-repositorio/`

## 📁 Estructura del Proyecto

```
VSR_DWG/
├── index.html          # Página principal
├── styles.css          # Estilos
├── viewer.ts           # Lógica del visor (compilado a viewer.js)
├── services/
│   ├── dxfParser.ts    # Parser DXF (compilado a services/dxfParser.js)
│   └── geminiService.ts
├── package.json        # Configuración npm
├── tsconfig.json       # Configuración TypeScript
└── README.md          # Este archivo
```

## 🎨 Funcionalidades del Visor

- **Zoom**: Rueda del mouse o botones +/-
- **Pan**: Arrastrar con el mouse o tocar y arrastrar en móviles
- **Ajustar a pantalla**: Botón para ajustar el dibujo a la ventana
- **Restablecer vista**: Volver a la vista inicial

## 🔧 Soporte de Entidades DXF

Actualmente soporta:
- ✅ LINE (Líneas)
- ✅ CIRCLE (Círculos)
- ✅ ARC (Arcos)
- ⚠️ POLYLINE / LWPOLYLINE (Básico)

## 📝 Notas

- El parser DXF es básico y puede no soportar todas las características avanzadas de DXF
- Para archivos DXF complejos, considera usar bibliotecas más completas como `dxf-parser`
- El visor funciona mejor con archivos DXF generados por AutoCAD o programas compatibles

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

MIT License - Siéntete libre de usar este proyecto como quieras.

## 🐛 Problemas Conocidos

- Polilíneas complejas pueden no renderizarse correctamente
- Algunos tipos de entidades DXF no están soportados
- Archivos DXF muy grandes pueden ser lentos de cargar

## 💡 Mejoras Futuras

- [ ] Soporte completo para POLYLINE con vértices
- [ ] Soporte para TEXT y MTEXT
- [ ] Soporte para capas (layers) con diferentes colores
- [ ] Exportar a imagen
- [ ] Medición de distancias
- [ ] Búsqueda de entidades

