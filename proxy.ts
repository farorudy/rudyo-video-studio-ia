import { NextRequest, NextResponse } from "next/server";
export function proxy(request:NextRequest){
 const host=request.headers.get("host")?.split(":")[0];
 if(host==="admin.rudyoai.com" || request.nextUrl.pathname==="/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
  return new NextResponse("Administration indisponible : accès réservé, authentification administrateur à configurer.",{status:403,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
 }
 const path=request.nextUrl.pathname;
 if(host==="www.rudyoai.com") return NextResponse.redirect(new URL(path+request.nextUrl.search,"https://rudyoai.com"),308);
 if(host==="rudyoai.com" && ["/studio","/projects","/credits","/dashboard","/workspace","/history","/login","/storyboard"].some(route=>path===route||path.startsWith(route+"/"))) {
  return NextResponse.redirect(new URL(path+request.nextUrl.search,"https://app.rudyoai.com"),308);
 }
 return NextResponse.next();
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
