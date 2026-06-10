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
        name: 'import-scene-levels',
        description:
          'Create ONE multi-level scene (Foundry v14 native Scene Levels) from a stack of floor images: each floor becomes a Level (image + elevation band + name) on a single scene, with its walls bound to that level. Use for the Watabou "maison" multi-étages pipeline — feed it meta.floors[] (per-floor PNG + .walls.json from gen.mjs). Floors must share dimensions/grid (the generator stacks them pixel-aligned).',
        inputSchema: {
          type: 'object',
          properties: {
            sceneName: {
              type: 'string',
              description: 'Name of the single multi-level scene to create (e.g. "ACT I — Auberge").',
            },
            floors: {
              type: 'array',
              minItems: 1,
              description:
                'Floors bottom-to-top (e.g. sous-sol, RdC, étages). Each becomes a Level stacked by elevation.',
              items: {
                type: 'object',
                properties: {
                  imagePath: {
                    type: 'string',
                    description: 'Absolute path to this floor\'s PNG (meta.floors[].png).',
                  },
                  wallsPath: {
                    type: 'string',
                    description: 'Optional absolute path to this floor\'s .walls.json (meta.floors[].walls).',
                  },
                  name: {
                    type: 'string',
                    description: 'Level name shown in the Levels UI (e.g. "RdC", "Étage 1", "Sous-sol").',
                  },
                  elevationBottom: {
                    type: 'number',
                    description: 'Bottom of this level\'s elevation band, in scene units/ft (meta.floors[].elevation.bottom).',
                  },
                  elevationTop: {
                    type: 'number',
                    description: 'Top of this level\'s elevation band, in scene units/ft (meta.floors[].elevation.top).',
                  },
                  footprint: {
                    type: 'array',
                    description: 'Phase B (optional): walkable surface rectangles (image px) for this floor — from meta.floors[].footprint. Creates a defineSurface region so tokens stand on the floor.',
                    items: {
                      type: 'object',
                      properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        w: { type: 'number' },
                        h: { type: 'number' },
                      },
                      required: ['x', 'y', 'w', 'h'],
                    },
                  },
                },
                required: ['imagePath', 'name', 'elevationBottom', 'elevationTop'],
              },
            },
            stairs: {
              type: 'array',
              description: 'Phase B (optional): stairs linking floors. Each creates a changeLevel region so a token walking onto it goes up/down a level. Dedupe cross-floor pairs before passing.',
              items: {
                type: 'object',
                properties: {
                  x: { type: 'number', description: 'Stair center X in image px (meta.floors[].stairs[].x).' },
                  y: { type: 'number', description: 'Stair center Y in image px.' },
                  fromFloorIndex: { type: 'number', description: 'Index into floors[] of one connected floor.' },
                  toFloorIndex: { type: 'number', description: 'Index into floors[] of the other connected floor.' },
                },
                required: ['x', 'y', 'fromFloorIndex', 'toFloorIndex'],
              },
            },
            gridSize: {
              type: 'number',
              description: 'Grid square size in pixels (meta.gridSize). Default: 100.',
              default: 100,
            },
            gridEnabled: {
              type: 'boolean',
              description: 'Show a square tactical grid (true for battlemaps). Default: true.',
              default: true,
            },
            folderName: {
              type: 'string',
              description: 'Optional Scene folder name (created if missing, e.g. "ACT I"). Defaults to "AI Generated Maps".',
            },
          },
          required: ['sceneName', 'floors'],
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
      {
        name: 'place-scene-props',
        description:
          'Place pickable/decorative prop images (e.g. Pixelrepo sprites) as Tiles on a tactical scene (dungeon/cave/house — NOT town/village overviews). Each prop uploads a local image and creates a Tile at image-pixel coordinates, optionally recording a linked dnd5e item (by compendium uuid + name) as a flag so the GM can grant it on pickup. Defaults to the active scene. Used by the objets-de-scene skill.',
        inputSchema: {
          type: 'object',
          properties: {
            sceneName: {
              type: 'string',
              description:
                'Optional target scene name or ID. Defaults to the currently active scene.',
            },
            props: {
              type: 'array',
              minItems: 1,
              description: 'The props to place on the scene.',
              items: {
                type: 'object',
                properties: {
                  imagePath: {
                    type: 'string',
                    description: 'Absolute path to the local prop image (PNG/JPG, transparency recommended).',
                  },
                  x: { type: 'number', description: 'X position in image pixels (top-left of the tile).' },
                  y: { type: 'number', description: 'Y position in image pixels (top-left of the tile).' },
                  width: {
                    type: 'number',
                    description: 'Tile width in pixels. Defaults to 100 (≈ one grid square at 100px grids).',
                  },
                  height: {
                    type: 'number',
                    description: 'Tile height in pixels. Defaults to 100.',
                  },
                  rotation: { type: 'number', description: 'Optional rotation in degrees (default 0).' },
                  label: {
                    type: 'string',
                    description: 'Human-readable label for this prop (e.g. "Torche"). Recorded as a flag.',
                  },
                  lootItemUuid: {
                    type: 'string',
                    description:
                      'Optional dnd5e compendium item uuid to link (from search-compendium). When a player clicks the prop, this item is added to their character and the tile is removed.',
                  },
                  lootItemName: {
                    type: 'string',
                    description: 'Optional linked item display name (e.g. "Torch").',
                  },
                  openImagePath: {
                    type: 'string',
                    description:
                      'Chest only: absolute path to the "opened chest" image. When set with contents, opening the chest swaps the tile to this sprite instead of deleting it.',
                  },
                  contents: {
                    type: 'array',
                    description:
                      'Chest only: list of dnd5e items the chest holds. On open, all are granted to the player at once. Use instead of lootItemUuid for a multi-item container.',
                    items: {
                      type: 'object',
                      properties: {
                        uuid: {
                          type: 'string',
                          description: 'dnd5e compendium item uuid (from search-compendium).',
                        },
                        name: { type: 'string', description: 'Optional item display name.' },
                        quantity: {
                          type: 'number',
                          description: 'Optional quantity (default 1).',
                        },
                      },
                      required: ['uuid'],
                    },
                  },
                },
                required: ['imagePath', 'x', 'y'],
              },
            },
          },
          required: ['props'],
        },
      },
      {
        name: 'set-scene-ambiance',
        description:
          "Set a scene's dynamic lighting and ambient FX to match the lore (skill mise-en-scene, étape 3ter). Adjusts the global darkness level (0=full day, 1=pitch black), global illumination on/off, and a core weather/particle effect, and optionally (re)creates AmbientLight sources (torches, hearths, windows) at image-pixel coordinates. Only apply effects that fit the place and time of day. Defaults to the active scene.",
        inputSchema: {
          type: 'object',
          properties: {
            sceneName: {
              type: 'string',
              description:
                'Optional target scene name or ID. Defaults to the currently active scene.',
            },
            darkness: {
              type: 'number',
              description:
                'Global darkness level 0..1. ~0 clear day; ~0.3-0.5 dusk/undergrowth; ~0.7-1.0 night / windowless interior / dungeon / cave / crypt.',
            },
            globalLight: {
              type: 'boolean',
              description:
                'Global illumination. true for daylit overviews (town/village by day) and sunny exteriors; false for dark tactical maps so only the light sources (and token vision) matter.',
            },
            weather: {
              type: 'string',
              description:
                "Core Foundry weather/particle effect id, or '' to clear. Common: rain, snow, fog, leaves, blizzard, rainStorm. Use ONLY when it fits (never rain in a dry crypt). Omit to leave unchanged.",
            },
            lights: {
              type: 'array',
              description:
                'AmbientLight sources to add (torches, hearths, candles, windows). Align them with the scene props and geometry already placed.',
              items: {
                type: 'object',
                properties: {
                  x: { type: 'number', description: 'X position in image/scene pixels (light center).' },
                  y: { type: 'number', description: 'Y position in image/scene pixels (light center).' },
                  dim: {
                    type: 'number',
                    description: 'Dim (faint) light radius in scene distance units (feet). Torch ≈ 40, candle ≈ 10.',
                  },
                  bright: {
                    type: 'number',
                    description: 'Bright light radius in scene distance units (feet). Torch ≈ 20, candle ≈ 5.',
                  },
                  color: {
                    type: 'string',
                    description: 'Hex tint. Warm fire ≈ #ffaa55, candle ≈ #ffcc88, cold window/moon ≈ #aaccff. Default #ffaa55.',
                  },
                  alpha: { type: 'number', description: 'Light intensity 0..1 (default 0.5).' },
                  angle: { type: 'number', description: 'Beam angle in degrees (default 360 = full circle).' },
                  rotation: { type: 'number', description: 'Beam rotation in degrees (default 0).' },
                  animationType: {
                    type: 'string',
                    description: "Foundry light animation: 'torch', 'flame', 'pulse', 'sunburst', 'fog', 'ghost', etc. Omit for a steady light.",
                  },
                  animationSpeed: { type: 'number', description: 'Animation speed 1..10 (default 3).' },
                  animationIntensity: { type: 'number', description: 'Animation intensity 1..10 (default 5).' },
                  level: {
                    type: 'string',
                    description: 'v14 Scene Levels: bind this light to one floor (Level name or id, e.g. "RdC"). Required on multi-level maison scenes so the light only illuminates that floor (an unbound light shines on every stacked level). Omit on single-level scenes.',
                  },
                  elevation: {
                    type: 'number',
                    description: 'Light elevation in scene units/ft (set to mid-floor, e.g. the floor band bottom + 5, when using `level`).',
                  },
                },
                required: ['x', 'y'],
              },
            },
            replaceLights: {
              type: 'boolean',
              description:
                'If true, delete the ambiance lights previously created by this tool before adding the new ones (hand-placed lights are left untouched). Use to re-apply lighting without duplicates.',
            },
          },
        },
      },
      {
        name: 'set-actor-image',
        description:
          "Set an actor's portrait (sheet image) and/or its prototype token artwork from local image files, and optionally apply player-character prototype defaults (linked token, vision enabled, friendly disposition, HP bar, name/bars on hover). Each provided image is uploaded to Foundry first (worlds/<id>/tokens), then assigned. Use to give real artwork to player characters (skill tokens-pj). Targets one actor by name or id.",
        inputSchema: {
          type: 'object',
          properties: {
            actorIdentifier: {
              type: 'string',
              description: 'Actor name or id to update.',
            },
            tokenImagePath: {
              type: 'string',
              description:
                'Absolute path to a local image (PNG/JPG) for the prototype token artwork (top-down token).',
            },
            portraitImagePath: {
              type: 'string',
              description:
                'Absolute path to a local image (PNG/JPG) for the actor portrait (sheet image). May be the same file as the token.',
            },
            applyPjDefaults: {
              type: 'boolean',
              description:
                'Apply player-character prototype-token defaults: actorLink=true, vision enabled, disposition friendly, HP bar, name/bars on hover. Default true. Set false for non-PJ actors.',
            },
            dynamicRing: {
              type: 'boolean',
              description:
                'Enable the v14 dynamic token ring (a clean colored frame + integrated resource bar) without altering the artwork. Default false.',
            },
            disposition: {
              type: 'number',
              enum: [-1, 0, 1],
              description: 'Override token disposition: -1 hostile, 0 neutral, 1 friendly.',
            },
          },
          required: ['actorIdentifier'],
        },
      },
      {
        name: 'set-scene-background',
        description:
          'Set or REPAIR the background image of an EXISTING scene (by name or id) from a local image file, WITHOUT recreating the scene — preserves notes, tokens, walls, lighting, links and id. Uploads the image, then sets the scene-root background and, for v14 Scene Levels scenes, the target level background so the map renders again. Use to fix scenes whose image upload failed at import (empty/broken background).',
        inputSchema: {
          type: 'object',
          properties: {
            sceneName: {
              type: 'string',
              description: 'Target scene name or id (id is more reliable for accented names).',
            },
            imagePath: {
              type: 'string',
              description: 'Absolute path to the local image file (PNG/JPG/WebP) to use as background.',
            },
            levelIndex: {
              type: 'number',
              description:
                'For v14 multi-level scenes, which level (0-based, default 0 = base/ground floor) to set the background on.',
            },
          },
          required: ['sceneName', 'imagePath'],
        },
      },
    ];
  }

  async handleSetSceneAmbiance(args: any): Promise<any> {
    const lightSchema = z.object({
      x: z.number(),
      y: z.number(),
      dim: z.number().optional(),
      bright: z.number().optional(),
      color: z.string().optional(),
      alpha: z.number().optional(),
      angle: z.number().optional(),
      rotation: z.number().optional(),
      animationType: z.string().optional(),
      animationSpeed: z.number().optional(),
      animationIntensity: z.number().optional(),
      level: z.string().optional(),
      elevation: z.number().optional(),
    });
    const schema = z.object({
      sceneName: z.string().optional(),
      darkness: z.number().min(0).max(1).optional(),
      globalLight: z.boolean().optional(),
      weather: z.string().optional(),
      lights: z.array(lightSchema).optional(),
      replaceLights: z.boolean().optional(),
    });
    const { sceneName, darkness, globalLight, weather, lights, replaceLights } = schema.parse(args);

    this.logger.info('Setting scene ambiance', {
      sceneName,
      darkness,
      globalLight,
      weather,
      lightCount: lights?.length,
    });

    try {
      const result = await this.foundryClient.query('jdr-mcp-bridge.set-scene-ambiance', {
        sceneIdentifier: sceneName,
        darkness,
        globalLight,
        weather,
        lights,
        replaceLights,
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      this.logger.error('Failed to set scene ambiance', error);
      throw new Error(
        `Failed to set scene ambiance: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async handleSetSceneBackground(args: any): Promise<any> {
    const schema = z.object({
      sceneName: z.string(),
      imagePath: z.string(),
      levelIndex: z.number().int().min(0).optional(),
    });
    const { sceneName, imagePath, levelIndex } = schema.parse(args);

    this.logger.info('Setting scene background', { sceneName, imagePath, levelIndex });

    let imageBuffer: Buffer;
    try {
      imageBuffer = await readFile(imagePath);
    } catch (error) {
      throw new Error(
        `Cannot read image file "${imagePath}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    const filename = basename(imagePath);
    const uploadResult = await this.foundryClient.query('jdr-mcp-bridge.upload-generated-map', {
      filename,
      imageData: imageBuffer.toString('base64'),
    });
    if (!uploadResult?.success) {
      throw new Error(
        `Failed to upload background image "${filename}": ${uploadResult?.error || 'unknown error'}`
      );
    }

    try {
      const result = await this.foundryClient.query('jdr-mcp-bridge.set-scene-background', {
        sceneIdentifier: sceneName,
        src: uploadResult.path,
        levelIndex,
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      this.logger.error('Failed to set scene background', error);
      throw new Error(
        `Failed to set scene background: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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

  /**
   * Create ONE multi-LEVEL scene from a stack of floor images (Foundry v14 native Scene Levels).
   * Each floor becomes a Level (image + elevation band + name) on a single scene, with its walls
   * bound to that level. Powers the Watabou "maison" multi-étages pipeline: feed it the per-floor
   * PNG + .walls.json from gen.mjs (meta.floors[]). Floors must share the same dimensions/grid
   * (they do — the generator stacks them pixel-aligned).
   */
  async handleImportSceneLevels(args: any): Promise<any> {
    const floorSchema = z.object({
      imagePath: z.string(),
      wallsPath: z.string().optional(),
      name: z.string(),
      elevationBottom: z.number(),
      elevationTop: z.number(),
      footprint: z
        .array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }))
        .optional(),
    });
    const stairSchema = z.object({
      x: z.number(),
      y: z.number(),
      fromFloorIndex: z.number(),
      toFloorIndex: z.number(),
    });
    const schema = z.object({
      sceneName: z.string(),
      floors: z.array(floorSchema).min(1),
      stairs: z.array(stairSchema).optional(),
      gridSize: z.number().default(100),
      gridEnabled: z.boolean().default(true),
      folderName: z.string().optional(),
    });
    const { sceneName, floors, stairs, gridSize, gridEnabled, folderName } = schema.parse(args);

    this.logger.info('Importing multi-level scene', { sceneName, floors: floors.length });

    let width = 0;
    let height = 0;
    const levels: any[] = [];
    for (const f of floors) {
      // Walls for this floor (logical .walls.json from the maison generator).
      let walls: any[] = [];
      if (f.wallsPath) {
        try {
          const parsed = JSON.parse(await readFile(f.wallsPath, 'utf8'));
          if (Array.isArray(parsed)) walls = parsed;
          else throw new Error('walls JSON must be an array');
        } catch (error) {
          throw new Error(
            `Cannot read walls file "${f.wallsPath}": ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      let imageBuffer: Buffer;
      try {
        imageBuffer = await readFile(f.imagePath);
      } catch (error) {
        throw new Error(
          `Cannot read image file "${f.imagePath}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      const dims = this.readImageDimensions(imageBuffer);
      if (!width) {
        width = dims.width;
        height = dims.height;
      }

      const filename = basename(f.imagePath);
      const uploadResult = await this.foundryClient.query('jdr-mcp-bridge.upload-generated-map', {
        filename,
        imageData: imageBuffer.toString('base64'),
      });
      if (!uploadResult?.success) {
        throw new Error(
          `Failed to upload floor image "${filename}": ${uploadResult?.error || 'unknown error'}`
        );
      }
      this.logger.info('Floor image uploaded', { filename, path: uploadResult.path });
      levels.push({
        name: f.name,
        src: uploadResult.path,
        elevationBottom: f.elevationBottom,
        elevationTop: f.elevationTop,
        walls,
        footprint: f.footprint, // Phase B: walkable surface shape (optional)
      });
    }

    const result = await this.foundryClient.query('jdr-mcp-bridge.create-scene-levels', {
      sceneName: sceneName.trim(),
      folderName: folderName?.trim() || undefined,
      gridSize,
      gridEnabled,
      width,
      height,
      levels,
      stairs: stairs || undefined, // Phase B: changeLevel regions (optional)
      active: true,
    });
    if (!result?.success) {
      throw new Error(`Failed to create multi-level scene: ${result?.error || 'unknown error'}`);
    }

    return {
      success: true,
      message: `Multi-level scene "${sceneName}" created (${result.levelCount} levels, ${result.totalWalls} walls, ${result.regionsCreated ?? 0} regions).`,
      sceneId: result.sceneId,
      sceneName: result.sceneName,
      levelCount: result.levelCount,
      levels: result.levels,
      totalWalls: result.totalWalls,
      regionsCreated: result.regionsCreated ?? 0,
      dimensions: { width, height },
    };
  }

  /**
   * Place pickable/decorative prop images as Tiles on a tactical scene. Each prop's local
   * image is uploaded to Foundry (worlds/<id>/scene-props), then a Tile is created at the
   * given image-pixel coordinates with an optional linked dnd5e item recorded as a flag.
   * Used by the objets-de-scene skill (dungeon/cave/house scenes — not town overviews).
   */
  async handlePlaceSceneProps(args: any): Promise<any> {
    const propSchema = z.object({
      imagePath: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
      rotation: z.number().optional(),
      label: z.string().optional(),
      lootItemUuid: z.string().optional(),
      lootItemName: z.string().optional(),
      openImagePath: z.string().optional(),
      contents: z
        .array(
          z.object({
            uuid: z.string(),
            name: z.string().optional(),
            quantity: z.number().optional(),
          })
        )
        .optional(),
    });
    const schema = z.object({
      sceneName: z.string().optional(),
      props: z.array(propSchema).min(1),
    });
    const { sceneName, props } = schema.parse(args);

    this.logger.info('Placing scene props', { sceneName, count: props.length });

    // Upload each prop image (deduped by path) and build the tile payloads.
    const uploadedByPath = new Map<string, string>();
    // Upload a local image once (cached by absolute path) and return its Foundry web path.
    const uploadImage = async (absPath: string): Promise<string> => {
      const cached = uploadedByPath.get(absPath);
      if (cached) return cached;
      let imageBuffer: Buffer;
      try {
        imageBuffer = await readFile(absPath);
      } catch (error) {
        throw new Error(
          `Cannot read prop image "${absPath}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      const filename = basename(absPath);
      const uploadResult = await this.foundryClient.query('jdr-mcp-bridge.upload-generated-map', {
        filename,
        imageData: imageBuffer.toString('base64'),
        subdir: 'scene-props',
      });
      if (!uploadResult?.success) {
        throw new Error(
          `Failed to upload prop "${filename}" to Foundry: ${uploadResult?.error || 'unknown error'}`
        );
      }
      const webPath = uploadResult.path as string;
      uploadedByPath.set(absPath, webPath);
      this.logger.info('Prop image uploaded to Foundry', { webPath });
      return webPath;
    };

    const tiles: any[] = [];
    for (const prop of props) {
      const webPath = await uploadImage(prop.imagePath);
      // Chests: upload the "opened" sprite too (if any) and keep contents for the module flag.
      const openSrc = prop.openImagePath ? await uploadImage(prop.openImagePath) : undefined;
      tiles.push({
        src: webPath,
        x: prop.x,
        y: prop.y,
        width: prop.width,
        height: prop.height,
        rotation: prop.rotation,
        label: prop.label,
        lootItemUuid: prop.lootItemUuid,
        lootItemName: prop.lootItemName,
        openSrc,
        contents: prop.contents,
      });
    }

    try {
      const result = await this.foundryClient.query('jdr-mcp-bridge.create-scene-tiles', {
        sceneIdentifier: sceneName,
        tiles,
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      this.logger.error('Failed to place scene props', error);
      throw new Error(
        `Failed to place scene props: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set an actor's portrait and/or prototype token artwork from local image files. Each image is
   * uploaded to Foundry (worlds/<id>/tokens) first, then assigned to the actor along with optional
   * player-character prototype-token defaults. Used by the tokens-pj skill.
   */
  async handleSetActorImage(args: any): Promise<any> {
    const schema = z.object({
      actorIdentifier: z.string(),
      tokenImagePath: z.string().optional(),
      portraitImagePath: z.string().optional(),
      applyPjDefaults: z.boolean().optional(),
      dynamicRing: z.boolean().optional(),
      disposition: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(),
    });
    const {
      actorIdentifier,
      tokenImagePath,
      portraitImagePath,
      applyPjDefaults,
      dynamicRing,
      disposition,
    } = schema.parse(args);

    if (!tokenImagePath && !portraitImagePath) {
      throw new Error('Provide at least one of tokenImagePath or portraitImagePath.');
    }

    this.logger.info('Setting actor image', {
      actorIdentifier,
      hasToken: !!tokenImagePath,
      hasPortrait: !!portraitImagePath,
    });

    // Upload a local image once (cached by absolute path) and return its Foundry web path.
    const uploadedByPath = new Map<string, string>();
    const uploadImage = async (absPath: string): Promise<string> => {
      const cached = uploadedByPath.get(absPath);
      if (cached) return cached;
      let imageBuffer: Buffer;
      try {
        imageBuffer = await readFile(absPath);
      } catch (error) {
        throw new Error(
          `Cannot read image "${absPath}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      const uploadResult = await this.foundryClient.query('jdr-mcp-bridge.upload-generated-map', {
        filename: basename(absPath),
        imageData: imageBuffer.toString('base64'),
        subdir: 'tokens',
      });
      if (!uploadResult?.success) {
        throw new Error(
          `Failed to upload image "${basename(absPath)}" to Foundry: ${uploadResult?.error || 'unknown error'}`
        );
      }
      const webPath = uploadResult.path as string;
      uploadedByPath.set(absPath, webPath);
      this.logger.info('Token image uploaded to Foundry', { webPath });
      return webPath;
    };

    const tokenSrc = tokenImagePath ? await uploadImage(tokenImagePath) : undefined;
    const img = portraitImagePath ? await uploadImage(portraitImagePath) : undefined;

    try {
      const result = await this.foundryClient.query('jdr-mcp-bridge.set-actor-image', {
        actorIdentifier,
        ...(img ? { img } : {}),
        ...(tokenSrc ? { tokenSrc } : {}),
        applyPjDefaults: applyPjDefaults ?? true,
        ...(dynamicRing !== undefined ? { dynamicRing } : {}),
        ...(disposition !== undefined ? { disposition } : {}),
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      this.logger.error('Failed to set actor image', error);
      throw new Error(
        `Failed to set actor image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
