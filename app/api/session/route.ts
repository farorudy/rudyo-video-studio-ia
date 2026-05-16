import { handleSessionGet, handleSessionPost } from "@/lib/session-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleSessionGet;
export const POST = handleSessionPost;
