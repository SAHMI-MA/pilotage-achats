# Déploiement Vercel + Railway (version de travail)

## Architecture
Une seule application Next.js sur Vercel (pages et API). Railway héberge uniquement PostgreSQL. Aucun service backend Railway distinct n'est nécessaire.

## Préparer Railway
1. Créer un projet Railway et ajouter **PostgreSQL**.
2. Récupérer l'URL de connexion **publique** PostgreSQL (nécessaire depuis Vercel). Ne pas utiliser l'hôte interne `postgres.railway.internal` depuis Vercel.
3. Ne jamais partager cette URL ni la committer dans Git.

## Préparer la base
Depuis un terminal ayant Node.js >= 22.13 :
```bash
corepack enable
corepack pnpm install
DATABASE_URL='postgresql://...' corepack pnpm db:init
```
Sous Windows PowerShell : `$env:DATABASE_URL='postgresql://...' ; corepack pnpm db:init`.

## Déployer sur Vercel
1. Importer le dépôt GitHub privé dans Vercel, framework **Next.js**, répertoire racine `pilotage-achats` si le dépôt contient ce dossier.
2. Définir `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` dans les variables d'environnement **server-side** (sans préfixe `NEXT_PUBLIC_`).
3. Déployer. Vérifier les routes `/` et `/api/projects` et l'enregistrement après rechargement.
4. Ajouter ensuite votre domaine personnalisé dans Vercel et configurer ses DNS chez l'hébergeur actuel.

## Sécurité / limites
- La protection actuelle utilise HTTP Basic avec un seul administrateur. **Ne pas utiliser pour plusieurs utilisateurs ou données sensibles sans une authentification robuste et des contrôles d'accès.**
- Le mot de passe est transmis via HTTPS, mais le navigateur peut mémoriser les identifiants Basic. Utiliser un mot de passe fort et HTTPS uniquement.
- Les migrations de données existantes depuis Cloudflare D1 ne sont **pas** automatiques.
- Le classeur d'import intégré ne s'applique que si l'email administrateur correspond à l'email propriétaire prévu dans le snapshot ; sinon il est ignoré.
- La compilation Next.js et les requêtes PostgreSQL réelles doivent être testées avant la mise en production.
