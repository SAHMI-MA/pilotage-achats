# Automatisations et intégrations à recréer séparément

## Inclus dans le code

- Le calcul métier des rappels à partir des projets enregistrés et de leurs réglages (rappels activés/désactivés, dates prévues, suivis enregistrés), ainsi que la prévention des doublons dans la base.
- Le centre de notifications affiché dans l’application et les notifications navigateur lorsqu’un utilisateur a accordé l’autorisation et garde la page ouverte.
- La route `POST /api/notifications/check`. Elle calcule les rappels et, en mode effectif, enregistre leurs identifiants de livraison dans la base de **cette copie**. Elle n’envoie aucun courriel aux fournisseurs ou prescripteurs.
- Les vérifications automatisées du comportement des relances, imports/exports et notifications dans `scripts/`.

## Non inclus, à reconfigurer

- La tâche planifiée ChatGPT qui vérifiait périodiquement l’application originale et notifiait son propriétaire. Une tâche ChatGPT est un réglage externe, attaché à une URL et à une identité de Site; elle n’est pas contenue dans le dépôt. Si souhaitée pour la copie, créer une nouvelle tâche avec l’URL de la copie, un accès de service autorisé pour celle-ci, son horaire et son destinataire. Ne réutiliser ni l’URL ni un jeton de l’original.
- Microsoft 365 / Outlook et l’envoi automatique de courriels. Aucune connexion OAuth, boîte, connecteur, règle d’envoi ou automatisation Microsoft 365 n’est implémenté ici. Pour en ajouter une, connecter le nouveau compte M365, décider quels types de rappels peuvent envoyer un message, définir modèle, destinataires, fuseau horaire et politique anti-doublon, puis tester en mode brouillon avant activation. Les fournisseurs et prescripteurs ne recevront rien avec le code livré.
- Le compte D1, le domaine, les droits d’accès, les secrets et la surveillance/sauvegarde d’exploitation du nouvel hébergement.

Les exemples de services planifiés ci-dessous sont uniquement une intégration future : un ordonnanceur authentifié peut appeler `POST /api/notifications/check` sur la nouvelle URL. L’accès doit être restreint au service et les secrets conservés dans son coffre. Le script `scripts/check-notifications.py` lit sa configuration depuis stdin et refuse toute URL qui n’est pas HTTPS; il ne contient aucun jeton. N’y placer que l’URL et les identifiants du **nouveau** déploiement. Il n’est pas lancé automatiquement.
