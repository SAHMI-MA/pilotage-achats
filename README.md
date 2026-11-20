# Pilotage achats — copie indépendante

Cette archive contient le code complet de l’interface et des fonctions de suivi : tableau de bord, édition des projets, fournisseurs et offres V1–V3, historiques et commentaires, relances indépendantes et rappels, indicateurs, import Excel/CSV avec aperçu et fusion, exports Excel, API, schéma Drizzle et migrations. Le design et les composants de l’édition exportée sont conservés. Les projets embarqués et l’exemple de classeur ont été remplacés par des données fictives.

**Cette copie est sans lien avec l’application d’origine.** Elle n’inclut aucun compte, mot de passe, jeton, base de production, sauvegarde réelle ni accès au Site original. L’archive n’a pas été déployée.

## Prérequis et lancement local

- Node.js 22.13 ou ultérieur et pnpm 11.25 (Corepack peut l’activer).
- Depuis le répertoire `pilotage-achats` :

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Ouvrir `http://localhost:5173`. En développement local, l’aperçu Sites fournit une identité de démonstration fictive. Elle est réservée à la boucle locale et ne constitue pas une authentification de production.

Pour vérifier le code :

```sh
node scripts/verify-projects.mjs
node scripts/verify-tracking.mjs
node scripts/verify-followups.mjs
npx tsc --noEmit --incremental false
```

## Nouvelle base de données

Le stockage attendu est Cloudflare D1 avec Drizzle. Créer une **nouvelle** base D1 dans le compte du nouveau propriétaire, relever son identifiant, puis remplacer la valeur de démonstration dans `wrangler.toml` (à créer pour le compte cible) et déclarer le binding `DB`. Ne réutilisez ni binding ni identifiant de la production d’origine. Après compilation, appliquer les migrations numérotées une seule fois et dans l’ordre :

```sh
corepack pnpm build
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote
```

Pour local, Wrangler crée un état neuf dans `.wrangler/state`. Pour la production D1, vérifier d’abord le compte et le nom de base sélectionnés dans Wrangler; la commande distante modifie uniquement la nouvelle base configurée. Les migrations SQL sont sous `drizzle/`; les snapshots et le journal Drizzle sont fournis. En cas d’évolution du schéma, modifier `db/schema.ts`, puis générer une migration avec `corepack pnpm db:generate` et la relire avant application.

## Déploiement indépendant

### Option A — nouveau Site ChatGPT (reprend l’authentification existante)

Créer un **nouveau Site privé** avec un nouveau dépôt et une nouvelle base D1. Importer ce dossier comme source du nouveau Site, attacher le binding `DB`, installer les dépendances et construire avec le pipeline Vinext/Sites fourni (`corepack pnpm build`), puis appliquer les migrations sur la nouvelle D1. Configurer l’accès du nouveau Site séparément. Les routes de connexion `/signin-with-chatgpt` et les en-têtes d’identité proviennent de l’hébergement Sites : ils ne créent pas une authentification générique sur un autre hébergeur.

### Option B — autre hébergeur/URL

Le Worker et les API attendent une identité authentifiée provenant d’un proxy de confiance. Avant d’ouvrir l’application, un développeur doit intégrer un fournisseur d’authentification au nouvel hébergeur, vérifier la session côté serveur et établir les valeurs d’identité fiables utilisées par `app/chatgpt-auth.ts`. **Ne copiez pas des en-têtes d’identité fournis par le navigateur et ne mettez pas l’application en public sans cette adaptation** : les modifications et données de projets sont protégées par cette identité. Configurer ensuite un nouveau nom de domaine, secrets et binding D1, compiler, migrer, tester les rôles et vérifier les sauvegardes de la nouvelle base. Aucun déploiement tiers n’est inclus dans cette archive.

Pour la démonstration, les API peuvent être testées par les scripts automatisés. Les données fictives d’amorçage sont dans `lib/seed.ts`. Elles servent à la démonstration et ne sont pas le transfert de la base réelle.

## Configuration de l’environnement

Aucun fichier `.env` secret n’est fourni. Ne stockez pas de secret dans Git ou dans le navigateur. Les paramètres d’authentification, D1, domaine, sauvegarde et éventuellement SMTP/Microsoft 365 doivent être créés sur le compte indépendant, dans son gestionnaire de secrets. Garder le compte local et la production séparés.

Voir également [`AUTOMATISATIONS_ET_INTEGRATIONS.md`](AUTOMATISATIONS_ET_INTEGRATIONS.md) et [`MANIFESTE_EXPORT.json`](MANIFESTE_EXPORT.json).
