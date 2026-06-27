import { redirect } from "next/navigation";
import { getCrewSession } from "@/lib/crew";
import ApplyPage from "@/components/m/apply-page";

export default async function Apply() {
  const member = await getCrewSession();
  if (member) redirect("/pit");
  return <ApplyPage />;
}
