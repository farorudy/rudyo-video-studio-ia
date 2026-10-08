import NextAuth from "next-auth";
import {acceptsVerifiedGoogleIdentity} from "@/lib/auth-policy";
import Google from "next-auth/providers/google";
import { getOrCreateUserByEmail } from "@/lib/auth";

export const { handlers, signIn, signOut } = NextAuth({
  providers: [Google],
  session: {strategy:"jwt",maxAge:60*60*24*7},
  callbacks: {
    signIn({account,profile}) {
      return acceptsVerifiedGoogleIdentity(account?.provider,profile);
    },
    async jwt({token,account,profile}) {
      if(account) {
        if(!acceptsVerifiedGoogleIdentity(account.provider,profile) || typeof profile?.email !== "string") return null;
        const user=await getOrCreateUserByEmail(profile.email,typeof profile.name === "string" ? profile.name : undefined);
        token.rudyoUserId=user.id;
        token.identityVerified=true;
      }
      return token;
    },
    redirect({url,baseUrl}) {
      // Keep the session on the application origin.
      if(url.startsWith("/")) return `${baseUrl}${url}`;
      try {if(new URL(url).origin===baseUrl)return url;}catch {}
      return baseUrl;
    },
  },
});
