import { adminClient } from "./clients";
import { withRetry } from "./resilient";

export interface CleanupRegistry {
  cleanup: () => Promise<void>;
  registerTeam: (teamId: string) => void;
  registerUser: (userId: string) => void;
}

export function createCleanupRegistry(): CleanupRegistry {
  const teamIds = new Set<string>();
  const userIds = new Set<string>();

  return {
    registerTeam(teamId) {
      teamIds.add(teamId);
    },

    registerUser(userId) {
      userIds.add(userId);
    },

    async cleanup() {
      const admin = adminClient();

      for (const teamId of [...teamIds].reverse()) {
        const { error } = await withRetry(`cleanup team ${teamId}`, () =>
          admin.from("teams").delete().eq("id", teamId),
        );

        if (error) {
          console.warn(`Cleanup warning while deleting team ${teamId}: ${error.message}`);
        }
      }

      for (const userId of [...userIds].reverse()) {
        const { error } = await admin.auth.admin.deleteUser(userId);

        if (error) {
          console.warn(`Cleanup warning while deleting user ${userId}: ${error.message}`);
        }
      }
    },
  };
}
