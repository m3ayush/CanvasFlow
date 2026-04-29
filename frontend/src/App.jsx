import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { io } from 'socket.io-client';
import rough from 'roughjs/bundled/rough.esm.js';
import { Pen, Square, Circle, Eraser, Type, MousePointer2, Palette } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import './App.css';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(backendUrl);

const generateId = () => Math.random().toString(36).substr(2, 9);

const isHit = (el, px, py) => {
  if (el.tool === 'rectangle') {
    const minX = Math.min(el.x, el.x + el.width);
    const maxX = Math.max(el.x, el.x + el.width);
    const minY = Math.min(el.y, el.y + el.height);
    const maxY = Math.max(el.y, el.y + el.height);
    return px >= minX && px <= maxX && py >= minY && py <= maxY;
  }
  if (el.tool === 'circle') {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const rx = Math.max(1, Math.abs(el.width / 2));
    const ry = Math.max(1, Math.abs(el.height / 2));
    return Math.pow(px - cx, 2) / Math.pow(rx, 2) + Math.pow(py - cy, 2) / Math.pow(ry, 2) <= 1;
  }
  if (el.tool === 'text') {
    return px >= el.x && px <= el.x + Math.max(100, el.text.length * 15) && py >= el.y - 24 && py <= el.y + 10;
  }
  if (el.tool === 'pen') {
    const minX = Math.min(...el.points.map(p => p.x));
    const maxX = Math.max(...el.points.map(p => p.x));
    const minY = Math.min(...el.points.map(p => p.y));
    const maxY = Math.max(...el.points.map(p => p.y));
    return px >= minX && px <= maxX && py >= minY && py <= maxY;
  }
  return false;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [joined, setJoined] = useState(false);
  const [sessionInfo, setSessionInfo] = useState({ sessionId: 'frontpage-1' });
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  const [elements, setElements] = useState([]);
  const [action, setAction] = useState('none');
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#2c2c2c');
  const [cursors, setCursors] = useState({});
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [editingText, setEditingText] = useState(null);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    socket.on('session-joined', ({ users, canvasSnapshot }) => {
      if (canvasSnapshot) setElements(canvasSnapshot.map(s => s.payload));
    });

    socket.on('draw-event', ({ eventType, payload }) => {
      setElements(prev => [...prev, payload]);
    });

    socket.on('update-element', (payload) => {
      setElements(prev => prev.map(el => el.id === payload.id ? payload : el));
    });

    socket.on('cursor-update', ({ userId, displayName, x, y }) => {
      setCursors(prev => ({ ...prev, [userId]: { displayName, x, y } }));
    });

    socket.on('chat-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('user-left', ({ userId }) => {
      setCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    });

    return () => {
      socket.off('session-joined');
      socket.off('draw-event');
      socket.off('update-element');
      socket.off('cursor-update');
      socket.off('chat-message');
      socket.off('user-left');
    };
  }, []);

  useLayoutEffect(() => {
    if (!joined) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const roughCanvas = rough.canvas(canvas);

    elements.forEach(element => {
      if (element.tool === 'pen') {
        const path = element.points.length > 1 
          ? element.points.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`).join(' ')
          : `M ${element.points[0].x} ${element.points[0].y} L ${element.points[0].x + 0.1} ${element.points[0].y + 0.1}`;
        
        roughCanvas.path(path, { 
          stroke: element.color || '#2c2c2c', 
          strokeWidth: element.strokeWidth || 2, 
          roughness: 1.5,
          seed: element.seed
        });
      } else if (element.tool === 'rectangle') {
        roughCanvas.rectangle(element.x, element.y, element.width, element.height, { 
          stroke: element.color || '#2c2c2c', 
          strokeWidth: 2,
          seed: element.seed
        });
      } else if (element.tool === 'circle') {
        roughCanvas.circle(element.x + element.width/2, element.y + element.height/2, Math.max(element.width, element.height), { 
          stroke: element.color || '#2c2c2c', 
          strokeWidth: 2,
          seed: element.seed
        });
      } else if (element.tool === 'text') {
        ctx.font = 'bold 24px "Playfair Display", serif';
        ctx.fillStyle = element.color || '#2c2c2c';
        ctx.textBaseline = 'top';
        ctx.fillText(element.text, element.x, element.y);
      }

      // Draw selection box
      if (element.id === selectedElementId) {
        ctx.strokeStyle = '#a73a2b';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        if (element.tool === 'rectangle' || element.tool === 'circle') {
          const minX = Math.min(element.x, element.x + element.width);
          const minY = Math.min(element.y, element.y + element.height);
          ctx.strokeRect(minX - 5, minY - 5, Math.abs(element.width) + 10, Math.abs(element.height) + 10);
        } else if (element.tool === 'pen') {
          const minX = Math.min(...element.points.map(p => p.x));
          const maxX = Math.max(...element.points.map(p => p.x));
          const minY = Math.min(...element.points.map(p => p.y));
          const maxY = Math.max(...element.points.map(p => p.y));
          ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
        } else if (element.tool === 'text') {
          ctx.strokeRect(element.x - 5, element.y - 5, Math.max(100, element.text.length * 15) + 10, 34);
        }
        ctx.setLineDash([]);
      }
    });
  }, [elements, joined, selectedElementId]);

  useEffect(() => {
    if (joined && containerRef.current && canvasRef.current) {
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
    }
  }, [joined]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setJoined(false);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (user && sessionInfo.sessionId) {
      const displayName = user.email.split('@')[0];
      socket.emit('join-session', { sessionId: sessionInfo.sessionId, displayName });
      setJoined(true);
    }
  };

  const handleMouseDown = (e) => {
    if (action === 'typing') {
      finalizeText();
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'select') {
      const hit = elements.slice().reverse().find(el => isHit(el, x, y));
      if (hit) {
        setSelectedElementId(hit.id);
        setLastMousePos({ x, y });
        setAction('moving');
      } else {
        setSelectedElementId(null);
      }
      return;
    }

    setSelectedElementId(null);
    const id = generateId();
    const seed = Math.floor(Math.random() * 10000);

    if (tool === 'text') {
      setEditingText({ id, x, y, text: '', color, seed });
      setAction('typing');
      return;
    }

    if (tool === 'pen' || tool === 'eraser') {
      const elementColor = tool === 'eraser' ? '#f4f1ea' : color;
      const strokeWidth = tool === 'eraser' ? 20 : 2;
      const newElement = { id, tool: 'pen', points: [{x, y}], color: elementColor, strokeWidth, seed };
      setElements([...elements, newElement]);
      setAction('drawing');
    } else {
      const newElement = { id, tool, x, y, width: 0, height: 0, color, seed };
      setElements([...elements, newElement]);
      setAction('drawing');
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    socket.emit('cursor-move', { sessionId: sessionInfo.sessionId, x, y });

    if (action === 'drawing') {
      const index = elements.length - 1;
      const currentElement = { ...elements[index] };

      if (currentElement.tool === 'pen') {
        currentElement.points = [...currentElement.points, {x, y}];
      } else {
        currentElement.width = x - currentElement.x;
        currentElement.height = y - currentElement.y;
      }

      const elementsCopy = [...elements];
      elementsCopy[index] = currentElement;
      setElements(elementsCopy);
    } else if (action === 'moving' && selectedElementId) {
      const dx = x - lastMousePos.x;
      const dy = y - lastMousePos.y;

      setElements(prev => prev.map(el => {
        if (el.id === selectedElementId) {
          if (el.tool === 'pen') {
            return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
          }
          return { ...el, x: el.x + dx, y: el.y + dy };
        }
        return el;
      }));
      setLastMousePos({ x, y });
    }
  };

  const handleMouseUp = () => {
    if (action === 'drawing') {
      const currentElement = elements[elements.length - 1];
      socket.emit('draw-event', { sessionId: sessionInfo.sessionId, eventType: 'add', payload: currentElement });
    } else if (action === 'moving' && selectedElementId) {
      const currentElement = elements.find(el => el.id === selectedElementId);
      if (currentElement) {
        socket.emit('update-element', { sessionId: sessionInfo.sessionId, payload: currentElement });
      }
    }
    
    if (action !== 'typing') setAction('none');
  };

  const finalizeText = () => {
    if (editingText && editingText.text.trim()) {
      const newElement = { ...editingText, tool: 'text' };
      setElements([...elements, newElement]);
      socket.emit('draw-event', { sessionId: sessionInfo.sessionId, eventType: 'add', payload: newElement });
    }
    setEditingText(null);
    setAction('none');
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      socket.emit('chat-message', { sessionId: sessionInfo.sessionId, message: chatInput });
      setChatInput('');
    }
  };

  if (!auth) return <div className="modal-overlay"><div className="vintage-modal" style={{ maxWidth: '600px' }}><h2>Configuration Missing</h2></div></div>;
  if (loading) return <div className="modal-overlay"><h2 style={{fontFamily: 'var(--font-serif)'}}>Loading the presses...</h2></div>;

  if (!user) {
    return (
      <div className="modal-overlay">
        <div className="vintage-modal">
          <h2>The Canvas Times</h2>
          <form onSubmit={handleAuth}>
            <input type="email" className="vintage-input" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" className="vintage-input" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            {authError && <p style={{color: 'var(--color-accent-red)', marginBottom: '1rem'}}>{authError}</p>}
            <button type="submit" className="vintage-btn" style={{width: '100%', marginBottom: '1rem'}}>{authMode === 'login' ? 'SIGN IN' : 'SUBSCRIBE'}</button>
            <p style={{fontSize: '0.9rem'}}><span style={{color: 'var(--color-accent-red)', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Subscribe' : 'Sign in'}</span></p>
          </form>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="modal-overlay">
        <div className="vintage-modal" style={{maxWidth: '500px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1rem'}}>
            <h2>Reader Dashboard</h2>
            <button onClick={handleLogout} style={{background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', textDecoration: 'underline'}}>Log Out</button>
          </div>
          <form onSubmit={handleJoin} style={{textAlign: 'left', border: '1px dashed var(--color-border)', padding: '1.5rem', background: 'var(--color-bg-primary)'}}>
            <input type="text" className="vintage-input" placeholder="Session ID (e.g. frontpage-1)" value={sessionInfo.sessionId} onChange={e => setSessionInfo({...sessionInfo, sessionId: e.target.value})} required />
            <button type="submit" className="vintage-btn" style={{width: '100%'}}>OPEN CANVAS</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="newspaper-container">
      <header className="newspaper-header">
        <h1 className="newspaper-title">The Degree Times</h1>
      </header>

      <div className="main-layout">
        <aside className="column-left">
          <button className={`tool-btn ${tool === 'select' ? 'active' : ''}`} onClick={() => setTool('select')} title="Select"><MousePointer2 size={24} /></button>
          <button className={`tool-btn ${tool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')} title="Pen"><Pen size={24} /></button>
          <button className={`tool-btn ${tool === 'rectangle' ? 'active' : ''}`} onClick={() => setTool('rectangle')} title="Rectangle"><Square size={24} /></button>
          <button className={`tool-btn ${tool === 'circle' ? 'active' : ''}`} onClick={() => setTool('circle')} title="Circle"><Circle size={24} /></button>
          <button className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="Eraser (Whiteout)"><Eraser size={24} /></button>
          <button className={`tool-btn ${tool === 'text' ? 'active' : ''}`} onClick={() => setTool('text')} title="Text"><Type size={24} /></button>
          
          <div style={{ marginTop: '1rem', padding: '1rem 0', borderTop: '1px solid var(--color-border)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
            <Palette size={20} color="var(--color-text-secondary)" />
            <button className="tool-btn" style={{backgroundColor: '#2c2c2c', width: 28, height: 28, borderRadius: '50%', padding: 0, border: color === '#2c2c2c' ? '2px solid var(--color-bg-primary)' : '2px solid transparent', outline: color === '#2c2c2c' ? '2px solid #2c2c2c' : 'none'}} onClick={() => setColor('#2c2c2c')} title="Ink Black"></button>
            <button className="tool-btn" style={{backgroundColor: '#a73a2b', width: 28, height: 28, borderRadius: '50%', padding: 0, border: color === '#a73a2b' ? '2px solid var(--color-bg-primary)' : '2px solid transparent', outline: color === '#a73a2b' ? '2px solid #a73a2b' : 'none'}} onClick={() => setColor('#a73a2b')} title="Newspaper Red"></button>
            <button className="tool-btn" style={{backgroundColor: '#214e34', width: 28, height: 28, borderRadius: '50%', padding: 0, border: color === '#214e34' ? '2px solid var(--color-bg-primary)' : '2px solid transparent', outline: color === '#214e34' ? '2px solid #214e34' : 'none'}} onClick={() => setColor('#214e34')} title="Vintage Green"></button>
          </div>
        </aside>

        <main className="column-center" ref={containerRef}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseOut={handleMouseUp}
          />
          
          {/* Inline Text Editor Overlay */}
          {editingText && (
            <textarea
              autoFocus
              style={{
                position: 'absolute',
                left: editingText.x,
                top: editingText.y,
                background: 'transparent',
                border: '1px dashed var(--color-accent-red)',
                outline: 'none',
                fontFamily: '"Playfair Display", serif',
                fontSize: '24px',
                fontWeight: 'bold',
                color: editingText.color,
                resize: 'both',
                minWidth: '100px',
                minHeight: '40px',
                overflow: 'hidden',
                padding: '0',
                margin: '0',
                zIndex: 100,
                lineHeight: '1',
                boxShadow: 'none'
              }}
              value={editingText.text}
              onChange={e => setEditingText({ ...editingText, text: e.target.value })}
              onBlur={finalizeText}
            />
          )}

          {Object.entries(cursors).map(([id, cursor]) => (
            <div key={id} style={{ position: 'absolute', left: cursor.x, top: cursor.y, pointerEvents: 'none', transform: 'translate(-50%, -50%)' }}>
              <MousePointer2 size={16} color="var(--color-accent-red)" fill="var(--color-accent-red)" />
              <div style={{ background: 'var(--color-accent-red)', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '2px', position: 'absolute', top: 16, left: 8, whiteSpace: 'nowrap' }}>
                {cursor.displayName}
              </div>
            </div>
          ))}
        </main>

        <aside className="column-right">
          <div className="chat-header">Telegrams</div>
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className="chat-message">
                <span className="chat-message-author">{m.displayName}: </span>
                <span>{m.message}</span>
              </div>
            ))}
          </div>
          <form className="chat-input-container" onSubmit={handleChatSubmit}>
            <input type="text" className="chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Send a telegram..." />
          </form>
        </aside>
      </div>
    </div>
  );
}

export default App;
