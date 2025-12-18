
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getDocumentSummary = async (text: string): Promise<string> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Eres un asistente experto en análisis de documentos. Por favor, resume el siguiente texto extraído de un PDF de forma concisa pero informativa en español: \n\n${text.substring(0, 30000)}`,
    });
    return response.text || "No se pudo generar el resumen.";
  } catch (error) {
    console.error("Error in getDocumentSummary:", error);
    return "Error al conectar con la IA para el resumen.";
  }
};

export const askDocumentQuestion = async (
  question: string, 
  documentContext: string,
  history: { role: string; parts: { text: string }[] }[]
): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: `Eres un asistente experto que responde preguntas sobre un documento PDF específico. 
        Usa el siguiente contexto para responder las preguntas del usuario en español. 
        Si la respuesta no está en el contexto, indícalo educadamente pero intenta ayudar con lo que sepas del tema general.
        
        CONTEXTO DEL DOCUMENTO:
        ${documentContext.substring(0, 25000)}`,
      }
    });

    const response = await chat.sendMessage({ message: question });
    return response.text || "No tengo una respuesta para eso.";
  } catch (error) {
    console.error("Error in askDocumentQuestion:", error);
    return "Lo siento, hubo un error al procesar tu pregunta.";
  }
};
