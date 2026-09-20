import { z } from "zod";
import { id } from "@/server/validation/common";

export const setCompanyAiFeaturesInput = z.object({
  companyId: id,
  enabled: z.boolean(),
});
