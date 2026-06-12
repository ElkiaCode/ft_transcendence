import { ConfirmDataErasureContent } from "@/features/rgpd/components/ConfirmDataErasureContent";

export default async function ConfirmDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return <ConfirmDataErasureContent token={token ?? ""} />;
}
