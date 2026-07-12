import type { AstroCookies } from "astro";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import type {
  BondifyDomainError,
  BondifyDomainErrorCode,
  BondifyGameResponseRecord,
  BondifyGameRound,
  EmojiCheckInRevealSummary,
  EmojiCheckInSession,
  EmojiCheckInTimelineEntry,
  EmojiCheckInTodayState,
  BondifyShellContext,
  BondifyShellTeamOption,
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
  TeamDeleteResult,
  TeamHistoryClearResult,
  TeamHistoryEntryClearResult,
  TeamHistoryState,
  TeamMemberRemoveResult,
  TeamManagementState,
  TeamInviteCreateResult,
  TeamInviteView,
  TeamRosterEntry,
  TeamSummary,
  TwoTruthsEntryRecord,
  TwoTruthsGuessProgress,
  TwoTruthsGuessRecord,
  TwoTruthsHistorySummary,
  TwoTruthsLieIndex,
  TwoTruthsRevealScore,
  TwoTruthsRevealSummary,
  TwoTruthsRoundPhase,
  TwoTruthsRoundRecord,
  TwoTruthsRoundState,
} from "@/types";
import {
  EMOJI_CHECK_IN_DEFAULT_TIME_ZONE,
  MAX_EMOJI_CHECK_IN_EMOJIS,
  MIN_EMOJI_CHECK_IN_EMOJIS,
  getEmojiCheckInSessionDateKey,
  normalizeEmojiCheckInSelection,
  summarizeEmojiCheckInSelections,
} from "@/lib/emoji-check-in";

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
  removed_at: string | null;
}

interface LegacyTeamMembershipRow extends Omit<TeamMembershipRow, "removed_at"> {
  removed_at?: string | null;
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

interface TwoTruthsRoundRow {
  game_round_id: string;
  phase: TwoTruthsRoundPhase;
  collection_closed_at: string | null;
  voting_started_at: string | null;
  voting_closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TwoTruthsEntryRow {
  id: string;
  game_round_id: string;
  author_membership_id: string;
  author_profile_id: string;
  statement_one: string;
  statement_two: string;
  statement_three: string;
  lie_statement_index: TwoTruthsLieIndex;
  included_in_voting: boolean;
  created_at: string;
  updated_at: string;
}

interface TwoTruthsGuessRow {
  id: string;
  game_round_id: string;
  voter_membership_id: string;
  voter_profile_id: string;
  target_entry_id: string;
  guessed_lie_index: TwoTruthsLieIndex;
  created_at: string;
}

interface EmojiCheckInSessionRow {
  id: string;
  team_id: string;
  session_date: string;
  status: EmojiCheckInSession["status"];
  revealed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EmojiCheckInSubmissionRow {
  id: string;
  session_id: string;
  membership_id: string;
  profile_id: string;
  emojis: string[];
  created_at: string;
}

type JoinedRow<T> = T | T[] | null;

interface RawTeamMembershipWithProfileRow extends TeamMembershipRow {
  profile: JoinedRow<Pick<ProfileRow, "id" | "email" | "normalized_email">>;
}

interface TeamMembershipWithProfileRow extends TeamMembershipRow {
  profile: Pick<ProfileRow, "id" | "email" | "normalized_email">;
}

interface RawTeamInviteWithAcceptedProfileRow extends TeamInviteRow {
  accepted_profile: JoinedRow<Pick<ProfileRow, "id" | "email" | "normalized_email">>;
}

interface TeamInviteWithAcceptedProfileRow extends TeamInviteRow {
  accepted_profile: Pick<ProfileRow, "id" | "email" | "normalized_email"> | null;
}

interface RawTeamSummaryRow extends TeamRow {
  team_memberships: RawTeamMembershipWithProfileRow[];
  team_invites: RawTeamInviteWithAcceptedProfileRow[];
}

interface TeamSummaryRow extends TeamRow {
  team_memberships: TeamMembershipWithProfileRow[];
  team_invites: TeamInviteWithAcceptedProfileRow[];
}

interface RawGameRoundWithTemplateRow extends GameRoundRow {
  game_template: JoinedRow<TemplateProjectionRow>;
  game_responses: GameResponseRow[];
}

interface GameRoundWithTemplateRow extends GameRoundRow {
  game_template: TemplateProjectionRow;
  game_responses: GameResponseRow[];
}

interface ActiveGameRoundRow extends GameRoundRow {
  game_responses: Pick<GameResponseRow, "id" | "membership_id">[];
}

interface RawHistoryEntryRow extends GameRoundRow {
  game_template: JoinedRow<TemplateProjectionRow>;
  game_responses: GameResponseRow[];
}

interface HistoryEntryRow extends GameRoundRow {
  game_template: TemplateProjectionRow;
  game_responses: GameResponseRow[];
}

interface RawTwoTruthsEntryWithAuthorRow extends TwoTruthsEntryRow {
  author_profile: JoinedRow<Pick<ProfileRow, "id" | "email" | "normalized_email">>;
}

interface TwoTruthsEntryWithAuthorRow extends TwoTruthsEntryRow {
  author_profile: Pick<ProfileRow, "id" | "email" | "normalized_email">;
}

interface RawTwoTruthsGuessWithVoterRow extends TwoTruthsGuessRow {
  voter_profile: JoinedRow<Pick<ProfileRow, "id" | "email" | "normalized_email">>;
}

interface TwoTruthsGuessWithVoterRow extends TwoTruthsGuessRow {
  voter_profile: Pick<ProfileRow, "id" | "email" | "normalized_email">;
}

interface EmojiCheckInSessionWithSubmissionsRow extends EmojiCheckInSessionRow {
  emoji_check_in_submissions: EmojiCheckInSubmissionRow[];
}

interface SupabaseLikeError {
  code?: string;
  message?: string;
}

interface HistoryClearRpcResult {
  cleared_count: number;
  cleared_at: string;
}

interface TeamMemberRemoveRpcResult {
  team_id: string;
  membership_id: string;
  removed_profile_id: string;
  removed_email: string;
  removed_at: string;
}

interface TeamDeleteRpcResult {
  deleted_team_id: string;
  deleted_team_name: string;
}

const MAX_RESPONSE_TEXT_LENGTH = 500;
const MAX_TWO_TRUTHS_STATEMENT_LENGTH = 200;
const HISTORY_RETENTION_DAYS = 30;
const EMOJI_CHECK_IN_TIMELINE_DAYS = 30;
const TWO_TRUTHS_TEMPLATE_SLUG = "two-truths-and-a-lie";
const ACTIVE_TEAM_MEMBERSHIP_SELECT = "id, team_id, profile_id, created_at, removed_at";
const LEGACY_TEAM_MEMBERSHIP_SELECT = "id, team_id, profile_id, created_at";
const TEAM_INVITE_SUMMARY_SELECT = `
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
`;
const TEAM_SUMMARY_SELECT = `
  id,
  name,
  created_by,
  created_at,
  updated_at,
  team_memberships (
    ${ACTIVE_TEAM_MEMBERSHIP_SELECT},
    profile:profiles (
      id,
      email,
      normalized_email
    )
  ),
  team_invites (
    ${TEAM_INVITE_SUMMARY_SELECT}
  )
`;
const LEGACY_TEAM_SUMMARY_SELECT = `
  id,
  name,
  created_by,
  created_at,
  updated_at,
  team_memberships (
    ${LEGACY_TEAM_MEMBERSHIP_SELECT},
    profile:profiles (
      id,
      email,
      normalized_email
    )
  ),
  team_invites (
    ${TEAM_INVITE_SUMMARY_SELECT}
  )
`;

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

function isMissingColumnError(error: SupabaseLikeError | null, table: string, column: string): boolean {
  const message = error?.message?.toLowerCase() ?? "";

  return (
    message.includes(`column ${table.toLowerCase()}.${column.toLowerCase()} does not exist`) ||
    message.includes(`could not find the '${column.toLowerCase()}' column of '${table.toLowerCase()}'`)
  );
}

function unwrapJoinedRow<T>(value: JoinedRow<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function requireJoinedRow<T>(value: JoinedRow<T>, relationName: string): T {
  const row = unwrapJoinedRow(value);

  if (!row) {
    throw new Error(`Expected joined row for ${relationName}.`);
  }

  return row;
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
    removedAt: row.removed_at,
  };
}

function isActiveMembership(row: TeamMembershipRow): boolean {
  return row.removed_at === null;
}

function normalizeLegacyTeamMembershipRow<T extends LegacyTeamMembershipRow>(row: T): T & TeamMembershipRow {
  return {
    ...row,
    removed_at: row.removed_at ?? null,
  };
}

async function findActiveMembershipByTeamAndProfile(
  supabase: SupabaseServerClient,
  input: { teamId: string; profileId: string },
): Promise<TeamMembershipRow | null> {
  const { teamId, profileId } = input;
  const { data: membership, error } = await supabase
    .from("team_memberships")
    .select(ACTIVE_TEAM_MEMBERSHIP_SELECT)
    .eq("team_id", teamId)
    .eq("profile_id", profileId)
    .is("removed_at", null)
    .maybeSingle();

  if (!error) {
    return membership;
  }

  if (!isMissingColumnError(error, "team_memberships", "removed_at")) {
    throw new BondifyServiceError("TEAM_ACCESS_DENIED", error.message, { teamId, profileId });
  }

  const { data: legacyMembership, error: legacyError } = await supabase
    .from("team_memberships")
    .select(LEGACY_TEAM_MEMBERSHIP_SELECT)
    .eq("team_id", teamId)
    .eq("profile_id", profileId)
    .maybeSingle<LegacyTeamMembershipRow>();

  if (legacyError) {
    throw new BondifyServiceError("TEAM_ACCESS_DENIED", legacyError.message, { teamId, profileId });
  }

  return legacyMembership ? normalizeLegacyTeamMembershipRow(legacyMembership) : null;
}

async function hasActiveMembershipForNormalizedEmail(
  supabase: SupabaseServerClient,
  input: { normalizedEmail: string; teamId: string },
): Promise<boolean> {
  const { normalizedEmail, teamId } = input;
  const { data: existingMemberships, error } = await supabase
    .from("team_memberships")
    .select("id, removed_at, profile:profiles!inner(normalized_email)")
    .eq("team_id", teamId)
    .eq("profile.normalized_email", normalizedEmail)
    .is("removed_at", null)
    .limit(1);

  if (!error) {
    return existingMemberships.length > 0;
  }

  if (!isMissingColumnError(error, "team_memberships", "removed_at")) {
    throw new BondifyServiceError("TEAM_ACCESS_DENIED", error.message, {
      normalizedEmail,
      teamId,
    });
  }

  const { data: legacyMemberships, error: legacyError } = await supabase
    .from("team_memberships")
    .select("id, profile:profiles!inner(normalized_email)")
    .eq("team_id", teamId)
    .eq("profile.normalized_email", normalizedEmail)
    .limit(1);

  if (legacyError) {
    throw new BondifyServiceError("TEAM_ACCESS_DENIED", legacyError.message, {
      normalizedEmail,
      teamId,
    });
  }

  return legacyMemberships.length > 0;
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

function toTwoTruthsRoundRecord(row: TwoTruthsRoundRow): TwoTruthsRoundRecord {
  return {
    roundId: row.game_round_id,
    phase: row.phase,
    collectionClosedAt: row.collection_closed_at,
    votingStartedAt: row.voting_started_at,
    votingClosedAt: row.voting_closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTwoTruthsEntryAuthor(profile: Pick<ProfileRow, "id" | "email" | "normalized_email">, membershipId: string) {
  return {
    membershipId,
    profileId: profile.id,
    email: profile.email,
    normalizedEmail: profile.normalized_email,
  };
}

function toTwoTruthsEntryRecord(row: TwoTruthsEntryWithAuthorRow): TwoTruthsEntryRecord {
  return {
    id: row.id,
    roundId: row.game_round_id,
    author: toTwoTruthsEntryAuthor(row.author_profile, row.author_membership_id),
    statements: [row.statement_one, row.statement_two, row.statement_three],
    lieStatementIndex: row.lie_statement_index,
    includedInVoting: row.included_in_voting,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTwoTruthsGuessRecord(row: TwoTruthsGuessWithVoterRow): TwoTruthsGuessRecord {
  return {
    id: row.id,
    roundId: row.game_round_id,
    voter: toTwoTruthsEntryAuthor(row.voter_profile, row.voter_membership_id),
    targetEntryId: row.target_entry_id,
    guessedLieIndex: row.guessed_lie_index,
    createdAt: row.created_at,
  };
}

function toEmojiCheckInSession(row: EmojiCheckInSessionRow): EmojiCheckInSession {
  return {
    id: row.id,
    teamId: row.team_id,
    sessionDate: row.session_date,
    status: row.status,
    revealedAt: row.revealed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEmojiCheckInRevealSummary(input: {
  session: EmojiCheckInSessionRow;
  submissions: EmojiCheckInSubmissionRow[];
}): EmojiCheckInRevealSummary {
  return {
    session: toEmojiCheckInSession(input.session),
    submittedCount: input.submissions.length,
    emojiCounts: summarizeEmojiCheckInSelections(input.submissions.flatMap((submission) => submission.emojis)),
  };
}

function toEmojiCheckInTimelineEntry(input: {
  session: EmojiCheckInSessionRow;
  submissions: EmojiCheckInSubmissionRow[];
}): EmojiCheckInTimelineEntry {
  return {
    session: toEmojiCheckInSession(input.session),
    submittedCount: input.submissions.length,
    emojiCounts: summarizeEmojiCheckInSelections(input.submissions.flatMap((submission) => submission.emojis)),
  };
}

function toEmojiCheckInTodayState(input: {
  teamId: string;
  session: EmojiCheckInSessionRow;
  membership: TeamMembershipRow;
  submissions: EmojiCheckInSubmissionRow[];
}): EmojiCheckInTodayState {
  const currentMemberSubmission =
    input.submissions.find((submission) => submission.membership_id === input.membership.id) ?? null;
  const revealedSummary =
    input.session.status === "revealed" && input.submissions.length > 0
      ? toEmojiCheckInRevealSummary({
          session: input.session,
          submissions: input.submissions,
        })
      : null;

  return {
    teamId: input.teamId,
    session: toEmojiCheckInSession(input.session),
    hasCurrentMemberSubmitted: currentMemberSubmission !== null,
    currentMemberSubmission: currentMemberSubmission
      ? {
          id: currentMemberSubmission.id,
          emojis: currentMemberSubmission.emojis,
        }
      : null,
    submittedCount: input.submissions.length,
    revealedSummary,
  };
}

function normalizeTeamMembershipWithProfileRow(row: RawTeamMembershipWithProfileRow): TeamMembershipWithProfileRow {
  return {
    ...normalizeLegacyTeamMembershipRow(row),
    profile: requireJoinedRow(row.profile, "team_memberships.profile"),
  };
}

function normalizeTeamInviteWithAcceptedProfileRow(
  row: RawTeamInviteWithAcceptedProfileRow,
): TeamInviteWithAcceptedProfileRow {
  return {
    ...row,
    accepted_profile: unwrapJoinedRow(row.accepted_profile),
  };
}

function normalizeTeamSummaryRow(row: RawTeamSummaryRow): TeamSummaryRow {
  return {
    ...row,
    team_memberships: row.team_memberships.map(normalizeTeamMembershipWithProfileRow),
    team_invites: row.team_invites.map(normalizeTeamInviteWithAcceptedProfileRow),
  };
}

function normalizeGameRoundWithTemplateRow(row: RawGameRoundWithTemplateRow): GameRoundWithTemplateRow {
  return {
    ...row,
    game_template: requireJoinedRow(row.game_template, "game_rounds.game_template"),
  };
}

function normalizeHistoryEntryRow(row: RawHistoryEntryRow): HistoryEntryRow {
  return {
    ...row,
    game_template: requireJoinedRow(row.game_template, "game_rounds.game_template"),
  };
}

function normalizeTwoTruthsEntryWithAuthorRow(row: RawTwoTruthsEntryWithAuthorRow): TwoTruthsEntryWithAuthorRow {
  return {
    ...row,
    author_profile: requireJoinedRow(row.author_profile, "two_truths_entries.author_profile"),
  };
}

function normalizeTwoTruthsGuessWithVoterRow(row: RawTwoTruthsGuessWithVoterRow): TwoTruthsGuessWithVoterRow {
  return {
    ...row,
    voter_profile: requireJoinedRow(row.voter_profile, "two_truths_guesses.voter_profile"),
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

function toParticipantSafeRoundReveal(row: GameRoundWithTemplateRow): ParticipantSafeRoundReveal {
  return {
    round: toRound(row),
    template: toTemplateProjection(row.game_template),
    responses: toParticipantSafeResponses(row.game_responses),
  };
}

function toTeamHistoryState(input: {
  team: TeamRow;
  entries: ParticipantSafeHistoryEntry[];
  emojiCheckInTimeline: EmojiCheckInTimelineEntry[];
  profileId: string;
}): TeamHistoryState {
  return {
    team: toTeam(input.team),
    entries: input.entries,
    emojiCheckInTimeline: input.emojiCheckInTimeline,
    canClearHistory: input.team.created_by === input.profileId,
  };
}

function toTeamManagementState(input: {
  row: TeamSummaryRow;
  incomingInvites: TeamInviteView[];
  profileId: string;
}): TeamManagementState {
  const activeMemberships = input.row.team_memberships.filter(isActiveMembership);

  return {
    team: toTeam(input.row),
    memberships: activeMemberships.map(toTeamRosterEntry),
    pendingInvites: input.row.team_invites.filter((invite) => invite.status === "pending").map(toTeamInviteView),
    incomingInvites: input.incomingInvites,
    canManageTeam: input.row.created_by === input.profileId,
  };
}

function normalizeHistoryClearRpcResult(
  row: HistoryClearRpcResult | null,
  fallbackClearedAt: string,
): HistoryClearRpcResult {
  return {
    cleared_count: row?.cleared_count ?? 0,
    cleared_at: row?.cleared_at ?? fallbackClearedAt,
  };
}

function toTeamGameState(input: {
  teamId: string;
  membership: TeamMembershipRow;
  template: TemplateProjectionRow;
  activeRound: ActiveGameRoundRow | null;
  revealedRound: GameRoundWithTemplateRow | null;
  twoTruthsRound: TwoTruthsRoundState | null;
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
    revealedRound: input.revealedRound ? toParticipantSafeRoundReveal(input.revealedRound) : null,
    twoTruthsRound: input.twoTruthsRound,
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
  const membership = await findActiveMembershipByTeamAndProfile(supabase, { teamId, profileId });

  if (!membership) {
    throw new BondifyServiceError("TEAM_ACCESS_DENIED", "You do not have access to this team.", { teamId, profileId });
  }

  return membership;
}

async function getTeamForMember(supabase: SupabaseServerClient, teamId: string): Promise<TeamRow> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, created_by, created_at, updated_at")
    .eq("id", teamId)
    .maybeSingle();

  if (error) {
    throw new BondifyServiceError("TEAM_NOT_FOUND", error.message, { teamId });
  }

  if (!data) {
    throw new BondifyServiceError("TEAM_NOT_FOUND", "Team not found.", { teamId });
  }

  return data;
}

async function requireTeamOwnerAccess(
  supabase: SupabaseServerClient,
  input: { teamId: string; profileId: string },
): Promise<TeamRow> {
  await requireMembershipAccess(supabase, input.teamId, input.profileId);
  const team = await getTeamForMember(supabase, input.teamId);

  if (team.created_by !== input.profileId) {
    throw new BondifyServiceError("TEAM_OWNER_REQUIRED", "Only the team owner can manage this team.", {
      teamId: input.teamId,
      profileId: input.profileId,
    });
  }

  return team;
}

function getHistoryVisibleUntil(firstResponseCreatedAt: string): string {
  const firstResponseTime = new Date(firstResponseCreatedAt).getTime();
  const retentionMs = HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return new Date(firstResponseTime + retentionMs).toISOString();
}

async function markRoundHistoryVisibleIfEligible(
  supabase: SupabaseServerClient,
  input: { round: GameRoundRow; firstResponseCreatedAt: string },
): Promise<void> {
  if (input.round.history_visible_until !== null) {
    return;
  }

  const { data: template, error: templateError } = await supabase
    .from("game_templates")
    .select("is_history_enabled")
    .eq("id", input.round.game_template_id)
    .maybeSingle();

  if (templateError) {
    throw new BondifyServiceError("INVALID_GAME_TEMPLATE", templateError.message, {
      gameTemplateId: input.round.game_template_id,
    });
  }

  if (!template?.is_history_enabled) {
    return;
  }

  const { error: updateError } = await supabase
    .from("game_rounds")
    .update({
      history_visible_until: getHistoryVisibleUntil(input.firstResponseCreatedAt),
    })
    .eq("id", input.round.id)
    .is("history_visible_until", null);

  if (updateError) {
    throw new BondifyServiceError("HISTORY_NOT_VISIBLE", updateError.message, {
      roundId: input.round.id,
    });
  }
}

async function listVisibleHistoryRows(supabase: SupabaseServerClient, teamId: string): Promise<HistoryEntryRow[]> {
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
        game_template:game_templates!inner (
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
    .eq("status", "revealed")
    .eq("game_template.is_history_enabled", true)
    .not("history_visible_until", "is", null)
    .gte("history_visible_until", new Date().toISOString())
    .is("history_cleared_at", null)
    .order("revealed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new BondifyServiceError("HISTORY_NOT_VISIBLE", error.message, { teamId });
  }

  return (data as RawHistoryEntryRow[]).map(normalizeHistoryEntryRow);
}

async function toParticipantSafeHistoryEntries(
  supabase: SupabaseServerClient,
  rows: HistoryEntryRow[],
): Promise<ParticipantSafeHistoryEntry[]> {
  const entries = await Promise.all(
    rows.map(async (row) => ({
      round: toRound(row),
      template: toTemplateProjection(row.game_template),
      responses: isTwoTruthsTemplateSlug(row.game_template.slug) ? [] : toParticipantSafeResponses(row.game_responses),
      twoTruthsSummary: isTwoTruthsTemplateSlug(row.game_template.slug)
        ? await buildTwoTruthsHistorySummary(supabase, row)
        : null,
    })),
  );

  return entries;
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

function toShellTeamOption(row: TeamSummaryRow): BondifyShellTeamOption {
  const activeMemberships = row.team_memberships.filter(isActiveMembership);

  return {
    id: row.id,
    name: row.name,
    memberCount: activeMemberships.length,
    pendingInviteCount: row.team_invites.filter((invite) => invite.status === "pending").length,
  };
}

async function listTeamSummaryRows(supabase: SupabaseServerClient): Promise<TeamSummaryRow[]> {
  const { data, error } = await supabase.from("teams").select(TEAM_SUMMARY_SELECT).order("created_at", {
    ascending: true,
  });

  if (error) {
    if (isMissingColumnError(error, "team_memberships", "removed_at")) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("teams")
        .select(LEGACY_TEAM_SUMMARY_SELECT)
        .order("created_at", { ascending: true });

      if (legacyError) {
        throw new BondifyServiceError("TEAM_ACCESS_DENIED", legacyError.message);
      }

      return (legacyData as RawTeamSummaryRow[]).map(normalizeTeamSummaryRow);
    }

    throw new BondifyServiceError("TEAM_ACCESS_DENIED", error.message);
  }

  return (data as RawTeamSummaryRow[]).map(normalizeTeamSummaryRow);
}

async function listPendingInvitesForNormalizedEmail(
  supabase: SupabaseServerClient,
  normalizedEmail: string,
): Promise<TeamInviteView[]> {
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
    .eq("normalized_email", normalizedEmail)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new BondifyServiceError("INVITE_NOT_FOUND", error.message, {
      normalizedEmail,
    });
  }

  return (data as RawTeamInviteWithAcceptedProfileRow[])
    .map(normalizeTeamInviteWithAcceptedProfileRow)
    .map(toTeamInviteView);
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

async function getLatestRevealedGameRound(
  supabase: SupabaseServerClient,
  input: { teamId: string; gameTemplateId: string },
): Promise<GameRoundWithTemplateRow | null> {
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
    .eq("team_id", input.teamId)
    .eq("game_template_id", input.gameTemplateId)
    .eq("status", "revealed")
    .order("revealed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new BondifyServiceError("ROUND_NOT_FOUND", error.message, input);
  }

  return data ? normalizeGameRoundWithTemplateRow(data) : null;
}

async function getEmojiCheckInSessionByTeamAndDate(
  supabase: SupabaseServerClient,
  input: { teamId: string; sessionDate: string },
): Promise<EmojiCheckInSessionRow | null> {
  const { data, error } = await supabase
    .from("emoji_check_in_sessions")
    .select("id, team_id, session_date, status, revealed_at, created_at, updated_at")
    .eq("team_id", input.teamId)
    .eq("session_date", input.sessionDate)
    .maybeSingle();

  if (error) {
    throw new BondifyServiceError("EMOJI_CHECK_IN_SESSION_NOT_FOUND", error.message, input);
  }

  return data;
}

async function getEmojiCheckInSessionWithSubmissions(
  supabase: SupabaseServerClient,
  input: { teamId: string; sessionId: string },
): Promise<EmojiCheckInSessionWithSubmissionsRow | null> {
  const { data, error } = await supabase
    .from("emoji_check_in_sessions")
    .select(
      `
        id,
        team_id,
        session_date,
        status,
        revealed_at,
        created_at,
        updated_at,
        emoji_check_in_submissions (
          id,
          session_id,
          membership_id,
          profile_id,
          emojis,
          created_at
        )
      `,
    )
    .eq("id", input.sessionId)
    .eq("team_id", input.teamId)
    .maybeSingle();

  if (error) {
    throw new BondifyServiceError("EMOJI_CHECK_IN_SESSION_NOT_FOUND", error.message, input);
  }

  return data;
}

function validateEmojiCheckInEmojis(emojis: string[]): string[] {
  try {
    return normalizeEmojiCheckInSelection(emojis);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : `Choose between ${MIN_EMOJI_CHECK_IN_EMOJIS} and ${MAX_EMOJI_CHECK_IN_EMOJIS} valid emojis.`;

    throw new BondifyServiceError("INVALID_EMOJI_SELECTION", message, {
      minSelections: MIN_EMOJI_CHECK_IN_EMOJIS,
      maxSelections: MAX_EMOJI_CHECK_IN_EMOJIS,
    });
  }
}

async function ensureTodayEmojiCheckInSession(
  supabase: SupabaseServerClient,
  input: { teamId: string; profileId: string },
): Promise<{ membership: TeamMembershipRow; session: EmojiCheckInSessionRow }> {
  const membership = await requireMembershipAccess(supabase, input.teamId, input.profileId);
  const sessionDate = getEmojiCheckInSessionDateKey(new Date(), EMOJI_CHECK_IN_DEFAULT_TIME_ZONE);
  const existingSession = await getEmojiCheckInSessionByTeamAndDate(supabase, {
    teamId: input.teamId,
    sessionDate,
  });

  if (existingSession) {
    return {
      membership,
      session: existingSession,
    };
  }

  const { data: createdSession, error: createSessionError } = await supabase
    .from("emoji_check_in_sessions")
    .insert({
      team_id: input.teamId,
      session_date: sessionDate,
    })
    .select("id, team_id, session_date, status, revealed_at, created_at, updated_at")
    .maybeSingle();

  if (createSessionError) {
    if (createSessionError.code === "23505") {
      const retrySession = await getEmojiCheckInSessionByTeamAndDate(supabase, {
        teamId: input.teamId,
        sessionDate,
      });

      if (retrySession) {
        return {
          membership,
          session: retrySession,
        };
      }
    }

    throw new BondifyServiceError("EMOJI_CHECK_IN_SESSION_NOT_FOUND", createSessionError.message, {
      teamId: input.teamId,
      sessionDate,
    });
  }

  if (!createdSession) {
    const retrySession = await getEmojiCheckInSessionByTeamAndDate(supabase, {
      teamId: input.teamId,
      sessionDate,
    });

    if (retrySession) {
      return {
        membership,
        session: retrySession,
      };
    }

    throw new BondifyServiceError(
      "EMOJI_CHECK_IN_SESSION_NOT_FOUND",
      "We couldn't load today's Emoji Check-In session.",
      {
        teamId: input.teamId,
        sessionDate,
      },
    );
  }

  return {
    membership,
    session: createdSession,
  };
}

async function loadTodayEmojiCheckInState(
  supabase: SupabaseServerClient,
  input: { teamId: string; profileId: string },
): Promise<EmojiCheckInTodayState> {
  const { membership, session } = await ensureTodayEmojiCheckInSession(supabase, input);
  const sessionWithSubmissions = await getEmojiCheckInSessionWithSubmissions(supabase, {
    teamId: input.teamId,
    sessionId: session.id,
  });

  if (!sessionWithSubmissions) {
    throw new BondifyServiceError(
      "EMOJI_CHECK_IN_SESSION_NOT_FOUND",
      "We couldn't load today's Emoji Check-In session.",
      {
        teamId: input.teamId,
        sessionId: session.id,
      },
    );
  }

  return toEmojiCheckInTodayState({
    teamId: input.teamId,
    session: sessionWithSubmissions,
    membership,
    submissions: sessionWithSubmissions.emoji_check_in_submissions,
  });
}

async function listEmojiCheckInTimelineRows(
  supabase: SupabaseServerClient,
  input: { teamId: string; days: number },
): Promise<EmojiCheckInSessionWithSubmissionsRow[]> {
  const { data, error } = await supabase
    .from("emoji_check_in_sessions")
    .select(
      `
        id,
        team_id,
        session_date,
        status,
        revealed_at,
        created_at,
        updated_at,
        emoji_check_in_submissions (
          id,
          session_id,
          membership_id,
          profile_id,
          emojis,
          created_at
        )
      `,
    )
    .eq("team_id", input.teamId)
    .eq("status", "revealed")
    .order("session_date", { ascending: false })
    .limit(input.days);

  if (error) {
    throw new BondifyServiceError("EMOJI_CHECK_IN_SESSION_NOT_FOUND", error.message, input);
  }

  return (data as EmojiCheckInSessionWithSubmissionsRow[]).filter((row) => row.emoji_check_in_submissions.length > 0);
}

function isTwoTruthsTemplateSlug(gameSlug: string): boolean {
  return gameSlug === TWO_TRUTHS_TEMPLATE_SLUG;
}

function validateTwoTruthsStatement(statement: string, position: number): string {
  const trimmedStatement = statement.trim();

  if (!trimmedStatement) {
    throw new BondifyServiceError("INVALID_TWO_TRUTHS_STATEMENT", `Statement ${position} cannot be blank.`, {
      position,
    });
  }

  if (trimmedStatement.length > MAX_TWO_TRUTHS_STATEMENT_LENGTH) {
    throw new BondifyServiceError(
      "INVALID_TWO_TRUTHS_STATEMENT",
      `Statement ${position} must be ${MAX_TWO_TRUTHS_STATEMENT_LENGTH} characters or fewer.`,
      { position, maxLength: MAX_TWO_TRUTHS_STATEMENT_LENGTH },
    );
  }

  return trimmedStatement;
}

function validateTwoTruthsLieIndex(lieStatementIndex: number): TwoTruthsLieIndex {
  if (lieStatementIndex !== 1 && lieStatementIndex !== 2 && lieStatementIndex !== 3) {
    throw new BondifyServiceError("INVALID_TWO_TRUTHS_LIE_INDEX", "Choose which of the three statements is the lie.", {
      lieStatementIndex,
    });
  }

  return lieStatementIndex;
}

async function ensureTwoTruthsRoundRow(
  supabase: SupabaseServerClient,
  gameRoundId: string,
): Promise<TwoTruthsRoundRow> {
  const { data: existingRow, error: existingRowError } = await supabase
    .from("two_truths_rounds")
    .select("game_round_id, phase, collection_closed_at, voting_started_at, voting_closed_at, created_at, updated_at")
    .eq("game_round_id", gameRoundId)
    .maybeSingle();

  if (existingRowError) {
    throw new BondifyServiceError("ROUND_NOT_FOUND", existingRowError.message, { gameRoundId });
  }

  if (existingRow) {
    return existingRow;
  }

  const { data: createdRow, error: createError } = await supabase
    .from("two_truths_rounds")
    .insert({
      game_round_id: gameRoundId,
      phase: "collecting",
    })
    .select("game_round_id, phase, collection_closed_at, voting_started_at, voting_closed_at, created_at, updated_at")
    .maybeSingle();

  if (createError) {
    if (createError.code === "23505") {
      const { data: retryRow, error: retryError } = await supabase
        .from("two_truths_rounds")
        .select(
          "game_round_id, phase, collection_closed_at, voting_started_at, voting_closed_at, created_at, updated_at",
        )
        .eq("game_round_id", gameRoundId)
        .single();

      if (retryError) {
        throw new BondifyServiceError("ROUND_NOT_FOUND", retryError.message, { gameRoundId });
      }

      return retryRow;
    }

    throw new BondifyServiceError("ROUND_NOT_FOUND", createError.message, { gameRoundId });
  }

  if (!createdRow) {
    throw new BondifyServiceError("ROUND_NOT_FOUND", "Structured round state could not be created.", { gameRoundId });
  }

  return createdRow;
}

async function listTwoTruthsEntries(
  supabase: SupabaseServerClient,
  gameRoundId: string,
): Promise<TwoTruthsEntryWithAuthorRow[]> {
  const { data, error } = await supabase
    .from("two_truths_entries")
    .select(
      `
        id,
        game_round_id,
        author_membership_id,
        author_profile_id,
        statement_one,
        statement_two,
        statement_three,
        lie_statement_index,
        included_in_voting,
        created_at,
        updated_at,
        author_profile:profiles!two_truths_entries_author_profile_id_fkey (
          id,
          email,
          normalized_email
        )
      `,
    )
    .eq("game_round_id", gameRoundId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new BondifyServiceError("ROUND_NOT_FOUND", error.message, { gameRoundId });
  }

  return (data as RawTwoTruthsEntryWithAuthorRow[]).map(normalizeTwoTruthsEntryWithAuthorRow);
}

async function listTwoTruthsGuesses(
  supabase: SupabaseServerClient,
  gameRoundId: string,
): Promise<TwoTruthsGuessWithVoterRow[]> {
  const { data, error } = await supabase
    .from("two_truths_guesses")
    .select(
      `
        id,
        game_round_id,
        voter_membership_id,
        voter_profile_id,
        target_entry_id,
        guessed_lie_index,
        created_at,
        voter_profile:profiles!two_truths_guesses_voter_profile_id_fkey (
          id,
          email,
          normalized_email
        )
      `,
    )
    .eq("game_round_id", gameRoundId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new BondifyServiceError("ROUND_NOT_FOUND", error.message, { gameRoundId });
  }

  return (data as RawTwoTruthsGuessWithVoterRow[]).map(normalizeTwoTruthsGuessWithVoterRow);
}

function toTwoTruthsGuessProgress(input: {
  entries: TwoTruthsEntryRecord[];
  guesses: TwoTruthsGuessRecord[];
  currentMembershipId: string;
}): TwoTruthsGuessProgress {
  const votingEntries = input.entries.filter((entry) => entry.includedInVoting);
  const participantCount = votingEntries.length;
  const requiredGuessesPerParticipant = participantCount > 1 ? participantCount - 1 : 0;
  const requiredTotalGuessCount = participantCount * requiredGuessesPerParticipant;
  const currentMemberSubmittedGuessCount = input.guesses.filter(
    (guess) => guess.voter.membershipId === input.currentMembershipId,
  ).length;

  return {
    participantCount,
    requiredGuessesPerParticipant,
    requiredTotalGuessCount,
    submittedGuessCount: input.guesses.length,
    currentMemberSubmittedGuessCount,
    currentMemberOutstandingGuessCount: Math.max(requiredGuessesPerParticipant - currentMemberSubmittedGuessCount, 0),
    allRequiredGuessesSubmitted: requiredTotalGuessCount > 0 && input.guesses.length >= requiredTotalGuessCount,
  };
}

function buildTwoTruthsRevealSummary(input: {
  entries: TwoTruthsEntryRecord[];
  guesses: TwoTruthsGuessRecord[];
}): TwoTruthsRevealSummary {
  const entryById = new Map(input.entries.map((entry) => [entry.id, entry]));

  const scores: TwoTruthsRevealScore[] = input.entries
    .filter((entry) => entry.includedInVoting)
    .map((entry) => {
      const correctGuessCount = input.guesses.filter(
        (guess) =>
          guess.voter.membershipId === entry.author.membershipId &&
          entryById.get(guess.targetEntryId)?.lieStatementIndex === guess.guessedLieIndex,
      ).length;
      const fooledTeammateCount = input.guesses.filter(
        (guess) => guess.targetEntryId === entry.id && guess.guessedLieIndex !== entry.lieStatementIndex,
      ).length;

      return {
        participant: entry.author,
        correctGuessCount,
        fooledTeammateCount,
        totalScore: correctGuessCount + fooledTeammateCount,
      };
    })
    .sort(
      (left, right) =>
        right.totalScore - left.totalScore || left.participant.email.localeCompare(right.participant.email),
    );

  return {
    totalGuessesRecorded: input.guesses.length,
    scores,
  };
}

async function loadTwoTruthsRoundState(
  supabase: SupabaseServerClient,
  input: { round: GameRoundRow; membership: TeamMembershipRow },
): Promise<TwoTruthsRoundState> {
  const structuredRoundRow = await ensureTwoTruthsRoundRow(supabase, input.round.id);
  const entryRows = await listTwoTruthsEntries(supabase, input.round.id);
  const guessRows = await listTwoTruthsGuesses(supabase, input.round.id);
  const entries = entryRows.map(toTwoTruthsEntryRecord);
  const guesses = guessRows.map(toTwoTruthsGuessRecord);
  const guessProgress = toTwoTruthsGuessProgress({
    entries,
    guesses,
    currentMembershipId: input.membership.id,
  });

  return {
    round: toRound(input.round),
    structuredRound: toTwoTruthsRoundRecord(structuredRoundRow),
    entries,
    guesses,
    hasCurrentMemberSubmitted: entries.some((entry) => entry.author.membershipId === input.membership.id),
    currentMemberEntryId: entries.find((entry) => entry.author.membershipId === input.membership.id)?.id ?? null,
    guessProgress,
    revealSummary:
      structuredRoundRow.phase === "revealed"
        ? buildTwoTruthsRevealSummary({
            entries,
            guesses,
          })
        : null,
  };
}

async function finalizeTwoTruthsVoting(
  supabase: SupabaseServerClient,
  input: { round: GameRoundRow; membership: TeamMembershipRow },
): Promise<TwoTruthsRoundState> {
  const now = new Date().toISOString();
  const { error: roundStateError } = await supabase
    .from("two_truths_rounds")
    .update({
      phase: "revealed",
      voting_closed_at: now,
    })
    .eq("game_round_id", input.round.id)
    .eq("phase", "voting");

  if (roundStateError) {
    throw new BondifyServiceError("TWO_TRUTHS_ROUND_PHASE_MISMATCH", roundStateError.message, {
      roundId: input.round.id,
    });
  }

  const { data: updatedRound, error: updatedRoundError } = await supabase
    .from("game_rounds")
    .update({
      status: "revealed",
      revealed_at: now,
    })
    .eq("id", input.round.id)
    .eq("status", "open")
    .select(
      "id, team_id, game_template_id, opened_by_profile_id, status, revealed_at, history_visible_until, history_cleared_at, created_at, updated_at",
    )
    .single();

  if (updatedRoundError) {
    throw new BondifyServiceError("ROUND_NOT_OPEN", updatedRoundError.message, { roundId: input.round.id });
  }

  return loadTwoTruthsRoundState(supabase, {
    round: updatedRound,
    membership: input.membership,
  });
}

async function buildTwoTruthsHistorySummary(
  supabase: SupabaseServerClient,
  round: GameRoundRow,
): Promise<TwoTruthsHistorySummary> {
  const { data: structuredRound, error: structuredRoundError } = await supabase
    .from("two_truths_rounds")
    .select("game_round_id, phase, collection_closed_at, voting_started_at, voting_closed_at, created_at, updated_at")
    .eq("game_round_id", round.id)
    .single();

  if (structuredRoundError) {
    throw new BondifyServiceError("HISTORY_NOT_VISIBLE", structuredRoundError.message, { roundId: round.id });
  }

  const entries = (await listTwoTruthsEntries(supabase, round.id)).map(toTwoTruthsEntryRecord);
  const guesses = (await listTwoTruthsGuesses(supabase, round.id)).map(toTwoTruthsGuessRecord);

  return {
    round: toTwoTruthsRoundRecord(structuredRound),
    entries,
    revealSummary: buildTwoTruthsRevealSummary({
      entries,
      guesses,
    }),
  };
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
  const latestRevealedRound = activeRound
    ? null
    : await getLatestRevealedGameRound(supabase, {
        teamId: input.teamId,
        gameTemplateId: template.id,
      });
  const structuredSourceRound = activeRound ?? latestRevealedRound;
  const twoTruthsRound =
    isTwoTruthsTemplateSlug(template.slug) && structuredSourceRound
      ? await loadTwoTruthsRoundState(supabase, {
          round: structuredSourceRound,
          membership,
        })
      : null;

  return toTeamGameState({
    teamId: input.teamId,
    membership,
    template,
    activeRound: isTwoTruthsTemplateSlug(template.slug) ? null : activeRound,
    revealedRound: isTwoTruthsTemplateSlug(template.slug) ? null : latestRevealedRound,
    twoTruthsRound,
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
          memberships: row.team_memberships.filter(isActiveMembership).map(toTeamRosterEntry),
          pendingInvites: row.team_invites.filter((invite) => invite.status === "pending").map(toTeamInviteView),
        }));
      });
    },

    async getShellContext(input?: { preferredTeamId?: string | null }): Promise<BondifyShellContext> {
      return withCurrentProfile(async (supabase, profile) => {
        const rows = await listTeamSummaryRows(supabase);
        const teams = rows.map(toShellTeamOption);
        const preferredTeamId = input?.preferredTeamId;
        const activeTeam = teams.find((team) => team.id === preferredTeamId) ?? teams.at(0) ?? null;

        return {
          viewerEmail: profile.email,
          teams,
          activeTeam,
        };
      });
    },

    async getTeamManagementState(input: { teamId: string }): Promise<TeamManagementState> {
      return withCurrentProfile(async (supabase, profile) => {
        const [rows, incomingInvites] = await Promise.all([
          listTeamSummaryRows(supabase),
          listPendingInvitesForNormalizedEmail(supabase, profile.normalizedEmail),
        ]);
        const selectedRow = rows.find((row) => row.id === input.teamId);

        if (!selectedRow) {
          throw new BondifyServiceError("TEAM_ACCESS_DENIED", "You do not have access to this team.", {
            teamId: input.teamId,
            profileId: profile.id,
          });
        }

        return toTeamManagementState({
          row: selectedRow,
          incomingInvites,
          profileId: profile.id,
        });
      });
    },

    async removeTeamMember(input: { teamId: string; membershipId: string }): Promise<TeamMemberRemoveResult> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireTeamOwnerAccess(supabase, { teamId: input.teamId, profileId: profile.id });

        const { data, error } = await supabase
          .rpc("remove_team_member", {
            team_uuid: input.teamId,
            membership_uuid: input.membershipId,
          })
          .maybeSingle();

        if (error) {
          const normalizedMessage = error.message.toLowerCase();

          if (normalizedMessage.includes("owner membership")) {
            throw new BondifyServiceError(
              "TEAM_OWNER_MEMBERSHIP_IMMUTABLE",
              "The team owner cannot be removed from the roster.",
              {
                teamId: input.teamId,
                membershipId: input.membershipId,
              },
            );
          }

          throw new BondifyServiceError("TEAM_MEMBER_NOT_FOUND", error.message, {
            teamId: input.teamId,
            membershipId: input.membershipId,
          });
        }

        if (!data) {
          throw new BondifyServiceError("TEAM_MEMBER_NOT_FOUND", "That team member could not be found.", {
            teamId: input.teamId,
            membershipId: input.membershipId,
          });
        }

        const result = data as TeamMemberRemoveRpcResult;

        return {
          teamId: result.team_id,
          membershipId: result.membership_id,
          removedProfileId: result.removed_profile_id,
          removedEmail: result.removed_email,
          removedAt: result.removed_at,
        };
      });
    },

    async deleteOwnedTeam(input: { teamId: string; confirmationName: string }): Promise<TeamDeleteResult> {
      return withCurrentProfile(async (supabase, profile) => {
        const team = await requireTeamOwnerAccess(supabase, { teamId: input.teamId, profileId: profile.id });
        const confirmationName = input.confirmationName.trim();

        if (confirmationName !== team.name) {
          throw new BondifyServiceError(
            "DELETE_TEAM_CONFIRMATION_MISMATCH",
            `Type "${team.name}" exactly to confirm team deletion.`,
            {
              teamId: input.teamId,
            },
          );
        }

        const teamRows = await listTeamSummaryRows(supabase);
        const redirectTeamId = teamRows.find((row) => row.id !== input.teamId)?.id ?? null;
        const { data, error } = await supabase.rpc("delete_owned_team", { team_uuid: input.teamId }).maybeSingle();

        if (error) {
          throw new BondifyServiceError("TEAM_NOT_FOUND", error.message, {
            teamId: input.teamId,
          });
        }

        if (!data) {
          throw new BondifyServiceError("TEAM_NOT_FOUND", "That team could not be deleted.", {
            teamId: input.teamId,
          });
        }

        const result = data as TeamDeleteRpcResult;

        return {
          deletedTeamId: result.deleted_team_id,
          deletedTeamName: result.deleted_team_name,
          redirectTeamId,
        };
      });
    },

    async updateTeam(input: { teamId: string; name: string }): Promise<TeamSummary> {
      const name = input.name.trim();

      if (!name || name.length > 80) {
        throw new BondifyServiceError(
          "INVALID_TEAM_NAME",
          name ? "Team name is too long." : "Team name cannot be blank.",
          { teamId: input.teamId },
        );
      }

      return withCurrentProfile(async (supabase, profile) => {
        await requireTeamOwnerAccess(supabase, { teamId: input.teamId, profileId: profile.id });

        const { error } = await supabase.from("teams").update({ name }).eq("id", input.teamId);

        if (error) {
          throw new BondifyServiceError("TEAM_NOT_FOUND", error.message, { teamId: input.teamId });
        }

        const updatedRow = (await listTeamSummaryRows(supabase)).find((row) => row.id === input.teamId);

        if (!updatedRow) {
          throw new BondifyServiceError("TEAM_NOT_FOUND", "That team could not be updated.", {
            teamId: input.teamId,
          });
        }

        return {
          team: toTeam(updatedRow),
          memberships: updatedRow.team_memberships.filter(isActiveMembership).map(toTeamRosterEntry),
          pendingInvites: updatedRow.team_invites
            .filter((invite) => invite.status === "pending")
            .map(toTeamInviteView),
        };
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

        const membership = await findActiveMembershipByTeamAndProfile(supabase, {
          teamId,
          profileId: profile.id,
        });

        if (!membership) {
          throw new BondifyServiceError("TEAM_ACCESS_DENIED", "You do not have access to this team.", {
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

          if (
            await hasActiveMembershipForNormalizedEmail(supabase, {
              teamId: input.teamId,
              normalizedEmail,
            })
          ) {
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
        return listPendingInvitesForNormalizedEmail(supabase, profile.normalizedEmail);
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

        const membership = await findActiveMembershipByTeamAndProfile(supabase, {
          teamId: updatedInviteRow.team_id,
          profileId: profile.id,
        });

        if (!membership) {
          throw new BondifyServiceError("TEAM_ACCESS_DENIED", "You do not have access to this team.", {
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

    async getTodayEmojiCheckInState(input: { teamId: string }): Promise<EmojiCheckInTodayState> {
      return withCurrentProfile(async (supabase, profile) =>
        loadTodayEmojiCheckInState(supabase, {
          teamId: input.teamId,
          profileId: profile.id,
        }),
      );
    },

    async submitTodayEmojiCheckIn(input: { teamId: string; emojis: string[] }): Promise<EmojiCheckInTodayState> {
      const emojis = validateEmojiCheckInEmojis(input.emojis);

      return withCurrentProfile(async (supabase, profile) => {
        const { membership, session } = await ensureTodayEmojiCheckInSession(supabase, {
          teamId: input.teamId,
          profileId: profile.id,
        });

        if (session.status === "revealed") {
          throw new BondifyServiceError(
            "EMOJI_CHECK_IN_ALREADY_REVEALED",
            "Today's Emoji Check-In has already been revealed.",
            {
              sessionId: session.id,
              teamId: input.teamId,
            },
          );
        }

        const { error } = await supabase.from("emoji_check_in_submissions").insert({
          session_id: session.id,
          membership_id: membership.id,
          profile_id: profile.id,
          emojis,
        });

        if (error) {
          if (error.code === "23505") {
            throw new BondifyServiceError("DUPLICATE_DAILY_EMOJI_CHECK_IN", "You already checked in for today.", {
              sessionId: session.id,
              membershipId: membership.id,
            });
          }

          const latestSession = await getEmojiCheckInSessionWithSubmissions(supabase, {
            teamId: input.teamId,
            sessionId: session.id,
          });

          if (latestSession?.status === "revealed") {
            throw new BondifyServiceError(
              "EMOJI_CHECK_IN_ALREADY_REVEALED",
              "Today's Emoji Check-In has already been revealed.",
              {
                sessionId: session.id,
                teamId: input.teamId,
              },
            );
          }

          throw new BondifyServiceError("INVALID_EMOJI_SELECTION", error.message, {
            sessionId: session.id,
            teamId: input.teamId,
          });
        }

        return loadTodayEmojiCheckInState(supabase, {
          teamId: input.teamId,
          profileId: profile.id,
        });
      });
    },

    async revealTodayEmojiCheckIn(input: { teamId: string; sessionId: string }): Promise<EmojiCheckInRevealSummary> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireMembershipAccess(supabase, input.teamId, profile.id);
        const currentSession = await getEmojiCheckInSessionWithSubmissions(supabase, {
          teamId: input.teamId,
          sessionId: input.sessionId,
        });

        if (!currentSession) {
          throw new BondifyServiceError(
            "EMOJI_CHECK_IN_SESSION_NOT_FOUND",
            "Today's Emoji Check-In session could not be found.",
            input,
          );
        }

        if (currentSession.status === "revealed") {
          throw new BondifyServiceError(
            "EMOJI_CHECK_IN_ALREADY_REVEALED",
            "Today's Emoji Check-In has already been revealed.",
            input,
          );
        }

        const submissions = currentSession.emoji_check_in_submissions;
        if (submissions.length === 0) {
          throw new BondifyServiceError(
            "EMOJI_CHECK_IN_HAS_NO_SUBMISSIONS",
            "Collect at least one emoji check-in before revealing the team mood.",
            input,
          );
        }

        const updateSessionResult = await supabase
          .from("emoji_check_in_sessions")
          .update({
            status: "revealed",
            revealed_at: new Date().toISOString(),
          })
          .eq("id", input.sessionId)
          .eq("team_id", input.teamId)
          .eq("status", "open")
          .select("id, team_id, session_date, status, revealed_at, created_at, updated_at")
          .maybeSingle();
        const updatedSession = updateSessionResult.data;
        const updateError = updateSessionResult.error;

        if (updateError) {
          throw new BondifyServiceError("EMOJI_CHECK_IN_ALREADY_REVEALED", updateError.message, input);
        }

        if (!updatedSession) {
          const latestSession = await getEmojiCheckInSessionWithSubmissions(supabase, input);

          if (latestSession?.status === "revealed") {
            throw new BondifyServiceError(
              "EMOJI_CHECK_IN_ALREADY_REVEALED",
              "Today's Emoji Check-In has already been revealed.",
              input,
            );
          }

          throw new BondifyServiceError(
            "EMOJI_CHECK_IN_SESSION_NOT_FOUND",
            "Today's Emoji Check-In session could not be updated.",
            input,
          );
        }

        const revealedSession = await getEmojiCheckInSessionWithSubmissions(supabase, {
          teamId: input.teamId,
          sessionId: input.sessionId,
        });

        if (!revealedSession) {
          throw new BondifyServiceError(
            "EMOJI_CHECK_IN_SESSION_NOT_FOUND",
            "Today's Emoji Check-In session could not be reloaded after reveal.",
            input,
          );
        }

        return toEmojiCheckInRevealSummary({
          session: revealedSession,
          submissions: revealedSession.emoji_check_in_submissions,
        });
      });
    },

    async getEmojiCheckInTimeline(input: { teamId: string; days?: number }): Promise<EmojiCheckInTimelineEntry[]> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireMembershipAccess(supabase, input.teamId, profile.id);
        const days = Math.max(1, input.days ?? EMOJI_CHECK_IN_TIMELINE_DAYS);
        const rows = await listEmojiCheckInTimelineRows(supabase, {
          teamId: input.teamId,
          days,
        });

        return rows.map((row) =>
          toEmojiCheckInTimelineEntry({
            session: row,
            submissions: row.emoji_check_in_submissions,
          }),
        );
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

        if (currentState.activeRound || currentState.twoTruthsRound?.round.status === "open") {
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

        if (isTwoTruthsTemplateSlug(currentState.template.slug)) {
          const latestState = await loadTeamGameState(supabase, {
            teamId: input.teamId,
            gameSlug: input.gameSlug,
            profileId: profile.id,
          });

          const structuredRoundId = latestState.twoTruthsRound?.round.id;
          if (structuredRoundId) {
            await ensureTwoTruthsRoundRow(supabase, structuredRoundId);
          }

          return latestState;
        }

        return loadTeamGameState(supabase, {
          teamId: input.teamId,
          gameSlug: input.gameSlug,
          profileId: profile.id,
        });
      });
    },

    async revealTeamGameRound(input: {
      teamId: string;
      gameSlug: string;
      roundId: string;
    }): Promise<ParticipantSafeRoundReveal> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireMembershipAccess(supabase, input.teamId, profile.id);
        const template = await getTemplateBySlug(supabase, input.gameSlug);

        const { data: round, error: roundError } = await supabase
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
          .eq("id", input.roundId)
          .eq("team_id", input.teamId)
          .eq("game_template_id", template.id)
          .maybeSingle();

        if (roundError) {
          throw new BondifyServiceError("ROUND_NOT_FOUND", roundError.message, {
            roundId: input.roundId,
            teamId: input.teamId,
            gameSlug: input.gameSlug,
          });
        }

        if (!round) {
          throw new BondifyServiceError("ROUND_NOT_FOUND", "Round not found for this team game.", {
            roundId: input.roundId,
            teamId: input.teamId,
            gameSlug: input.gameSlug,
          });
        }

        const roundRow = normalizeGameRoundWithTemplateRow(round);
        if (isTwoTruthsTemplateSlug(roundRow.game_template.slug)) {
          throw new BondifyServiceError(
            "LEGACY_TWO_TRUTHS_TEMPLATE_NOT_SUPPORTED",
            "This structured round reveals through the dedicated Two Truths flow.",
            {
              roundId: input.roundId,
              gameSlug: input.gameSlug,
            },
          );
        }

        if (roundRow.status === "revealed") {
          throw new BondifyServiceError("ROUND_ALREADY_REVEALED", "This game has already been revealed.", {
            roundId: input.roundId,
          });
        }

        if (roundRow.status !== "open") {
          throw new BondifyServiceError("ROUND_NOT_OPEN", "This game is not ready to reveal.", {
            roundId: input.roundId,
            status: roundRow.status,
          });
        }

        if (roundRow.game_responses.length === 0) {
          throw new BondifyServiceError("ROUND_HAS_NO_RESPONSES", "Collect at least one response before revealing.", {
            roundId: input.roundId,
          });
        }

        const { error: updateError } = await supabase
          .from("game_rounds")
          .update({
            status: "revealed",
            revealed_at: new Date().toISOString(),
          })
          .eq("id", input.roundId)
          .eq("status", "open");

        if (updateError) {
          throw new BondifyServiceError("ROUND_NOT_OPEN", updateError.message, { roundId: input.roundId });
        }

        const { data: revealedRound, error: revealedRoundError } = await supabase
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
          .eq("id", input.roundId)
          .single();

        if (revealedRoundError) {
          throw new BondifyServiceError("ROUND_NOT_FOUND", revealedRoundError.message, { roundId: input.roundId });
        }

        return toParticipantSafeRoundReveal(normalizeGameRoundWithTemplateRow(revealedRound));
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

        const { data: templateRow, error: templateError } = await supabase
          .from("game_templates")
          .select("id, slug, name, prompt, is_history_enabled")
          .eq("id", roundRow.game_template_id)
          .single();

        if (templateError) {
          throw new BondifyServiceError("INVALID_GAME_TEMPLATE", templateError.message, {
            gameTemplateId: roundRow.game_template_id,
          });
        }

        const templateProjection: TemplateProjectionRow = templateRow;
        if (isTwoTruthsTemplateSlug(templateProjection.slug)) {
          throw new BondifyServiceError(
            "LEGACY_TWO_TRUTHS_TEMPLATE_NOT_SUPPORTED",
            "This structured round uses dedicated truth/lie entry forms instead of the old free-text response flow.",
            { roundId: input.roundId },
          );
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

        const createdResponseRow: GameResponseRow = createdResponse;

        await markRoundHistoryVisibleIfEligible(supabase, {
          round: roundRow,
          firstResponseCreatedAt: createdResponseRow.created_at,
        });

        return toResponseRecord(createdResponseRow);
      });
    },

    async submitTwoTruthsEntry(input: {
      roundId: string;
      statementOne: string;
      statementTwo: string;
      statementThree: string;
      lieStatementIndex: number;
    }): Promise<TwoTruthsRoundState> {
      const statementOne = validateTwoTruthsStatement(input.statementOne, 1);
      const statementTwo = validateTwoTruthsStatement(input.statementTwo, 2);
      const statementThree = validateTwoTruthsStatement(input.statementThree, 3);
      const lieStatementIndex = validateTwoTruthsLieIndex(input.lieStatementIndex);

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
        const template = await getTemplateBySlug(supabase, TWO_TRUTHS_TEMPLATE_SLUG);
        if (roundRow.game_template_id !== template.id) {
          throw new BondifyServiceError(
            "LEGACY_TWO_TRUTHS_TEMPLATE_NOT_SUPPORTED",
            "This round is not using the structured Two Truths and a Lie template.",
            { roundId: input.roundId },
          );
        }

        if (roundRow.status !== "open") {
          throw new BondifyServiceError("ROUND_NOT_OPEN", "This round is no longer collecting entries.", {
            roundId: input.roundId,
          });
        }

        const membership = await requireMembershipAccess(supabase, roundRow.team_id, profile.id);
        const structuredRound = await ensureTwoTruthsRoundRow(supabase, roundRow.id);

        if (structuredRound.phase !== "collecting") {
          throw new BondifyServiceError(
            "TWO_TRUTHS_ROUND_PHASE_MISMATCH",
            "This round is no longer collecting structured entries.",
            { roundId: input.roundId, phase: structuredRound.phase },
          );
        }

        const entryId = crypto.randomUUID();
        const { error: insertError } = await supabase.from("two_truths_entries").insert({
          id: entryId,
          game_round_id: input.roundId,
          author_membership_id: membership.id,
          author_profile_id: profile.id,
          statement_one: statementOne,
          statement_two: statementTwo,
          statement_three: statementThree,
          lie_statement_index: lieStatementIndex,
        });

        if (insertError) {
          throw mapDuplicateInsertError(
            insertError,
            new BondifyServiceError(
              "DUPLICATE_TWO_TRUTHS_ENTRY",
              "You have already submitted your set for this round.",
              {
                roundId: input.roundId,
                membershipId: membership.id,
              },
            ),
          );
        }

        const { data: createdEntry, error: createdEntryError } = await supabase
          .from("two_truths_entries")
          .select("created_at")
          .eq("id", entryId)
          .single();

        if (createdEntryError) {
          throw new BondifyServiceError("ROUND_NOT_FOUND", createdEntryError.message, {
            roundId: input.roundId,
            entryId,
          });
        }

        const createdEntryRow: { created_at: string } = createdEntry;

        await markRoundHistoryVisibleIfEligible(supabase, {
          round: roundRow,
          firstResponseCreatedAt: createdEntryRow.created_at,
        });

        return loadTwoTruthsRoundState(supabase, {
          round: roundRow,
          membership,
        });
      });
    },

    async closeTwoTruthsCollection(input: { roundId: string }): Promise<TwoTruthsRoundState> {
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
        const template = await getTemplateBySlug(supabase, TWO_TRUTHS_TEMPLATE_SLUG);
        if (roundRow.game_template_id !== template.id) {
          throw new BondifyServiceError(
            "LEGACY_TWO_TRUTHS_TEMPLATE_NOT_SUPPORTED",
            "This round is not using the structured Two Truths and a Lie template.",
            { roundId: input.roundId },
          );
        }

        const membership = await requireMembershipAccess(supabase, roundRow.team_id, profile.id);
        const structuredRound = await ensureTwoTruthsRoundRow(supabase, roundRow.id);

        if (structuredRound.phase !== "collecting") {
          throw new BondifyServiceError(
            "TWO_TRUTHS_ROUND_PHASE_MISMATCH",
            "This round has already moved past collection.",
            { roundId: input.roundId, phase: structuredRound.phase },
          );
        }

        const entryRows = await listTwoTruthsEntries(supabase, input.roundId);
        if (entryRows.length < 2) {
          throw new BondifyServiceError(
            "TWO_TRUTHS_INSUFFICIENT_ENTRIES",
            "Collect at least two submitted sets before starting voting.",
            { roundId: input.roundId, submittedEntryCount: entryRows.length },
          );
        }

        const now = new Date().toISOString();
        const { error: markEntriesError } = await supabase
          .from("two_truths_entries")
          .update({ included_in_voting: true })
          .eq("game_round_id", input.roundId)
          .eq("included_in_voting", false);

        if (markEntriesError) {
          throw new BondifyServiceError("TWO_TRUTHS_ROUND_PHASE_MISMATCH", markEntriesError.message, {
            roundId: input.roundId,
          });
        }

        const { error: updateStateError } = await supabase
          .from("two_truths_rounds")
          .update({
            phase: "voting",
            collection_closed_at: now,
            voting_started_at: now,
          })
          .eq("game_round_id", input.roundId)
          .eq("phase", "collecting");

        if (updateStateError) {
          throw new BondifyServiceError("TWO_TRUTHS_ROUND_PHASE_MISMATCH", updateStateError.message, {
            roundId: input.roundId,
          });
        }

        return loadTwoTruthsRoundState(supabase, {
          round: roundRow,
          membership,
        });
      });
    },

    async getTwoTruthsGuessProgress(input: { roundId: string }): Promise<TwoTruthsGuessProgress> {
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
        const membership = await requireMembershipAccess(supabase, roundRow.team_id, profile.id);
        const state = await loadTwoTruthsRoundState(supabase, {
          round: roundRow,
          membership,
        });

        return state.guessProgress;
      });
    },

    async submitTwoTruthsGuess(input: {
      roundId: string;
      targetEntryId: string;
      guessedLieIndex: number;
    }): Promise<TwoTruthsRoundState> {
      const guessedLieIndex = validateTwoTruthsLieIndex(input.guessedLieIndex);

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
          throw new BondifyServiceError("ROUND_NOT_OPEN", "This round is no longer accepting guesses.", {
            roundId: input.roundId,
          });
        }

        const membership = await requireMembershipAccess(supabase, roundRow.team_id, profile.id);
        const structuredRound = await ensureTwoTruthsRoundRow(supabase, roundRow.id);
        if (structuredRound.phase !== "voting") {
          throw new BondifyServiceError("TWO_TRUTHS_ROUND_PHASE_MISMATCH", "This round is not in the voting phase.", {
            roundId: input.roundId,
            phase: structuredRound.phase,
          });
        }

        const entryRows = await listTwoTruthsEntries(supabase, input.roundId);
        const targetEntry = entryRows.find((entry) => entry.id === input.targetEntryId && entry.included_in_voting);
        if (!targetEntry) {
          throw new BondifyServiceError("TWO_TRUTHS_ENTRY_NOT_FOUND", "That teammate entry could not be found.", {
            roundId: input.roundId,
            targetEntryId: input.targetEntryId,
          });
        }

        if (targetEntry.author_membership_id === membership.id) {
          throw new BondifyServiceError("TWO_TRUTHS_SELF_GUESS", "You cannot guess on your own submitted set.", {
            roundId: input.roundId,
            targetEntryId: input.targetEntryId,
          });
        }

        const guessId = crypto.randomUUID();
        const { error: insertError } = await supabase.from("two_truths_guesses").insert({
          id: guessId,
          game_round_id: input.roundId,
          voter_membership_id: membership.id,
          voter_profile_id: profile.id,
          target_entry_id: input.targetEntryId,
          guessed_lie_index: guessedLieIndex,
        });

        if (insertError) {
          throw mapDuplicateInsertError(
            insertError,
            new BondifyServiceError("DUPLICATE_TWO_TRUTHS_GUESS", "You have already guessed on this teammate's set.", {
              roundId: input.roundId,
              targetEntryId: input.targetEntryId,
              membershipId: membership.id,
            }),
          );
        }

        const state = await loadTwoTruthsRoundState(supabase, {
          round: roundRow,
          membership,
        });

        if (state.guessProgress.allRequiredGuessesSubmitted) {
          return finalizeTwoTruthsVoting(supabase, {
            round: roundRow,
            membership,
          });
        }

        return state;
      });
    },

    async closeTwoTruthsVoting(input: { roundId: string }): Promise<TwoTruthsRoundState> {
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
          throw new BondifyServiceError("ROUND_NOT_OPEN", "This round is no longer open.", {
            roundId: input.roundId,
          });
        }

        const membership = await requireMembershipAccess(supabase, roundRow.team_id, profile.id);
        const structuredRound = await ensureTwoTruthsRoundRow(supabase, roundRow.id);
        if (structuredRound.phase !== "voting") {
          throw new BondifyServiceError("TWO_TRUTHS_ROUND_PHASE_MISMATCH", "This round is not in the voting phase.", {
            roundId: input.roundId,
            phase: structuredRound.phase,
          });
        }

        return finalizeTwoTruthsVoting(supabase, {
          round: roundRow,
          membership,
        });
      });
    },

    async getParticipantSafeRoundReveal(roundId: string): Promise<ParticipantSafeRoundReveal> {
      return withCurrentProfile(async (supabase, profile) => {
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

        const roundRow = normalizeGameRoundWithTemplateRow(data);
        await requireMembershipAccess(supabase, roundRow.team_id, profile.id);

        if (roundRow.status !== "revealed") {
          throw new BondifyServiceError("HISTORY_NOT_VISIBLE", "This game has not been revealed yet.", { roundId });
        }

        return toParticipantSafeRoundReveal(roundRow);
      });
    },

    async getParticipantSafeHistory(teamId: string): Promise<ParticipantSafeHistoryEntry[]> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireMembershipAccess(supabase, teamId, profile.id);
        return toParticipantSafeHistoryEntries(supabase, await listVisibleHistoryRows(supabase, teamId));
      });
    },

    async getTeamHistoryState(teamId: string): Promise<TeamHistoryState> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireMembershipAccess(supabase, teamId, profile.id);
        const team = await getTeamForMember(supabase, teamId);
        const entries = await toParticipantSafeHistoryEntries(supabase, await listVisibleHistoryRows(supabase, teamId));
        const emojiCheckInTimeline = (
          await listEmojiCheckInTimelineRows(supabase, {
            teamId,
            days: EMOJI_CHECK_IN_TIMELINE_DAYS,
          })
        ).map((row) =>
          toEmojiCheckInTimelineEntry({
            session: row,
            submissions: row.emoji_check_in_submissions,
          }),
        );

        return toTeamHistoryState({
          team,
          entries,
          emojiCheckInTimeline,
          profileId: profile.id,
        });
      });
    },

    async clearTeamHistory(teamId: string): Promise<TeamHistoryClearResult> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireTeamOwnerAccess(supabase, { teamId, profileId: profile.id });
        const clearedAt = new Date().toISOString();
        const { data, error } = await supabase.rpc("clear_team_history", { team_uuid: teamId }).maybeSingle();

        if (error) {
          throw new BondifyServiceError("HISTORY_NOT_VISIBLE", error.message, { teamId });
        }

        const result = normalizeHistoryClearRpcResult(data as HistoryClearRpcResult | null, clearedAt);

        return {
          teamId,
          clearedCount: result.cleared_count,
          clearedAt: result.cleared_at,
        };
      });
    },

    async clearTeamHistoryEntry(input: { teamId: string; roundId: string }): Promise<TeamHistoryEntryClearResult> {
      return withCurrentProfile(async (supabase, profile) => {
        await requireTeamOwnerAccess(supabase, { teamId: input.teamId, profileId: profile.id });
        const clearedAt = new Date().toISOString();
        const { data, error } = await supabase
          .rpc("clear_team_history_entry", { team_uuid: input.teamId, round_uuid: input.roundId })
          .maybeSingle();

        if (error) {
          throw new BondifyServiceError("HISTORY_NOT_VISIBLE", error.message, {
            teamId: input.teamId,
            roundId: input.roundId,
          });
        }

        const result = normalizeHistoryClearRpcResult(data as HistoryClearRpcResult | null, clearedAt);

        if (result.cleared_count === 0) {
          throw new BondifyServiceError("HISTORY_ENTRY_NOT_FOUND", "History entry not found.", {
            teamId: input.teamId,
            roundId: input.roundId,
          });
        }

        return {
          teamId: input.teamId,
          roundId: input.roundId,
          clearedCount: result.cleared_count,
          clearedAt: result.cleared_at,
        };
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
