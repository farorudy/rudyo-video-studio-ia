# Forfaits de clips automatiques et recharges exactes

## Source de vérité

Les règles tarifaires vivent dans `lib/tiktok-offer.ts`. Le navigateur affiche
les résultats calculés par le serveur, mais ne transmet jamais un montant ou un
nombre de crédits à Stripe.

| Formule | Durée normalisée | Plafond | Prix plafond |
| --- | ---: | ---: | ---: |
| Clip TikTok | 1 à 210 s | 3 500 crédits | 35 € |
| Clip Long | 211 à 300 s | 5 000 crédits | 50 € |
| Clip Premium | 301 à 420 s | 7 000 crédits | 70 € |

La durée normalisée vaut `max(1, round(durée brute))`. Le coût exact vaut
`ceil(durée normalisée × 1000 / 60)` crédits, avec 100 crédits pour 1 €. Une
durée normalisée supérieure à 420 secondes est refusée et orientée vers un
devis personnalisé ; elle n'est jamais tronquée silencieusement.

Les formules Long et Premium peuvent être suspendues indépendamment avec
`CLIP_LONG_ENABLED` et `CLIP_PREMIUM_ENABLED`. Les contrôles de rentabilité
utilisent également les coûts BytePlus, worker, stockage et reprise définis
dans les variables serveur.

## Parcours avec solde insuffisant

1. Le serveur sonde le fichier audio, normalise sa durée et choisit la formule.
2. Il crée un projet privé au statut `DRAFT`, puis conserve la photo, la musique,
   l'idée et les options dans des ressources privées.
3. Le serveur relit le solde en base et calcule exactement les crédits manquants.
4. Stripe Checkout reçoit un `unit_amount` serveur égal aux crédits manquants,
   car un crédit vaut un centime d'euro. Aucun prix fourni par le navigateur
   n'est accepté.
5. Le webhook Stripe signé crédite la transaction une seule fois et marque le
   paiement sur le brouillon. Il ne lance ni Seedance ni le montage.
6. Le retour Checkout rouvre le projet. Une confirmation explicite de
   l'utilisateur est obligatoire avant l'appel à Seedance.

La recharge utilise des clés d'idempotence Stripe et base de données. La
réservation des crédits et la prise en charge du brouillon protègent aussi les
confirmations concurrentes.

## Stripe et production

Ce parcours emploie une ligne de prix dynamique dans Checkout pour la recharge
exacte. Il ne crée ni ne modifie un produit ou un prix permanent dans le
catalogue Stripe. Toute création de produit réel, migration de production,
génération Seedance facturable ou mise en production du worker exige une
autorisation explicite préalable.

## Validation locale

```bash
npx prisma generate
npx prisma validate
npm run test:seedance
npm run test:security
npm run typecheck
npm run lint
npm run build
cd worker && npm test
```

Les tests couvrent les limites de durée, le choix automatique des trois
formules, la recharge exacte, les incohérences de webhook, l'idempotence, la
confirmation explicite et les rendus worker jusqu'à 420 secondes.
