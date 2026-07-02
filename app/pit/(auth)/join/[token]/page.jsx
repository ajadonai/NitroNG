import JoinPage from "@/components/m/join-page";

export default async function Join({ params }) {
  const { token } = await params;
  return <JoinPage token={token} />;
}
