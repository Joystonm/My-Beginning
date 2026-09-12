import type { Metadata } from "next";
import { AuthView } from "../AuthView";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return <AuthView mode="signin" />;
}