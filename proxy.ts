import { NextRequest, NextResponse } from "next/server";
export function proxy(request:NextRequest){
 const host=request.headers.get("host")?.split(":")[0];
 if(host==="admin.rudyoai.com" || request.nextUrl.pathname==="/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
  return new NextResponse("Administration indisponible : accès réservé, authentification administrateur à configurer.",{status:403,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
 }
 return NextResponse.next();
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
