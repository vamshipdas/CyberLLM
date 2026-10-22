import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import TicketsPanel from './components/TicketsPanel';
import LoginPage from './components/LoginPage';
import LogAnalysis from './components/LogAnalysis/LogAnalysis';
import AlertDetailDrawer from './components/AlertDetail/AlertDetailDrawer';
import { fetchMe, listChats, newChat, archiveChat, deleteChat, logout, isLoggedIn, AuthError, AUTH_EXPIRED_EVENT } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [isRestoring, setIsRestoring] = useState(isLoggedIn);
  const [currentView, setCurrentView] = useState('workspace'); // 'workspace' | 'logs'
  const [activeChatId, setActiveChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [focusedOrigin, setFocusedOrigin] = useState(null);
  const cancelledRef = useRef(false);

  function resetSession() {
    setUser(null);
    setChats([]);
    setActiveChatId(null);
    setShowArchived(false);
    setChatInput('');
    setSelectedAlert(null);
    setFocusedOrigin(null);
    setCurrentView('workspace');
  }

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, resetSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, resetSession);
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      return;
    }
    cancelledRef.current = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (!cancelledRef.current) setUser(me);
      } catch (err) {
        if (!(err instanceof AuthError)) console.error('Session restore failed:', err);
      } finally {
        if (!cancelledRef.current) setIsRestoring(false);
      }
    })();
    return () => { cancelledRef.current = true; };
  }, []);

  useEffect(() => {
    if (user) {
      listChats()
        .then((savedChats) => {
          setChats(savedChats);
          setActiveChatId((current) => current ?? savedChats[0]?.id ?? null);
        })
        .catch(() => setChats([]));
    }
  }, [user]);

  const handleLoggedIn = (authenticatedUser) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    logout();
    resetSession();
  };

  const handleNewChat = async () => {
    try {
      const data = await newChat();
      setChats((prev) => [{ id: data.id, title: data.title, updated_at: data.updated_at }, ...prev]);
      setActiveChatId(data.id);
      return data.id;
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return;
      alert('Failed to create new chat: ' + err.message);
      return null;
    }
  };

  const handleArchive = async (id, archived) => {
    try {
      await archiveChat(id, archived);
      setChats((prev) => prev.map((c) => c.id === id ? { ...c, archived } : c));
      if (activeChatId === id) setActiveChatId(null);
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return;
      alert('Failed to archive chat: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteChat(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeChatId === id) setActiveChatId(null);
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return;
      alert('Failed to delete chat: ' + err.message);
    }
  };

  const handleBlankChat = () => {
    setChatInput('');
    return handleNewChat();
  };

  const handleSelectChat = (id) => {
    setChatInput('');
    setActiveChatId(id);
  };

  const handleTicketPrompt = async (prompt) => {
    setChatInput(prompt);
    setCurrentView('workspace');
    if (!activeChatId) await handleNewChat();
  };

  const handleAskCyberLLM = async (prompt) => {
    setChatInput(prompt);
    setCurrentView('workspace');
    if (!activeChatId) await handleNewChat();
  };

  const handleTicketDrop = (event) => {
    const prompt = event.dataTransfer.getData('application/x-soc-ticket');
    if (!prompt) return;
    event.preventDefault();
    handleTicketPrompt(prompt);
  };

  const handleSelectAlert = (alertItem) => {
    setSelectedAlert(alertItem);
    if (alertItem?.origin?.lat != null && alertItem?.origin?.lon != null) {
      setFocusedOrigin(alertItem.origin);
    }
  };

  const handleFocusGlobe = (origin) => {
    if (origin) {
      setFocusedOrigin(origin);
      if (currentView !== 'logs') {
        setCurrentView('logs');
      }
    }
  };

  if (isRestoring) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: '0.9rem'
      }}>
        Signing in…
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  return (
    <div className="app-shell">
      <Header
        user={user}
        onLogout={handleLogout}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {currentView === 'logs' ? (
        <main className="workspace-logs">
          <LogAnalysis
            onAskCyberLLM={handleAskCyberLLM}
            onSelectAlert={handleSelectAlert}
            focusedOrigin={focusedOrigin}
          />
        </main>
      ) : (
        <main className="workspace">
          <Sidebar
            chats={chats}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            onNewChat={handleBlankChat}
            onArchive={handleArchive}
            onDelete={handleDelete}
            showArchived={showArchived}
            onToggleArchived={setShowArchived}
          />

          {activeChatId ? (
            <ChatWindow
              key={activeChatId}
              sessionId={activeChatId}
              input={chatInput}
              onInputChange={setChatInput}
            />
          ) : (
            <div
              className="workspace-empty ticket-drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleTicketDrop}
            >
              <div className="workspace-empty__icon">+</div>
              <h2>Start an investigation</h2>
              <p>Select a saved conversation, create a new one, or drop an incoming ticket here.</p>
              <button className="btn btn-primary" onClick={handleBlankChat}>New conversation</button>
            </div>
          )}

          <TicketsPanel
            onUseTicket={handleTicketPrompt}
            onSelectAlert={handleSelectAlert}
          />
        </main>
      )}

      {/* Global Alert Detail Drawer */}
      <AlertDetailDrawer
        isOpen={Boolean(selectedAlert)}
        alertData={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onOpenInWorkspace={handleTicketPrompt}
        onFocusGlobe={handleFocusGlobe}
      />
    </div>
  );
}
