import { handleSessionVerify } from "@/lib/session-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handleSessionVerify;
