import type { AstroCookies } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  createClient: createClientMock,
}));

import { createBondifyServices } from "@/lib/services/bondify";

const baseProfileRow = {
  id: "profile-1",
  email: "owner@example.com",
  normalized_email: "owner@example.com",
  created_at: "2026-06-16T08:00:00.000Z",
  updated_at: "2026-06-16T08:00:00.000Z",
};

function createServiceContext() {
  return {
    requestHeaders: new Headers(),
    cookies: {
      set: vi.fn(),
    } as unknown as AstroCookies,
  };
}

function createProfilesBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({
      data: baseProfileRow,
      error: null,
    }),
  };

  return builder;
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
        return createProfilesBuilder();
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

function createCreateTeamCompatibilitySupabaseMock() {
  let insertedTeamId = "";

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: baseProfileRow.id,
            email: baseProfileRow.email,
          },
        },
      }),
    },
    from(table: string) {
      if (table === "profiles") {
        return createProfilesBuilder();
      }

      if (table === "teams") {
        return {
          insert: vi.fn().mockImplementation((payload: { created_by: string; id: string; name: string }) => {
            insertedTeamId = payload.id;
            return Promise.resolve({ error: null });
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: insertedTeamId,
                  name: "Legacy-safe Team",
                  created_by: baseProfileRow.id,
                  created_at: "2026-06-16T08:00:00.000Z",
                  updated_at: "2026-06-16T08:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "team_memberships") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockImplementation((selection: string) => {
            const builder = {
              eq: vi.fn(() => builder),
              is: vi.fn(() => builder),
              maybeSingle: vi.fn().mockImplementation(() => {
                if (selection.includes("removed_at")) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      message: "column team_memberships.removed_at does not exist",
                    },
                  });
                }

                return Promise.resolve({
                  data: {
                    id: "membership-1",
                    team_id: insertedTeamId,
                    profile_id: baseProfileRow.id,
                    created_at: "2026-06-16T08:00:00.000Z",
                  },
                  error: null,
                });
              }),
            };

            return builder;
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { supabase };
}

function createAcceptInviteCompatibilitySupabaseMock() {
  const inviteId = "invite-1";
  const teamId = "team-accept";

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: baseProfileRow.id,
            email: baseProfileRow.email,
          },
        },
      }),
    },
    from(table: string) {
      if (table === "profiles") {
        return createProfilesBuilder();
      }

      if (table === "team_invites") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: inviteId,
                  team_id: teamId,
                  inviter_profile_id: "profile-owner",
                  email: baseProfileRow.email,
                  normalized_email: baseProfileRow.normalized_email,
                  status: "pending",
                  accepted_profile_id: null,
                  accepted_at: null,
                  created_at: "2026-06-16T08:00:00.000Z",
                  updated_at: "2026-06-16T08:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: inviteId,
                    team_id: teamId,
                    inviter_profile_id: "profile-owner",
                    email: baseProfileRow.email,
                    normalized_email: baseProfileRow.normalized_email,
                    status: "accepted",
                    accepted_profile_id: baseProfileRow.id,
                    accepted_at: "2026-06-16T09:00:00.000Z",
                    created_at: "2026-06-16T08:00:00.000Z",
                    updated_at: "2026-06-16T09:00:00.000Z",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "team_memberships") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockImplementation((selection: string) => {
            const builder = {
              eq: vi.fn(() => builder),
              is: vi.fn(() => builder),
              maybeSingle: vi.fn().mockImplementation(() => {
                if (selection.includes("removed_at")) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      message: "column team_memberships.removed_at does not exist",
                    },
                  });
                }

                return Promise.resolve({
                  data: {
                    id: "membership-accepted",
                    team_id: teamId,
                    profile_id: baseProfileRow.id,
                    created_at: "2026-06-16T09:00:00.000Z",
                  },
                  error: null,
                });
              }),
            };

            return builder;
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { inviteId, supabase, teamId };
}

function createAlreadyMemberCompatibilitySupabaseMock() {
  const teamId = "team-1";

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: baseProfileRow.id,
            email: baseProfileRow.email,
          },
        },
      }),
    },
    from(table: string) {
      if (table === "profiles") {
        return createProfilesBuilder();
      }

      if (table === "team_memberships") {
        return {
          select: vi.fn().mockImplementation((selection: string) => {
            if (selection.includes("profile:profiles!inner(normalized_email)")) {
              const lookupBuilder = {
                eq: vi.fn(() => lookupBuilder),
                is: vi.fn(() => lookupBuilder),
                limit: vi.fn().mockImplementation(() => {
                  if (selection.includes("removed_at")) {
                    return Promise.resolve({
                      data: null,
                      error: {
                        message: "column team_memberships.removed_at does not exist",
                      },
                    });
                  }

                  return Promise.resolve({
                    data: [{ id: "membership-existing" }],
                    error: null,
                  });
                }),
              };

              return lookupBuilder;
            }

            const membershipBuilder = {
              eq: vi.fn(() => membershipBuilder),
              is: vi.fn(() => membershipBuilder),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "membership-owner",
                  team_id: teamId,
                  profile_id: baseProfileRow.id,
                  created_at: "2026-06-16T08:00:00.000Z",
                  removed_at: null,
                },
                error: null,
              }),
            };

            return membershipBuilder;
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { supabase, teamId };
}

function createResolvedListQuery(result: { data: unknown[]; error: null }) {
  // game_rounds ends in `.order().order()` and emoji_check_in_sessions ends in
  // `.order().limit()`. Rather than guess which call is terminal, make the
  // builder itself thenable: every chain method returns the builder, and
  // awaiting the builder at any point resolves the query result.
  const builder: Record<string, unknown> = {
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => resolve(result),
  };
  const chain = () => builder;

  for (const method of ["select", "eq", "is", "not", "gte", "order", "limit"]) {
    builder[method] = vi.fn(chain);
  }

  return builder;
}

function createReadGateCompatibilitySupabaseMock() {
  const teamId = "team-read-gate";
  const membershipSelections: string[] = [];

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: baseProfileRow.id,
            email: baseProfileRow.email,
          },
        },
      }),
    },
    from(table: string) {
      if (table === "profiles") {
        return createProfilesBuilder();
      }

      if (table === "team_memberships") {
        return {
          select: vi.fn().mockImplementation((selection: string) => {
            membershipSelections.push(selection);

            const builder = {
              eq: vi.fn(() => builder),
              is: vi.fn(() => builder),
              maybeSingle: vi.fn().mockImplementation(() => {
                if (selection.includes("removed_at")) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      message: "column team_memberships.removed_at does not exist",
                    },
                  });
                }

                return Promise.resolve({
                  data: {
                    id: "membership-read-gate",
                    team_id: teamId,
                    profile_id: baseProfileRow.id,
                    created_at: "2026-06-16T08:00:00.000Z",
                  },
                  error: null,
                });
              }),
            };

            return builder;
          }),
        };
      }

      if (table === "teams") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: teamId,
                  name: "Read-gate Team",
                  created_by: baseProfileRow.id,
                  created_at: "2026-06-16T08:00:00.000Z",
                  updated_at: "2026-06-16T08:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "game_rounds" || table === "emoji_check_in_sessions") {
        return {
          select: vi.fn().mockReturnValue(createResolvedListQuery({ data: [], error: null })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { supabase, teamId, membershipSelections };
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

  it("creates a team successfully when membership fallback has to use the legacy schema shape", async () => {
    const { supabase } = createCreateTeamCompatibilitySupabaseMock();
    createClientMock.mockReturnValue(supabase);

    const services = createBondifyServices(createServiceContext());
    const summary = await services.createTeam({ name: "Legacy-safe Team" });

    expect(summary.team.name).toBe("Legacy-safe Team");
    expect(summary.memberships).toHaveLength(1);
    expect(summary.memberships[0]?.membership.removedAt).toBeNull();
    expect(summary.memberships[0]?.profile.email).toBe(baseProfileRow.email);
  });

  it("accepts an invite successfully when the created membership must be re-read through the legacy fallback", async () => {
    const { inviteId, supabase, teamId } = createAcceptInviteCompatibilitySupabaseMock();
    createClientMock.mockReturnValue(supabase);

    const services = createBondifyServices(createServiceContext());
    const result = await services.acceptInvite({ inviteId });

    expect(result.invite.teamId).toBe(teamId);
    expect(result.invite.status).toBe("accepted");
    expect(result.membership.teamId).toBe(teamId);
    expect(result.membership.removedAt).toBeNull();
  });

  it("blocks duplicate invite creation when the active-membership check must fall back to the legacy schema", async () => {
    const { supabase, teamId } = createAlreadyMemberCompatibilitySupabaseMock();
    createClientMock.mockReturnValue(supabase);

    const services = createBondifyServices(createServiceContext());
    const results = await services.createPendingInvites({
      teamId,
      emails: ["teammate@example.com"],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      email: "teammate@example.com",
      normalizedEmail: "teammate@example.com",
      ok: false,
      errorCode: "ALREADY_TEAM_MEMBER",
    });
  });

  it("grants a member team-scoped read access when the read-gate must fall back to the legacy schema", async () => {
    const { supabase, teamId, membershipSelections } = createReadGateCompatibilitySupabaseMock();
    createClientMock.mockReturnValue(supabase);

    const services = createBondifyServices(createServiceContext());
    const state = await services.getTeamHistoryState(teamId);

    // Member granted: getTeamHistoryState resolves with the team-scoped state
    // instead of throwing TEAM_ACCESS_DENIED.
    expect(state.team.id).toBe(teamId);
    expect(state.team.name).toBe("Read-gate Team");

    // The read-gate attempted the active (removed_at) select before falling
    // back to the legacy select.
    expect(membershipSelections).toHaveLength(2);
    expect(membershipSelections[0]).toContain("removed_at");
    expect(membershipSelections[1]).not.toContain("removed_at");
  });
});
