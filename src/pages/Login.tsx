import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { login } from '../api/client';
import { Eye, EyeOff, Loader2, Mail, Lock, ShieldCheck, Gauge, ClipboardCheck } from 'lucide-react';
import logoUrl from '../assets/LOGO-AGENCE-MENAGE.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(email, password);
      setAuth(data.user);
      navigate('/');
    } catch {
      setError('Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-split-left">
        <div className="login-orb login-orb-one" />
        <div className="login-orb login-orb-two" />
        <div className="login-grid-overlay" />

        <div className="login-brand">
          <img src={logoUrl} alt="Agence Ménage" className="login-logo-large" />
          <p className="login-kicker">Plateforme operationnelle</p>
          <h1>Pilotez vos operations avec precision.</h1>
          <p>
            Un espace centralise pour suivre les demandes, les missions et les profils
            avec une execution plus rapide et plus fiable.
          </p>

          <ul className="login-value-list">
            <li>
              <ShieldCheck size={17} />
              <span>Securite renforcée et acces controle</span>
            </li>
            <li>
              <Gauge size={17} />
              <span>Suivi en temps reel des activites terrain</span>
            </li>
            <li>
              <ClipboardCheck size={17} />
              <span>Process standardises pour l'equipe operationnelle</span>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="login-split-right">
        <div className="login-card">
          <div className="login-header">
            <div className="login-top-logo">
              <img src={logoUrl} alt="Agence Ménage" />
            </div>
            <h2>Bienvenue</h2>
            <p className="login-backoffice-text">Back Office Agence Menage</p>
            <p className="login-subtitle">Connectez-vous a votre espace de pilotage</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Adresse email</label>
              <div className="input-with-icon input-with-icon-left">
                <span className="input-icon-left">
                  <Mail size={18} />
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@agencemenage.ma"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Mot de passe</label>
              <div className="input-with-icon input-with-icon-left">
                <span className="input-icon-left">
                  <Lock size={18} />
                </span>
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button type="button" className="input-icon-btn" onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-container">
                <input type="checkbox" id="remember" />
                <span className="checkmark"></span>
                Se souvenir de moi
              </label>
              <a href="#" className="forgot-password">Mot de passe oublie ?</a>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn-primary btn-full login-btn" disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : 'Se connecter'}
            </button>

            <p className="login-support-note">
              Besoin d'aide ? Contactez l'equipe support interne.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
