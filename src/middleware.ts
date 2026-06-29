export { auth as middleware } from "@/lib/auth/auth";

export const config = {
  matcher: ["/admin/:path*", "/driver/:path*", "/login"],
};
