import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Key, Eye, EyeOff, X, Trash2, Settings, MessageSquare, AlertCircle } from 'lucide-react';

export default function DocumentQA({ docType, fileName, rawText }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('extrkt_gemini_api_key') || '');
  const [tempKey, setTempKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(!localStorage.getItem('extrkt_gemini_api_key'));
  
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const chatEndRef = useRef(null);

  // Clear chat if filename changes (user uploaded a new file)
  useEffect(() => {
    setMessages([]);
    setErrorMsg('');
  }, [fileName]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSaveKey = (e) => {
    e.preventDefault();
    if (!tempKey.trim()) return;
    localStorage.setItem('extrkt_gemini_api_key', tempKey.trim());
    setApiKey(tempKey.trim());
    setIsEditingKey(false);
    setErrorMsg('');
  };

  const handleClearKey = () => {
    localStorage.removeItem('extrkt_gemini_api_key');
    setApiKey('');
    setTempKey('');
    setIsEditingKey(true);
    setMessages([]);
  };

  const handleSendMessage = async (textToSend) => {
    const query = textToSend.trim();
    if (!query || isProcessing) return;

    if (!apiKey) {
      setErrorMsg('Please save a valid Gemini API Key first.');
      return;
    }

    // Add user message
    const userMsg = { id: Date.now() + '-user', role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsProcessing(true);
    setErrorMsg('');

    try {
      const promptText = `You are a professional document analysis AI.
You are helping the user find information in the following extracted document text.

Document Type: ${docType}
File Name: ${fileName}

Document Extracted Text:
"""
${rawText || 'No text extracted.'}
"""

User Question: ${query}

Instructions:
1. Answer the question accurately and directly based ONLY on the document text provided above.
2. If the information is not in the text, say: "I cannot find this information in the document." Do not make things up.
3. Be concise and professional. Use bullet points if listing multiple items.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: promptText }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024,
            },
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const specificError = errData?.error?.message || `HTTP error ${response.status}`;
        throw new Error(specificError);
      }

      const responseData = await response.json();
      const aiText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text received.';
      
      setMessages(prev => [...prev, { id: Date.now() + '-ai', role: 'ai', text: aiText }]);
    } catch (err) {
      console.error('AI Q&A Error:', err);
      setErrorMsg(err.message || 'Failed to communicate with AI. Please check your internet connection and API key.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatResponseText = (text) => {
    if (!text) return '';
    
    // Custom lightweight markdown line-by-line renderer
    return text.split('\n').map((line, idx) => {
      let content = line;
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      if (isBullet) {
        content = content.trim().substring(2);
      }
      
      const parts = content.split('**');
      const renderedParts = parts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <strong key={pIdx} className="font-extrabold text-[#0f172a]">{part}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <li key={idx} className="ml-4 list-disc pl-1 text-slate-700 my-0.5 font-medium leading-relaxed text-sm">
            {renderedParts}
          </li>
        );
      }

      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-slate-700 font-medium leading-relaxed text-sm my-1">
          {renderedParts}
        </p>
      );
    });
  };

  const getSuggestions = () => {
    if (docType === 'paycheck') {
      return [
        "Summarize tax deductions",
        "What is the employer name?",
        "Verify hourly rate and check date"
      ];
    } else if (docType === 'card') {
      return [
        "List transactions over $100",
        "Find the largest purchase",
        "Are there any interest or late fees?"
      ];
    } else {
      return [
        "Identify the merchant category",
        "Is this transaction normal?",
        "Summarize the transaction details"
      ];
    }
  };

  return (
    <div className="qa-card w-full bg-white border border-[#e6e5e0] rounded-2xl p-5 shadow-sm transition-all duration-300">
      {/* QA Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#e6e5e0] mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600 animate-pulse" />
          <h3 className="font-extrabold text-xs tracking-wider text-slate-800 uppercase">ASK DOCUMENT AI</h3>
        </div>
        
        {apiKey && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingKey(prev => !prev)}
              className="qa-icon-btn"
              title="API Settings"
            >
              <Settings size={14} className="text-slate-500 hover:text-slate-800 animate-spin-hover" />
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="qa-icon-btn"
                title="Clear Chat"
              >
                <Trash2 size={14} className="text-red-500 hover:text-red-700" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Editing Key Mode / Set API Key View */}
      {isEditingKey ? (
        <div className="py-4 space-y-4">
          <div className="text-slate-600 text-xs sm:text-sm font-medium leading-relaxed">
            Instant AI Q&A search for this document runs client-side. Please enter your <strong>Gemini API Key</strong> below. It's saved locally and never sent to any external server other than Google's Gemini API.
          </div>
          
          <form onSubmit={handleSaveKey} className="space-y-3">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="Enter Gemini API Key..."
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                className="qa-key-input w-full pr-10 pl-9 py-2 border border-[#cbd5e1] rounded-xl text-sm focus:border-slate-500 outline-none"
              />
              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="submit"
                disabled={!tempKey.trim()}
                className="qa-action-btn py-2 px-5 bg-white border-1.5 border-black text-black font-extrabold text-xs tracking-wider uppercase rounded-xl disabled:opacity-35 disabled:pointer-events-none w-full sm:w-auto"
              >
                Save API Key
              </button>
              {apiKey && (
                <button
                  type="button"
                  onClick={() => setIsEditingKey(false)}
                  className="qa-cancel-btn py-2 px-5 bg-slate-100 text-slate-600 font-extrabold text-xs tracking-wider uppercase rounded-xl w-full sm:w-auto"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="pt-2">
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline flex items-center gap-1"
            >
              Get a Free Gemini API Key from Google AI Studio &rarr;
            </a>
          </div>
        </div>
      ) : (
        /* Q&A Chat Feed View */
        <div className="space-y-4">
          <div className="qa-chat-area flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
                <MessageSquare size={24} className="mb-2 text-slate-300" />
                <p className="text-xs font-semibold tracking-wide uppercase">Ask anything about this document</p>
                <p className="text-xs mt-1 max-w-[280px]">Ask standard or custom questions to instantly search the extracted text.</p>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <div className={`qa-msg-bubble px-3.5 py-2.5 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-slate-100 border border-[#cbd5e1] text-slate-800 rounded-tr-sm'
                      : 'bg-indigo-50/50 border border-indigo-100 text-slate-800 rounded-tl-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="font-semibold text-[#0f172a]">{msg.text}</p>
                    ) : (
                      <div className="space-y-1">{formatResponseText(msg.text)}</div>
                    )}
                  </div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-1 px-1">
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </span>
                </div>
              ))
            )}

            {isProcessing && (
              <div className="flex flex-col max-w-[85%] self-start items-start">
                <div className="qa-msg-bubble px-4 py-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 rounded-tl-sm flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-1 px-1">
                  AI is thinking
                </span>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Quick Query Suggestion Chips */}
          {messages.length === 0 && !isProcessing && (
            <div className="space-y-2 pt-2">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Suggestions</span>
              <div className="flex flex-wrap gap-2">
                {getSuggestions().map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(sug)}
                    className="qa-chip text-left text-xs font-bold border border-[#cbd5e1] hover:border-black rounded-lg px-2.5 py-1.5 transition-colors duration-150 text-slate-700 bg-white"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* User Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputVal);
            }}
            className="flex gap-2 items-center border-t border-[#e6e5e0] pt-3 mt-2"
          >
            <input
              type="text"
              placeholder="Ask a question..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isProcessing}
              className="qa-chat-input flex-1 px-3.5 py-2.5 bg-slate-50 border border-[#e6e5e0] focus:border-[#cbd5e1] rounded-xl text-sm outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || isProcessing}
              className="qa-send-btn p-2.5 bg-black hover:bg-slate-800 text-white rounded-xl disabled:opacity-30 disabled:hover:bg-black transition-colors shrink-0"
              title="Send question"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-600 text-xs font-semibold animate-fade-in-up">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="block mb-1">Error processing request:</span>
            <span className="font-medium text-red-500">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
