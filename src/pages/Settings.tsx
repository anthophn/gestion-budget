import { useRef, useState, type FormEvent } from 'react';
import { Cloud, Download, Eraser, FileJson, HardDrive, KeyRound, LogOut, MonitorSmartphone, Sparkles, Trash2, Upload } from 'lucide-react';
import { useData } from '../state';
import { auth, isNativeApp } from '../lib/backend';
import { frError } from '../lib/cloud';
import { CURRENCIES } from '../lib/format';
import { backupJSON, downloadFile, expensesToCSV, parseBackup } from '../lib/exporter';
import { sampleData } from '../lib/sample';
import { isIOS, isStandalone, useInstallPrompt } from '../lib/install';
import { setTheme, useTheme, type ThemePref } from '../theme';
import { toast } from '../lib/toast';
import { Card, ask } from '../components/ui';
import { passwordProblem } from './Auth';
import { CATEGORIES } from '../lib/kakeibo';
import { CategoryBadge } from '../components/CategoryIcon';

export function SettingsPage() {
  const { user, mode, data, saveSettings, importData, clearAll } = useData();
  const theme = useTheme();
  const install = useInstallPrompt();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pw, setPw] = useState('');
  const [pwOpen, setPwOpen] = useState(false);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    const p = passwordProblem(pw);
    if (p) return toast(p, 'error');
    try {
      await auth.updatePassword(pw);
      setPw('');
      setPwOpen(false);
      toast('Mot de passe modifié', 'success');
    } catch (err) {
      toast(frError(err), 'error');
    }
  };

  const restore = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      const ok = await ask({ title: 'Importer cette sauvegarde ?', text: `${backup.expenses?.length ?? 0} dépenses et ${backup.months?.length ?? 0} mois seront ajoutés ou mis à jour.`, confirm: 'Importer' });
      if (ok && (await importData(backup))) toast('Sauvegarde importée', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fichier illisible', 'error');
    }
  };

  return (
    <div className="page settings">
      <div className="grid-2">
        <Card title="Mon compte">
          <div className="setting-row">
            <div>
              <strong>{user.email}</strong>
              <p className="muted small icon-text">
                {mode === 'cloud' ? (
                  <>
                    <Cloud size={14} /> Synchronisé sur tous tes appareils
                  </>
                ) : (
                  <>
                    <HardDrive size={14} /> Mode local : uniquement sur cet appareil
                  </>
                )}
              </p>
            </div>
          </div>
          {pwOpen ? (
            <form className="inline-form" onSubmit={changePassword}>
              <input type="password" autoComplete="new-password" placeholder="Nouveau mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Nouveau mot de passe" />
              <button type="submit" className="btn btn-primary">
                Valider
              </button>
            </form>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setPwOpen(true)}>
              <KeyRound size={16} /> Changer de mot de passe
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => auth.signOut()}>
            <LogOut size={16} /> Se déconnecter
          </button>
        </Card>

        <Card title="Préférences">
          <label className="field">
            <span>Devise</span>
            <select value={data.settings.currency} onChange={(e) => void saveSettings({ ...data.settings, currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Thème (sur cet appareil)</span>
            <div className="segmented">
              {(
                [
                  ['auto', 'Automatique'],
                  ['light', 'Clair'],
                  ['dark', 'Sombre'],
                ] as [ThemePref, string][]
              ).map(([id, label]) => (
                <button type="button" key={id} className={theme === id ? 'active' : ''} aria-pressed={theme === id} onClick={() => setTheme(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid-2">
        {!isNativeApp && (
          <Card title="Installer l’application">
            {isStandalone() ? (
              <p className="muted">L’application est installée sur cet appareil. 🎉</p>
            ) : install ? (
              <>
                <p className="muted">Installe Kakeibo pour l’ouvrir comme une vraie appli, depuis ton écran d’accueil ou ton bureau.</p>
                <button type="button" className="btn btn-primary" onClick={install}>
                  <MonitorSmartphone size={16} /> Installer
                </button>
              </>
            ) : isIOS() ? (
              <p className="muted">
                Sur iPhone / iPad : ouvre ce site dans <strong>Safari</strong>, touche le bouton <strong>Partager</strong> (carré avec une flèche) puis <strong>« Sur l’écran d’accueil »</strong>.
              </p>
            ) : (
              <p className="muted">
                Dans Chrome ou Edge : menu <strong>⋮</strong> → <strong>« Installer Kakeibo »</strong> (ou l’icône d’installation dans la barre d’adresse). Sur Android : menu <strong>⋮</strong> →{' '}
                <strong>« Ajouter à l’écran d’accueil »</strong>.
              </p>
            )}
          </Card>
        )}

        <Card title="Mes données">
          <div className="button-list">
            <button type="button" className="btn btn-ghost" disabled={data.expenses.length === 0} onClick={() => downloadFile('kakeibo-toutes-les-depenses.csv', expensesToCSV(data.expenses), 'text/csv')}>
              <Download size={16} /> Exporter les dépenses (Excel / CSV)
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => downloadFile(`kakeibo-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, backupJSON(data), 'application/json')}>
              <FileJson size={16} /> Télécharger une sauvegarde complète
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Importer une sauvegarde
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void restore(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                if (await ask({ title: 'Ajouter des données d’exemple ?', text: '6 mois de budget fictif seront ajoutés à ton compte pour découvrir l’analyse. Tu pourras tout effacer ensuite.', confirm: 'Ajouter' })) {
                  if (await importData(sampleData())) toast('Données d’exemple ajoutées', 'success');
                }
              }}
            >
              <Sparkles size={16} /> Essayer avec des données d’exemple
            </button>
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="La méthode Kakeibo">
          <p className="muted">
            Inventée au Japon en 1904 par Hani Motoko, la méthode Kakeibo (« livre de comptes du foyer ») consiste à noter chaque dépense à la main, à la ranger dans une des 4 catégories et à faire le bilan chaque mois. Le simple fait de noter rend
            plus conscient de ses dépenses.
          </p>
          <ul className="method">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <CategoryBadge category={c.id} size={26} />
                <span>
                  <strong>{c.label}</strong> — {c.examples}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Zone sensible" className="danger-zone">
          <button
            type="button"
            className="btn btn-ghost btn-danger-text"
            onClick={async () => {
              if (await ask({ title: 'Effacer toutes tes données ?', text: 'Dépenses, revenus, charges et bilans seront supprimés sur tous tes appareils. Ton compte reste actif.', confirm: 'Tout effacer', danger: true })) {
                if (await clearAll()) toast('Toutes tes données ont été effacées', 'success');
              }
            }}
          >
            <Eraser size={16} /> Effacer toutes mes données
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-danger-text"
            onClick={async () => {
              if (await ask({ title: 'Supprimer définitivement ton compte ?', text: 'Ton compte et toutes tes données seront supprimés. Cette action est irréversible.', confirm: 'Supprimer mon compte', danger: true })) {
                try {
                  await auth.deleteAccount();
                  toast('Compte supprimé', 'success');
                } catch (err) {
                  toast(frError(err), 'error');
                }
              }
            }}
          >
            <Trash2 size={16} /> Supprimer mon compte
          </button>
        </Card>
      </div>
      <p className="muted small center">Kakeibo · version {__APP_VERSION__}</p>
    </div>
  );
}
