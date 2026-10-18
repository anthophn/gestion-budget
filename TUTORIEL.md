# Publier Kakeibo gratuitement — tutoriel pas à pas

Ce guide met ton appli en ligne pour que **n'importe qui** puisse l'installer gratuitement, sur téléphone comme sur ordinateur, avec un compte personnel synchronisé. Aucune carte bancaire, aucun serveur à gérer. Compte 30 à 45 minutes la première fois.

## 0. Ce qu'il te faut

| Service | À quoi il sert | Prix |
| --- | --- | --- |
| [GitHub](https://github.com/signup) | Garde le code, met le site en ligne, fabrique les fichiers à télécharger | Gratuit |
| [Supabase](https://supabase.com/dashboard/sign-up) | Comptes utilisateurs + base de données synchronisée | Gratuit (offre Free) |
| [GitHub Desktop](https://desktop.github.com/) | Envoyer le code sur GitHub sans taper de commande | Gratuit |

Astuce : sur Supabase, choisis **« Continue with GitHub »** pour n'avoir qu'un seul identifiant.

Comment ça marche : l'appli est un site web installable (PWA). Le même code s'affiche en **version PC** (menu à gauche, tableaux) ou en **version mobile** (onglets en bas, bouton +). Les données vivent dans Supabase : ce que tu saisis sur ton téléphone apparaît en temps réel sur ton PC.

---

## 1. Créer la base de données et les comptes (Supabase)

1. Connecte-toi sur [supabase.com/dashboard](https://supabase.com/dashboard) puis **New project**.
2. Remplis :
   - **Name** : `kakeibo`
   - **Database Password** : clique sur *Generate a password* et garde-le dans un coin (tu n'en auras normalement plus besoin).
   - **Region** : *West EU (Paris)* ou la plus proche de chez toi.
   - Plan **Free**, puis **Create new project**. Attends 1 à 2 minutes.
3. Menu de gauche → **SQL Editor** → **New query**. Ouvre le fichier `supabase/schema.sql` du projet, copie **tout** son contenu, colle-le et clique sur **Run**. Tu dois voir *Success. No rows returned*.
   Ce script crée les tables, la règle de sécurité « chaque utilisateur ne voit que ses données », la suppression de compte et la synchronisation en temps réel.
4. Menu **Authentication** → **Sign In / Providers** (ou *Providers*) → **Email** :
   - laisse **Enable Email provider** activé ;
   - **désactive « Confirm email »** puis **Save**.
   Pourquoi : l'expéditeur d'e-mails fourni par Supabase n'envoie qu'aux membres de ton équipe Supabase, et seulement 2 e-mails par heure. Sans confirmation, n'importe qui peut créer son compte et l'utiliser tout de suite. (Pour activer la confirmation et le « mot de passe oublié » pour tout le monde, voir la section 6.)
5. Récupère tes deux clés : bouton **Connect** en haut de la page du projet (ou **Project Settings** → **API Keys**) :
   - **Project URL** : `https://xxxxxxxx.supabase.co`
   - **Publishable key** (`sb_publishable_…`) — ou, dans l'onglet *Legacy API keys*, la clé **anon public**. Les deux fonctionnent.
   ⚠️ Ne copie **jamais** la clé *secret* / *service_role* dans l'appli : elle donne tous les droits sur la base.

---

## 2. Mettre le code sur GitHub

1. Sur [github.com/new](https://github.com/new), crée un dépôt :
   - **Repository name** : `kakeibo`
   - **Public** (obligatoire pour GitHub Pages gratuit)
   - ne coche rien d'autre → **Create repository**.
2. Ajoute tes clés Supabase **avant** d'envoyer le code : dans le dépôt, **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, deux fois :

   | Name | Secret |
   | --- | --- |
   | `VITE_SUPABASE_URL` | ton *Project URL* |
   | `VITE_SUPABASE_ANON_KEY` | ta *Publishable key* (ou *anon key*) |

3. Active le site : **Settings** → **Pages** → **Build and deployment** → **Source : GitHub Actions**.
4. Envoie le code avec **GitHub Desktop** :
   1. Installe GitHub Desktop et connecte-toi avec ton compte GitHub.
   2. **File** → **Clone repository** → choisis `kakeibo` → choisis un dossier sur ton ordinateur → **Clone**.
   3. Décompresse `kakeibo.zip` (tu obtiens un dossier `kakeibo`) et copie **tout son contenu** dans le dossier cloné, y compris les éléments cachés `.github` et `.gitignore`.
      Sur Mac, appuie sur **Cmd + Maj + .** dans le Finder pour voir les fichiers cachés. Sur Windows, ils sont visibles par défaut.
   4. Dans GitHub Desktop, écris « Première version » dans **Summary** → **Commit to main** → **Push origin**.

   Sans GitHub Desktop : sur la page du dépôt, **uploading an existing file**, glisse le contenu du dossier, puis **Commit changes**. Vérifie ensuite que le dossier `.github/workflows` apparaît bien dans le dépôt ; s'il manque, crée les deux fichiers à la main avec **Add file → Create new file** (nom : `.github/workflows/deploy.yml`, puis `release.yml`) et colles-y leur contenu.

---

## 3. Mettre l'appli en ligne

1. Dans le dépôt, onglet **Actions** : le travail **« Mettre le site en ligne »** démarre tout seul après l'envoi du code. Attends la coche verte (1 à 2 minutes). S'il n'a pas démarré : clique dessus → **Run workflow**.
2. Ton appli est en ligne à l'adresse :
   `https://TON-PSEUDO.github.io/kakeibo/`
   (elle est aussi affichée dans **Settings → Pages**).
3. Retourne dans Supabase → **Authentication** → **URL Configuration** :
   - **Site URL** : `https://TON-PSEUDO.github.io/kakeibo/`
   - **Redirect URLs** → **Add URL** : `https://TON-PSEUDO.github.io/kakeibo/**` (et `http://localhost:5173/**` si tu développes sur ton PC).
   - **Save**.
4. Ouvre l'adresse : l'écran de connexion **ne doit pas** afficher « Mode local ». S'il l'affiche, les secrets de l'étape 2 sont absents ou mal nommés : corrige-les, puis **Actions → Mettre le site en ligne → Run workflow**.

Alternative à GitHub Pages : [Vercel](https://vercel.com) ou [Netlify](https://netlify.com) (gratuits). *Add New Project* → importe le dépôt → ajoute les deux variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` → *Deploy*. Pense à mettre leur adresse dans Supabase (étape 3) et, pour les applis à télécharger, à créer une variable de dépôt `PUBLIC_URL` (Settings → Secrets and variables → Actions → onglet *Variables*) avec cette adresse.

---

## 4. Installer l'appli et vérifier la synchronisation

Donne simplement l'adresse du site à qui tu veux. Chacun crée son propre compte : les données sont séparées par utilisateur.

| Appareil | Comment installer |
| --- | --- |
| Android (Chrome) | Ouvre l'adresse → menu **⋮** → **Installer l'application** (ou *Ajouter à l'écran d'accueil*) |
| iPhone / iPad (Safari) | Ouvre l'adresse dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter** |
| PC Windows / Mac / Linux (Chrome ou Edge) | Icône **Installer** dans la barre d'adresse, ou menu → **Installer Kakeibo** |
| Depuis l'appli | **Réglages** → **Installer l'application** |

Vérifier que tout est synchronisé :

1. Sur ton téléphone, crée ton compte (e-mail + mot de passe).
2. Sur ton PC, connecte-toi avec le **même** e-mail et mot de passe.
3. Ajoute une dépense sur le téléphone : elle apparaît sur le PC en une ou deux secondes. Le point vert **« Synchronisé »** en haut indique que le temps réel fonctionne.

---

## 5. Bonus : des fichiers .exe, .dmg, .apk à télécharger

Le dépôt contient une automatisation qui fabrique les applications natives et les publie sur une page de téléchargement.

1. Onglet **Actions** → **« Publier les applications »** → **Run workflow** → version `1.0.0` → **Run workflow**.
2. Attends 10 à 15 minutes. La page **Releases** du dépôt contient alors :

   | Appareil | Fichier |
   | --- | --- |
   | Windows 10 / 11 | `Kakeibo-1.0.0-win-x64.exe` |
   | Mac (puce Apple) | `Kakeibo-1.0.0-mac-arm64.dmg` |
   | Mac (Intel) | `Kakeibo-1.0.0-mac-x64.dmg` |
   | Linux | `Kakeibo-1.0.0-linux-x86_64.AppImage` |
   | Android | `Kakeibo-1.0.0-android.apk` |

3. Partage ce lien, qui pointe toujours vers la dernière version :
   `https://github.com/TON-PSEUDO/kakeibo/releases/latest`

Ce qu'il faut savoir :

- Les applis ne sont pas signées par un éditeur payant. **Windows** affiche « Windows a protégé votre ordinateur » → *Informations complémentaires* → *Exécuter quand même*. **Mac** : ouvre l'appli une fois, puis **Réglages Système → Confidentialité et sécurité → Ouvrir quand même**. **Android** : autorise l'installation d'applications inconnues pour ton navigateur.
- Sur Android, si une nouvelle version refuse de s'installer par-dessus l'ancienne, désinstalle l'ancienne d'abord : tes données sont en ligne, tu ne perds rien. (Avancé : pour éviter ça, crée une clé de signature avec `keytool -genkeypair -v -keystore kakeibo.keystore -alias kakeibo -keyalg RSA -keysize 2048 -validity 10000`, puis ajoute les secrets `ANDROID_KEYSTORE_BASE64` (le fichier encodé en base64), `ANDROID_KEYSTORE_PASSWORD` et `ANDROID_KEY_ALIAS`.)
- **iPhone** : une appli native exige un compte Apple Developer payant (99 $/an). La version installée depuis Safari (étape 4) est la solution gratuite, avec les mêmes fonctions.

---

## 6. Mettre à jour, limites, sécurité, dépannage

### Mettre à jour l'appli
- **Site / appli installée** : modifie le code, puis *Commit* + *Push* dans GitHub Desktop. Le site se met à jour tout seul en 1 à 2 minutes, et les applis installées se mettent à jour à leur prochaine ouverture.
- **Fichiers à télécharger** : relance **Publier les applications** avec un nouveau numéro (`1.0.1`, `1.1.0`…).

### Limites des offres gratuites
- **Supabase Free** : base de 500 Mo par projet (des centaines de milliers de dépenses), 50 000 utilisateurs actifs par mois, 2 projets actifs. Un projet **sans aucune activité pendant 1 semaine est mis en pause** : ouvre le tableau de bord Supabase et clique sur *Restore project* (les données sont conservées). [Tarifs Supabase](https://supabase.com/pricing)
- **GitHub Pages** : dépôt public, site de 1 Go maximum, 100 Go de bande passante par mois (limite souple), pas destiné à un usage commercial. [Limites GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- **GitHub Actions** : gratuit pour les dépôts publics.

### Activer la confirmation d'e-mail et le « mot de passe oublié » pour tous
Branche un service d'e-mails gratuit ([Brevo](https://developers.brevo.com/docs/supabase-smtp-integration), Resend…) dans **Supabase → Authentication → Emails → SMTP Settings**, puis réactive *Confirm email* si tu le souhaites. [Doc Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

### Sécurité
- La clé *publishable / anon* est publique par nature : elle est visible dans le site. Ce sont les règles de sécurité (RLS) créées par `schema.sql` qui empêchent un utilisateur de lire les données d'un autre.
- Les mots de passe sont gérés par Supabase (jamais stockés en clair). Le site est servi en HTTPS.
- Chaque utilisateur peut exporter ses données (CSV pour Excel, sauvegarde JSON) et supprimer son compte dans **Réglages**.

### Dépannage

| Problème | Solution |
| --- | --- |
| Le site affiche « Mode local » | Secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` absents ou mal nommés → corrige-les puis relance « Mettre le site en ligne » |
| Page 404 sur GitHub Pages | Vérifie *Settings → Pages → Source : GitHub Actions* et que l'adresse se termine par `/kakeibo/` |
| « E-mail ou mot de passe incorrect » juste après l'inscription | *Confirm email* est encore activé dans Supabase → désactive-le (étape 1.4) |
| Aucun e-mail reçu (mot de passe oublié) | Normal sans SMTP personnalisé → voir « Activer la confirmation d'e-mail » ci-dessus |
| Le lien d'un e-mail ouvre `localhost` | Renseigne *Site URL* dans Supabase (étape 3.3) |
| Point orange « Connexion… » qui reste | Relance `schema.sql` (la partie 7 active le temps réel), puis recharge la page |
| « Failed to fetch » / plus rien ne charge | Projet Supabase en pause → *Restore project* |
| « Publier les applications » échoue sur un système | Les autres fichiers sont quand même publiés ; ouvre le travail en échec → *Re-run failed jobs* |

### Lancer l'appli sur ton ordinateur (facultatif, pour modifier le code)
Installe [Node.js](https://nodejs.org) (version 22 ou plus), puis dans le dossier du projet :

```bash
npm install
cp .env.example .env.local   # puis colle tes clés Supabase dedans
npm run dev                  # ouvre http://localhost:5173
```

Sans `.env.local`, l'appli démarre en mode local (comptes stockés dans le navigateur) : pratique pour tester.
