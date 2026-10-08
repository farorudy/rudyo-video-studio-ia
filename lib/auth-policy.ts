export function acceptsVerifiedGoogleIdentity(provider:unknown,profile:unknown):boolean {
 if(provider!=="google"||!profile||typeof profile!=="object")return false;
 const claims=profile as {email_verified?:unknown;email?:unknown};
 return claims.email_verified===true && typeof claims.email==="string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email);
}
