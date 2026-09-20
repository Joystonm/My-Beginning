import { redirect } from "next/navigation";

/**
 * Route alias — the canonical path is /universes; /my-universes redirects there.
 */
export default function MyUniversesAlias() {
  redirect("/universes");
}
