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
        className="font-mono text-[clamp(1.75rem,8vw,2rem)] font-semibold tabular-nums tracking-[0.18em] text-foreground sm:text-3xl sm:tracking-[0.2em]"
        data-testid="handoff-code-value"
      >
        {code}
      </p>
    </section>
  );
}
