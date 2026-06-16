import type { AstroCookies } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  createClient: createClientMock,
}));

import { createBondifyServices } from "@/lib/services/bondify";

function createServiceContext() {
  return {
    requestHeaders: new Headers(),
    cookies: {
      set: vi.fn(),
    } as unknown as AstroCookies,
  };
}

function createCompatibilitySupabaseMock() {
  const teamSelections: string[] = [];

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "profile-1",
            email: "owner@example.com",
          },
        },
      }),
    },
    from(table: string) {
      if (table === "profiles") {
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "profile-1",
              email: "owner@example.com",
              normalized_email: "owner@example.com",
              created_at: "2026-06-16T08:00:00.000Z",
              updated_at: "2026-06-16T08:00:00.000Z",
            },
            error: null,
          }),
        };

        return builder;
      }

      if (table === "teams") {
        return {
          select(selection: string) {
            teamSelections.push(selection);

            return {
              order: vi.fn().mockImplementation(() => {
                if (selection.includes("removed_at")) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      message: "column team_memberships.removed_at does not exist",
                    },
                  });
                }

                return Promise.resolve({
                  data: [
                    {
                      id: "team-1",
                      name: "Compatibility Team",
                      created_by: "profile-1",
                      created_at: "2026-06-16T08:00:00.000Z",
                      updated_at: "2026-06-16T08:00:00.000Z",
                      team_memberships: [
                        {
                          id: "membership-1",
                          team_id: "team-1",
                          profile_id: "profile-1",
                          created_at: "2026-06-16T08:00:00.000Z",
                          profile: {
                            id: "profile-1",
                            email: "owner@example.com",
                            normalized_email: "owner@example.com",
                          },
                        },
                      ],
                      team_invites: [],
                    },
                  ],
                  error: null,
                });
              }),
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { supabase, teamSelections };
}

describe("createBondifyServices compatibility", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("falls back to legacy team membership queries when removed_at is unavailable", async () => {
    const { supabase, teamSelections } = createCompatibilitySupabaseMock();
    createClientMock.mockReturnValue(supabase);

    const services = createBondifyServices(createServiceContext());
    const summaries = await services.getCurrentTeamSummaries();

    expect(teamSelections).toHaveLength(2);
    expect(teamSelections[0]).toContain("removed_at");
    expect(teamSelections[1]).not.toContain("removed_at");
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.team.id).toBe("team-1");
    expect(summaries[0]?.memberships).toHaveLength(1);
    expect(summaries[0]?.memberships[0]?.membership.removedAt).toBeNull();
    expect(summaries[0]?.memberships[0]?.profile.normalizedEmail).toBe("owner@example.com");
  });
});
