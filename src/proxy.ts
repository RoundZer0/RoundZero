import { withAuth } from "next-auth/middleware";

const authProxy = withAuth({
  pages: {
    signIn: "/",
  },
  callbacks: {
    authorized({ req, token }) {
      // The public root route renders LandingPage for signed-out visitors.
      if (req.nextUrl.pathname === "/") return true;

      // Contest registration and its API are intentionally signed-in experiences.
      if (
        req.nextUrl.pathname === "/registercontest" ||
        req.nextUrl.pathname === "/api/contest/register"
      ) {
        return !!token;
      }

      return !!token;
    },
  },
});

export const proxy = authProxy;
export default authProxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /auth/signin (Sign-in page)
     * - /api/auth/* (NextAuth API routes)
     * - /api/user/credits (JSON API handles its own unauthenticated response)
     * - /privacy, /terms, /refund-policy, /shipping-policy, /contact, /about (Merchant legal info)
     * - _next/static, _next/image, favicon.ico (Static assets)
     */
    "/((?!auth/signin|login|api/auth|api/user/credits|privacy|terms|refund-policy|shipping-policy|contact|about|_next/static|_next/image|favicon.ico).*)",
  ],
};
