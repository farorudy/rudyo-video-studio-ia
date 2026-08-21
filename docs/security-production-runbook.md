# Mise en production sécurisée

Ce document est une procédure opératoire. Les migrations et secrets ne doivent jamais être appliqués depuis une Preview ni pendant `next build`.

## Blocages avant production

- Exécuter le test PostgreSQL de concurrence avec une base éphémère via `TEST_DATABASE_URL`.
- Reconstituer et valider une base vide : les migrations actuelles sont incrémentales et ne constituent pas encore un historique initial complet.
- Vérifier le worker HTTPS de rendu final et son authentification Bearer.
- Migrer les objets historiques publics vers des objets privés avec journal, reprise et comparaison de hachage. Ne supprimer les anciens objets qu'après validation et autorisation distincte.
- Vérifier `APP_BASE_URL`, les domaines Vercel et les webhooks Stripe/BytePlus sans modifier le DNS depuis ce dépôt.

## Ordre de déploiement

1. Geler les écritures administratives et effectuer une sauvegarde PostgreSQL chiffrée, puis tester sa restauration sur une base isolée.
2. Capturer l'état des migrations avec `prisma migrate status` et conserver le SHA Git déployé.
3. Appliquer les migrations avec une tâche opérateur dédiée : `prisma migrate deploy`. Ne jamais ajouter cette commande au build Vercel.
4. Configurer les secrets serveur dans Production et Preview séparément : `AUTH_SECRET`, SMTP/Resend, Stripe, Turnstile, Blob, `ARK_API_KEY`, worker de rendu et administration.
5. Déployer une Preview, exécuter les parcours utilisateur/admin, les paiements Stripe en mode test, les doublons de webhook, les limites et les accès croisés.
6. Promouvoir l'artefact vérifié, puis surveiller erreurs 5xx, refus 401/403/429, files de rendu, webhooks échoués et réservations de crédits non finalisées.

## Rotation de secrets

Créer les nouveaux secrets avec forte entropie dans le gestionnaire prévu, les injecter sans les écrire dans Git, déployer, valider, puis révoquer les anciennes valeurs chez chaque fournisseur. La rotation de `AUTH_SECRET` révoque les sessions et signatures média existantes ; la planifier explicitement.

## Retour arrière

- Revenir à l'artefact applicatif précédent sans effacer de tables ni d'objets.
- Désactiver les nouvelles routes coûteuses par configuration si nécessaire.
- Les migrations de ce lot sont additives : conserver les colonnes/tables lors du rollback applicatif.
- Restaurer une sauvegarde uniquement après décision d'incident et sur preuve d'une corruption de données ; ne pas utiliser une restauration pour un simple défaut applicatif.
- Réconcilier ensuite `StripeWebhookEvent`, `SubscriptionCreditGrant`, réservations de crédits et tâches fournisseur avant de rouvrir les écritures.
