import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import process from "node:process";

type TestEnvName = "BONDIFY_TEST_SUPABASE_URL" | "BONDIFY_TEST_ANON_KEY" | "BONDIFY_TEST_SERVICE_ROLE_KEY";

export interface TestCredentials {
  email: string;
  password: string;
  label: string;
}

export interface TestActor extends TestCredentials {
  client: SupabaseClient;
  userId: string;
}

function requireEnv(name: TestEnvName) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required test environment variable: ${name}`);
  }

  return value;
}

function createTestClient(key: string) {
  return createClient(requireEnv("BONDIFY_TEST_SUPABASE_URL"), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function adminClient() {
  return createTestClient(requireEnv("BONDIFY_TEST_SERVICE_ROLE_KEY"));
}

export async function userClient(credentials: TestCredentials): Promise<TestActor> {
  const client = createTestClient(requireEnv("BONDIFY_TEST_ANON_KEY"));
  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    throw new Error(`Failed to sign in ${credentials.label}: ${error.message}`);
  }

  return {
    ...credentials,
    client,
    userId: data.user.id,
  };
}
