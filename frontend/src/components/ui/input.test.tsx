import { createRef } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("forwards refs to the native input", () => {
    const ref = createRef<HTMLInputElement>();

    render(<Input ref={ref} aria-label="Buscar producto" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
