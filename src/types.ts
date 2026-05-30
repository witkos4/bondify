export type TeamInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export type GameRoundStatus = "open" | "revealed" | "closed";

export type BondifyDomainErrorCode =
  | "SUPABASE_NOT_CONFIGURED"
  | "UNAUTHENTICATED"
  | "PROFILE_NOT_FOUND"
  | "TEAM_NOT_FOUND"
  | "TEAM_ACCESS_DENIED"
  | "INVALID_TEAM_NAME"
  | "INVALID_INVITE_EMAIL"
  | "DUPLICATE_INVITE"
  | "DUPLICATE_MEMBERSHIP"
  | "INVITE_NOT_FOUND"
  | "INVITE_NOT_PENDING"
  | "INVITE_EMAIL_MISMATCH"
  | "INVALID_GAME_TEMPLATE"
  | "ROUND_NOT_FOUND"
  | "ROUND_NOT_OPEN"
  | "DUPLICATE_RESPONSE"
  | "HISTORY_NOT_VISIBLE";

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

export interface BondifyGameResponseRecord {
  id: string;
  roundId: string;
  membershipId: string;
  profileId: string;
  responseText: string;
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

export interface ParticipantSafeHistoryEntry {
  round: BondifyGameRound;
  template: Pick<BondifyGameTemplate, "id" | "slug" | "name" | "prompt" | "isHistoryEnabled">;
  responses: ParticipantSafeResponse[];
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
