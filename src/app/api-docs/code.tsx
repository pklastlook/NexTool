/**
 * Lightweight code block for the API docs page.
 *
 * Plain <pre> with mono font + horizontal scroll. No syntax highlighting
 * library — keeps the page server-only and zero-JS.
 */
export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
      <code className="font-mono text-foreground">{children}</code>
    </pre>
  );
}
