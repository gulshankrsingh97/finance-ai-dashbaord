import React, { useState, useRef, useEffect } from 'react';
import { MdChat } from 'react-icons/md';
import { FiSearch, FiSettings } from 'react-icons/fi';
import { FaCompass, FaRobot } from 'react-icons/fa';
import { MdPerson } from 'react-icons/md';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatWithLocalAI } from '../mcpKiteApi.js';

function AssistantPanel() {
    const chatRef = useRef(null);
    const [llmStatus, setLlmStatus] = useState('unknown'); // 'unknown' | 'connected' | 'down'
    const [showSettings, setShowSettings] = useState(false);
    const [modelProvider, setModelProvider] = useState(() => {
        return localStorage.getItem('ai_model_provider') || 'local';
    });
    const [testResult, setTestResult] = useState('');
    const [messages, setMessages] = useState([
        {
            sender: 'assistant',
            content: `
👋 Hello! I'm your AI financial assistant. I can help you:

- Analyze market data and trends
- Search for financial information  
- Navigate websites and perform actions
- Answer questions about the markets

How can I assist you today?
      `
        }
    ]);
    const [input, setInput] = useState('');
    const [intent, setIntent] = useState('chat');
    const [isTyping, setIsTyping] = useState(false);

    const testConnection = async () => {
        try {
            if (modelProvider === 'cloud') {
                setTestResult('Cloud test: placeholder. Configure cloud backend to enable live test.');
                setLlmStatus('unknown');
                return;
            }
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);
            const resp = await fetch('http://localhost:3001/health', { signal: controller.signal });
            clearTimeout(timeout);
            if (resp.ok) {
                const data = await resp.json().catch(() => ({}));
                setTestResult('✅ Local AI reachable: ' + (data?.ai_backend || 'ok'));
                setLlmStatus('connected');
            } else {
                setTestResult('❌ Local AI not reachable: HTTP ' + resp.status);
                setLlmStatus('down');
            }
        } catch (e) {
            setTestResult('❌ Local AI test error: ' + (e?.message || String(e)));
            setLlmStatus('down');
        }
    };

    useEffect(() => { testConnection(); /* initial probe */ }, []);

    const handleSend = async () => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
        if (!input.trim()) return;
        const userMsg = { sender: 'user', content: input };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setIsTyping(true);
        setInput('');
        try {
            const historyForApi = newMessages.map(m => ({
                role: m.sender === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));
            const aiResult = await chatWithLocalAI(
                historyForApi,
                { model: modelProvider === 'cloud' ? 'gemini-2.5' : 'openai-oss' }
            );
            setMessages(prev => [
                ...prev,
                { sender: 'assistant', content: aiResult.content }
            ]);
        } catch (err) {
            setMessages(prev => [
                ...prev,
                { sender: 'assistant', content: "⚠️ AI error:\n" + (err.message || "LLM unavailable") }
            ]);
        }
        setIsTyping(false);
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    };

    return (
        <div className="assistant-panel">
            {/* Header */}
            <div className="assistant-header" style={{ display:'flex', alignItems:'center', gap:10 }}>
                <FaRobot style={{ fontSize: 28, color:'#38bdf8', flexShrink:0 }} />
                <h2 style={{ margin:0, fontWeight:700, fontSize:'1.25em', letterSpacing:'0.01em' }}>FinanceGPT</h2>
                {/* Connection pill */}
                <button
                    onClick={testConnection}
                    className="btn btn--sm"
                    title={llmStatus==='connected' ? 'LLM connected' : llmStatus==='down' ? 'LLM down' : 'LLM status unknown'}
                    style={{
                        marginLeft:8,
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        padding:'4px', borderRadius:999,
                        width:18, height:18,
                        background:'transparent', border:'none'
                    }}
                >
          <span style={{
              width:10, height:10, borderRadius:'50%',
              background: llmStatus==='connected' ? '#22c55e' : (llmStatus==='down' ? '#ef4444' : '#94a3b8'),
              boxShadow:'0 0 0 3px rgba(0,0,0,0.06)'
          }} />
                </button>
                {/* Controls */}
                <div className="assistant-controls" style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                    <button className="btn btn--sm btn--secondary" onClick={() => setMessages([])}>Clear</button>
                    <button className="btn btn--sm btn--secondary" title="Settings" onClick={() => setShowSettings(true)} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                        <FiSettings size={16}/> Settings
                    </button>
                </div>
            </div>

            {/* Chat Messages */}
            <div className="assistant-content" style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
                <div className="chat-messages" id="chatMessages" ref={chatRef} style={{ overflowY:'auto', flex:1, minHeight:0 }}>
                    {messages.map((msg, index) => {
                        // auto-scroll on new message
                        if (index === messages.length - 1 && chatRef.current) {
                            setTimeout(() => { chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 0);
                        }
                        const isAI = msg.sender==='assistant';
                        // detect action URLs
                        let isActionMode = false;
                        let openAction = null;
                        if (isAI && typeof msg.content==='string') {
                            const actionPattern = /\{[^}]*"id"\s*:\s*"([^"]+)"[^}]*"actionType"\s*:\s*"([^"]+)"[^}]*"url"\s*:\s*"([^"]+)"[^}]*\}/;
                            const actionCmdMatch = msg.content.match(actionPattern);
                            if (actionCmdMatch) {
                                isActionMode = true;
                                openAction = {
                                    label: actionCmdMatch[2].toLowerCase().includes('open') ? 'Open in new tab' : 'Perform Action',
                                    url: actionCmdMatch[3]
                                };
                            } else {
                                const jsonCmdMatch = msg.content.match(/\{[^}]*"id"\s*:\s*"([^"]+)"[^}]*"source"\s*:\s*"([^"]+)"[^}]*\}/);
                                if (jsonCmdMatch) {
                                    try {
                                        const block = JSON.parse(jsonCmdMatch[0]);
                                        if (block && block.source && /^https?:\/\//.test(block.source)) {
                                            openAction = {
                                                label: block.id && block.id.toLowerCase().includes('search') ? 'Search and open' : 'Open in new tab',
                                                url: block.source
                                            };
                                        }
                                    } catch {
                                        openAction = {
                                            label: jsonCmdMatch[1] && jsonCmdMatch[1].toLowerCase().includes('search') ? 'Search and open' : 'Open in new tab',
                                            url: jsonCmdMatch[2]
                                        };
                                    }
                                } else {
                                    const urlMatch = msg.content.match(/https?:\/\/[^\s"<]+/);
                                    if (urlMatch) {
                                        openAction = { label:'Open in new tab', url: urlMatch[0] };
                                    }
                                }
                            }
                        }
                        // Auto-open if action detected
                        if (isAI && isActionMode && openAction?.url) {
                            setTimeout(() => { window.open(openAction.url, '_blank'); }, 300);
                        }
                        return (
                            <div key={index}
                                 className={`message ${isAI?'ai-message':'user-message'}`}
                                 style={{
                                     display:'flex',
                                     alignItems:'flex-end',
                                     justifyContent: isAI?'flex-start':'flex-end',
                                     gap:10,
                                     marginBottom:18,
                                     width:'100%'
                                 }}
                            >
                                {isAI && (
                                    <span style={{
                                        background:'#e0f2fe',
                                        borderRadius:'50%',
                                        padding:5,
                                        display:'flex',
                                        alignItems:'center',
                                        boxShadow:'0 1px 8px #38bdf835'
                                    }} >
                    <FaRobot size={20} style={{ color:'#38bdf8' }} />
                  </span>
                                )}
                                {isAI && isActionMode ? (
                                    // simple acknowledgment
                                    <div className="message-content" style={{
                                        background:'linear-gradient(90deg,#e0f2fe 70%,#bae6fd 100%)',
                                        color:'#334155',
                                        borderRadius:'16px 16px 16px 6px',
                                        boxShadow:'0 2px 16px #0002',
                                        padding:'11px 17px',
                                        fontSize:15.1,
                                        fontWeight:460,
                                        maxWidth:'calc(100% - 56px)',
                                        overflowX:'auto',
                                        whiteSpace:'normal',
                                        textAlign:'left'
                                    }}>
                                        Action performed.
                                    </div>
                                ) : (
                                    <>
                                        <div className="message-content" style={{
                                            background: isAI ? 'linear-gradient(90deg,#e0f2fe 70%,#bae6fd 100%)' : 'linear-gradient(90deg,#23272f 85%,#0ea5e9 100%)',
                                            color: isAI ? '#334155' : '#fff',
                                            borderRadius: isAI ? '16px 16px 16px 6px' : '16px 16px 6px 16px',
                                            boxShadow:'0 2px 16px #0002',
                                            padding:'11px 17px',
                                            fontSize:15.1,
                                            fontWeight:460,
                                            maxWidth:'calc(100% - 56px)',
                                            overflowX:'auto',
                                            whiteSpace:'normal',
                                            textAlign:'left'
                                        }}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                        </div>
                                        {isAI && openAction && (
                                            <button
                                                className="btn btn--sm btn--primary"
                                                style={{marginLeft:12, alignSelf:'center', padding:'6px 12px', fontSize:13.2, cursor:'pointer', borderRadius:7}}
                                                onClick={() => window.open(openAction.url, '_blank')}
                                            >
                                                {openAction.label}
                                            </button>
                                        )}
                                    </>
                                )}
                                {!isAI && (
                                    <span style={{
                                        background:'#23272f',
                                        borderRadius:'50%',
                                        padding:5,
                                        display:'flex',
                                        alignItems:'center',
                                        boxShadow:'0 1px 8px #0ea5e93a'
                                    }}>
                    <MdPerson size={20} style={{ color:'#38bdf8' }} />
                  </span>
                                )}
                            </div>
                        );
                    })}
                    {isTyping && <div className="message assistant-message typing-indicator">Typing...</div>}
                    {isTyping && chatRef.current && (() => { chatRef.current.scrollTop = chatRef.current.scrollHeight; })()}
                </div>

                {/* Input area */}
                <div className="chat-input-section" style={{padding: '12px', background: 'rgba(15, 19, 32, 0.8)', borderTop: '1px solid #2a3346'}}>
                    <div className="intent-buttons" style={{
                        display:'flex',
                        gap:8,
                        marginBottom:10,
                        flexWrap:'nowrap',
                        justifyContent:'flex-start'
                    }}>
                        <button
                            className={`intent-btn ${intent === 'chat' ? 'active' : ''}`}
                            onClick={() => setIntent('chat')}
                            style={{
                                display:'flex',
                                alignItems:'center',
                                gap:4,
                                padding:'6px 12px',
                                fontSize:'13px',
                                borderRadius:'6px',
                                border: intent === 'chat' ? '1px solid #0ea5e9' : '1px solid #374151',
                                background: intent === 'chat' ? '#0ea5e9' : 'transparent',
                                color: intent === 'chat' ? '#fff' : '#9ca3af',
                                cursor:'pointer',
                                transition:'all 0.2s',
                                whiteSpace:'nowrap',
                                flexShrink:0
                            }}
                        >
                            <MdChat size={16} /> Chat
                        </button>
                        <button
                            className={`intent-btn ${intent === 'search' ? 'active' : ''}`}
                            onClick={() => setIntent('search')}
                            style={{
                                display:'flex',
                                alignItems:'center',
                                gap:4,
                                padding:'6px 12px',
                                fontSize:'13px',
                                borderRadius:'6px',
                                border: intent === 'search' ? '1px solid #0ea5e9' : '1px solid #374151',
                                background: intent === 'search' ? '#0ea5e9' : 'transparent',
                                color: intent === 'search' ? '#fff' : '#9ca3af',
                                cursor:'pointer',
                                transition:'all 0.2s',
                                whiteSpace:'nowrap',
                                flexShrink:0
                            }}
                        >
                            <FiSearch size={16} /> Search
                        </button>
                        <button
                            className={`intent-btn ${intent === 'navigate' ? 'active' : ''}`}
                            onClick={() => setIntent('navigate')}
                            style={{
                                display:'flex',
                                alignItems:'center',
                                gap:4,
                                padding:'6px 12px',
                                fontSize:'13px',
                                borderRadius:'6px',
                                border: intent === 'navigate' ? '1px solid #0ea5e9' : '1px solid #374151',
                                background: intent === 'navigate' ? '#0ea5e9' : 'transparent',
                                color: intent === 'navigate' ? '#fff' : '#9ca3af',
                                cursor:'pointer',
                                transition:'all 0.2s',
                                whiteSpace:'nowrap',
                                flexShrink:0
                            }}
                        >
                            <FaCompass size={16} /> Navigate
                        </button>
                    </div>
                    <div className="input-group" style={{
                        display:'flex',
                        gap:8,
                        alignItems:'center'
                    }}>
                        <input
                            type="text"
                            className="form-control"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask about markets, search, or request actions..."
                            style={{
                                flex:1,
                                padding:'10px 14px',
                                borderRadius:'8px',
                                border:'1px solid #374151',
                                background:'#1f2937',
                                color:'#fff',
                                fontSize:'14px'
                            }}
                        />
                        <button
                            className="btn btn--primary"
                            onClick={handleSend}
                            style={{
                                padding:'10px 16px',
                                borderRadius:'8px',
                                background:'#0ea5e9',
                                border:'none',
                                color:'#fff',
                                fontSize:'14px',
                                fontWeight:'500',
                                cursor:'pointer',
                                flexShrink:0,
                                minWidth:'60px'
                            }}
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>

            {/* Status */}
            <div className="assistant-status" style={{ display:'flex', justifyContent:'space-around', padding:'8px', background:'#f9fafb' }}>
                <div>
                    <span className="status-label">Model:</span> <span className="status-value">{modelProvider==='cloud' ? 'Gemini 2.5 (Cloud)' : 'Open AI OSS (Local)'}</span>
                </div>
                <div>
                    <span className="status-label">Connection:</span> <span className="status-value">{llmStatus==='connected' ? 'Active' : llmStatus==='down' ? 'Connection error' : 'Inactive'}</span>
                </div>
            </div>

            {/* Settings modal */}
            {showSettings && (
                <div style={{
                    position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999
                }} onClick={() => setShowSettings(false)}>
                    <div style={{ width:420, background:'#0f1320', border:'1px solid #2a3346', padding:20, borderRadius:8 }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginBottom:12 }}>AI Settings</h3>
                        {/* Model provider */}
                        <div style={{ marginBottom:12 }}>
                            <div style={{ marginBottom:8 }}>Select AI Model Provider</div>
                            <div style={{ display:'flex', gap:10 }}>
                                <button
                                    style={{ padding:'4px 8px', borderRadius:4, border: modelProvider==='local' ? '2px solid #2563eb' : '1px solid #ccc', background:'#fff', cursor:'pointer' }}
                                    onClick={() => { setModelProvider('local'); localStorage.setItem('ai_model_provider','local'); }}
                                >
                                    Open AI OSS
                                </button>
                                <button
                                    style={{ padding:'4px 8px', borderRadius:4, border: modelProvider==='cloud' ? '2px solid #2563eb' : '1px solid #ccc', background:'#fff', cursor:'pointer' }}
                                    onClick={() => { setModelProvider('cloud'); localStorage.setItem('ai_model_provider','cloud'); }}
                                >
                                    Gemini 2.5 (Cloud)
                                </button>
                            </div>
                        </div>
                        {/* Mode toggle */}
                        <div style={{ marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
                            <div>Local</div>
                            <label style={{ position:'relative', display:'inline-block', width:50, height:26 }}>
                                <input type="checkbox" checked={modelProvider==='cloud'} onChange={(e) => {
                                    const val = e.target.checked ? 'cloud' : 'local';
                                    setModelProvider(val);
                                    localStorage.setItem('ai_model_provider', val);
                                }} style={{ display:'none' }} />
                                <span style={{
                                    position:'absolute', top:0, left:0, right:0, bottom:0,
                                    background: modelProvider==='cloud' ? '#0ea5e9' : '#334155',
                                    borderRadius:26,
                                    transition:'.2s',
                                    cursor:'pointer'
                                }}></span>
                                <span style={{
                                    position:'absolute', height:22, width:22,
                                    left: modelProvider==='cloud' ? 26 : 2,
                                    top:2,
                                    background:'#fff',
                                    borderRadius:'50%',
                                    transition:'.2s'
                                }}></span>
                            </label>
                            <div>Cloud</div>
                        </div>
                        {/* Test & Save buttons */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                            <button style={{ padding:'4px 8px', borderRadius:4, background:'#2563eb', color:'#fff', border:'none' }} onClick={testConnection}>Test Connection</button>
                            <div style={{ fontSize:12, color:'#9ca3af' }}>{testResult}</div>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                            <button style={{ padding:'4px 8px', borderRadius:4, border:'1px solid #ccc', background:'#fff' }} onClick={() => setShowSettings(false)}>Back</button>
                            <button style={{ padding:'4px 8px', borderRadius:4, background:'#2563eb', color:'#fff', border:'none' }} onClick={() => {
                                setMessages(prev => [...prev, { sender:'assistant', content:`✅ Model set to **${modelProvider==='cloud' ? 'Gemini 2.5 (Cloud)' : 'Open AI OSS (Local)'}**. You can continue chatting.` }]);
                                setShowSettings(false);
                            }}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AssistantPanel;
