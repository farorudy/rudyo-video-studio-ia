#!/usr/bin/env node

/**
 * Script pour créer un utilisateur de test avec crédits
 * pour tester la production vidéo
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function createTestUser() {
  console.log("👤 Création d'un utilisateur de test...\n");

  try {
    // Vérifier si l'utilisateur existe
    const existingUser = await prisma.user.findFirst({
      where: { email: "test@rudyo.local" },
    });

    if (existingUser) {
      console.log("✅ Utilisateur de test existe déjà!");
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Crédits: ${existingUser.credits}`);
      return existingUser;
    }

    // Créer un nouvel utilisateur
    const user = await prisma.user.create({
      data: {
        email: "test@rudyo.local",
        name: "Test User",
        plan: "CREATOR", // Plan CREATOR pour plus de crédits
        credits: 10000, // Crédits suffisants pour tester
      },
    });

    console.log("✅ Utilisateur créé avec succès!");
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Plan: ${user.plan}`);
    console.log(`   Crédits: ${user.credits}\n`);

    return user;
  } catch (error) {
    console.error("❌ Erreur lors de la création:", error.message);
    return null;
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
