import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { login } from '../api/client';
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .lp-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', system-ui, sans-serif;
          background: radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%);
          position: relative;
          overflow: hidden;
        }

        /* Night Sky Stars */
        .lp-stars {
          position: absolute;
          top: 0;
          left: 0;
          width: 2px;
          height: 2px;
          background: transparent;
          box-shadow: 1744px 122px #FFF, 134px 1321px #FFF, 92px 859px #FFF, 1618px 1012px #FFF, 482px 768px #FFF, 1872px 145px #FFF, 1432px 156px #FFF, 1876px 1654px #FFF, 123px 456px #FFF, 876px 123px #FFF, 1543px 789px #FFF, 345px 1678px #FFF, 987px 543px #FFF, 234px 1234px #FFF, 1765px 234px #FFF, 456px 987px #FFF, 1234px 678px #FFF, 543px 123px #FFF, 1678px 345px #FFF, 789px 1543px #FFF;
          animation: twinkle 5s infinite;
        }

        .lp-stars-2 {
          width: 1px;
          height: 1px;
          background: transparent;
          box-shadow: 444px 222px #FFF, 234px 1421px #FFF, 192px 959px #FFF, 1818px 1112px #FFF, 582px 868px #FFF, 1772px 245px #FFF, 1532px 256px #FFF, 1776px 1754px #FFF, 223px 556px #FFF, 976px 223px #FFF, 1643px 889px #FFF, 445px 1778px #FFF, 1087px 643px #FFF, 334px 1334px #FFF, 1865px 334px #FFF, 556px 1087px #FFF, 1334px 778px #FFF, 643px 223px #FFF, 1778px 445px #FFF, 889px 1643px #FFF;
          animation: twinkle 8s infinite;
          opacity: 0.5;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 0.3; }
        }

        /* Shooting Stars (Comets) */
        .lp-comet {
          position: absolute;
          top: var(--top);
          left: var(--left);
          width: 1px;
          height: 1px;
          background: #fff;
          opacity: 0;
          animation: comet var(--duration) infinite linear;
          animation-delay: var(--delay);
          pointer-events: none;
        }

        .lp-comet::after {
          content: '';
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 80px;
          height: 1px;
          background: linear-gradient(90deg, #fff, transparent);
        }

        @keyframes comet {
          0% { transform: rotate(-45deg) translateX(0); opacity: 0; }
          5% { opacity: 1; }
          15% { transform: rotate(-45deg) translateX(-1000px); opacity: 0; }
          100% { transform: rotate(-45deg) translateX(-1000px); opacity: 0; }
        }

        .lp-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          padding: 48px 44px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 24px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
        }

        .lp-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 36px;
        }

        .lp-logo img {
          height: 38px;
          object-fit: contain;
        }

        .lp-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .lp-label {
          display: inline-block;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6366f1;
          background: #eef2ff;
          border-radius: 6px;
          padding: 4px 10px;
          margin-bottom: 14px;
        }

        .lp-title {
          font-family: 'DM Serif Display', Georgia, serif;
          font-size: 30px;
          font-weight: 400;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin-bottom: 8px;
        }

        .lp-subtitle {
          font-size: 14px;
          color: #94a3b8;
        }

        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .lp-field label {
          display: block;
          font-size: 12.5px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 7px;
          letter-spacing: 0.01em;
        }

        .lp-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .lp-input-icon {
          position: absolute;
          left: 14px;
          color: #94a3b8;
          display: flex;
          pointer-events: none;
        }

        .lp-input-wrap input {
          width: 100%;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 13px 14px 13px 42px;
          font-size: 14px;
          font-family: 'DM Sans', system-ui, sans-serif;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }

        .lp-input-wrap input::placeholder { color: #cbd5e1; }

        .lp-input-wrap input:focus {
          background: #fff;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        .lp-pwd-toggle {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }

        .lp-pwd-toggle:hover { color: #6366f1; }

        .lp-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: -2px;
        }

        .lp-remember {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          color: #64748b;
          user-select: none;
        }

        .lp-remember input[type='checkbox'] {
          width: 15px;
          height: 15px;
          accent-color: #6366f1;
          cursor: pointer;
        }

        .lp-forgot {
          font-size: 13px;
          color: #6366f1;
          text-decoration: none;
          font-weight: 500;
          transition: opacity 0.15s;
        }

        .lp-forgot:hover { opacity: 0.7; }

        .lp-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          color: #dc2626;
          text-align: center;
        }

        .lp-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          background: #4f46e5;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 14.5px;
          font-weight: 500;
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 4px 14px rgba(79,70,229,0.35);
          margin-top: 4px;
        }

        .lp-submit:hover:not(:disabled) {
          background: #4338ca;
          box-shadow: 0 6px 20px rgba(79,70,229,0.45);
          transform: translateY(-1px);
        }

        .lp-submit:active:not(:disabled) { transform: translateY(0); }
        .lp-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .lp-spin { animation: spin 0.7s linear infinite; }

        .lp-support {
          text-align: center;
          font-size: 12.5px;
          color: #94a3b8;
          margin-top: 20px;
        }

        .lp-support a {
          color: #6366f1;
          text-decoration: none;
          font-weight: 500;
        }

        .lp-footer {
          position: absolute;
          bottom: 24px;
          font-size: 12px;
          color: #a5b4fc;
          opacity: 0.8;
          z-index: 1;
        }
      `}</style>

      <div className="lp-root">
        <div className="lp-stars" />
        <div className="lp-stars-2" />
        <div className="lp-comet" style={{ '--top': '10%', '--left': '100%', '--duration': '6s', '--delay': '0s' } as any} />
        <div className="lp-comet" style={{ '--top': '30%', '--left': '100%', '--duration': '8s', '--delay': '3s' } as any} />
        <div className="lp-comet" style={{ '--top': '50%', '--left': '100%', '--duration': '7s', '--delay': '5s' } as any} />

        <div className="lp-card">
          <div className="lp-logo">
            <img src={logoUrl} alt="Agence Ménage" />
          </div>

          <div className="lp-header">
            <span className="lp-label">Back Office</span>
            <h1 className="lp-title">Bienvenue</h1>
            <p className="lp-subtitle">Connectez-vous à votre espace de pilotage</p>
          </div>

          <form onSubmit={handleSubmit} className="lp-form">
            <div className="lp-field">
              <label htmlFor="email">Adresse email</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon"><Mail size={16} /></span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@agencemenage.ma"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="lp-field">
              <label htmlFor="password">Mot de passe</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon"><Lock size={16} /></span>
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button type="button" className="lp-pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="lp-row">
              <label className="lp-remember">
                <input type="checkbox" id="remember" />
                Se souvenir de moi
              </label>
              <a href="#" className="lp-forgot">Mot de passe oublié ?</a>
            </div>

            {error && <p className="lp-error">{error}</p>}

            <button type="submit" className="lp-submit" disabled={loading}>
              {loading
                ? <Loader2 size={18} className="lp-spin" />
                : <><span>Se connecter</span><ArrowRight size={16} /></>
              }
            </button>
          </form>

          <p className="lp-support">
            Besoin d'aide ?{' '}
            <a href="#">Contacter le support</a>
          </p>
        </div>

        <div className="lp-footer">
          © {new Date().getFullYear()} Agence Ménage — Tous droits réservés
        </div>
      </div>
    </>
  );
}