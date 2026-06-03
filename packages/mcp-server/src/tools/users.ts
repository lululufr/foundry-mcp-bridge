import { z } from 'zod';
import { FoundryClient } from '../foundry-client.js';
import { Logger } from '../logger.js';

export interface UserToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
}

// Foundry user roles
const UserRoleValues = {
  NONE: 0,
  PLAYER: 1,
  TRUSTED: 2,
  ASSISTANT: 3,
  GAMEMASTER: 4,
} as const;

// French aliases accepted for roles (the world is played in French).
const RoleAliases: Record<string, keyof typeof UserRoleValues> = {
  joueur: 'PLAYER',
  player: 'PLAYER',
  confiance: 'TRUSTED',
  'de confiance': 'TRUSTED',
  trusted: 'TRUSTED',
  assistant: 'ASSISTANT',
  'assistant-mj': 'ASSISTANT',
  mj: 'GAMEMASTER',
  gm: 'GAMEMASTER',
  gamemaster: 'GAMEMASTER',
};

// Document ownership levels
const OwnershipLevels = {
  NONE: 0,
  LIMITED: 1,
  OBSERVER: 2,
  OWNER: 3,
} as const;

const ownershipLevelSchema = z.enum(['NONE', 'LIMITED', 'OBSERVER', 'OWNER']);
const documentTypeSchema = z.enum([
  'JournalEntry',
  'Scene',
  'Item',
  'RollTable',
  'Macro',
  'Actor',
]);

export class UserTools {
  private foundryClient: FoundryClient;
  private logger: Logger;

  constructor({ foundryClient, logger }: UserToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'UserTools' });
  }

  getToolDefinitions() {
    return [
      {
        name: 'list-users',
        description:
          'List all Foundry users with their role (Joueur/De confiance/Assistant-MJ/MJ), connection status, assigned default character, and the actors they own. Read-only audit of who can do what.',
        inputSchema: {
          type: 'object',
          properties: {
            includeOwnedActors: {
              type: 'boolean',
              description: 'Include the list of actors each player explicitly owns. Default true.',
              default: true,
            },
          },
        },
      },
      {
        name: 'set-user-role',
        description:
          'Change a user account role. Roles: PLAYER (Joueur), TRUSTED (De confiance), ASSISTANT (Assistant-MJ), GAMEMASTER (MJ). French aliases accepted. Promoting to GAMEMASTER requires confirm=true. Cannot change your own role or demote the last GM.',
        inputSchema: {
          type: 'object',
          properties: {
            userIdentifier: {
              type: 'string',
              description: 'User name or ID (partial name matching supported).',
            },
            role: {
              type: 'string',
              description:
                'New role: PLAYER, TRUSTED, ASSISTANT or GAMEMASTER (FR: Joueur, De confiance, Assistant, MJ).',
            },
            confirm: {
              type: 'boolean',
              description: 'Required (true) when promoting a user to GAMEMASTER.',
              default: false,
            },
          },
          required: ['userIdentifier', 'role'],
        },
      },
      {
        name: 'assign-default-character',
        description:
          "Set (or clear) a user's default character — the actor they control on login. By default also grants the user OWNER permission on that actor. Useful so players auto-control their PC (and can pick up loot onto it).",
        inputSchema: {
          type: 'object',
          properties: {
            userIdentifier: {
              type: 'string',
              description: 'User name or ID (partial matching supported).',
            },
            actorIdentifier: {
              type: 'string',
              description: 'Actor name or ID to assign as the default character. Omit when clearing.',
            },
            clear: {
              type: 'boolean',
              description: 'Set true to remove the default character instead of assigning one.',
              default: false,
            },
            grantOwnership: {
              type: 'boolean',
              description: 'Also grant the user OWNER of the actor. Default true.',
              default: true,
            },
          },
          required: ['userIdentifier'],
        },
      },
      {
        name: 'set-document-ownership',
        description:
          'Set ownership/permission on a world document (journal, scene, item, rollable table, macro, or actor) for a player, the whole party, or everyone (default). Permission levels: NONE, LIMITED, OBSERVER, OWNER. Bulk targets (party/all/default) require confirmBulkOperation=true.',
        inputSchema: {
          type: 'object',
          properties: {
            documentType: {
              type: 'string',
              enum: ['JournalEntry', 'Scene', 'Item', 'RollTable', 'Macro', 'Actor'],
              description: 'Type of document to modify.',
            },
            documentIdentifier: {
              type: 'string',
              description: 'Document name or ID (partial name matching supported).',
            },
            target: {
              type: 'string',
              description:
                'Who to set the permission for: a user name/ID, "party" (all players), "default" (everyone, base level), or "all" (default + every player).',
            },
            permissionLevel: {
              type: 'string',
              enum: ['NONE', 'LIMITED', 'OBSERVER', 'OWNER'],
              description:
                'Permission to grant: NONE (no access), LIMITED (basic view), OBSERVER (full view), OWNER (full control).',
            },
            confirmBulkOperation: {
              type: 'boolean',
              description: 'Required (true) when target is "party", "all" or "default".',
              default: false,
            },
          },
          required: ['documentType', 'documentIdentifier', 'target', 'permissionLevel'],
        },
      },
    ];
  }

  async handleToolCall(name: string, args: any) {
    try {
      switch (name) {
        case 'list-users':
          return await this.listUsers(args);
        case 'set-user-role':
          return await this.setUserRole(args);
        case 'assign-default-character':
          return await this.assignDefaultCharacter(args);
        case 'set-document-ownership':
          return await this.setDocumentOwnership(args);
        default:
          throw new Error(`Unknown user tool: ${name}`);
      }
    } catch (error) {
      this.logger.error(`Error in user tool ${name}:`, error);
      throw error;
    }
  }

  private async listUsers(args: any) {
    const includeOwnedActors = args?.includeOwnedActors !== false;
    this.logger.info('Listing users', { includeOwnedActors });
    const users = await this.foundryClient.query('jdr-mcp-bridge.listUsers', {
      includeOwnedActors,
    });
    return { success: true, users };
  }

  private async setUserRole(args: any) {
    const { userIdentifier, role, confirm = false } = args;

    // Normalize role: accept canonical English or French aliases.
    const raw = String(role || '').trim();
    const canonical =
      (UserRoleValues as Record<string, number>)[raw.toUpperCase()] !== undefined
        ? (raw.toUpperCase() as keyof typeof UserRoleValues)
        : RoleAliases[raw.toLowerCase()];
    if (!canonical) {
      return {
        success: false,
        error: `Rôle invalide : "${role}". Utilisez PLAYER, TRUSTED, ASSISTANT ou GAMEMASTER (FR: Joueur, De confiance, Assistant, MJ).`,
      };
    }
    const numericRole = UserRoleValues[canonical];

    this.logger.info(`Setting role of "${userIdentifier}" to ${canonical} (${numericRole})`);
    return await this.foundryClient.query('jdr-mcp-bridge.setUserRole', {
      userIdentifier,
      role: numericRole,
      confirm,
    });
  }

  private async assignDefaultCharacter(args: any) {
    const { userIdentifier, actorIdentifier, clear = false, grantOwnership = true } = args;
    if (!clear && !actorIdentifier) {
      return { success: false, error: 'actorIdentifier requis (ou clear=true).' };
    }
    this.logger.info(`Assigning default character`, { userIdentifier, actorIdentifier, clear });
    return await this.foundryClient.query('jdr-mcp-bridge.assignDefaultCharacter', {
      userIdentifier,
      actorIdentifier,
      clear,
      grantOwnership,
    });
  }

  private async setDocumentOwnership(args: any) {
    const { documentType, documentIdentifier, target, permissionLevel, confirmBulkOperation = false } =
      args;

    const validatedType = documentTypeSchema.parse(documentType);
    const validatedLevel = ownershipLevelSchema.parse(permissionLevel);
    const numericLevel = OwnershipLevels[validatedLevel];

    this.logger.info(
      `Setting ${validatedType} "${documentIdentifier}" ownership ${validatedLevel} for "${target}"`
    );
    return await this.foundryClient.query('jdr-mcp-bridge.setDocumentOwnership', {
      documentType: validatedType,
      documentIdentifier,
      target,
      permission: numericLevel,
      confirmBulkOperation,
    });
  }
}
