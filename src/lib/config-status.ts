import { getSecret } from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

export function getConfigStatuses(): ConfigStatus[] {
  const configured = Boolean(getSecret("SUPABASE_URL") && getSecret("SUPABASE_KEY"));

  return [
    {
      name: "Supabase",
      configured,
      message: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    },
  ];
}

export function getMissingConfigs(): ConfigStatus[] {
  return getConfigStatuses().filter((status) => !status.configured);
}
