import type { Metadata } from "next";
import { AuthView } from "../AuthView";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignUpPage() {
  return <AuthView mode="signup" />;
}