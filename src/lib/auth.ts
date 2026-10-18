import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { isLaunchAccessActive, syncUserWithMongoDB } from './dbServices';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'mock_google_client_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_google_client_secret',
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || 'roundzero_oa_nextauth_secret_key_2026',
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        if (user.email) {
          const normEmail = user.email.trim().toLowerCase();
          token.email = normEmail;
          try {
            const dbUser = await syncUserWithMongoDB(
              normEmail,
              user.name || undefined,
              user.image || undefined
            );
            if (dbUser) {
              const hasPaidPass =
                !!dbUser.isUnlimited &&
                (!dbUser.unlimitedExpiry || new Date(dbUser.unlimitedExpiry).getTime() > Date.now());
              const hasLaunchAccess = isLaunchAccessActive(dbUser.launchUnlimitedExpiry);
              token.credits = hasPaidPass || hasLaunchAccess ? 999 : (dbUser.credits ?? 1);
              token.isUnlimited = hasPaidPass || hasLaunchAccess;
              token.unlimitedExpiry = hasPaidPass
                ? dbUser.unlimitedExpiry
                  ? new Date(dbUser.unlimitedExpiry).toISOString()
                  : undefined
                : hasLaunchAccess
                  ? new Date(dbUser.launchUnlimitedExpiry!).toISOString()
                  : undefined;
              token.potdStreak = dbUser.potdStreak || 0;
              token.potdLastSolvedDate = dbUser.potdLastSolvedDate;
            }
          } catch (e) {
            console.warn('JWT user sync warning:', e);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token.id || token.sub;
        if (token.email) {
          session.user.email = token.email as string;
        }
        (session.user as any).credits = (token.credits as number) ?? 1;
        (session.user as any).isUnlimited = !!token.isUnlimited;
        (session.user as any).unlimitedExpiry = token.unlimitedExpiry as string | undefined;
        (session.user as any).potdStreak = (token.potdStreak as number) || 0;
        (session.user as any).potdLastSolvedDate = token.potdLastSolvedDate as string | undefined;
      }
      return session;
    },
  },
};
