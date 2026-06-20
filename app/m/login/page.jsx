import { redirect } from "next/navigation";
import { getCrewSession } from "@/lib/crew";
import LoginPage from "@/components/m/login-page";

export default async function Login() {
  const member = await getCrewSession();
  if (member) redirect("/m");
  return <LoginPage />;
}
