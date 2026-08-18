type PageHeaderProps = {
  title: string;
  description?: string;
  /** Centered titles for Profile / History. Cards stay start-aligned. */
  align?: "start" | "center";
};

export function PageHeader({
  title,
  description,
  align = "start",
}: PageHeaderProps) {
  const centered = align === "center";

  return (
    <div
      className={[
        "motion-page-header flex w-full flex-col gap-2",
        centered ? "items-center text-center" : "",
      ].join(" ")}
      data-testid="page-header"
      data-align={align}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p
          className={[
            "text-sm leading-6 text-muted sm:text-base",
            centered ? "mx-auto max-w-2xl" : "max-w-2xl",
          ].join(" ")}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
