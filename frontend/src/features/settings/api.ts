import { apiRequest } from "@/api/client";
import { companySchema } from "@/lib/schemas";
import type { Company } from "@/types/tenant";

export interface UpdateCompanySettingsPayload {
  branding: {
    display_name: string;
    logo_url: string | null;
    primary_color: string;
  };
  payments: {
    yape_phone: string | null;
    plin_phone: string | null;
  };
}

export function updateCompanySettings(payload: UpdateCompanySettingsPayload): Promise<Company> {
  return apiRequest<Company>(
    { method: "PUT", url: "/company/settings", data: payload },
    companySchema,
  );
}
