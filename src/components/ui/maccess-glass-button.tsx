import { Suspense } from "react";

import {
  MaccessGlassButton as DarkGlassRectangle,
  type SectionCompositionProps,
} from "@/components/ui/maccess-glass-button-utils/MaccessElements";
import {
  LumenCta,
  type LumenCtaProps,
} from "@/components/ui/maccess-glass-button-utils/LumenCta";

export type RectangleButtonVariant =
  "dark-pill" | "lumen-cta" | "lumen-cta-ghost";

export type RectangleButtonsProps = SectionCompositionProps &
  Omit<LumenCtaProps, "variant"> & {
    variant?: RectangleButtonVariant;
  };

export default function RectangleButtons({
  variant = "dark-pill",
  ...props
}: RectangleButtonsProps) {
  if (variant === "lumen-cta" || variant === "lumen-cta-ghost") {
    return (
      <Suspense fallback={null}>
        <LumenCta
          {...props}
          variant={variant === "lumen-cta-ghost" ? "ghost" : "primary"}
        />
      </Suspense>
    );
  }

  return <DarkGlassRectangle className={props.className} style={props.style} />;
}

export { RectangleButtons };

/** @deprecated Use RectangleButtons. */
export const MaccessGlassButton = RectangleButtons;
