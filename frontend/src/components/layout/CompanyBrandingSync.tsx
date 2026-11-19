import * as React from "react";

import { cacheCompanyBranding, FALLBACK_LOGO_URL, resolveBranding } from "@/lib/branding";
import { useAuthStore } from "@/stores/authStore";

function readableForeground(color: string): string {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);

  return luminance > 0.179 ? "#111827" : "#ffffff";
}

export function CompanyBrandingSync() {
  const company = useAuthStore((state) => state.company);
  const branding = resolveBranding(company);

  React.useEffect(() => {
    if (company) {
      cacheCompanyBranding(company);
    }

    const root = document.documentElement;
    const color = branding.primaryColor;
    const foreground = readableForeground(color);

    root.style.setProperty("--brand", color);
    root.style.setProperty("--primary", color);
    root.style.setProperty("--primary-foreground", foreground);
    root.style.setProperty("--ring", color);
    root.style.setProperty("--chart-1", color);
    root.style.setProperty("--sidebar-primary", color);
    root.style.setProperty("--sidebar-primary-foreground", foreground);
    root.style.setProperty("--sidebar-accent-foreground", color);
    root.style.setProperty("--sidebar-ring", color);

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.content = color;
    }

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = branding.logoUrl ?? FALLBACK_LOGO_URL;
    }

    document.title = branding.name;
  }, [company, branding.logoUrl, branding.name, branding.primaryColor]);

  return null;
}
