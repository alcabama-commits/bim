
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { getDocumentSummary, askDocumentQuestion } from '../services/gemini';

interface AiSidebarProps {
  documentText: string;
  isPdfLoaded: boolean;
  onClose?: () => void;
}

const AiSidebar: React.FC<AiSidebarProps> = ({ documentText, isPdfLoaded, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'summary'>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isPdfLoaded || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const aiResponse = await askDocumentQuestion(input, documentText, history);
    
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: aiResponse,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const handleGenerateSummary = async () => {
    if (!isPdfLoaded || isLoading) return;
    setIsLoading(true);
    const result = await getDocumentSummary(documentText);
    setSummary(result);
    setIsLoading(false);
    setActiveTab('summary');
  };

  return (
    <div className="w-96 border-l border-slate-200 bg-white flex flex-col h-full shadow-xl">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-wand-magic-sparkles text-indigo-600"></i>
            Asistente AI
          </h2>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 sm:hidden">
              <i className="fa-solid fa-times"></i>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1 text-sm rounded-md transition ${activeTab === 'chat' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Chat
            </button>
            <button 
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1 text-sm rounded-md transition ${activeTab === 'summary' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Resumen
            </button>
          </div>
          {onClose && (
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-red-500 hidden sm:block">
              <i className="fa-solid fa-times"></i>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar" ref={scrollRef}>
        {!isPdfLoaded ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center space-y-2">
            <i className="fa-solid fa-robot text-3xl opacity-20"></i>
            <p className="text-sm">Sube un PDF para habilitar la IA</p>
          </div>
        ) : activeTab === 'chat' ? (
          <>
            {messages.length === 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
                <p className="font-semibold mb-1">¡Hola! Soy tu asistente de documentos.</p>
                <p>Puedes preguntarme sobre el contenido del PDF, pedirme aclaraciones o solicitar puntos clave.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-slate-100 text-slate-800 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {!summary ? (
              <div className="flex flex-col items-center justify-center py-10">
                <button 
                  onClick={handleGenerateSummary}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-bolt"></i>
                  Generar Resumen
                </button>
                <p className="text-xs text-slate-400 mt-3 text-center px-6">
                  Analizaré el documento completo para extraerte lo más importante.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Resumen Ejecutivo</span>
                  <button onClick={() => setSummary(null)} className="text-slate-400 hover:text-red-500">
                    <i className="fa-solid fa-rotate-right"></i>
                  </button>
                </div>
                {summary}
              </div>
            )}
          </div>
        )}
      </div>

      {activeTab === 'chat' && (
        <div className="p-4 border-t border-slate-100">
          <form onSubmit={handleSendMessage} className="relative">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isPdfLoaded ? "Escribe tu pregunta..." : "Sube un archivo primero"}
              disabled={!isPdfLoaded || isLoading}
              className="w-full pl-4 pr-12 py-3 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 transition-all"
            />
            <button 
              type="submit"
              disabled={!isPdfLoaded || isLoading || !input.trim()}
              className="absolute right-2 top-1.5 w-9 h-9 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <i className="fa-solid fa-paper-plane text-xs"></i>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AiSidebar;