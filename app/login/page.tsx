"use client";
import {signIn} from "next-auth/react";
import {useState} from "react";
export default function LoginPage(){
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 return <main className="mx-auto max-w-lg p-10 text-white"><h1 className="text-3xl font-bold">Connexion sécurisée</h1><p className="my-6">Connectez-vous avec votre compte Google. Une adresse vérifiée est nécessaire. Les anciens comptes sont retrouvés par leur adresse vérifiée.</p><button disabled={busy} className="rounded-xl bg-cyan-400 p-4 text-slate-950" onClick={async()=>{setBusy(true);setError("");try{await signIn("google",{redirectTo:"/studio"});}catch{setError("Connexion indisponible. Réessayez plus tard.");setBusy(false);}}}>{busy?"Connexion en cours…":"Continuer avec Google"}</button><p role="alert">{error}</p></main>;
}
