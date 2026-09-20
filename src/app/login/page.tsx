import { Suspense } from "react";
import { LoginView } from "./LoginView";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}
