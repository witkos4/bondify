export type TeamInviteStatus = "pending" | "accepted" | "revoked" | "expired";
export type TeamSurface = "dashboard" | "management";

export type GameRoundStatus = "open" | "revealed" | "closed";
export type EmojiCheckInSessionStatus = "open" | "revealed";
export type TwoTruthsRoundPhase = "collecting" | "voting" | "revealed";
export type TwoTruthsLieIndex = 1 | 2 | 3;

export type BondifyDomainErrorCode =
  | "SUPABASE_NOT_CONFIGURED"
  | "UNAUTHENTICATED"
  | "PROFILE_NOT_FOUND"
  | "TEAM_NOT_FOUND"
  | "TEAM_ACCESS_DENIED"
  | "INVALID_TEAM_NAME"
  | "INVALID_INVITE_EMAIL"
  | "DUPLICATE_INVITE"
  | "ALREADY_TEAM_MEMBER"
  | "SELF_INVITE"
  | "DUPLICATE_MEMBERSHIP"
  | "INVITE_NOT_FOUND"
  | "INVITE_NOT_PENDING"
  | "INVITE_EMAIL_MISMATCH"
  | "INVALID_GAME_TEMPLATE"
  | "ROUND_NOT_FOUND"
  | "ROUND_NOT_OPEN"
  | "ROUND_ALREADY_REVEALED"
  | "ROUND_HAS_NO_RESPONSES"
  | "INVALID_RESPONSE_TEXT"
  | "DUPLICATE_RESPONSE"
  | "INVALID_TWO_TRUTHS_STATEMENT"
  | "INVALID_TWO_TRUTHS_LIE_INDEX"
  | "DUPLICATE_TWO_TRUTHS_ENTRY"
  | "DUPLICATE_TWO_TRUTHS_GUESS"
  | "TWO_TRUTHS_SELF_GUESS"
  | "TWO_TRUTHS_ENTRY_NOT_FOUND"
  | "TWO_TRUTHS_INSUFFICIENT_ENTRIES"
  | "TWO_TRUTHS_ROUND_PHASE_MISMATCH"
  | "LEGACY_TWO_TRUTHS_TEMPLATE_NOT_SUPPORTED"
  | "EMOJI_CHECK_IN_SESSION_NOT_FOUND"
  | "EMOJI_CHECK_IN_ALREADY_REVEALED"
  | "EMOJI_CHECK_IN_HAS_NO_SUBMISSIONS"
  | "INVALID_EMOJI_SELECTION"
  | "DUPLICATE_DAILY_EMOJI_CHECK_IN"
  | "HISTORY_NOT_VISIBLE"
  | "HISTORY_ENTRY_NOT_FOUND"
  | "TEAM_OWNER_REQUIRED"
  | "INVALID_RETURN_SURFACE"
  | "TEAM_MEMBER_NOT_FOUND"
  | "TEAM_OWNER_MEMBERSHIP_IMMUTABLE"
  | "DELETE_TEAM_CONFIRMATION_MISMATCH";

export interface BondifyProfile {
  id: string;
  email: string;
  normalizedEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface BondifyTeam {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BondifyTeamMembership {
  id: string;
  teamId: string;
  profileId: string;
  createdAt: string;
  removedAt: string | null;
}

export interface BondifyTeamInvite {
  id: string;
  teamId: string;
  inviterProfileId: string;
  email: string;
  normalizedEmail: string;
  status: TeamInviteStatus;
  acceptedProfileId: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BondifyGameTemplate {
  id: string;
  slug: string;
  name: string;
  prompt: string;
  isHistoryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BondifyGameRound {
  id: string;
  teamId: string;
  gameTemplateId: string;
  openedByProfileId: string;
  status: GameRoundStatus;
  revealedAt: string | null;
  historyVisibleUntil: string | null;
  historyClearedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TwoTruthsRoundRecord {
  roundId: string;
  phase: TwoTruthsRoundPhase;
  collectionClosedAt: string | null;
  votingStartedAt: string | null;
  votingClosedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BondifyGameResponseRecord {
  id: string;
  roundId: string;
  membershipId: string;
  profileId: string;
  responseText: string;
  createdAt: string;
}

export interface TwoTruthsEntryAuthor {
  membershipId: string;
  profileId: string;
  email: string;
  normalizedEmail: string;
}

export interface TwoTruthsEntryRecord {
  id: string;
  roundId: string;
  author: TwoTruthsEntryAuthor;
  statements: [string, string, string];
  lieStatementIndex: TwoTruthsLieIndex;
  includedInVoting: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TwoTruthsGuessRecord {
  id: string;
  roundId: string;
  voter: TwoTruthsEntryAuthor;
  targetEntryId: string;
  guessedLieIndex: TwoTruthsLieIndex;
  createdAt: string;
}

export interface EmojiCheckInSession {
  id: string;
  teamId: string;
  sessionDate: string;
  status: EmojiCheckInSessionStatus;
  revealedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmojiCheckInSubmissionRecord {
  id: string;
  sessionId: string;
  membershipId: string;
  profileId: string;
  emojis: string[];
  createdAt: string;
}

export interface TeamRosterEntry {
  membership: BondifyTeamMembership;
  profile: Pick<BondifyProfile, "id" | "email" | "normalizedEmail">;
}

export interface TeamInviteView {
  invite: BondifyTeamInvite;
  acceptedProfile: Pick<BondifyProfile, "id" | "email" | "normalizedEmail"> | null;
}

export interface TeamSummary {
  team: BondifyTeam;
  memberships: TeamRosterEntry[];
  pendingInvites: TeamInviteView[];
}

export interface TeamInviteCreateResult {
  email: string;
  normalizedEmail: string;
  ok: boolean;
  invite: BondifyTeamInvite | null;
  errorCode: BondifyDomainErrorCode | null;
  errorMessage: string | null;
}

export interface BondifyShellTeamOption {
  id: string;
  name: string;
  memberCount: number;
  pendingInviteCount: number;
}

export interface BondifyShellContext {
  viewerEmail: string;
  teams: BondifyShellTeamOption[];
  activeTeam: BondifyShellTeamOption | null;
}

export interface EmojiCheckInAggregatedEmojiCount {
  emoji: string;
  count: number;
}

export interface EmojiCheckInRevealSummary {
  session: EmojiCheckInSession;
  submittedCount: number;
  emojiCounts: EmojiCheckInAggregatedEmojiCount[];
}

export interface EmojiCheckInTimelineEntry {
  session: EmojiCheckInSession;
  submittedCount: number;
  emojiCounts: EmojiCheckInAggregatedEmojiCount[];
}

export interface EmojiCheckInTodayState {
  teamId: string;
  session: EmojiCheckInSession;
  hasCurrentMemberSubmitted: boolean;
  currentMemberSubmission: Pick<EmojiCheckInSubmissionRecord, "id" | "emojis"> | null;
  submittedCount: number;
  revealedSummary: EmojiCheckInRevealSummary | null;
}

export interface ParticipantSafeResponse {
  id: string;
  roundId: string;
  responseText: string;
  createdAt: string;
}

export interface ParticipantSafeRoundReveal {
  round: BondifyGameRound;
  template: Pick<BondifyGameTemplate, "id" | "slug" | "name" | "prompt" | "isHistoryEnabled">;
  responses: ParticipantSafeResponse[];
}

export interface TwoTruthsGuessProgress {
  participantCount: number;
  requiredGuessesPerParticipant: number;
  requiredTotalGuessCount: number;
  submittedGuessCount: number;
  currentMemberSubmittedGuessCount: number;
  currentMemberOutstandingGuessCount: number;
  allRequiredGuessesSubmitted: boolean;
}

export interface TwoTruthsRevealScore {
  participant: TwoTruthsEntryAuthor;
  correctGuessCount: number;
  fooledTeammateCount: number;
  totalScore: number;
}

export interface TwoTruthsRevealSummary {
  totalGuessesRecorded: number;
  scores: TwoTruthsRevealScore[];
}

export interface TwoTruthsRoundState {
  round: BondifyGameRound;
  structuredRound: TwoTruthsRoundRecord;
  entries: TwoTruthsEntryRecord[];
  guesses: TwoTruthsGuessRecord[];
  hasCurrentMemberSubmitted: boolean;
  currentMemberEntryId: string | null;
  guessProgress: TwoTruthsGuessProgress;
  revealSummary: TwoTruthsRevealSummary | null;
}

export interface TwoTruthsHistorySummary {
  round: TwoTruthsRoundRecord;
  entries: TwoTruthsEntryRecord[];
  revealSummary: TwoTruthsRevealSummary;
}

export interface ParticipantSafeHistoryEntry {
  round: BondifyGameRound;
  template: Pick<BondifyGameTemplate, "id" | "slug" | "name" | "prompt" | "isHistoryEnabled">;
  responses: ParticipantSafeResponse[];
  twoTruthsSummary: TwoTruthsHistorySummary | null;
}

export interface TeamHistoryState {
  team: BondifyTeam;
  entries: ParticipantSafeHistoryEntry[];
  emojiCheckInTimeline: EmojiCheckInTimelineEntry[];
  canClearHistory: boolean;
}

export interface TeamHistoryClearResult {
  teamId: string;
  clearedCount: number;
  clearedAt: string;
}

export interface TeamHistoryEntryClearResult extends TeamHistoryClearResult {
  roundId: string;
}

export interface TeamManagementState {
  team: BondifyTeam;
  memberships: TeamRosterEntry[];
  pendingInvites: TeamInviteView[];
  incomingInvites: TeamInviteView[];
  canManageTeam: boolean;
}

export interface TeamMemberRemoveResult {
  teamId: string;
  membershipId: string;
  removedProfileId: string;
  removedEmail: string;
  removedAt: string;
}

export interface TeamDeleteResult {
  deletedTeamId: string;
  deletedTeamName: string;
  redirectTeamId: string | null;
}

export type BondifyGameTemplateProjection = Pick<
  BondifyGameTemplate,
  "id" | "slug" | "name" | "prompt" | "isHistoryEnabled"
>;

export interface ActiveGameRoundSummary {
  round: BondifyGameRound;
  submittedResponseCount: number;
  hasCurrentMemberSubmitted: boolean;
  currentMemberResponseId: string | null;
}

export interface TeamGameState {
  teamId: string;
  membership: BondifyTeamMembership;
  template: BondifyGameTemplateProjection;
  activeRound: ActiveGameRoundSummary | null;
  revealedRound: ParticipantSafeRoundReveal | null;
  twoTruthsRound: TwoTruthsRoundState | null;
}

export interface BondifyServiceResult<T> {
  data: T;
  error: null;
}

export interface BondifyServiceFailure {
  data: null;
  error: BondifyDomainError;
}

export type BondifyServiceResponse<T> = BondifyServiceResult<T> | BondifyServiceFailure;

export interface BondifyDomainError {
  code: BondifyDomainErrorCode;
  message: string;
  details?: Record<string, string | number | boolean | null>;
}
