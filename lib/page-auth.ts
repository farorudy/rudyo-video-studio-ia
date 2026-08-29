import "server-only";

import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function getPageUser() {
  const incoming = await headers();
  const request = new NextRequest("http://rudyo.internal/page", { headers: { cookie: incoming.get("cookie") || "" } });
  return getCurrentUser(request);
}
