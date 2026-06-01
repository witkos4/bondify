import type { AstroCookies } from "astro";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import type {
  BondifyDomainError,
  BondifyDomainErrorCode,
  BondifyGameResponseRecord,
  BondifyGameRound,
  BondifyGameTemplate,
  BondifyGameTemplateProjection,
  BondifyProfile,
  BondifyServiceResponse,
  BondifyTeam,
  BondifyTeamInvite,
  BondifyTeamMembership,
  ParticipantSafeHistoryEntry,
  ParticipantSafeRoundReveal,
  TeamGameState,
  TeamInviteCreateResult,
  TeamInviteView,
  TeamRosterEntry,
  TeamSummary,
} from "@/types";

type SupabaseServerClient = NonNullable<ReturnType<typeof createClient>>;

interface ServiceContext {
  requestHeaders: Headers;
  cookies: AstroCookies;
}

interface ProfileRow {
  id: string;
  email: string;
  normalized_email: string;
  created_at: string;
  updated_at: string;
}

interface TeamRow {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TeamMembershipRow {
  id: string;
  team_id: string;
  profile_id: string;
  created_at: string;
}

interface TeamInviteRow {
  id: string;
  team_id: string;
  inviter_profile_id: string;
  email: string;
  normalized_email: string;
  status: BondifyTeamInvite["status"];
  accepted_profile_id: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface GameTemplateRow {
  id: string;
  slug: string;
  name: string;
  prompt: string;
  is_history_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateProjectionRow {
  id: string;
  slug: string;
  name: string;
  prompt: string;
  is_history_enabled: boolean;
}

interface GameRoundRow {
  id: string;
  team_id: string;
  game_template_id: string;
  opened_by_profile_id: string;
  status: BondifyGameRound["status"];
  revealed_at: string | null;
  history_visible_until: string | null;
  history_cleared_at: string | null;
  created_at: string;
  updated_at: string;
}

interface GameResponseRow {
  id: string;
  round_id: string;
  membership_id: string;
  profile_id: string;
  response_text: string;
  created_at: string;
}

interface TeamMembershipWithProfileRow extends TeamMembershipRow {
  profile: Pick<ProfileRow, "id" | "email" | "normalized_email">;
}

interface TeamInviteWithAcceptedProfileRow extends TeamInviteRow {
  accepted_profile: Pick<ProfileRow, "id" | "email" | "normalized_email"> | null;
}

interface TeamSummaryRow extends TeamRow {
  team_memberships: TeamMembershipWithProfileRow[];
  team_invites: TeamInviteWithAcceptedProfileRow[];
}

interface GameRoundWithTemplateRow extends GameRoundRow {
  game_template: TemplateProjectionRow;
  game_responses: GameResponseRow[];
}

interface ActiveGameRoundRow extends GameRoundRow {
  game_responses: Pick<GameResponseRow, "id" | "membership_id">[];
}

interface HistoryEntryRow extends GameRoundRow {
  game_template: TemplateProjectionRow;
  game_responses: GameResponseRow[];
}

interface SupabaseLikeError {
  code?: string;
  message?: string;
}

const MAX_RESPONSE_TEXT_LENGTH = 500;

export class BondifyServiceError extends Error {
  readonly code: BondifyDomainErrorCode;
  readonly details?: Record<string, string | number | boolean | null>;

  constructor(
    code: BondifyDomainErrorCode,
    message: string,
    details?: Record<string, string | number | boolean | null>,
  ) {
    super(message);
    this.name = "BondifyServiceError";
    this.code = code;
    this.details = details;
  }

  toDomainError(): BondifyDomainError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toProfile(row: ProfileRow): BondifyProfile {
  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalized_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTeam(row: TeamRow): BondifyTeam {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMembership(row: TeamMembershipRow): BondifyTeamMembership {
  return {
    id: row.id,
    teamId: row.team_id,
    profileId: row.profile_id,
    createdAt: row.created_at,
  };
}

function toInvite(row: TeamInviteRow): BondifyTeamInvite {
  return {
    id: row.id,
    teamId: row.team_id,
    inviterProfileId: row.inviter_profile_id,
    email: row.email,
    normalizedEmail: row.normalized_email,
    status: row.status,
    acceptedProfileId: row.accepted_profile_id,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTemplate(row: GameTemplateRow): BondifyGameTemplate {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    prompt: row.prompt,
    isHistoryEnabled: row.is_history_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTemplateProjection(row: TemplateProjectionRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    prompt: row.prompt,
    isHistoryEnabled: row.is_history_enabled,
  };
}

function toGameTemplateProjection(row: TemplateProjectionRow): BondifyGameTemplateProjection {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    prompt: row.prompt,
    isHistoryEnabled: row.is_history_enabled,
  };
}

function toRound(row: GameRoundRow): BondifyGameRound {
  return {
    id: row.id,
    teamId: row.team_id,
    gameTemplateId: row.game_template_id,
    openedByProfileId: row.opened_by_profile_id,
    status: row.status,
    revealedAt: row.revealed_at,
    historyVisibleUntil: row.history_visible_until,
    historyClearedAt: row.history_cleared_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toResponseRecord(row: GameResponseRow): BondifyGameResponseRecord {
  return {
    id: row.id,
    roundId: row.round_id,
    membershipId: row.membership_id,
    profileId: row.profile_id,
    responseText: row.response_text,
    createdAt: row.created_at,
  };
}

function toParticipantSafeResponses(rows: GameResponseRow[]) {
  return rows.map((row) => ({
    id: row.id,
    roundId: row.round_id,
    responseText: row.response_text,
    createdAt: row.created_at,
  }));
}

function toTeamGameState(input: {
  teamId: string;
  membership: TeamMembershipRow;
  template: TemplateProjectionRow;
  activeRound: ActiveGameRoundRow | null;
}): TeamGameState {
  const activeRound = input.activeRound;
  const currentMemberResponse =
    activeRound?.game_responses.find((response) => response.membership_id === input.membership.id) ?? null;

  return {
    teamId: input.teamId,
    membership: toMembership(input.membership),
    template: toGameTemplateProjection(input.template),
    activeRound: activeRound
      ? {
          round: toRound(activeRound),
          submittedResponseCount: activeRound.game_responses.length,
          hasCurrentMemberSubmitted: currentMemberResponse !== null,
          currentMemberResponseId: currentMemberResponse?.id ?? null,
        }
      : null,
  };
}

function duplicateMembershipError(teamId: string, profileId: string) {
  return new BondifyServiceError("DUPLICATE_MEMBERSHIP", "This profile is already a member of the team.", {
    teamId,
    profileId,
  });
}

function mapDuplicateInsertError(error: SupabaseLikeError | null, fallback: BondifyServiceError): BondifyServiceError {
  if (error?.code === "23505") {
    return fallback;
  }

  if (error?.message) {
    return new BondifyServiceError(fallback.code, error.message, fallback.details);
  }

  return fallback;
}

function requireSupabase(context: ServiceContext): SupabaseServerClient {
  const supabase = createClient(context.requestHeaders, context.cookies);

  if (!supabase) {
    throw new BondifyServiceError("SUPABASE_NOT_CONFIGURED", "Supabase is not configured for this environment.");
  }

  return supabase;
}

async function requireUser(supabase: SupabaseServerClient): Promise<User> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new BondifyServiceError("UNAUTHENTICATED", "You must be signed in to use Bondify services.");
  }

  return user;
}

async function ensureProfileRow(supabase: SupabaseServerClient, user: User): Promise<ProfileRow> {
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id, email, normalized_email, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    throw new BondifyServiceError("PROFILE_NOT_FOUND", existingProfileError.message);
  }

  if (existingProfile) {
    return existingProfile;
  }

  const normalizedEmail = normalizeEmail(user.email ?? "");
  if (!normalizedEmail) {
    throw new BondifyServiceError("PROFILE_NOT_FOUND", "Authenticated user is missing an email address.");
  }

  const { data: createdProfile, error: createProfileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? normalizedEmail,
        normalized_email: normalizedEmail,
      },
      { onConflict: "id" },
    )
    .select("id, email, normalized_email, created_at, updated_at")
    .single();

  if (createProfileError) {
    throw new BondifyServiceError("PROFILE_NOT_FOUND", createProfileError.message);
  }

  return createdProfile;
}

async function requireMembershipAccess(
  supabase: SupabaseServerClient,
  teamId: string,
  profileId: string,
): Promise<TeamMembershipRow> {
  const { data: membership, error } = await supabase
    .from("team_memberships")
    .select("id, team_id, profile_id, created_at")
    .eq("team_id", teamId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw new BondifyServiceError("TEAM_ACCESS_DENIED", error.message, { teamId, profileId });
  }

  if (!membership) {
    throw new BondifyServiceError("TEAM_ACCESS_DENIED", "You do not have access to this team.", { teamId, profileId });
  }

  return membership;
}

function toTeamRosterEntry(row: TeamMembershipWithProfileRow): TeamRosterEntry {
  return {
    membership: toMembership(row),
    profile: {
      id: row.profile.id,
      email: row.profile.email,
      normalizedEmail: row.profile.normalized_email,
    },
  };
}

function toTeamInviteView(row: TeamInviteWithAcceptedProfileRow): TeamInviteView {
  return {
    invite: toInvite(row),
    acceptedProfile: row.accepted_profile
      ? {
          id: row.accepted_profile.id,
          email: row.accepted_profile.email,
          normalizedEmail: row.accepted_profile.normalized_email,
        }
      : null,
  };
}

async function listTeamSummaryRows(supabase: SupabaseServerClient): Promise<TeamSummaryRow[]> {
  const { data, error } = await supabase
    .from("teams")
    .select(
      `
        id,
        name,
        created_by,
        created_at,
        updated_at,
        team_memberships (
          id,
          team_id,
          profile_id,
          created_at,
          profile:profiles (
            id,
            email,
            normalized_email
          )
        ),
        team_invites (
          id,
          team_id,
          inviter_profile_id,
          email,
          normalized_email,
          status,
          accepted_profile_id,
          accepted_at,
          created_at,
          updated_at,
          accepted_profile:profiles!team_invites_accepted_profile_id_fkey (
            id,
            email,
            normalized_email
          )
        )
      `,
    )
    .order("created_at", { ascending: true });

  if (error) {
    throw new BondifyServiceError("TEAM_ACCESS_DENIED", error.message);
  }

  return data as TeamSummaryRow[];
}

async function getTemplateBySlug(supabase: SupabaseServerClient, gameSlug: string): Promise<TemplateProjectionRow> {
  const slug = gameSlug.trim();
  if (!slug) {
    throw new BondifyServiceError("INVALID_GAME_TEMPLATE", "Choose a valid game template.");
  }

  const { data, error } = await supabase
    .from("game_templates")
    .select("id, slug, name, prompt, is_history_enabled")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new BondifyServiceError("INVALID_GAME_TEMPLATE", error.message, { gameSlug: slug });
  }

  if (!data) {
    throw new BondifyServiceError("INVALID_GAME_TEMPLATE", "Game template not found.", { gameSlug: slug });
  }

  return data;
}

async function getActiveGameRound(
  supabase: SupabaseServerClient,
  input: { teamId: string; gameTemplateId: string },
): Promise<ActiveGameRoundRow | null> {
  const { data, error } = await supabase
    .from("game_rounds")
    .select(
      `
        id,
        team_id,
        game_template_id,
        opened_by_profile_id,
        status,
        revealed_at,
        history_visible_until,
        history_cleared_at,
        created_at,
        updated_at,
        game_responses (
          id,
          membership_id
        )
      `,
    )
    .eq("team_id", input.teamId)
    .eq("game_template_id", input.gameTemplateId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new BondifyServiceError("ROUND_NOT_FOUND", error.message, input);
  }

  return data;
}

async function loadTeamGameState(
  supabase: SupabaseServerClient,
  input: { teamId: string; gameSlug: string; profileId: string },
): Promise<TeamGameState> {
  const membership = await requireMembershipAccess(supabase, input.teamId, input.profileId);
  const template = await getTemplateBySlug(supabase, input.gameSlug);
  const activeRound = await getActiveGameRound(supabase, {
    teamId: input.teamId,
    gameTemplateId: template.id,
  });

  return toTeamGameState({
    teamId: input.teamId,
    membership,
    template,
    activeRound,
  });
}

function validateResponseText(responseText: string): string {
  const trimmedResponseText = responseText.trim();

  if (!trimmedResponseText) {
    throw new BondifyServiceError("INVALID_RESPONSE_TEXT", "Response text cannot be blank.");
  }

  if (trimmedResponseText.length > MAX_RESPONSE_TEXT_LENGTH) {
    throw new BondifyServiceError(
      "INVALID_RESPONSE_TEXT",
      `Response text must be ${MAX_RESPONSE_TEXT_LENGTH} characters or fewer.`,
      { maxLength: MAX_RESPONSE_TEXT_LENGTH },
    );
  }

  return trimmedResponseText;
}

export function createBondifyServices(context: ServiceContext) {
  async function withCurrentProfile<T>(
    callback: (supabase: SupabaseServerClient, profile: BondifyProfile) => Promise<T> | T,
  ): Promise<T> {
    const supabase = requireSupabase(context);
    const user = await requireUser(supabase);
    const profile = toProfile(await ensureProfileRow(supabase, user));
    return callback(supabase, profile);
  }

  return {
    async ensureCurrentProfile(): Promise<BondifyProfile> {
      return withCurrentProfile((_supabase, profile) => profile);
    },

    async getCurrentTeamSummaries(): Promise<TeamSummary[]> {
      return withCurrentProfile(async (supabase) => {
        const rows = await listTeamSummaryRows(supabase);

        return rows.map((row) => ({
          team: toTeam(row),
          memberships: row.team_memberships.map(toTeamRosterEntry),
          pendingInvites: row.team_invites.filter((invite) => invite.status === "pending").map(toTeamInviteView),
        }));
      });
    },

    async createTeam(input: { name: string }): Promise<TeamSummary> {
      const name = input.name.trim();
      if (!name) {
        throw new BondifyServiceError("INVALID_TEAM_NAME", "Team name cannot be blank.");
      }

      return withCurrentProfile(async (supabase, profile) => {
        const teamId = crypto.randomUUID();

        const { error: createTeamError } = await supabase
          .from("teams")
          .insert({ id: teamId, name, created_by: profile.id });

        if (createTeamError) {
          throw new BondifyServiceError("TEAM_NOT_FOUND", createTeamError.message);
        }

        const { error: membershipError } = await supabase.from("team_memberships").insert({
          team_id: teamId,
          profile_id: profile.id,
        });

        if (membershipError) {
          throw mapDuplicateInsertError(membershipError, duplicateMembershipError(teamId, profile.id));
        }

        const { data: membership, error: createdMembershipError } = await supabase
          .from("team_memberships")
          .select("id, team_id, profile_id, created_at")
          .eq("team_id", teamId)
          .eq("profile_id", profile.id)
          .single();

        if (createdMembershipError) {
          throw new BondifyServiceError("TEAM_ACCESS_DENIED", createdMembershipError.message, {
            teamId,
            profileId: profile.id,
          });
        }

        const { data: createdTeam, error: createdTeamError } = await supabase
          .from("teams")
          .select("id, name, created_by, created_at, updated_at")
          .eq("id", teamId)
          .single();

        if (createdTeamError) {
          throw new BondifyServiceError("TEAM_NOT_FOUND", createdTeamError.message, { teamId });
        }

        const teamRow: TeamRow = createdTeam;

        return {
          team: toTeam(teamRow),
          memberships: [
            {
              membership: toMembership(membership),
              profile: {
                id: profile.id,
                email: profile.email,
                normalizedEmail: profile.normalizedEmail,
              },
            },
          ],
          pendingInvites: [],
        };
      });
    },

    async createPendingInvites(input: { teamId: string; emails: string[] }): Promise<TeamInviteCreateResult[]> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireMembershipAccess(supabase, input.teamId, profile.id);

        const results: TeamInviteCreateResult[] = [];
        const seenEmails = new Set<string>();

        for (const rawEmail of input.emails) {
          const trimmedEmail = rawEmail.trim();
          const normalizedEmail = normalizeEmail(rawEmail);

          if (!normalizedEmail) {
            results.push({
              email: rawEmail,
              normalizedEmail,
              ok: false,
              invite: null,
              errorCode: "INVALID_INVITE_EMAIL",
              errorMessage: "Invite email cannot be blank.",
            });
            continue;
          }

          if (!isValidEmail(normalizedEmail)) {
            results.push({
              email: trimmedEmail,
              normalizedEmail,
              ok: false,
              invite: null,
              errorCode: "INVALID_INVITE_EMAIL",
              errorMessage: "Enter a valid email address.",
            });
            continue;
          }

          if (normalizedEmail === profile.normalizedEmail) {
            results.push({
              email: trimmedEmail,
              normalizedEmail,
              ok: false,
              invite: null,
              errorCode: "SELF_INVITE",
              errorMessage: "You are already on this account. Invite a teammate instead.",
            });
            continue;
          }

          if (seenEmails.has(normalizedEmail)) {
            results.push({
              email: trimmedEmail,
              normalizedEmail,
              ok: false,
              invite: null,
              errorCode: "DUPLICATE_INVITE",
              errorMessage: "This email appears more than once in the same invite batch.",
            });
            continue;
          }

          seenEmails.add(normalizedEmail);

          const { data: existingMembership, error: membershipLookupError } = await supabase
            .from("team_memberships")
            .select("id, profile:profiles!inner(normalized_email)")
            .eq("team_id", input.teamId)
            .eq("profile.normalized_email", normalizedEmail)
            .limit(1);

          if (membershipLookupError) {
            throw new BondifyServiceError("TEAM_ACCESS_DENIED", membershipLookupError.message, {
              teamId: input.teamId,
              normalizedEmail,
            });
          }

          if (existingMembership.length > 0) {
            results.push({
              email: trimmedEmail,
              normalizedEmail,
              ok: false,
              invite: null,
              errorCode: "ALREADY_TEAM_MEMBER",
              errorMessage: "That teammate is already an active member of this team.",
            });
            continue;
          }

          const { data, error } = await supabase
            .from("team_invites")
            .insert({
              team_id: input.teamId,
              inviter_profile_id: profile.id,
              email: trimmedEmail,
              normalized_email: normalizedEmail,
              status: "pending",
            })
            .select(
              "id, team_id, inviter_profile_id, email, normalized_email, status, accepted_profile_id, accepted_at, created_at, updated_at",
            )
            .single();

          if (error) {
            const mappedError = mapDuplicateInsertError(
              error,
              new BondifyServiceError(
                "DUPLICATE_INVITE",
                "A pending invite already exists for this email on the team.",
                {
                  teamId: input.teamId,
                  normalizedEmail,
                },
              ),
            );

            results.push({
              email: trimmedEmail,
              normalizedEmail,
              ok: false,
              invite: null,
              errorCode: mappedError.code,
              errorMessage: mappedError.message,
            });
            continue;
          }

          const createdInvite: TeamInviteRow = data;

          results.push({
            email: createdInvite.email,
            normalizedEmail,
            ok: true,
            invite: toInvite(createdInvite),
            errorCode: null,
            errorMessage: null,
          });
        }

        return results;
      });
    },

    async listPendingInvitesForCurrentProfile(): Promise<TeamInviteView[]> {
      return withCurrentProfile(async (supabase, profile) => {
        const { data, error } = await supabase
          .from("team_invites")
          .select(
            `
              id,
              team_id,
              inviter_profile_id,
              email,
              normalized_email,
              status,
              accepted_profile_id,
              accepted_at,
              created_at,
              updated_at,
              accepted_profile:profiles!team_invites_accepted_profile_id_fkey (
                id,
                email,
                normalized_email
              )
            `,
          )
          .eq("normalized_email", profile.normalizedEmail)
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (error) {
          throw new BondifyServiceError("INVITE_NOT_FOUND", error.message, {
            normalizedEmail: profile.normalizedEmail,
          });
        }

        return (data as TeamInviteWithAcceptedProfileRow[]).map(toTeamInviteView);
      });
    },

    async acceptInvite(input: {
      inviteId: string;
    }): Promise<{ invite: BondifyTeamInvite; membership: BondifyTeamMembership }> {
      return withCurrentProfile(async (supabase, profile) => {
        const { data: invite, error: inviteError } = await supabase
          .from("team_invites")
          .select(
            "id, team_id, inviter_profile_id, email, normalized_email, status, accepted_profile_id, accepted_at, created_at, updated_at",
          )
          .eq("id", input.inviteId)
          .maybeSingle();

        if (inviteError) {
          throw new BondifyServiceError("INVITE_NOT_FOUND", inviteError.message, { inviteId: input.inviteId });
        }

        if (!invite) {
          throw new BondifyServiceError("INVITE_NOT_FOUND", "Invite not found.", { inviteId: input.inviteId });
        }

        const inviteRow: TeamInviteRow = invite;

        if (inviteRow.status !== "pending") {
          throw new BondifyServiceError("INVITE_NOT_PENDING", "Only pending invites can be accepted.", {
            inviteId: input.inviteId,
          });
        }

        if (inviteRow.normalized_email !== profile.normalizedEmail) {
          throw new BondifyServiceError("INVITE_EMAIL_MISMATCH", "This invite belongs to a different email address.", {
            expectedEmail: inviteRow.normalized_email,
            actualEmail: profile.normalizedEmail,
          });
        }

        const { data: updatedInvite, error: updateInviteError } = await supabase
          .from("team_invites")
          .update({
            status: "accepted",
            accepted_profile_id: profile.id,
            accepted_at: new Date().toISOString(),
          })
          .eq("id", input.inviteId)
          .select(
            "id, team_id, inviter_profile_id, email, normalized_email, status, accepted_profile_id, accepted_at, created_at, updated_at",
          )
          .single();

        if (updateInviteError) {
          throw new BondifyServiceError("INVITE_NOT_PENDING", updateInviteError.message, {
            inviteId: input.inviteId,
          });
        }

        const updatedInviteRow: TeamInviteRow = updatedInvite;

        const { error: membershipError } = await supabase.from("team_memberships").insert({
          team_id: updatedInviteRow.team_id,
          profile_id: profile.id,
        });

        if (membershipError) {
          throw mapDuplicateInsertError(
            membershipError,
            duplicateMembershipError(updatedInviteRow.team_id, profile.id),
          );
        }

        const { data: membership, error: createdMembershipError } = await supabase
          .from("team_memberships")
          .select("id, team_id, profile_id, created_at")
          .eq("team_id", updatedInviteRow.team_id)
          .eq("profile_id", profile.id)
          .single();

        if (createdMembershipError) {
          throw new BondifyServiceError("TEAM_ACCESS_DENIED", createdMembershipError.message, {
            teamId: updatedInviteRow.team_id,
            profileId: profile.id,
          });
        }

        return {
          invite: toInvite(updatedInviteRow),
          membership: toMembership(membership),
        };
      });
    },

    async listGameTemplates(): Promise<BondifyGameTemplate[]> {
      return withCurrentProfile(async (supabase) => {
        const { data, error } = await supabase
          .from("game_templates")
          .select("id, slug, name, prompt, is_history_enabled, created_at, updated_at")
          .order("name", { ascending: true });

        if (error) {
          throw new BondifyServiceError("INVALID_GAME_TEMPLATE", error.message);
        }

        return (data as GameTemplateRow[]).map(toTemplate);
      });
    },

    async getTeamGameState(input: { teamId: string; gameSlug: string }): Promise<TeamGameState> {
      return withCurrentProfile(async (supabase, profile) =>
        loadTeamGameState(supabase, {
          teamId: input.teamId,
          gameSlug: input.gameSlug,
          profileId: profile.id,
        }),
      );
    },

    async startTeamGameRound(input: { teamId: string; gameSlug: string }): Promise<TeamGameState> {
      return withCurrentProfile(async (supabase, profile) => {
        const currentState = await loadTeamGameState(supabase, {
          teamId: input.teamId,
          gameSlug: input.gameSlug,
          profileId: profile.id,
        });

        if (currentState.activeRound) {
          return currentState;
        }

        const { error } = await supabase.from("game_rounds").insert({
          team_id: input.teamId,
          game_template_id: currentState.template.id,
          opened_by_profile_id: profile.id,
        });

        if (error && error.code !== "23505") {
          throw new BondifyServiceError("ROUND_NOT_FOUND", error.message, {
            teamId: input.teamId,
            gameSlug: input.gameSlug,
          });
        }

        return loadTeamGameState(supabase, {
          teamId: input.teamId,
          gameSlug: input.gameSlug,
          profileId: profile.id,
        });
      });
    },

    async createRound(input: {
      teamId: string;
      gameTemplateId: string;
      historyVisibleUntil?: string | null;
    }): Promise<BondifyGameRound> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireMembershipAccess(supabase, input.teamId, profile.id);

        const { data, error } = await supabase
          .from("game_rounds")
          .insert({
            team_id: input.teamId,
            game_template_id: input.gameTemplateId,
            opened_by_profile_id: profile.id,
            history_visible_until: input.historyVisibleUntil ?? null,
          })
          .select(
            "id, team_id, game_template_id, opened_by_profile_id, status, revealed_at, history_visible_until, history_cleared_at, created_at, updated_at",
          )
          .single();

        if (error) {
          throw new BondifyServiceError("ROUND_NOT_FOUND", error.message);
        }

        return toRound(data);
      });
    },

    async submitResponse(input: {
      roundId: string;
      membershipId: string;
      responseText: string;
    }): Promise<BondifyGameResponseRecord> {
      const responseText = validateResponseText(input.responseText);

      return withCurrentProfile(async (supabase, profile) => {
        const { data: createdResponse, error } = await supabase
          .from("game_responses")
          .insert({
            round_id: input.roundId,
            membership_id: input.membershipId,
            profile_id: profile.id,
            response_text: responseText,
          })
          .select("id, round_id, membership_id, profile_id, response_text, created_at")
          .single();

        if (error) {
          throw mapDuplicateInsertError(
            error,
            new BondifyServiceError("DUPLICATE_RESPONSE", "Only one response per participant is allowed.", {
              roundId: input.roundId,
              membershipId: input.membershipId,
            }),
          );
        }

        return toResponseRecord(createdResponse);
      });
    },

    async submitCurrentMemberResponse(input: {
      roundId: string;
      responseText: string;
    }): Promise<BondifyGameResponseRecord> {
      const responseText = validateResponseText(input.responseText);

      return withCurrentProfile(async (supabase, profile) => {
        const { data: round, error: roundError } = await supabase
          .from("game_rounds")
          .select(
            "id, team_id, game_template_id, opened_by_profile_id, status, revealed_at, history_visible_until, history_cleared_at, created_at, updated_at",
          )
          .eq("id", input.roundId)
          .maybeSingle();

        if (roundError) {
          throw new BondifyServiceError("ROUND_NOT_FOUND", roundError.message, { roundId: input.roundId });
        }

        if (!round) {
          throw new BondifyServiceError("ROUND_NOT_FOUND", "Round not found.", { roundId: input.roundId });
        }

        const roundRow: GameRoundRow = round;
        if (roundRow.status !== "open") {
          throw new BondifyServiceError("ROUND_NOT_OPEN", "This game is not accepting responses.", {
            roundId: input.roundId,
          });
        }

        const membership = await requireMembershipAccess(supabase, roundRow.team_id, profile.id);
        const responseId = crypto.randomUUID();

        const { error: insertError } = await supabase.from("game_responses").insert({
          id: responseId,
          round_id: input.roundId,
          membership_id: membership.id,
          profile_id: profile.id,
          response_text: responseText,
        });

        if (insertError) {
          throw mapDuplicateInsertError(
            insertError,
            new BondifyServiceError("DUPLICATE_RESPONSE", "Only one response per participant is allowed.", {
              roundId: input.roundId,
              membershipId: membership.id,
            }),
          );
        }

        const { data: createdResponse, error: createdResponseError } = await supabase
          .from("game_responses")
          .select("id, round_id, membership_id, profile_id, response_text, created_at")
          .eq("id", responseId)
          .single();

        if (createdResponseError) {
          throw new BondifyServiceError("ROUND_NOT_FOUND", createdResponseError.message, {
            roundId: input.roundId,
            responseId,
          });
        }

        return toResponseRecord(createdResponse);
      });
    },

    async getParticipantSafeRoundReveal(roundId: string): Promise<ParticipantSafeRoundReveal> {
      return withCurrentProfile(async (supabase) => {
        const { data, error } = await supabase
          .from("game_rounds")
          .select(
            `
              id,
              team_id,
              game_template_id,
              opened_by_profile_id,
              status,
              revealed_at,
              history_visible_until,
              history_cleared_at,
              created_at,
              updated_at,
              game_template:game_templates (
                id,
                slug,
                name,
                prompt,
                is_history_enabled
              ),
              game_responses (
                id,
                round_id,
                membership_id,
                profile_id,
                response_text,
                created_at
              )
            `,
          )
          .eq("id", roundId)
          .maybeSingle();

        if (error) {
          throw new BondifyServiceError("ROUND_NOT_FOUND", error.message, { roundId });
        }

        if (!data) {
          throw new BondifyServiceError("ROUND_NOT_FOUND", "Round not found.", { roundId });
        }

        const roundRow: GameRoundWithTemplateRow = data;

        return {
          round: toRound(roundRow),
          template: toTemplateProjection(roundRow.game_template),
          responses: toParticipantSafeResponses(roundRow.game_responses),
        };
      });
    },

    async getParticipantSafeHistory(teamId: string): Promise<ParticipantSafeHistoryEntry[]> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireMembershipAccess(supabase, teamId, profile.id);

        const { data, error } = await supabase
          .from("game_rounds")
          .select(
            `
              id,
              team_id,
              game_template_id,
              opened_by_profile_id,
              status,
              revealed_at,
              history_visible_until,
              history_cleared_at,
              created_at,
              updated_at,
              game_template:game_templates (
                id,
                slug,
                name,
                prompt,
                is_history_enabled
              ),
              game_responses (
                id,
                round_id,
                membership_id,
                profile_id,
                response_text,
                created_at
              )
            `,
          )
          .eq("team_id", teamId)
          .not("history_visible_until", "is", null)
          .is("history_cleared_at", null)
          .order("created_at", { ascending: false });

        if (error) {
          throw new BondifyServiceError("HISTORY_NOT_VISIBLE", error.message, { teamId });
        }

        const now = new Date();

        const historyRows: HistoryEntryRow[] = data;

        return historyRows
          .filter((row) => row.history_visible_until !== null && new Date(row.history_visible_until) >= now)
          .map((row) => ({
            round: toRound(row),
            template: toTemplateProjection(row.game_template),
            responses: toParticipantSafeResponses(row.game_responses),
          }));
      });
    },
  };
}

export async function callBondifyService<T>(operation: () => Promise<T>): Promise<BondifyServiceResponse<T>> {
  try {
    return {
      data: await operation(),
      error: null,
    };
  } catch (error) {
    if (error instanceof BondifyServiceError) {
      return {
        data: null,
        error: error.toDomainError(),
      };
    }

    throw error;
  }
}
