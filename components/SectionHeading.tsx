/** Section header: display-font title on the same 3px peach rule the
 *  schedule board's day headers sit on. */
export default function SectionHeading({ title, as: Tag = "h2" }: { title: string; as?: "h1" | "h2" }) {
  return (
    <div className="border-b-[3px] border-peach pb-2">
      <Tag className={`font-display text-ink ${Tag === "h1" ? "text-4xl" : "text-3xl"}`}>{title}</Tag>
    </div>
  );
}
