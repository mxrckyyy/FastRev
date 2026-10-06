/**
 * Shared empty state: icon, heading, short explanation, optional CTA slot
 * (pass the action as `children`). Kept intentionally small — it should
 * guide, not dominate the page.
 */
export default function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <div className="flex animate-in flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center fade-in-0 duration-200 motion-reduce:animate-none">
      <span
        className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Icon className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}
