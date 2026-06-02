import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

const getOrCreateDeviceId = () => {
  let deviceId = localStorage.getItem('cmg_chat_device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('cmg_chat_device_id', deviceId);
  }
  return deviceId;
};

const LiveChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const savedMessages = localStorage.getItem('cmg_chat_messages');
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
        } catch (e) {
          console.error('Failed to parse messages', e);
        }
      }
    }
    return [
      { id: '1', sender: 'bot', text: 'สวัสดีครับ IT Support ยินดีให้บริการ มีอะไรให้ช่วยเหลือไหมครับ?', timestamp: new Date() }
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [pendingRequests, setPendingRequests] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Webhook URL
  const WEBHOOK_URL = 'https://n8n.cmgai.online/webhook/livechat'; 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Save messages to LocalStorage whenever they change
  useEffect(() => {
    localStorage.setItem('cmg_chat_messages', JSON.stringify(messages));
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputValue,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue('');
    setPendingRequests(prev => prev + 1);

    try {
      // Webhook Call
      const deviceId = getOrCreateDeviceId();
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: newUserMessage.text,
          deviceId: deviceId
        })
      });
      
      let botText = 'เราได้รับข้อความของคุณแล้ว กำลังส่งเรื่องให้ทีมงานตรวจสอบครับ';
      try {
        const data = await response.json();
        // n8n returns the response in the "output" field based on the setup
        if (data && data.output) {
          botText = data.output;
        } else if (data && data.text) {
          botText = data.text;
        }
      } catch (err) {
        console.error('Failed to parse webhook response', err);
      }
      
      const botResponse: Message = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        sender: 'bot',
        text: botText,
        timestamp: new Date()
      };
      
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error('Webhook error:', error);
      const errorMsg: Message = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        sender: 'bot',
        text: 'ขออภัย ไม่สามารถส่งข้อความได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setPendingRequests(prev => Math.max(0, prev - 1));
    }
  };

  return (
    <>
      {/* Floating Button Container */}
      <div className="fixed bottom-6 right-6 z-[1000] flex items-center justify-center">
        {/* Strobe Effect */}
        {!isOpen && (
          <div className="absolute inset-0 rounded-2xl border-[3px] border-[#F26522] animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-75 pointer-events-none"></div>
        )}
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative shadow-2xl transition-all duration-300 flex items-center justify-center hover:scale-105 ${
            isOpen ? 'bg-error text-white rotate-90 p-4 rounded-full w-16 h-16 overflow-hidden' : 'bg-transparent p-0 rounded-2xl'
          }`}
          style={{
              boxShadow: isOpen ? '0 10px 25px -5px rgba(239, 68, 68, 0.4)' : '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
          }}
        >
          {isOpen ? (
            <span className="material-symbols-outlined text-[32px] transition-transform">
              close
            </span>
          ) : (
            <img 
              src="/live-chat-icon.jpg" 
              alt="Live Chat" 
              className="w-32 sm:w-40 h-auto object-contain rounded-2xl" 
            />
          )}
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[350px] max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col z-[1000] h-[500px] max-h-[calc(100vh-8rem)] animate-[fadeIn_0.2s_ease-out] border border-slate-100 flex flex-col">
          {/* Header */}
          <div className="bg-[#F26522] p-4 text-white flex items-center justify-between shadow-md relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <span className="material-symbols-outlined text-white">support_agent</span>
              </div>
              <div>
                <h3 className="font-bold font-display text-lg leading-tight">Live Chat</h3>
                <p className="text-white/80 text-xs font-body">Online - พร้อมให้บริการ</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">expand_more</span>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4 font-body scrollbar-hide">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                    msg.sender === 'user' 
                      ? 'bg-[#27619D] text-white rounded-tr-none' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                  <div className={`text-[10px] mt-1 text-right ${msg.sender === 'user' ? 'text-white/70' : 'text-slate-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {pendingRequests > 0 && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-[#F26522] rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-[#F26522] rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-2 h-2 bg-[#F26522] rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100 z-10">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="พิมพ์ข้อความ..."
                className="flex-1 px-4 py-2.5 bg-slate-100 border-none rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#F26522]/50 font-body placeholder:text-slate-400 text-slate-700"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="w-10 h-10 bg-[#F26522] text-white rounded-full flex items-center justify-center hover:bg-[#e05a1d] transition-colors disabled:opacity-50 shadow-md shrink-0"
              >
                <span className="material-symbols-outlined text-[20px] ml-1">send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default LiveChat;
