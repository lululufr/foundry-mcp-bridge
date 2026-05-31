import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { FoundryClient } from '../foundry-client.js';
import { Logger } from '../logger.js';

export interface SceneToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
}

export class SceneTools {
  private foundryClient: FoundryClient;
  private logger: Logger;

  constructor({ foundryClient, logger }: SceneToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'SceneTools' });
  }

  /**
   * Tool definitions for scene operations
   */
  getToolDefinitions() {
    return [
      {
        name: 'get-current-scene',
        description:
          'Get information about the currently active scene, including tokens and layout',
        inputSchema: {
          type: 'object',
          properties: {
            includeTokens: {
              type: 'boolean',
              description: 'Whether to include detailed token information (default: true)',
              default: true,
            },
            includeHidden: {
              type: 'boolean',
              description: 'Whether to include hidden tokens and elements (default: false)',
              default: false,
            },
          },
        },
      },
      {
        name: 'get-world-info',
        description: 'Get basic information about the Foundry world and system',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'import-map-image',
        description:
          'Upload a local image file (e.g. a Watabou/Inkarnate map) to Foundry and create a new scene from it. The scene is created and activated automatically.',
        inputSchema: {
          type: 'object',
          properties: {
            imagePath: {
              type: 'string',
              description: 'Absolute path to the local image file (PNG/JPG/WebP) to import.',
            },
            sceneName: {
              type: 'string',
              description: 'Name of the scene to create in Foundry.',
            },
            gridEnabled: {
              type: 'boolean',
              description:
                'Whether to show a square tactical grid (true for battlemaps, false for town/world maps). Default: false.',
              default: false,
            },
            gridSize: {
              type: 'number',
              description: 'Grid square size in pixels (only used when gridEnabled). Default: 100.',
              default: 100,
            },
            wallsPath: {
              type: 'string',
              description:
                'Optional absolute path to a JSON file containing an array of wall segments to create on the scene (e.g. the .walls.json produced by the Watabou "maison"/Dwellings generator). Each entry: { c:[x1,y1,x2,y2], movement, sight, door, doorState, direction }. Coordinates are in image pixels.',
            },
            folderName: {
              type: 'string',
              description:
                'Optional Scene folder name to file the new scene under (created if missing, e.g. "ACT I"). Defaults to "AI Generated Maps".',
            },
          },
          required: ['imagePath', 'sceneName'],
        },
      },
      {
        name: 'create-scene-note',
        description:
          'Place map Notes (journal pins / "lieux-dits") on a scene to mark points of interest. Each note sits at image-pixel coordinates and can link to a lore JournalEntry (by Codex slug) so clicking the pin opens it. Use this for city/village overview maps instead of creature tokens. Defaults to the active scene.',
        inputSchema: {
          type: 'object',
          properties: {
            sceneName: {
              type: 'string',
              description:
                'Optional target scene name or ID. Defaults to the currently active scene.',
            },
            notes: {
              type: 'array',
              minItems: 1,
              description: 'The points of interest to pin on the map.',
              items: {
                type: 'object',
                properties: {
                  x: { type: 'number', description: 'X position in image pixels.' },
                  y: { type: 'number', description: 'Y position in image pixels.' },
                  label: {
                    type: 'string',
                    description:
                      'Pin label shown on the map. Defaults to the linked journal entry name.',
                  },
                  codexSlug: {
                    type: 'string',
                    description:
                      'Codex entity slug to link (e.g. "le-fanal-noye"). Clicking the pin opens that lore entry. Resolved against world JournalEntries synced by sync-codex.',
                  },
                  journalName: {
                    type: 'string',
                    description:
                      'Alternative to codexSlug: link by journal entry name (case-insensitive).',
                  },
                  entryId: {
                    type: 'string',
                    description: 'Alternative: link by explicit JournalEntry id.',
                  },
                  targetScene: {
                    type: 'string',
                    description:
                      'Optional scene name or ID to turn this pin into a "passage": double-clicking it navigates the GM to that scene. Can be combined with a label; takes precedence over journal linking for the click action.',
                  },
                  icon: {
                    type: 'string',
                    description:
                      'Optional Foundry icon path for the pin (default: icons/svg/book.svg).',
                  },
                  iconSize: {
                    type: 'number',
                    description: 'Pin icon size in pixels (min 32, default 40).',
                  },
                  fontSize: {
                    type: 'number',
                    description: 'Label font size in pixels (default 28).',
                  },
                },
                required: ['x', 'y'],
              },
            },
          },
          required: ['notes'],
        },
      },
      {
        name: 'delete-scene-note',
        description:
          'Delete map Notes (pins) from a scene, by id list or all of them. Lets pins be re-placed or resized without re-importing the whole scene. Defaults to the active scene.',
        inputSchema: {
          type: 'object',
          properties: {
            sceneName: {
              type: 'string',
              description:
                'Optional target scene name or ID. Defaults to the currently active scene.',
            },
            noteIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of the notes to delete (from create-scene-note or get-current-scene).',
            },
            all: {
              type: 'boolean',
              description: 'If true, delete every note on the scene (ignores noteIds).',
            },
          },
        },
      },
    ];
  }

  async handleDeleteSceneNote(args: any): Promise<any> {
    const schema = z.object({
      sceneName: z.string().optional(),
      noteIds: z.array(z.string()).optional(),
      all: z.boolean().optional(),
    });
    const { sceneName, noteIds, all } = schema.parse(args);

    this.logger.info('Deleting scene notes', { sceneName, count: noteIds?.length, all });

    try {
      const result = await this.foundryClient.query('jdr-mcp-bridge.delete-scene-notes', {
        sceneIdentifier: sceneName,
        noteIds,
        all,
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      this.logger.error('Failed to delete scene notes', error);
      throw new Error(
        `Failed to delete scene notes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async handleCreateSceneNote(args: any): Promise<any> {
    const noteSchema = z.object({
      x: z.number(),
      y: z.number(),
      label: z.string().optional(),
      codexSlug: z.string().optional(),
      journalName: z.string().optional(),
      entryId: z.string().optional(),
      targetScene: z.string().optional(),
      icon: z.string().optional(),
      iconSize: z.number().optional(),
      fontSize: z.number().optional(),
    });
    const schema = z.object({
      sceneName: z.string().optional(),
      notes: z.array(noteSchema).min(1),
    });
    const { sceneName, notes } = schema.parse(args);

    this.logger.info('Creating scene notes', { sceneName, count: notes.length });

    try {
      const result = await this.foundryClient.query('jdr-mcp-bridge.create-scene-notes', {
        sceneIdentifier: sceneName,
        notes,
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      this.logger.error('Failed to create scene notes', error);
      throw new Error(
        `Failed to create scene notes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async handleGetCurrentScene(args: any): Promise<any> {
    const schema = z.object({
      includeTokens: z.boolean().default(true),
      includeHidden: z.boolean().default(false),
    });

    const { includeTokens, includeHidden } = schema.parse(args);

    this.logger.info('Getting current scene information', { includeTokens, includeHidden });

    try {
      const sceneData = await this.foundryClient.query('jdr-mcp-bridge.getActiveScene');

      this.logger.debug('Successfully retrieved scene data', {
        sceneId: sceneData.id,
        sceneName: sceneData.name,
        tokenCount: sceneData.tokens?.length || 0,
      });

      return this.formatSceneResponse(sceneData, includeTokens, includeHidden);
    } catch (error) {
      this.logger.error('Failed to get current scene', error);
      throw new Error(
        `Failed to get current scene: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async handleGetWorldInfo(_args: any): Promise<any> {
    this.logger.info('Getting world information');

    try {
      const worldData = await this.foundryClient.query('jdr-mcp-bridge.getWorldInfo');

      this.logger.debug('Successfully retrieved world data', {
        worldId: worldData.id,
        system: worldData.system,
      });

      return this.formatWorldResponse(worldData);
    } catch (error) {
      this.logger.error('Failed to get world information', error);
      throw new Error(
        `Failed to get world information: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async handleImportMapImage(args: any): Promise<any> {
    const schema = z.object({
      imagePath: z.string(),
      sceneName: z.string(),
      gridEnabled: z.boolean().default(false),
      gridSize: z.number().default(100),
      wallsPath: z.string().optional(),
      folderName: z.string().optional(),
    });
    const { imagePath, sceneName, gridEnabled, gridSize, wallsPath, folderName } =
      schema.parse(args);

    this.logger.info('Importing map image as scene', { imagePath, sceneName, gridEnabled });

    // Optional walls (e.g. Watabou "maison"/Dwellings .walls.json) — the Foundry module
    // turns sceneData.walls into Wall documents at scene creation (createSceneWalls).
    let walls: any[] = [];
    if (wallsPath) {
      try {
        const raw = await readFile(wallsPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) walls = parsed;
        else throw new Error('walls JSON must be an array');
        this.logger.info('Loaded walls for scene', { wallsPath, count: walls.length });
      } catch (error) {
        throw new Error(
          `Cannot read walls file "${wallsPath}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    let imageBuffer: Buffer;
    try {
      imageBuffer = await readFile(imagePath);
    } catch (error) {
      throw new Error(
        `Cannot read image file "${imagePath}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    const base64Image = imageBuffer.toString('base64');
    const { width, height } = this.readImageDimensions(imageBuffer);

    const filename = basename(imagePath);
    const uploadResult = await this.foundryClient.query('jdr-mcp-bridge.upload-generated-map', {
      filename,
      imageData: base64Image,
    });
    if (!uploadResult?.success) {
      throw new Error(`Failed to upload image to Foundry: ${uploadResult?.error || 'unknown error'}`);
    }
    const webPath = uploadResult.path;
    this.logger.info('Image uploaded to Foundry', { webPath, width, height });

    const sceneData = {
      name: sceneName.trim(),
      // Foundry v14 : la scène n'a plus de `background` au niveau racine ; l'image de fond
      // vit sur un Level (scene.levels[0].background.src). On crée donc un niveau de base.
      // On garde `background` racine en fallback v13 (ignoré/strippé en v14, inoffensif).
      background: { src: webPath },
      levels: [{ name: 'Surface', background: { src: webPath } }],
      width,
      height,
      padding: 0,
      initial: { x: Math.round(width / 2), y: Math.round(height / 2), scale: 0.4 },
      backgroundColor: '#000000',
      grid: {
        type: gridEnabled ? 1 : 0, // 1 = SQUARE, 0 = GRIDLESS
        size: gridSize,
        color: '#000000',
        alpha: 0.2,
        distance: 5,
        units: 'ft',
      },
      tokenVision: gridEnabled,
      fogExploration: gridEnabled,
      fogReset: Date.now(),
      globalLight: !gridEnabled,
      darkness: 0,
      navigation: true,
      active: false,
      walls,
      // Custom field consumed by the module (socket-bridge) to file the scene under a Scene
      // folder; stripped before Scene.create. Defaults module-side to "AI Generated Maps".
      folderName: folderName?.trim() || undefined,
    };

    this.foundryClient.broadcastMessage({
      type: 'job-completed',
      jobId: `import-${Date.now()}`,
      data: {
        status: 'completed',
        result: sceneData,
        image_path: webPath,
        prompt: sceneName,
      },
    });

    return {
      success: true,
      message: `Scene "${sceneName}" requested in Foundry from ${filename} (${width}x${height}px)${walls.length ? ` with ${walls.length} walls` : ''}. It is created and activated by the Foundry module.`,
      uploadedPath: webPath,
      dimensions: { width, height },
      gridEnabled,
      wallsCreated: walls.length,
    };
  }

  /** Lit largeur/hauteur depuis l'en-tête PNG ou JPEG ; sinon valeurs carrées par défaut. */
  private readImageDimensions(buf: Buffer): { width: number; height: number } {
    if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1];
        const len = buf.readUInt16BE(off + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
        }
        off += 2 + len;
      }
    }
    this.logger.warn('Could not parse image dimensions; defaulting to 2048x2048');
    return { width: 2048, height: 2048 };
  }

  private formatSceneResponse(sceneData: any, includeTokens: boolean, includeHidden: boolean): any {
    const response: any = {
      id: sceneData.id,
      name: sceneData.name,
      active: sceneData.active,
      dimensions: {
        width: sceneData.width,
        height: sceneData.height,
        padding: sceneData.padding,
      },
      hasBackground: !!sceneData.background,
      navigation: sceneData.navigation,
      elements: {
        walls: sceneData.walls || 0,
        lights: sceneData.lights || 0,
        sounds: sceneData.sounds || 0,
        notes: sceneData.notes?.length || 0,
      },
    };

    if (includeTokens && sceneData.tokens) {
      response.tokens = this.formatTokens(sceneData.tokens, includeHidden);
      response.tokenSummary = this.createTokenSummary(sceneData.tokens, includeHidden);
    }

    if (sceneData.notes && sceneData.notes.length > 0) {
      response.notes = sceneData.notes.map((note: any) => ({
        id: note.id,
        text: this.truncateText(note.text, 100),
        position: { x: note.x, y: note.y },
      }));
    }

    return response;
  }

  private formatTokens(tokens: any[], includeHidden: boolean): any[] {
    return tokens
      .filter(token => includeHidden || !token.hidden)
      .map(token => ({
        id: token.id,
        name: token.name,
        position: {
          x: token.x,
          y: token.y,
        },
        size: {
          width: token.width,
          height: token.height,
        },
        actorId: token.actorId,
        disposition: this.getDispositionName(token.disposition),
        hidden: token.hidden,
        hasImage: !!token.img,
      }));
  }

  private createTokenSummary(tokens: any[], includeHidden: boolean): any {
    const visibleTokens = includeHidden ? tokens : tokens.filter(t => !t.hidden);

    const summary = {
      total: visibleTokens.length,
      byDisposition: {
        friendly: 0,
        neutral: 0,
        hostile: 0,
        unknown: 0,
      },
      hasActors: 0,
      withoutActors: 0,
    };

    visibleTokens.forEach(token => {
      // Count by disposition
      const disposition = this.getDispositionName(token.disposition);
      if (disposition in summary.byDisposition) {
        summary.byDisposition[disposition as keyof typeof summary.byDisposition]++;
      } else {
        summary.byDisposition.unknown++;
      }

      // Count actor association
      if (token.actorId) {
        summary.hasActors++;
      } else {
        summary.withoutActors++;
      }
    });

    return summary;
  }

  private formatWorldResponse(worldData: any): any {
    return {
      id: worldData.id,
      title: worldData.title,
      system: {
        id: worldData.system,
        version: worldData.systemVersion,
      },
      foundry: {
        version: worldData.foundryVersion,
      },
      users: {
        total: worldData.users?.length || 0,
        active: worldData.users?.filter((u: any) => u.active).length || 0,
        gms: worldData.users?.filter((u: any) => u.isGM).length || 0,
        players: worldData.users?.filter((u: any) => !u.isGM).length || 0,
      },
      activeUsers:
        worldData.users
          ?.filter((u: any) => u.active)
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            isGM: u.isGM,
          })) || [],
    };
  }

  private getDispositionName(disposition: number): string {
    switch (disposition) {
      case -1:
        return 'hostile';
      case 0:
        return 'neutral';
      case 1:
        return 'friendly';
      default:
        return 'unknown';
    }
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}
