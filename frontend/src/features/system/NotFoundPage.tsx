import { ArrowLeft, FileQuestion } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="flex size-10 items-center justify-center rounded-md border bg-background text-muted-foreground">
        <FileQuestion className="size-4.5" strokeWidth={1.5} />
      </span>
      <p className="mt-4 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        Error 404
      </p>
      <h1 className="mt-1.5 text-xl font-semibold tracking-tight">Ruta no encontrada</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        La página solicitada no existe o fue movida dentro de esta instalación.
      </p>
      <Button variant="outline" size="sm" className="mt-5" asChild>
        <Link to="/">
          <ArrowLeft className="size-4" strokeWidth={1.5} />
          Volver al resumen
        </Link>
      </Button>
    </div>
  );
}
