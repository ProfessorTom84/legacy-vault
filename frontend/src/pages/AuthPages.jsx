import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, Field } from '../components';

function AuthShell({ title, sub, children }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: 26 }}>
          <span className="brand-mark" aria-hidden /> Legacy Vault
        </div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{sub}</p>
        {children}
      </div>
    </div>
  );
}

export function Setup() {
  const { needsSetup, loading: authLoading, signIn } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!authLoading && !needsSetup) return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const data = await api.post('/auth/setup', form);
      signIn(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome" sub="Create the admin account. You can invite your family from the admin panel afterwards.">
      <form onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <Field label="Your name">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password (8+ characters)">
          <input className="input" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <Field label="Confirm password">
          <input className="input" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
        </Field>
        <Button type="submit" loading={loading} style={{ width: '100%' }}>Create admin account</Button>
      </form>
    </AuthShell>
  );
}

export function Login() {
  const { needsSetup, loading: authLoading, signIn, user } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!authLoading && needsSetup) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login', form);
      signIn(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in" sub="Everything left here is waiting for you.">
      <form onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <Field label="Email">
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoFocus />
        </Field>
        <Field label="Password">
          <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <Button type="submit" loading={loading} style={{ width: '100%' }}>Sign in</Button>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13.5 }}>
          <Link to="/forgot-password" style={{ color: 'var(--accent-strong)' }}>Forgot your password?</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {
      /* the answer is intentionally identical either way */
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset password" sub="Enter your email and we'll send a reset link.">
      {sent ? (
        <div className="form-ok">If that account exists, a reset link is on its way. Check your inbox.</div>
      ) : (
        <form onSubmit={submit}>
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Button type="submit" loading={loading} style={{ width: '100%' }}>Send reset link</Button>
        </form>
      )}
      <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13.5 }}>
        <Link to="/login" style={{ color: 'var(--accent-strong)' }}>Back to sign in</Link>
      </p>
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Choose a new password" sub="This link works for one hour.">
      {done ? (
        <>
          <div className="form-ok">Your password has been changed.</div>
          <Link to="/login"><Button style={{ width: '100%' }}>Sign in</Button></Link>
        </>
      ) : (
        <form onSubmit={submit}>
          {error && <div className="form-error">{error}</div>}
          <Field label="New password (8+ characters)">
            <input className="input" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoFocus />
          </Field>
          <Field label="Confirm new password">
            <input className="input" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
          </Field>
          <Button type="submit" loading={loading} style={{ width: '100%' }}>Change password</Button>
        </form>
      )}
    </AuthShell>
  );
}
