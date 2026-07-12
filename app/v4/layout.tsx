import ConceptSwitcher from "@/components/ConceptSwitcher";

export default function V4Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ConceptSwitcher current="/v4" />
      {children}
    </>
  );
}
