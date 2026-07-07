import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { TopBar, Spinner } from './components';
import { Login, Setup, ForgotPassword, ResetPassword } from './pages/AuthPages';
import Home from './pages/Home';
import Library from './pages/Library';
import ContentDetail from './pages/ContentDetail';
import { Collections, CollectionDetail } from './pages/Collections';
import Studio from './pages/Studio';
import Questions from './pages/Questions';
import Admin from './pages/Admin';

function Protected({ children, role }) {
  const { user, loading, needsSetup, isAuthor, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role === 'author' && !isAuthor) return <Navigate to="/" replace />;
  if (role === 'admin' && !isAdmin) return <Navigate to="/" replace />;
  return (
    <div className="app-shell">
      <TopBar />
      <main className="page">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Protected><Home /></Protected>} />
      <Route path="/library" element={<Protected><Library /></Protected>} />
      <Route path="/content/:id" element={<Protected><ContentDetail /></Protected>} />
      <Route path="/collections" element={<Protected><Collections /></Protected>} />
      <Route path="/collections/:id" element={<Protected><CollectionDetail /></Protected>} />
      <Route path="/questions" element={<Protected><Questions /></Protected>} />
      <Route path="/studio" element={<Protected role="author"><Studio /></Protected>} />
      <Route path="/studio/edit/:id" element={<Protected role="author"><Studio /></Protected>} />
      <Route path="/admin" element={<Protected role="admin"><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
