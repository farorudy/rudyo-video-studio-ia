import {NextRequest,NextResponse} from "next/server";
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");
 if(origin && origin!==new URL(request.url).origin)return NextResponse.json({success:false},{status:403});
 const response=NextResponse.json({success:true});
 const names=new Set(["rudyo_session","authjs.session-token","__Secure-authjs.session-token"]);
 for(const cookie of request.cookies.getAll()) {
  if(/^(?:__Secure-)?authjs\.session-token\.\d+$/.test(cookie.name))names.add(cookie.name);
 }
 for(const name of names)response.cookies.set({name,value:"",httpOnly:true,path:"/",sameSite:"lax",secure:name.startsWith("__Secure-")||process.env.NODE_ENV==="production",maxAge:0});
 return response;
}
