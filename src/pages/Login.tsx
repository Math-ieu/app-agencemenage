import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { login, forgotPassword, resetPassword } from '../api/client';
import { Eye, EyeOff, Loader2, Mail, User, Lock, ArrowRight, X } from 'lucide-react';
import logoUrl from '../assets/LOGO-AGENCE-MENAGE.png';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';


export default function LoginPage() {
  const [loginVal, setLoginVal] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Forgot password flow states
  const [showForgot, setShowForgot] = useState(false);
  const [forgotLogin, setForgotLogin] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(loginVal, password);
      setAuth(data.user);
      navigate('/');
    } catch {
      setError('Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await forgotPassword(forgotLogin);
      setForgotSuccess(true);
    } catch (err: any) {
      setForgotError(err.response?.data?.detail || 'Une erreur est survenue.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await resetPassword({
        login: forgotLogin,
        code: otpCode,
        new_password: newPassword
      });
      setShowForgot(false);
      setForgotSuccess(false);
      setForgotLogin('');
      setOtpCode('');
      setNewPassword('');
      setError('Mot de passe réinitialisé avec succès. Connectez-vous.');
    } catch (err: any) {
      setForgotError(err.response?.data?.error || 'Code de validation incorrect ou expiré.');
    } finally {
      setForgotLoading(false);
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
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 32px 80px rgba(0,0,0,0.5);
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
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #2dd4bf;
          background: rgba(3, 114, 101, 0.15);
          border: 1px solid rgba(3, 114, 101, 0.3);
          border-radius: 6px;
          padding: 4px 12px;
          margin-bottom: 16px;
        }

        .lp-title {
          font-family: 'DM Serif Display', Georgia, serif;
          font-size: 32px;
          font-weight: 400;
          color: #ffffff;
          letter-spacing: 0.02em;
          margin-bottom: 10px;
        }
        
        .lp-subtitle {
          font-size: 15px;
          color: #cbd5e1;
          font-weight: 400;
          letter-spacing: 0.01em;
        }

        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .lp-field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #f1f5f9;
          margin-bottom: 8px;
          letter-spacing: 0.02em;
        }

        .lp-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .lp-input-icon {
          position: absolute;
          left: 16px;
          color: #64748b;
          display: flex;
          pointer-events: none;
          transition: color 0.2s;
        }

        .lp-input-wrap:focus-within .lp-input-icon {
          color: #037265;
        }

        .lp-input-wrap input {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 14px 14px 14px 44px;
          font-size: 14px;
          font-family: 'DM Sans', system-ui, sans-serif;
          color: #ffffff;
          outline: none;
          transition: all 0.2s;
        }
        
        .lp-input-wrap input::placeholder { color: #475569; }

        .lp-input-wrap input:focus {
          background: rgba(255, 255, 255, 0.07);
          border-color: #037265;
          box-shadow: 0 0 0 4px rgba(3, 114, 101, 0.15);
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

        .lp-pwd-toggle:hover { color: #037265; }

        .lp-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: -2px;
        }

        .lp-remember {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-size: 14px;
          color: #94a3b8;
          user-select: none;
          transition: color 0.2s;
        }
        
        .lp-remember:hover { color: #cbd5e1; }

        .lp-remember input[type='checkbox'] {
          width: 15px;
          height: 15px;
          accent-color: #037265;
          cursor: pointer;
        }

        .lp-forgot {
          font-size: 13px;
          color: #037265;
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
          gap: 10px;
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #037265 0%, #025a50 100%);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 10px 25px rgba(3,114,101,0.3);
          margin-top: 8px;
        }

        .lp-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #025a50 0%, #01413a 100%);
          box-shadow: 0 6px 20px rgba(3,114,101,0.45);
          transform: translateY(-1px);
        }

        .lp-submit:active:not(:disabled) { transform: translateY(0); }
        .lp-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .lp-spin { animation: spin 0.7s linear infinite; }

        .lp-support {
          text-align: center;
          font-size: 13px;
          color: #94a3b8;
          margin-top: 24px;
          letter-spacing: 0.01em;
        }

        .lp-support a {
          color: #037265;
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

        /* Recovery Modal */
        .lp-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(9, 10, 15, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .lp-modal-card {
          width: 100%;
          max-width: 440px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          padding: 40px 36px;
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
          position: relative;
          color: #ffffff;
        }

        .lp-modal-close {
          position: absolute;
          top: 24px;
          right: 24px;
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s;
        }

        .lp-modal-close:hover {
          color: #ffffff;
        }

        .lp-modal-title {
          font-family: 'DM Serif Display', Georgia, serif;
          font-size: 26px;
          font-weight: 400;
          margin-bottom: 8px;
          letter-spacing: 0.02em;
        }

        .lp-modal-desc {
          font-size: 14px;
          color: #cbd5e1;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .lp-otp-group {
          display: flex;
          justify-content: center;
          gap: 8px !important;
          width: 100%;
        }

        .otp-slot {
          width: 46px !important;
          height: 52px !important;
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 10px !important;
          color: #ffffff !important;
          font-size: 20px !important;
          font-weight: 600 !important;
          transition: all 0.2s !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 !important;
          outline: none !important;
        }

        .otp-slot.ring-2 {
          border-color: #037265 !important;
          --tw-ring-color: #037265 !important;
          box-shadow: 0 0 0 4px rgba(3, 114, 101, 0.25) !important;
          background: rgba(255, 255, 255, 0.08) !important;
        }

        .animate-caret-blink {
          background-color: #037265 !important;
          width: 2px !important;
          height: 20px !important;
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
              <label htmlFor="loginVal">Adresse e-mail ou Nom d'utilisateur</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon">
                  {loginVal.includes('@') ? <Mail size={16} /> : <User size={16} />}
                </span>
                <input
                  id="loginVal"
                  type="text"
                  value={loginVal}
                  onChange={e => setLoginVal(e.target.value)}
                  placeholder="Ex: sofia@example.ma ou sofia"
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
              <a href="#" onClick={(e) => { e.preventDefault(); setShowForgot(true); }} className="lp-forgot">Mot de passe oublié ?</a>
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

        {showForgot && (
          <div className="lp-modal-overlay" onClick={() => { setShowForgot(false); setForgotSuccess(false); }}>
            <div className="lp-modal-card" onClick={(e) => e.stopPropagation()}>
              <button className="lp-modal-close" onClick={() => { setShowForgot(false); setForgotSuccess(false); }}>
                <X size={20} />
              </button>

              {!forgotSuccess ? (
                <form onSubmit={handleForgotSubmit} className="lp-form">
                  <h2 className="lp-modal-title">Mot de passe oublié</h2>
                  <p className="lp-modal-desc">
                    Entrez votre adresse e-mail ou votre nom d'utilisateur. Nous vous enverrons un code de réinitialisation à 6 chiffres par e-mail.
                  </p>

                  <div className="lp-field">
                    <label htmlFor="forgotLogin">Identifiant (Email ou Nom d'utilisateur)</label>
                    <div className="lp-input-wrap">
                      <span className="lp-input-icon">
                        {forgotLogin.includes('@') ? <Mail size={16} /> : <User size={16} />}
                      </span>
                      <input
                        id="forgotLogin"
                        type="text"
                        value={forgotLogin}
                        onChange={e => setForgotLogin(e.target.value)}
                        placeholder="sofia@example.ma ou sofia"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {forgotError && <p className="lp-error">{forgotError}</p>}

                  <button type="submit" className="lp-submit" disabled={forgotLoading}>
                    {forgotLoading ? (
                      <Loader2 size={18} className="lp-spin" />
                    ) : (
                      <>
                        <span>Envoyer les instructions</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetSubmit} className="lp-form">
                  <h2 className="lp-modal-title">Nouveau mot de passe</h2>
                  <p className="lp-modal-desc">
                    Un e-mail a été envoyé à l'adresse associée à votre compte. Saisissez le code à 6 chiffres reçu et votre nouveau mot de passe.
                  </p>

                  <div className="lp-field" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#f1f5f9', marginBottom: '12px', letterSpacing: '0.02em', alignSelf: 'flex-start' }}>
                      Code de validation (6 chiffres)
                    </label>
                    <div className="flex justify-center mb-4">
                      <InputOTP
                        maxLength={6}
                        value={otpCode}
                        onChange={setOtpCode}
                        autoFocus
                      >
                        <InputOTPGroup className="lp-otp-group">
                          <InputOTPSlot index={0} className="otp-slot" />
                          <InputOTPSlot index={1} className="otp-slot" />
                          <InputOTPSlot index={2} className="otp-slot" />
                          <InputOTPSlot index={3} className="otp-slot" />
                          <InputOTPSlot index={4} className="otp-slot" />
                          <InputOTPSlot index={5} className="otp-slot" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  <div className="lp-field">
                    <label htmlFor="newPassword">Nouveau mot de passe</label>
                    <div className="lp-input-wrap">
                      <span className="lp-input-icon"><Lock size={16} /></span>
                      <input
                        id="newPassword"
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min. 8 caractères, 1 majuscule, 1 chiffre"
                        required
                      />
                      <button type="button" className="lp-pwd-toggle" onClick={() => setShowNewPwd(v => !v)}>
                        {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {forgotError && <p className="lp-error">{forgotError}</p>}

                  <button type="submit" className="lp-submit" disabled={forgotLoading}>
                    {forgotLoading ? (
                      <Loader2 size={18} className="lp-spin" />
                    ) : (
                      <>
                        <span>Valider le mot de passe</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}