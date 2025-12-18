
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("ArchView BIM: Iniciando secuencia de montaje...");

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("ArchView BIM: ERROR CRÍTICO - No se encontró el contenedor #root en el DOM.");
  throw new Error("Target container 'root' not found.");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("ArchView BIM: Renderizado inicial completado correctamente.");
} catch (error) {
  console.error("ArchView BIM: Falló el montaje de la aplicación React:", error);
  rootElement.innerHTML = `
    <div style="color: white; padding: 20px; font-family: monospace; background: #900;">
      <h2>Error de Carga</h2>
      <p>${error instanceof Error ? error.message : 'Error desconocido durante el inicio.'}</p>
      <button onclick="location.reload()" style="background: white; color: black; border: none; padding: 10px; cursor: pointer;">
        Reintentar Carga
      </button>
    </div>
  `;
}
