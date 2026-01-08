
import { GoogleGenerativeAI } from "@google/generative-ai";

export const getDocumentSummary = async (text: string): Promise<string> => {
  try {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) {
      return "Error: API Key no configurada. Por favor contacta al administrador.";
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const prompt = `Eres un asistente experto en arquitectura y construcción. Resume técnicamente este contenido extraído de un plano o memoria descriptiva: \n\n${text.substring(0, 30000)}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error en resumen:", error);
    return "Error al conectar con la IA de Google.";
  }
};

export const askDocumentQuestion = async (
  question: string, 
  documentContext: string,
  history: any[]
): Promise<string> => {
  try {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) {
      return "Error: API Key no configurada. Por favor contacta al administrador.";
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      systemInstruction: `Eres un asistente experto BIM/Arquitectura. 
      Analiza el contexto del plano para responder dudas técnicas sobre materiales, medidas o especificaciones.
      
      CONTEXTO DEL DOCUMENTO:
      ${documentContext.substring(0, 25000)}`
    });

    // Transform history to Gemini format if needed, but for now we start fresh chat with context
    // or use history correctly. 
    // Gemini SDK history format: { role: "user" | "model", parts: [{ text: "..." }] }
    
    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.parts?.[0]?.text || h.content || "" }] // Adapt based on input history structure
      })),
    });

    const result = await chat.sendMessage(question);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error en chat:", error);
    return "Error en la consulta de IA. Verifica tu conexión o intenta más tarde.";
  }
};
