import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server"
import { ROLES } from "@/lib/domain"

export const adminSearchParams = {
  q: parseAsString.withDefault(""),
  role: parseAsStringLiteral(ROLES),
  page: parseAsInteger.withDefault(1),
}

export const loadAdminParams = createLoader(adminSearchParams)
