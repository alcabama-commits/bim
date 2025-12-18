
import { GoogleGenAI } from "@google/genai";

// Función auxiliar para obtener la key de forma segura en el navegador
const getApiKey = () => {
  try {
    return (window as any).process?.env?.API_KEY || (process as any)?.env?.API_KEY || "";
  } catch {
    return "";
  }
};

export const getDocumentSummary = async (text: string): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return "API Key no configurada.";
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Eres un asistente experto en arquitectura y construcción. Resume técnicamente este contenido extraído de un plano o memoria descriptiva: \n\n${text.substring(0, 30000)}`,
    });
    return response.text || "No se pudo generar el resumen.";
  } catch (error) {
    console.error("Error en resumen:", error);
    return "Error al conectar con la IA.";
  }
};

export const askDocumentQuestion = async (
  question: string, 
  documentContext: string,
  history: any[]
): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return "API Key no disponible.";

    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: `Eres un asistente experto BIM/Arquitectura. 
        Analiza el contexto del plano para responder dudas técnicas sobre materiales, medidas o especificaciones.
        
        CONTEXTO:
        ${documentContext.substring(0, 25000)}`,
      }
    });

    const response = await chat.sendMessage({ message: question });
    return response.text || "Sin respuesta disponible.";
  } catch (error) {
    console.error("Error en chat:", error);
    return "Error en la consulta de IA.";
  }
};