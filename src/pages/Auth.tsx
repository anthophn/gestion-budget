import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { auth } from '../lib/backend';
import { frError } from '../lib/cloud';
import { toast } from '../lib/toast';
import { Logo } from '../components/Logo';

type View = 'signin' | 'signup' | 'forgot' | 'check-email';

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Le mot de passe doit contenir des lettres et au moins un chiffre.';
  return null;
}

export function AuthPage() {
  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentFor, setSentFor] = useState<'signup' | 'reset'>('signup');

  const switchTo = (v: View) => {
    setView(v);
    setError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const mail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setError('Adresse e-mail invalide.');
    if (view === 'signup') {
      const p = passwordProblem(password);
      if (p) return setError(p);
      if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    }
    setBusy(true);
    try {
      if (view === 'signin') await auth.signIn(mail, password);
      else if (view === 'signup') {
        const res = await auth.signUp(mail, password);
        if (res.needsConfirmation) {
          setSentFor('signup');
          setView('check-email');
        } else toast('Bienvenue ! Ton compte est créé.', 'success');
      } else if (view === 'forgot') {
        await auth.sendReset(mail);
        setSentFor('reset');
        setView('check-email');
      }
    } catch (err) {
      setError(frError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-side">
        <Logo big />
        <p className="auth-pitch">Le carnet de comptes japonais, synchronisé sur ton téléphone et ton ordinateur.</p>
        <ul className="auth-points">
          <li>
            <strong>Planifie</strong> ton mois : revenus, charges fixes, objectif d’épargne.
          </li>
          <li>
            <strong>Note</strong> chaque dépense dans l’une des 4 catégories Kakeibo.
          </li>
          <li>
            <strong>Analyse</strong> tes budgets et fais ton bilan en fin de mois.
          </li>
        </ul>
      </div>

      <div className="auth-card">
        {view === 'check-email' ? (
          <div className="auth-sent">
            <MailCheck size={40} />
            <h1>Vérifie tes e-mails</h1>
            <p className="muted">
              {sentFor === 'signup'
                ? `Un lien de confirmation a été envoyé à ${email}. Clique dessus pour activer ton compte, puis connecte-toi.`
                : `Si un compte existe pour ${email}, tu vas recevoir un lien pour choisir un nouveau mot de passe.`}
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => switchTo('signin')}>
              Retour à la connexion
            </button>
          </div>
        ) : (
          <>
            {view !== 'forgot' && (
              <div className="segmented" role="tablist">
                <button type="button" role="tab" aria-selected={view === 'signin'} className={view === 'signin' ? 'active' : ''} onClick={() => switchTo('signin')}>
                  Connexion
                </button>
                <button type="button" role="tab" aria-selected={view === 'signup'} className={view === 'signup' ? 'active' : ''} onClick={() => switchTo('signup')}>
                  Créer un compte
                </button>
              </div>
            )}
            <h1 className="auth-title">{view === 'signin' ? 'Content de te revoir' : view === 'signup' ? 'Crée ton compte gratuit' : 'Mot de passe oublié'}</h1>
            {view === 'forgot' && <p className="muted">Indique ton e-mail : tu recevras un lien pour choisir un nouveau mot de passe.</p>}
            <form className="form" onSubmit={submit}>
              <label className="field">
                <span>E-mail</span>
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="toi@exemple.fr" />
              </label>
              {view !== 'forgot' && (
                <label className="field">
                  <span>Mot de passe</span>
                  <div className="password">
                    <input
                      type={show ? 'text' : 'password'}
                      autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={view === 'signup' ? 8 : undefined}
                    />
                    <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {view === 'signup' && <small className="muted">8 caractères minimum, avec lettres et chiffres.</small>}
                </label>
              )}
              {view === 'signup' && (
                <label className="field">
                  <span>Confirme le mot de passe</span>
                  <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </label>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Un instant…' : view === 'signin' ? 'Se connecter' : view === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
              </button>
            </form>
            {view === 'signin' && (
              <button type="button" className="link-btn center" onClick={() => switchTo('forgot')}>
                Mot de passe oublié ?
              </button>
            )}
            {view === 'forgot' && (
              <button type="button" className="link-btn center" onClick={() => switchTo('signin')}>
                ← Retour à la connexion
              </button>
            )}
          </>
        )}
        {auth.mode === 'local' && (
          <p className="auth-local">
            <strong>Mode local</strong> : Supabase n’est pas encore configuré. Les comptes sont créés sur cet appareil uniquement, sans synchronisation.
          </p>
        )}
      </div>
    </div>
  );
}

export function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = passwordProblem(password);
    if (p) return setError(p);
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setBusy(true);
    try {
      await auth.updatePassword(password);
      toast('Mot de passe modifié', 'success');
      history.replaceState(null, '', location.pathname);
      onDone();
    } catch (err) {
      setError(frError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth auth-single">
      <div className="auth-card">
        <Logo />
        <h1 className="auth-title">Choisis un nouveau mot de passe</h1>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Nouveau mot de passe</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label className="field">
            <span>Confirme le mot de passe</span>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  );
}
