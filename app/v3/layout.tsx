import ConceptSwitcher from "@/components/ConceptSwitcher";

export default function V3Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ConceptSwitcher current="/v3" />
      {children}
    </>
  );
}
