type HandoffCodeSectionProps = {
  code: string;
};

export function HandoffCodeSection({ code }: HandoffCodeSectionProps) {
  return (
    <section
      className="flex flex-col gap-2"
      data-testid="handoff-code-section"
    >
      <h3 className="text-sm font-semibold text-foreground">Handoff code</h3>
      <p
        className="font-mono text-3xl font-semibold tabular-nums tracking-[0.2em] text-foreground"
        data-testid="handoff-code-value"
      >
        {code}
      </p>
      <p className="text-sm text-muted">
        Give this code to the driver when they arrive.
      </p>
    </section>
  );
}
