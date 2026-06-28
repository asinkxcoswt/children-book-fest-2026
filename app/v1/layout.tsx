import ConceptSwitcher from "@/components/ConceptSwitcher";

export default function V1Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ConceptSwitcher current="/v1" />
      {children}
    </>
  );
}
