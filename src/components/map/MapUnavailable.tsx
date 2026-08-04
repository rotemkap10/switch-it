import { Card } from "@/components/ui/Card";

export function MapUnavailable() {
  return (
    <Card className="mx-auto max-w-lg">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">
          Map is unavailable
        </p>
        <p className="text-sm text-muted">
          We couldn’t load the map tiles. Please check your configuration and
          try again.
        </p>
      </div>
    </Card>
  );
}

