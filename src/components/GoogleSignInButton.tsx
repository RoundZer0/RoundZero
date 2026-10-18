
"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { resetCreditsInMemory } from "@/lib/userCredits";

type GoogleSignInButtonProps = {
  callbackUrl?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export default function GoogleSignInButton({
  callbackUrl,
  children = "Sign In",
  className = "flex items-center gap-1.5 rounded-lg border border-[#383838] bg-[#282828] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-[#383838]",
  style,
}: GoogleSignInButtonProps) {
  const { update } = useSession();
  const router = useRouter();

  useEffect(() => {
    const handlePopupMessage = async (
      event: MessageEvent<{ type?: string }>
    ) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== "google-sign-in-complete"
      ) {
        return;
      }

      try {
        await update();
        if (callbackUrl) {
          router.push(callbackUrl);
          return;
        }
      } catch (error) {
        console.error("Failed to refresh the Google sign-in session:", error);
      } finally {
        if (!callbackUrl) {
          window.location.reload();
        }
      }
    };
    window.addEventListener("message", handlePopupMessage);
    return () => window.removeEventListener("message", handlePopupMessage);
  }, [callbackUrl, router, update]);

  const handleGoogleSignIn = () => {
    resetCreditsInMemory();
    const width = 500;
    const height = 650;

    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      "/api/auth/signin/google?callbackUrl=" +
        encodeURIComponent(
          `${window.location.origin}/api/auth/google/popup`
        ),
      "roundzero-google-signin",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      // Popup blocked: fall back to normal sign-in.
      signIn("google", { callbackUrl });
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
