import { randomBytes, scryptSync } from "crypto";

const password = randomBytes(18).toString("base64url");
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
const sessionSecret = randomBytes(48).toString("base64url");

console.log("Conservez ces valeurs dans un gestionnaire de mots de passe.");
console.log(`ADMIN_INITIAL_PASSWORD=${password}`);
console.log(`ADMIN_PASSWORD_SALT=${salt.toString("base64")}`);
console.log(`ADMIN_PASSWORD_HASH=${hash.toString("base64")}`);
console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
