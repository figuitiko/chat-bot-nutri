import { db } from "@/lib/db";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";

export async function upsertContactByPhone(input: {
  phone: string;
  waId?: string;
  name?: string;
  profileName?: string;
  locale?: string;
  isOptedIn?: boolean;
}) {
  const phone = normalizePhone(input.phone);

  return db.contact.upsert({
    where: { phone },
    create: {
      phone,
      waId: input.waId,
      name: input.name,
      profileName: input.profileName,
      locale: input.locale ?? DEFAULT_LOCALE,
      isOptedIn: input.isOptedIn ?? true,
    },
    update: {
      waId: input.waId ?? undefined,
      name: input.name ?? undefined,
      profileName: input.profileName ?? undefined,
      locale: input.locale ?? undefined,
      isOptedIn: input.isOptedIn ?? undefined,
    },
  });
}
