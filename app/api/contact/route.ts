import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const {
      nom,
      prenom,
      email,
      telephone,
      typeVideo,
      objectif,
      dateLimite,
      budget,
      fichiers,
      message,
    } = data;

    // Validation basique
    if (!nom || !prenom || !email || !typeVideo || !objectif) {
      return NextResponse.json(
        { error: "Champs requis manquants" },
        { status: 400 },
      );
    }

    // Ici tu pourrais envoyer un email avec Resend, Sendgrid, ou autre
    // Pour l'instant, on va juste logguer

    console.log("📋 Nouvelle demande de devis :", {
      nom,
      prenom,
      email,
      telephone,
      typeVideo,
      objectif,
      dateLimite,
      budget,
      fichiers,
      message,
      timestamp: new Date().toISOString(),
    });

    // TODO: Intégrer avec un service d'email
    // await sendEmail({
    //   to: email,
    //   subject: "Demande de devis reçue - Farozik",
    //   html: `Merci de votre demande. Nous vous répondrons sous 24-48h.`,
    // });

    return NextResponse.json(
      { success: true, message: "Demande reçue" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Erreur contact :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
