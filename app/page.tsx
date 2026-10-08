export async function generateMetadata(){const host=(await headers()).get("host")?.split(":")[0];return {alternates:{canonical:host==="app.rudyoai.com"?"https://app.rudyoai.com":"https://rudyoai.com"}};}
import { headers } from "next/headers";
import PublicHome from "./PublicHome";
import StudioHome from "./StudioHome";
export const dynamic = "force-dynamic";
export default async function Home() {
 const host=(await headers()).get("host")?.split(":")[0];
 if(host!=="rudyoai.com"&&host!=="www.rudyoai.com")return <StudioHome/>;
 return <PublicHome/>;
}
