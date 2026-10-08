# Connexion RudyoAI

Auth.js utilise Google OIDC. Le profil doit provenir de Google et porter email_verified=true. Après validation, le compte métier est retrouvé/créé par son adresse vérifiée et son identifiant est conservé dans le JWT signé. Les champs envoyés depuis le client ne peuvent pas attribuer d'identité. Les anciens cookies rudyo_session restent refusés en production.

Configuration serveur nécessaire : AUTH_SECRET (aléatoire, au moins 32 caractères), AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_URL=https://app.rudyoai.com, AUTH_TRUST_HOST=true et DATABASE_URL. Saisir les secrets directement dans Vercel, jamais dans une conversation ou dans Git.

Dans Google Cloud, autoriser exactement https://app.rudyoai.com/api/auth/callback/google. Prévoir une application OAuth et un écran de consentement adaptés au public cible. Aucun identifiant OAuth n'a été créé ou configuré par cette modification.

La connexion Google remplace les mots de passe locaux : leur récupération relève du fournisseur Google. Aucun e-mail n'est envoyé par cette intégration. Une autre méthode de connexion sera nécessaire pour les personnes ne disposant pas de compte Google.

Les sessions expirent après sept jours. L'administration reste bloquée : aucun rôle administrateur n'est attribué automatiquement, notamment à partir d'un nom ou d'une adresse saisie. Ne pas publier avant test de bout en bout : refus de profil non vérifié, connexion, reprise de compte, isolation entre deux comptes, déconnexion, expiration et crédits.
