import ConceptSwitcher from "@/components/ConceptSwitcher";

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ConceptSwitcher current="/v2" />
      {children}
    </>
  );
}
