import React, { useState } from 'react';
import { MdChat } from 'react-icons/md';
import { FiSearch, FiSettings } from 'react-icons/fi';
import { FaCompass } from 'react-icons/fa';
import { FaRobot } from 'react-icons/fa';
import { MdPerson } from 'react-icons/md';
import { chatWithLocalAI } from '../mcpKiteApi.js';

function AssistantPanel() {
  const [showSettings, setShowSettings] = useState(false);
  const [modelProvider, setModelProvider] = useState(() => {
    return localStorage.getItem('ai_model_provider') || 'local';
  });
  const [testResult, setTestResult] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      content: `
        <p>👋 Hello! I'm your AI financial assistant. I can help you:</p>
        <ul>
          <li>Analyze market data and trends</li>
          <li>Search for financial information</li>
          <li>Navigate websites and perform actions</li>
          <li>Answer questions about the markets</li>
        </ul>
        <p>How can I assist you today?</p>
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
        return;
      }
      const resp = await fetch('http://localhost:3001/health');
      if (resp.ok) {
        const data = await resp.json().catch(()=>({}));
        setTestResult('✅ Local AI reachable: ' + (data?.ai_backend || 'ok'));
      } else {
        setTestResult('❌ Local AI not reachable: HTTP ' + resp.status);
      }
    } catch (e) {
      setTestResult('❌ Local AI test error: ' + (e?.message || String(e)));
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsTyping(true);
    setInput('');
    try {
      // Prepare messages as OpenAI format for LLM
      const historyForApi = newMessages.map(m => ({
        role: m.sender === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));
      const aiResult = await chatWithLocalAI(historyForApi, { model: modelProvider==='cloud' ? 'gemini-2.5' : 'openai-oss' });
      setMessages(prev => [
        ...prev,
        { sender: 'assistant', content: aiResult.content }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { sender: 'assistant', content: "<span style='color:crimson'>⚠️ AI error:<br/>" + (err.message || "LLM unavailable") + "</span>" }
      ]);
    }
    setIsTyping(false);
  };

  return (
    <div className="assistant-panel">
      <div className="assistant-header" style={{display:'flex',alignItems:'center',gap:10}}>
        <FaRobot style={{fontSize: 28, color:'#38bdf8', flexShrink:0}} />
        <h2 style={{margin:0,fontWeight:700,fontSize:'1.25em',letterSpacing:'0.01em'}}>FinanceGPT</h2>
        <div className="assistant-controls" style={{marginLeft:'auto', display:'flex', gap:8}}>
                  <button className="btn btn--sm btn--secondary" onClick={() => setMessages([])}>Clear</button>
                  <button className="btn btn--sm btn--secondary" title="Settings" onClick={() => setShowSettings(true)} style={{display:'inline-flex',alignItems:'center',gap:6}}>
                    <FiSettings size={16}/> Settings
                  </button>
                </div>
      </div>

      <div className="assistant-content">
        <div className="chat-messages" id="chatMessages">
          {messages.map((msg, index) => {
            const isAI = msg.sender === 'assistant';
            // Determine if this message is an "action", to display differently and perform immediately
            let isActionMode = false;
            let openAction = null;
            // Attempt to recognize explicit action format (such as browser.open with a url)
            if (isAI && typeof msg.content === 'string') {
              // Try match for generic action pattern (ex: { "id":"...", "actionType":"browser.open", "url":"..." })
              const actionPattern = /\{[^}]*"id"\s*:\s*"([^"]+)"[^}]*"actionType"\s*:\s*"([^"]+)"[^}]*"url"\s*:\s*"([^"]+)"[^}]*\}/;
              const actionCmdMatch = msg.content.match(actionPattern);
              if (actionCmdMatch) {
                // Only treat as action if there is a clear actionType (browser.open/open)
                isActionMode = true;
                openAction = {
                  label: actionCmdMatch[2].toLowerCase().includes('open') ? 'Open in new tab' : 'Perform Action',
                  url: actionCmdMatch[3]
                };
              } else {
                // Fallback: check for generic source url JSON, but do NOT auto-action
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
                  // Fallback: look for plain URL as single line—never auto-action
                  const urlMatch = msg.content.match(/https?:\/\/[^\s"<]+/);
                  if (urlMatch) {
                    openAction = {
                      label: 'Open in new tab',
                      url: urlMatch[0]
                    };
                  }
                }
              }
            }
            // If message is an explicit action (with actionType), perform and just show concise text
            if (isAI && isActionMode && openAction && openAction.url) {
              // Perform action as soon as rendered (auto-open tab)
              setTimeout(()=>window.open(openAction.url, '_blank'), 300);
            }
            return (
              <div
                key={index}
                className={`message ${isAI ? 'ai-message' : 'user-message'}`}
                style={{
                  display:'flex',
                  alignItems:'flex-end',
                  justifyContent: isAI ? 'flex-start' : 'flex-end',
                  gap:10,
                  marginBottom:18,
                  width: '100%'
                }}
              >
                {isAI && (
                  <span
                    style={{
                      background: '#e0f2fe',
                      borderRadius: '50%',
                      padding: 5,
                      display: 'flex',
                      alignItems: 'center',
                      boxShadow: '0 1px 8px #38bdf835'
                    }}
                  >
                    <FaRobot size={20} style={{ color: '#38bdf8'}} />
                  </span>
                )}
                {isAI && isActionMode ? (
                  // concise acknowledgement for action
                  <div
                    className="message-content"
                    style={{
                      background: 'linear-gradient(90deg,#e0f2fe 70%,#bae6fd 100%)',
                      color: '#334155',
                      borderRadius: '16px 16px 16px 6px',
                      boxShadow: '0 2px 16px #0002',
                      padding: '11px 17px',
                      fontSize: 15.1,
                      fontWeight: 460,
                      maxWidth: '90%',
                      whiteSpace: 'pre-line',
                      textAlign: 'left'
                    }}
                  >
                    Action performed.
                  </div>
                ) : (
                  <>
                    <div
                      className="message-content"
                      style={{
                        background: isAI ? 'linear-gradient(90deg,#e0f2fe 70%,#bae6fd 100%)' : 'linear-gradient(90deg,#23272f 85%,#0ea5e9 100%)',
                        color: isAI ? '#334155' : '#fff',
                        borderRadius: isAI ? '16px 16px 16px 6px' :  '16px 16px 6px 16px',
                        boxShadow: '0 2px 16px #0002',
                        padding: '11px 17px',
                        fontSize: 15.1,
                        fontWeight: 460,
                        maxWidth: '90%',
                        whiteSpace: 'pre-line',
                        textAlign: 'left'
                      }}
                      dangerouslySetInnerHTML={{ __html: msg.content }}
                    />
                    {/* Actionable open/search button if detected (chat mode—non-action only) */}
                    {isAI && openAction && (
                      <button
                        className="btn btn--sm btn--primary"
                        style={{marginLeft:12,alignSelf:'center',padding:'6px 12px',fontSize:13.2,cursor:'pointer',borderRadius:7}}
                        onClick={() => window.open(openAction.url, '_blank')}
                      >
                        {openAction.label}
                      </button>
                    )}
                  </>
                )}
                {!isAI && (
                  <span
                    style={{
                      background: '#23272f',
                      borderRadius: '50%',
                      padding: 5,
                      display: 'flex',
                      alignItems: 'center',
                      boxShadow: '0 1px 8px #0ea5e93a'
                    }}
                  >
                    <MdPerson size={20} style={{ color: '#38bdf8'}} />
                  </span>
                )}
              </div>
            );
          })}
          {isTyping && <div className="message assistant-message typing-indicator">Typing...</div>}
                  </div>

        <div className="chat-input-section">
          <div className="intent-buttons" style={{display:'flex',gap:7}}>
            <button className={`intent-btn ${intent === 'chat' ? 'active' : ''}`} onClick={() => setIntent('chat')} style={{display:'flex',alignItems:'center',gap:3}}>
              <MdChat size={18} style={{marginBottom:1}} /> Chat
            </button>
            <button className={`intent-btn ${intent === 'search' ? 'active' : ''}`} onClick={() => setIntent('search')} style={{display:'flex',alignItems:'center',gap:3}}>
              <FiSearch size={17} /> Search
            </button>
            <button className={`intent-btn ${intent === 'navigate' ? 'active' : ''}`} onClick={() => setIntent('navigate')} style={{display:'flex',alignItems:'center',gap:3}}>
              <FaCompass size={17} /> Navigate
            </button>
          </div>
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about markets, search, or request actions..."
            />
            <button className="btn btn--primary" onClick={handleSend}>Send</button>
          </div>
        </div>
      </div>

      <div className="assistant-status">
        <div className="status-item">
          <span className="status-label">Model:</span>
          <span className="status-value" id="currentModel">{modelProvider==='cloud' ? 'Gemini 2.5 (Cloud)' : 'Open AI OSS (Local)'}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Connection:</span>
          <span className="status-value" id="aiStatus">Initializing...</span>
        </div>
      </div>

      {showSettings && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={() => setShowSettings(false)}>
          <div className="card" style={{width:420, background:'#0f1320', border:'1px solid #2a3346'}} onClick={(e)=>e.stopPropagation()}>
            <div className="card__header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{fontSize:'1.1rem'}}>AI Settings</h3>
              <button className="btn btn--sm btn--secondary" onClick={() => setShowSettings(false)}>Close</button>
            </div>
            <div className="card__body" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="form-group">
                <label className="form-label">Select AI Model Provider</label>
                <div style={{display:'flex',gap:10}}>
                  <button
                    className={`btn btn--sm ${modelProvider==='local'?'btn--primary':'btn--secondary'}`}
                    onClick={()=>{ setModelProvider('local'); localStorage.setItem('ai_model_provider','local'); }}
                  >
                    Open AI OSS (Local)
                  </button>
                  <button
                    className={`btn btn--sm ${modelProvider==='cloud'?'btn--primary':'btn--secondary'}`}
                    onClick={()=>{ setModelProvider('cloud'); localStorage.setItem('ai_model_provider','cloud'); }}
                  >
                    Gemini 2.5 (Cloud)
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Default Mode Toggle</label>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:12,color:'#94a3b8'}}>Local</span>
                  <label style={{position:'relative', display:'inline-block', width:50, height:26}}>
                    <input type="checkbox" checked={modelProvider==='cloud'} onChange={(e)=>{
                      const val = e.target.checked ? 'cloud' : 'local';
                      setModelProvider(val);
                      localStorage.setItem('ai_model_provider', val);
                    }} style={{display:'none'}} />
                    <span style={{position:'absolute',cursor:'pointer',top:0,left:0,right:0,bottom:0,background:modelProvider==='cloud'?'#0ea5e9':'#334155',transition:'.2s',borderRadius:26}}></span>
                    <span style={{position:'absolute',height:22,width:22,left: modelProvider==='cloud' ? 26 : 2, top:2, background:'#fff', borderRadius:'50%', transition:'.2s'}}></span>
                  </label>
                  <span style={{fontSize:12,color:'#94a3b8'}}>Cloud</span>
                </div>
              </div>
              <div className="form-group" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <button className="btn btn--outline btn--sm" onClick={testConnection}>
                  Test {modelProvider==='cloud' ? 'Cloud' : 'Local'}
                </button>
                <span style={{fontSize:12,color:'#9ca3af',marginLeft:8}}>{testResult}</span>
              </div>

              <div className="form-group" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <button className="btn btn--secondary btn--sm" onClick={()=> setShowSettings(false)}>Back to Chat</button>
                <button className="btn btn--primary btn--sm" onClick={()=>{
                  setMessages(prev=>[...prev,{sender:'assistant', content:`✅ Model set to <b>${modelProvider==='cloud'?'Gemini 2.5 (Cloud)':'Open AI OSS (Local)'}.</b> You can continue chatting.`}]);
                  setShowSettings(false);
                }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AssistantPanel;
