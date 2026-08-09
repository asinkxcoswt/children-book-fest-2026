/** Section header: display-font title on the same 3px peach rule the
 *  schedule board's day headers sit on, with an optional small letterspaced
 *  English caption on the right — one heading language across the site. */
export default function SectionHeading({
  title,
  caption,
  as: Tag = "h2",
}: {
  title: string;
  caption?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b-[3px] border-peach pb-2">
      <Tag className={`font-display text-ink ${Tag === "h1" ? "text-4xl" : "text-3xl"}`}>
        {title}
      </Tag>
      {caption && (
        <span className="hidden text-xs uppercase tracking-[0.18em] text-ink/45 sm:block">
          {caption}
        </span>
      )}
    </div>
  );
}
