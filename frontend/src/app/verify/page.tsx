import RegistryApp from "@/components/RegistryApp";

// QR codes link to /verify?id=CERTIFICATE_ID. We read the id from the query
// (server-side) and hand it to the app, which auto-runs the ID lookup.
export default function VerifyPage({
  searchParams,
}: {
  searchParams: { id?: string | string[] };
}) {
  const raw = searchParams.id;
  const id = Array.isArray(raw) ? raw[0] : raw ?? "";
  return <RegistryApp initialTab="verify" initialVerifyId={id} />;
}
