/**
 * Remboursement des deux générations non conformes du 27 août 2026.
 *
 * Par défaut : SIMULATION. Aucune écriture n'est effectuée.
 * Exécution réelle : --execute ET la phrase d'autorisation exacte.
 *
 *   node scripts/incident-refund.mjs
 *   node scripts/incident-refund.mjs --execute --authorize "J'autorise le remboursement de 4 600 et 250 crédits sur le compte rudyfaro@farorudy.com"
 */
import pg from "pg";

const AUTHORIZATION =
  "J'autorise le remboursement de 4 600 et 250 crédits sur le compte rudyfaro@farorudy.com";

const EMAIL = "rudyfaro@farorudy.com";
const REASON = "Résultat non conforme produit par le worker de démonstration.";

const REFUNDS = [
  {
    label: "Clip 5:00 · 276 s",
    jobId: "5e74b2ff-7f9b-4005-8d59-282b265cbbda",
    reservationId: "cmtax9vvk0003ev6ovfgbbfjd",
    credits: 4600,
  },
  {
    label: "Clip 3:30 ·  15 s",
    jobId: "c3fe7a5c-4937-4c54-9a82-dffc51c00718",
    reservationId: "cmtaxj31j000cq926wdhsx856",
    credits: 250,
  },
];

const idempotencyKey = (jobId) => `refund:incident-mock-worker:${jobId}`;

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const authorization = args.includes("--authorize") ? args[args.indexOf("--authorize") + 1] : "";

if (execute && authorization !== AUTHORIZATION) {
  console.error("REFUS : phrase d'autorisation absente ou incorrecte. Aucune écriture effectuée.");
  process.exit(1);
}

const url = process.env.REFUND_DATABASE_URL;
if (!url) throw new Error("REFUND_DATABASE_URL requis");

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const { rows: users } = await client.query(
    'SELECT id, email, "creditsRemaining", "creditsUsed" FROM "User" WHERE email = $1',
    [EMAIL],
  );
  const user = users[0];
  if (!user) throw new Error(`Compte introuvable : ${EMAIL}`);

  console.log(`Mode            : ${execute ? "EXECUTION REELLE" : "SIMULATION (aucune ecriture)"}`);
  console.log(`Compte cible    : ${user.email} (${user.id})`);
  console.log(`Solde actuel    : ${user.creditsRemaining} credits`);
  console.log("");

  let total = 0;
  const applicable = [];

  for (const refund of REFUNDS) {
    const key = idempotencyKey(refund.jobId);
    const { rows: existing } = await client.query(
      'SELECT id, "creditsAmount" FROM "CreditTransaction" WHERE "idempotencyKey" = $1',
      [key],
    );
    const { rows: reservations } = await client.query(
      'SELECT id, status::text AS status, "creditsAmount" FROM "CreditTransaction" WHERE id = $1',
      [refund.reservationId],
    );
    const reservation = reservations[0];

    console.log(`${refund.label}`);
    console.log(`  jobId              : ${refund.jobId.slice(0, 8)}…${refund.jobId.slice(-4)}`);
    console.log(`  reservation        : ${reservation ? `${reservation.status} (${reservation.creditsAmount})` : "INTROUVABLE"}`);
    console.log(`  cle d'idempotence  : ${key}`);
    console.log(`  remboursement deja present : ${existing.length > 0 ? `OUI (${existing[0].id})` : "NON"}`);
    console.log(`  montant a rembourser       : ${existing.length > 0 ? 0 : refund.credits} credits`);
    console.log("");

    if (!reservation) throw new Error(`Réservation introuvable : ${refund.reservationId}`);
    if (existing.length === 0) {
      applicable.push(refund);
      total += refund.credits;
    }
  }

  console.log(`Total a rembourser : ${total} credits`);
  console.log(`Solde attendu      : ${user.creditsRemaining} + ${total} = ${user.creditsRemaining + total} credits`);
  console.log("");

  if (!execute) {
    console.log("SIMULATION terminee. Aucune ecriture n'a ete effectuee.");
    console.log("Pour executer reellement, relancer avec --execute et la phrase d'autorisation.");
  } else if (applicable.length === 0) {
    console.log("Rien a faire : les remboursements existent deja.");
  } else {
    await client.query("BEGIN");
    try {
      for (const refund of applicable) {
        // L'unicité de la clé garantit qu'un double appel ne crédite qu'une fois.
        const inserted = await client.query(
          `INSERT INTO "CreditTransaction"
             ("id","userId","type","action","status","creditsAmount","description","idempotencyKey","confirmedAt","createdAt","updatedAt")
           VALUES (md5(random()::text || clock_timestamp()::text), $1, 'REFUND', 'CLIP_PACK', 'CONFIRMED', $2, $3, $4, NOW(), NOW(), NOW())
           ON CONFLICT ("idempotencyKey") DO NOTHING
           RETURNING id`,
          [user.id, refund.credits, `${REASON} (${refund.label})`, idempotencyKey(refund.jobId)],
        );
        if (inserted.rowCount === 0) {
          console.log(`${refund.label} : deja rembourse entre-temps, ignore.`);
          continue;
        }
        // Le solde n'est jamais écrit à la main : il suit l'écriture comptable.
        await client.query(
          'UPDATE "User" SET "creditsRemaining" = "creditsRemaining" + $2, "creditsUsed" = GREATEST(0, "creditsUsed" - $2), "updatedAt" = NOW() WHERE id = $1',
          [user.id, refund.credits],
        );
        await client.query(
          `UPDATE "CreditTransaction" SET status = 'REFUNDED', "updatedAt" = NOW() WHERE id = $1 AND status = 'CONFIRMED'`,
          [refund.reservationId],
        );
        console.log(`${refund.label} : ${refund.credits} credits rembourses (${inserted.rows[0].id}).`);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    const { rows: after } = await client.query('SELECT "creditsRemaining" FROM "User" WHERE id = $1', [user.id]);
    console.log(`\nSolde final : ${after[0].creditsRemaining} credits`);
  }
} finally {
  await client.end();
}
