import { MODULE_ID, ERROR_MESSAGES, TOKEN_DISPOSITIONS } from './constants.js';
import { permissionManager } from './permissions.js';
import { transactionManager } from './transaction-manager.js';
// Local type definitions to avoid shared package import issues
interface CharacterInfo {
  id: string;
  name: string;
  type: string;
  img?: string;
  system: Record<string, unknown>;
  items: CharacterItem[];
  effects: CharacterEffect[];
  actions?: any[]; // PF2e actions (strikes, spells, etc.)
  itemVariants?: any[]; // Item rule element variants (ChoiceSet, etc.)
  itemToggles?: any[]; // Item rule element toggles (RollOption, ToggleProperty, equipped)
  spellcasting?: SpellcastingEntry[]; // PF2e/D&D 5e spellcasting entries
}

interface SpellcastingEntry {
  id: string;
  name: string;
  tradition?: string | undefined; // arcane, divine, primal, occult (PF2e)
  type: string; // prepared, spontaneous, innate, focus (PF2e) or class name (5e)
  ability?: string | undefined; // spellcasting ability (int, wis, cha)
  dc?: number | undefined;
  attack?: number | undefined;
  slots?: Record<string, { value: number; max: number }> | undefined; // spell slots per level/rank
  spells: SpellInfo[];
}

interface SpellInfo {
  id: string;
  name: string;
  level: number; // spell level/rank
  prepared?: boolean | undefined; // for prepared casters
  expended?: boolean | undefined; // has this spell slot been used
  traits?: string[] | undefined;
  actionCost?: string | undefined; // 1, 2, 3, reaction, free
  // Targeting info - helps Claude decide whether to specify targets
  range?: string | undefined; // "touch", "self", "60 feet", etc.
  target?: string | undefined; // "1 creature", "self", "area", etc.
  area?: string | undefined; // "20-foot radius", "30-foot cone", etc. (for template spells)
}

interface CharacterItem {
  id: string;
  name: string;
  type: string;
  img?: string;
  system: Record<string, unknown>;
}

interface CharacterEffect {
  id: string;
  name: string;
  icon?: string;
  disabled: boolean;
  duration?: {
    type: string;
    duration?: number;
    remaining?: number;
  };
}

interface CompendiumSearchResult {
  id: string;
  name: string;
  type: string;
  img?: string;
  pack: string;
  packLabel: string;
  system?: Record<string, unknown>;
  summary?: string;
  hasImage?: boolean;
  description?: string;
}

// D&D 5e Enhanced Creature Index
interface DnD5eCreatureIndex {
  id: string;
  name: string;
  type: string;
  pack: string;
  packLabel: string;
  challengeRating: number;
  creatureType: string;
  size: string;
  hitPoints: number;
  armorClass: number;
  hasSpells: boolean;
  hasLegendaryActions: boolean;
  alignment: string;
  description?: string;
  img?: string;
}

// Pathfinder 2e Enhanced Creature Index
interface PF2eCreatureIndex {
  id: string;
  name: string;
  type: string;
  pack: string;
  packLabel: string;
  level: number; // PF2e: -1 to 25+
  traits: string[]; // PF2e: ['dragon', 'fire', 'amphibious']
  creatureType: string; // Primary trait extracted from traits array
  rarity: string; // PF2e: 'common', 'uncommon', 'rare', 'unique'
  size: string;
  hitPoints: number;
  armorClass: number;
  hasSpells: boolean;
  alignment: string;
  description?: string;
  img?: string;
}

// Cosmere RPG (Plotweaver) Enhanced Creature Index
//
// Plotweaver categorises adversaries by `tier` (1-4) and `role`
// (minion/rival/boss) rather than CR or level — those are the primary
// encounter-design dials. Defenses are split into phy/cog/spi instead
// of a single AC, and Investiture is the Surge/Stormlight resource.
interface CosmereRpgCreatureIndex {
  id: string;
  name: string;
  type: string; // 'adversary' for compendium creatures
  pack: string;
  packLabel: string;
  tier: number; // 1-4
  role: string; // minion | rival | boss | (system-extended)
  creatureType: string; // humanoid | animal | spren | …
  subtype: string; // free-form secondary type
  size: string;
  hitPoints: number; // resources.hea.max (override-aware)
  focus: number; // resources.foc.max
  investiture: number; // resources.inv.max — typically 0
  hasInvestiture: boolean;
  defensePhysical: number;
  defenseCognitive: number;
  defenseSpiritual: number;
  deflect: number;
  walkSpeed: number;
  description?: string;
  img?: string;
}

// Union type across all supported systems
type EnhancedCreatureIndex = DnD5eCreatureIndex | PF2eCreatureIndex | CosmereRpgCreatureIndex;

interface PersistentIndexMetadata {
  version: string;
  timestamp: number;
  packFingerprints: Map<string, PackFingerprint>;
  totalCreatures: number;
  gameSystem: string; // 'dnd5e' or 'pf2e'
}

interface PackFingerprint {
  packId: string;
  packLabel: string;
  lastModified: number;
  documentCount: number;
  checksum: string;
}

interface PersistentEnhancedIndex {
  metadata: PersistentIndexMetadata;
  creatures: EnhancedCreatureIndex[];
}

interface SceneInfo {
  id: string;
  name: string;
  img?: string;
  background?: string;
  width: number;
  height: number;
  padding: number;
  active: boolean;
  navigation: boolean;
  tokens: SceneToken[];
  walls: number;
  lights: number;
  sounds: number;
  notes: SceneNote[];
}

interface SceneToken {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  actorId?: string;
  img: string;
  hidden: boolean;
  disposition: number;
}

interface SceneNote {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface WorldInfo {
  id: string;
  title: string;
  system: string;
  systemVersion: string;
  foundryVersion: string;
  users: WorldUser[];
}

interface WorldUser {
  id: string;
  name: string;
  active: boolean;
  isGM: boolean;
}

// Phase 2: Write Operation Interfaces
interface ActorCreationRequest {
  creatureType: string;
  customNames?: string[] | undefined;
  packPreference?: string | undefined;
  quantity?: number | undefined;
  addToScene?: boolean | undefined;
}

interface ActorCreationResult {
  success: boolean;
  actors: CreatedActorInfo[];
  errors?: string[] | undefined;
  tokensPlaced?: number;
  totalRequested: number;
  totalCreated: number;
}

interface CreatedActorInfo {
  id: string;
  name: string;
  originalName: string;
  type: string;
  sourcePackId: string;
  sourcePackLabel: string;
  img?: string;
}

interface CompendiumEntryFull {
  id: string;
  name: string;
  type: string;
  img?: string;
  pack: string;
  packLabel: string;
  system: Record<string, unknown>;
  items?: CompendiumItem[];
  effects?: CompendiumEffect[];
  fullData: Record<string, unknown>;
}

interface CompendiumItem {
  id: string;
  name: string;
  type: string;
  img?: string;
  system: Record<string, unknown>;
}

interface CompendiumEffect {
  id: string;
  name: string;
  icon?: string;
  disabled: boolean;
  duration?: Record<string, unknown>;
}

interface SceneTokenPlacement {
  actorIds: string[];
  placement: 'random' | 'grid' | 'center' | 'coordinates';
  hidden: boolean;
  coordinates?: { x: number; y: number }[];
}

interface TokenPlacementResult {
  success: boolean;
  tokensCreated: number;
  tokenIds: string[];
  errors?: string[] | undefined;
}

/**
 * Persistent Enhanced Creature Index System
 * Stores pre-computed creature data in JSON file within Foundry world directory for instant filtering
 * Uses file-based storage following Foundry best practices for large data sets
 */
class PersistentCreatureIndex {
  private moduleId: string = MODULE_ID;
  private readonly INDEX_VERSION = '1.0.0';
  private readonly INDEX_FILENAME = 'enhanced-creature-index.json';
  private buildInProgress = false;
  private hooksRegistered = false;

  constructor() {
    this.registerFoundryHooks();
  }

  /**
   * Get the file path for the enhanced creature index
   */
  private getIndexFilePath(): string {
    // Store in world data directory using world ID
    return `worlds/${game.world.id}/${this.INDEX_FILENAME}`;
  }

  /**
   * Get or build the enhanced creature index
   */
  async getEnhancedIndex(): Promise<EnhancedCreatureIndex[]> {
    // Check if we have a valid persistent index
    const existingIndex = await this.loadPersistedIndex();

    if (existingIndex && this.isIndexValid(existingIndex)) {
      return existingIndex.creatures;
    }

    // Build new index if needed
    return await this.buildEnhancedIndex();
  }

  /**
   * Force rebuild of the enhanced index
   */
  async rebuildIndex(): Promise<EnhancedCreatureIndex[]> {
    return await this.buildEnhancedIndex(true);
  }

  /**
   * Load persisted index from JSON file
   */
  private async loadPersistedIndex(): Promise<PersistentEnhancedIndex | null> {
    try {
      const filePath = this.getIndexFilePath();

      // Check if file exists using Foundry's FilePicker
      let fileExists = false;
      try {
        const browseResult = await (
          foundry as any
        ).applications.apps.FilePicker.implementation.browse('data', `worlds/${game.world.id}`);
        fileExists = browseResult.files.some((f: any) => f.endsWith(this.INDEX_FILENAME));
      } catch (error) {
        // Directory doesn't exist or other error, return null
        return null;
      }

      if (!fileExists) {
        return null;
      }

      // Load file content
      const response = await fetch(filePath);
      if (!response.ok) {
        console.warn(`[${this.moduleId}] Failed to load index file: ${response.status}`);
        return null;
      }

      const rawData = await response.json();

      // Convert Map data back from JSON
      const metadata = rawData.metadata;
      if (metadata && metadata.packFingerprints) {
        metadata.packFingerprints = new Map(metadata.packFingerprints);
      }

      return rawData;
    } catch (error) {
      console.warn(`[${this.moduleId}] Failed to load persisted index from file:`, error);
      return null;
    }
  }

  /**
   * Save enhanced index to JSON file
   */
  private async savePersistedIndex(index: PersistentEnhancedIndex): Promise<void> {
    try {
      // Convert Map to Array for JSON serialization
      const saveData = {
        ...index,
        metadata: {
          ...index.metadata,
          packFingerprints: Array.from(index.metadata.packFingerprints.entries()),
        },
      };

      const jsonContent = JSON.stringify(saveData, null, 2);

      // Create a File object and upload it using Foundry's file system
      const file = new File([jsonContent], this.INDEX_FILENAME, { type: 'application/json' });

      // Upload the file to the world directory
      const uploadResponse = await (
        foundry as any
      ).applications.apps.FilePicker.implementation.upload('data', `worlds/${game.world.id}`, file);

      if (uploadResponse) {
      } else {
        throw new Error('File upload failed');
      }
    } catch (error) {
      console.error(`[${this.moduleId}] Failed to save enhanced index to file:`, error);
      throw error;
    }
  }

  /**
   * Check if existing index is valid (all packs unchanged)
   */
  private isIndexValid(existingIndex: PersistentEnhancedIndex): boolean {
    // Check version
    if (existingIndex.metadata.version !== this.INDEX_VERSION) {
      return false;
    }

    // NEW: Check system compatibility
    const currentSystem = (game as any).system.id;
    if (existingIndex.metadata.gameSystem !== currentSystem) {
      console.log(
        `[${this.moduleId}] System changed from ${existingIndex.metadata.gameSystem} to ${currentSystem}, index invalidated`
      );
      return false;
    }

    // Check each pack fingerprint
    const actorPacks = Array.from(game.packs.values()).filter(
      pack => pack.metadata.type === 'Actor'
    );

    for (const pack of actorPacks) {
      const currentFingerprint = this.generatePackFingerprint(pack);
      const savedFingerprint = existingIndex.metadata.packFingerprints.get(pack.metadata.id);

      if (!savedFingerprint) {
        return false;
      }

      if (!this.fingerprintsMatch(currentFingerprint, savedFingerprint)) {
        return false;
      }
    }

    // Check if any saved packs no longer exist
    for (const [packId] of existingIndex.metadata.packFingerprints) {
      if (!game.packs.get(packId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Register Foundry hooks for real-time pack change detection
   */
  private registerFoundryHooks(): void {
    if (this.hooksRegistered) return;

    // Listen for compendium document changes
    Hooks.on('createDocument', (document: any) => {
      if (
        document.pack &&
        (document.type === 'npc' || document.type === 'character' || document.type === 'creature')
      ) {
        this.invalidateIndex();
      }
    });

    Hooks.on('updateDocument', (document: any) => {
      if (
        document.pack &&
        (document.type === 'npc' || document.type === 'character' || document.type === 'creature')
      ) {
        this.invalidateIndex();
      }
    });

    Hooks.on('deleteDocument', (document: any) => {
      if (
        document.pack &&
        (document.type === 'npc' || document.type === 'character' || document.type === 'creature')
      ) {
        this.invalidateIndex();
      }
    });

    // Listen for pack creation/deletion
    Hooks.on('createCompendium', (pack: any) => {
      if (pack.metadata.type === 'Actor') {
        this.invalidateIndex();
      }
    });

    Hooks.on('deleteCompendium', (pack: any) => {
      if (pack.metadata.type === 'Actor') {
        this.invalidateIndex();
      }
    });

    this.hooksRegistered = true;
  }

  /**
   * Invalidate the current index (mark for rebuild on next access)
   */
  private async invalidateIndex(): Promise<void> {
    try {
      // Check if auto-rebuild is enabled
      const autoRebuild = game.settings.get(this.moduleId, 'autoRebuildIndex');

      if (!autoRebuild) {
        return;
      }

      // Delete the index file to force rebuild
      const filePath = this.getIndexFilePath();

      try {
        // Check if file exists first by trying to browse to the world directory
        const browseResult = await (
          foundry as any
        ).applications.apps.FilePicker.implementation.browse('data', `worlds/${game.world.id}`);
        const fileExists = browseResult.files.some((f: any) => f.endsWith(this.INDEX_FILENAME));

        if (fileExists) {
          // File exists, delete it using fetch with DELETE method
          await fetch(filePath, { method: 'DELETE' });
          // File deletion completed (or failed silently)
        }
      } catch (error) {
        // File doesn't exist or deletion failed - that's okay
      }
    } catch (error) {
      console.warn(`[${this.moduleId}] Failed to invalidate index:`, error);
    }
  }

  /**
   * Generate fingerprint for pack change detection with improved accuracy
   */
  private generatePackFingerprint(pack: any): PackFingerprint {
    // Get actual modification time if available
    let lastModified = Date.now();
    if (pack.metadata.lastModified) {
      lastModified = new Date(pack.metadata.lastModified).getTime();
    }

    return {
      packId: pack.metadata.id,
      packLabel: pack.metadata.label,
      lastModified: lastModified,
      documentCount: pack.index?.size || 0,
      checksum: this.generatePackChecksum(pack),
    };
  }

  /**
   * Generate checksum for pack contents
   */
  private generatePackChecksum(pack: any): string {
    // Simple checksum based on pack metadata and size
    const data = `${pack.metadata.id}-${pack.metadata.label}-${pack.index?.size || 0}`;
    return btoa(data).slice(0, 16); // Simple hash for demonstration
  }

  /**
   * Compare two pack fingerprints
   */
  private fingerprintsMatch(current: PackFingerprint, saved: PackFingerprint): boolean {
    return current.documentCount === saved.documentCount && current.checksum === saved.checksum;
  }

  /**
   * Build enhanced creature index from all Actor packs with detailed progress tracking
   */
  private async buildEnhancedIndex(force = false): Promise<EnhancedCreatureIndex[]> {
    if (this.buildInProgress && !force) {
      throw new Error('Index build already in progress');
    }

    // Detect game system ONCE at build time
    const gameSystem = (game as any).system.id;

    console.log(`[${this.moduleId}] Building enhanced creature index for system: ${gameSystem}`);

    // Route to system-specific builder
    if (gameSystem === 'pf2e') {
      return await this.buildPF2eIndex(force);
    } else if (gameSystem === 'dnd5e') {
      return await this.buildDnD5eIndex(force);
    } else if (gameSystem === 'cosmere-rpg') {
      return await this.buildCosmereRpgIndex(force);
    } else {
      throw new Error(
        `Enhanced creature index not supported for system: ${gameSystem}. Only D&D 5e, Pathfinder 2e, and Cosmere RPG are currently supported.`
      );
    }
  }

  /**
   * Build D&D 5e enhanced creature index
   */
  private async buildDnD5eIndex(_force = false): Promise<DnD5eCreatureIndex[]> {
    this.buildInProgress = true;

    const startTime = Date.now();
    let progressNotification: any = null;
    let totalErrors = 0; // Track extraction errors

    try {
      const actorPacks = Array.from(game.packs.values()).filter(
        pack => pack.metadata.type === 'Actor'
      );
      const enhancedCreatures: DnD5eCreatureIndex[] = [];
      const packFingerprints = new Map<string, PackFingerprint>();

      // Show initial progress notification
      ui.notifications?.info(
        `Starting enhanced creature index build from ${actorPacks.length} packs...`
      );

      for (let i = 0; i < actorPacks.length; i++) {
        const pack = actorPacks[i];
        const progressPercent = Math.round((i / actorPacks.length) * 100);

        // Update progress notification every few packs or for important packs
        if (i % 3 === 0 || pack.metadata.label.toLowerCase().includes('monster')) {
          if (progressNotification) {
            progressNotification.remove();
          }
          progressNotification = ui.notifications?.info(
            `Building creature index... ${progressPercent}% (${i + 1}/${actorPacks.length}) Processing: ${pack.metadata.label}`
          );
        }

        try {
          // Ensure pack index is loaded
          if (!pack.indexed) {
            await pack.getIndex({});
          }

          // Generate pack fingerprint for change detection
          packFingerprints.set(pack.metadata.id, this.generatePackFingerprint(pack));

          // Show pack processing details for large packs
          const packSize = pack.index?.size || 0;
          if (packSize > 50) {
            if (progressNotification) {
              progressNotification.remove();
            }
            progressNotification = ui.notifications?.info(
              `Processing large pack: ${pack.metadata.label} (${packSize} documents)...`
            );
          }

          // Process creatures in this pack
          const packResult = await this.extractDnD5eDataFromPack(pack);
          enhancedCreatures.push(...packResult.creatures);
          totalErrors += packResult.errors;

          // Pack processing completed: ${pack.metadata.label} - ${packResult.creatures.length} creatures extracted

          // Show milestone notifications for significant progress
          if (i === 0 || (i + 1) % 5 === 0 || i === actorPacks.length - 1) {
            const totalCreaturesSoFar = enhancedCreatures.length;
            if (progressNotification) {
              progressNotification.remove();
            }
            progressNotification = ui.notifications?.info(
              `Index Progress: ${i + 1}/${actorPacks.length} packs complete, ${totalCreaturesSoFar} creatures indexed`
            );
          }
        } catch (error) {
          console.warn(`[${this.moduleId}] Failed to process pack ${pack.metadata.label}:`, error);
          // Show error notification for pack failures
          ui.notifications?.warn(
            `Warning: Failed to index pack "${pack.metadata.label}" - continuing with other packs`
          );
        }
      }

      // Clear progress notification and show final processing step
      if (progressNotification) {
        progressNotification.remove();
      }
      ui.notifications?.info(
        `Saving enhanced index to world database... (${enhancedCreatures.length} creatures)`
      );

      // Create persistent index structure
      const persistentIndex: PersistentEnhancedIndex = {
        metadata: {
          version: this.INDEX_VERSION,
          timestamp: Date.now(),
          packFingerprints,
          totalCreatures: enhancedCreatures.length,
          gameSystem: 'dnd5e', // Mark as D&D 5e index
        },
        creatures: enhancedCreatures,
      };

      // Save to world flags
      await this.savePersistedIndex(persistentIndex);

      const buildTimeSeconds = Math.round((Date.now() - startTime) / 1000);
      const errorText = totalErrors > 0 ? ` (${totalErrors} extraction errors)` : '';
      const successMessage = `Enhanced creature index complete! ${enhancedCreatures.length} creatures indexed from ${actorPacks.length} packs in ${buildTimeSeconds}s${errorText}`;

      ui.notifications?.info(successMessage);

      return enhancedCreatures;
    } catch (error) {
      // Clear any progress notifications on error
      if (progressNotification) {
        progressNotification.remove();
      }

      const errorMessage = `Failed to build enhanced creature index: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[${this.moduleId}] ${errorMessage}`);
      ui.notifications?.error(errorMessage);

      throw error;
    } finally {
      this.buildInProgress = false;

      // Ensure progress notification is cleared
      if (progressNotification) {
        progressNotification.remove();
      }
    }
  }

  /**
   * Extract D&D 5e data from all documents in a pack
   */
  private async extractDnD5eDataFromPack(
    pack: any
  ): Promise<{ creatures: DnD5eCreatureIndex[]; errors: number }> {
    const creatures: DnD5eCreatureIndex[] = [];
    let errors = 0;

    try {
      // Load all documents from pack
      const documents = await pack.getDocuments();

      for (const doc of documents) {
        try {
          // Only process NPCs, characters, and creatures
          if (doc.type !== 'npc' && doc.type !== 'character' && doc.type !== 'creature') {
            continue;
          }

          const result = this.extractDnD5eCreatureData(doc, pack);
          if (result) {
            creatures.push(result.creature);
            errors += result.errors;
          }
        } catch (error) {
          console.warn(
            `[${this.moduleId}] Failed to extract data from ${doc.name} in ${pack.metadata.label}:`,
            error
          );
          errors++;
        }
      }
    } catch (error) {
      console.warn(
        `[${this.moduleId}] Failed to load documents from ${pack.metadata.label}:`,
        error
      );
      errors++;
    }

    return { creatures, errors };
  }

  /**
   * Extract D&D 5e creature data from a single document
   */
  private extractDnD5eCreatureData(
    doc: any,
    pack: any
  ): { creature: DnD5eCreatureIndex; errors: number } | null {
    try {
      const system = doc.system || {};

      // Extract challenge rating with comprehensive fallbacks
      // Based on debug logs: system.details.cr contains the actual value
      let challengeRating =
        system.details?.cr ??
        system.details?.cr?.value ??
        system.cr?.value ??
        system.cr ??
        system.attributes?.cr?.value ??
        system.attributes?.cr ??
        system.challenge?.rating ??
        system.challenge?.cr ??
        0;

      // Handle null values (spell effects, etc.)
      if (challengeRating === null || challengeRating === undefined) {
        challengeRating = 0;
      }

      if (typeof challengeRating === 'string') {
        if (challengeRating === '1/8') challengeRating = 0.125;
        else if (challengeRating === '1/4') challengeRating = 0.25;
        else if (challengeRating === '1/2') challengeRating = 0.5;
        else challengeRating = parseFloat(challengeRating) || 0;
      }

      // Ensure it's a number
      challengeRating = Number(challengeRating) || 0;

      // Extract creature type with proper type checking
      // Based on debug logs: system.details.type.value contains the actual value
      let creatureType =
        system.details?.type?.value ??
        system.details?.type ??
        system.type?.value ??
        system.type ??
        system.race?.value ??
        system.race ??
        system.details?.race ??
        'unknown';

      // Handle null/undefined values properly
      if (creatureType === null || creatureType === undefined || creatureType === '') {
        creatureType = 'unknown';
      }

      // Ensure creatureType is a string before calling toLowerCase()
      if (typeof creatureType !== 'string') {
        creatureType = String(creatureType || 'unknown');
      }

      // Extract size with proper type checking
      let size =
        system.traits?.size?.value ||
        system.traits?.size ||
        system.size?.value ||
        system.size ||
        system.details?.size ||
        'medium';

      // Ensure size is a string
      if (typeof size !== 'string') {
        size = String(size || 'medium');
      }

      // Extract hit points with more fallbacks
      const hitPoints =
        system.attributes?.hp?.max ||
        system.hp?.max ||
        system.attributes?.hp?.value ||
        system.hp?.value ||
        system.health?.max ||
        system.health?.value ||
        0;

      // Extract armor class with more fallbacks
      const armorClass =
        system.attributes?.ac?.value ||
        system.ac?.value ||
        system.attributes?.ac ||
        system.ac ||
        system.armor?.value ||
        system.armor ||
        10;

      // Extract alignment with proper type checking
      let alignment =
        system.details?.alignment?.value ||
        system.details?.alignment ||
        system.alignment?.value ||
        system.alignment ||
        'unaligned';

      // Ensure alignment is a string
      if (typeof alignment !== 'string') {
        alignment = String(alignment || 'unaligned');
      }

      // Check for spells with more comprehensive detection
      const hasSpells = !!(
        system.spells ||
        system.attributes?.spellcasting ||
        (system.details?.spellLevel && system.details.spellLevel > 0) ||
        (system.resources?.spell && system.resources.spell.max > 0) ||
        system.spellcasting ||
        system.traits?.spellcasting ||
        system.details?.spellcaster
      );

      // Check for legendary actions with more comprehensive detection
      const hasLegendaryActions = !!(
        system.resources?.legact ||
        system.legendary ||
        (system.resources?.legres && system.resources.legres.value > 0) ||
        system.details?.legendary ||
        system.traits?.legendary ||
        (system.resources?.legendary && system.resources.legendary.max > 0)
      );

      // DEBUG: Log what we extracted for comparison

      // Successful extraction
      return {
        creature: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          pack: pack.metadata.id,
          packLabel: pack.metadata.label,
          challengeRating: challengeRating,
          creatureType: creatureType.toLowerCase(),
          size: size.toLowerCase(),
          hitPoints: hitPoints,
          armorClass: armorClass,
          hasSpells: hasSpells,
          hasLegendaryActions: hasLegendaryActions,
          alignment: alignment.toLowerCase(),
          description: doc.system?.details?.biography || doc.system?.description || '',
          img: doc.img,
        },
        errors: 0,
      };
    } catch (error) {
      console.warn(`[${this.moduleId}] Failed to extract enhanced data from ${doc.name}:`, error);

      // Return a basic fallback record with error count instead of null to avoid losing creatures
      return {
        creature: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          pack: pack.metadata.id,
          packLabel: pack.metadata.label,
          challengeRating: 0,
          creatureType: 'unknown',
          size: 'medium',
          hitPoints: 1,
          armorClass: 10,
          hasSpells: false,
          hasLegendaryActions: false,
          alignment: 'unaligned',
          description: 'Data extraction failed',
          img: doc.img || '',
        },
        errors: 1,
      };
    }
  }

  /**
   * Build Pathfinder 2e enhanced creature index
   */
  private async buildPF2eIndex(_force = false): Promise<PF2eCreatureIndex[]> {
    this.buildInProgress = true;

    const startTime = Date.now();
    let progressNotification: any = null;
    let totalErrors = 0;

    try {
      const actorPacks = Array.from(game.packs.values()).filter(
        pack => pack.metadata.type === 'Actor'
      );
      const enhancedCreatures: PF2eCreatureIndex[] = [];
      const packFingerprints = new Map<string, PackFingerprint>();

      ui.notifications?.info(
        `Starting PF2e creature index build from ${actorPacks.length} packs...`
      );

      let currentPack = 0;
      for (const pack of actorPacks) {
        currentPack++;

        if (progressNotification) {
          progressNotification.remove();
        }
        progressNotification = ui.notifications?.info(
          `Building PF2e index: Pack ${currentPack}/${actorPacks.length} (${pack.metadata.label})...`
        );

        const fingerprint = await this.generatePackFingerprint(pack);
        packFingerprints.set(pack.metadata.id, fingerprint);

        const result = await this.extractPF2eDataFromPack(pack);
        enhancedCreatures.push(...result.creatures);
        totalErrors += result.errors;
      }

      if (progressNotification) {
        progressNotification.remove();
      }
      ui.notifications?.info(
        `Saving PF2e index to world database... (${enhancedCreatures.length} creatures)`
      );

      const persistentIndex: PersistentEnhancedIndex = {
        metadata: {
          version: this.INDEX_VERSION,
          timestamp: Date.now(),
          packFingerprints,
          totalCreatures: enhancedCreatures.length,
          gameSystem: 'pf2e', // Mark as PF2e index
        },
        creatures: enhancedCreatures,
      };

      await this.savePersistedIndex(persistentIndex);

      const buildTimeSeconds = Math.round((Date.now() - startTime) / 1000);
      const errorText = totalErrors > 0 ? ` (${totalErrors} extraction errors)` : '';
      const successMessage = `PF2e creature index complete! ${enhancedCreatures.length} creatures indexed from ${actorPacks.length} packs in ${buildTimeSeconds}s${errorText}`;

      ui.notifications?.info(successMessage);

      return enhancedCreatures;
    } catch (error) {
      if (progressNotification) {
        progressNotification.remove();
      }

      const errorMessage = `Failed to build PF2e creature index: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[${this.moduleId}] ${errorMessage}`);
      ui.notifications?.error(errorMessage);

      throw error;
    } finally {
      this.buildInProgress = false;

      if (progressNotification) {
        progressNotification.remove();
      }
    }
  }

  /**
   * Extract PF2e creature data from all documents in a pack
   */
  private async extractPF2eDataFromPack(
    pack: any
  ): Promise<{ creatures: PF2eCreatureIndex[]; errors: number }> {
    const creatures: PF2eCreatureIndex[] = [];
    let errors = 0;

    try {
      const documents = await pack.getDocuments();

      for (const doc of documents) {
        try {
          // Support NPCs, characters, and creatures
          if (doc.type !== 'npc' && doc.type !== 'character' && doc.type !== 'creature') {
            continue;
          }

          const result = this.extractPF2eCreatureData(doc, pack);
          if (result) {
            creatures.push(result.creature);
            errors += result.errors;
          }
        } catch (error) {
          console.warn(
            `[${this.moduleId}] Failed to extract PF2e data from ${doc.name} in ${pack.metadata.label}:`,
            error
          );
          errors++;
        }
      }
    } catch (error) {
      console.warn(
        `[${this.moduleId}] Failed to load documents from ${pack.metadata.label}:`,
        error
      );
      errors++;
    }

    return { creatures, errors };
  }

  /**
   * Extract Pathfinder 2e creature data from a single document
   */
  private extractPF2eCreatureData(
    doc: any,
    pack: any
  ): { creature: PF2eCreatureIndex; errors: number } | null {
    try {
      const system = doc.system || {};

      // Level extraction (PF2e primary power metric)
      let level = system.details?.level?.value ?? 0;
      level = Number(level) || 0;

      // Traits extraction (PF2e uses array of traits)
      const traitsValue = system.traits?.value || [];
      const traits = Array.isArray(traitsValue) ? traitsValue : [];

      // Extract primary creature type from traits
      const creatureTraits = [
        'aberration',
        'animal',
        'beast',
        'celestial',
        'construct',
        'dragon',
        'elemental',
        'fey',
        'fiend',
        'fungus',
        'humanoid',
        'monitor',
        'ooze',
        'plant',
        'undead',
      ];
      const creatureType =
        traits.find((t: string) => creatureTraits.includes(t.toLowerCase()))?.toLowerCase() ||
        'unknown';

      // Rarity extraction (PF2e specific)
      const rarity = system.traits?.rarity || 'common';

      // Size extraction
      let size = system.traits?.size?.value || 'med';
      // Normalize PF2e size values (tiny, sm, med, lg, huge, grg)
      const sizeMap: Record<string, string> = {
        tiny: 'tiny',
        sm: 'small',
        med: 'medium',
        lg: 'large',
        huge: 'huge',
        grg: 'gargantuan',
      };
      size = sizeMap[size.toLowerCase()] || 'medium';

      // Hit Points
      const hitPoints = system.attributes?.hp?.max || 0;

      // Armor Class
      const armorClass = system.attributes?.ac?.value || 10;

      // Spellcasting detection (PF2e uses spellcasting entries)
      const spellcasting = system.spellcasting || {};
      const hasSpells = Object.keys(spellcasting).length > 0;

      // Alignment
      let alignment = system.details?.alignment?.value || 'N';
      if (typeof alignment !== 'string') {
        alignment = String(alignment || 'N');
      }

      return {
        creature: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          pack: pack.metadata.id,
          packLabel: pack.metadata.label,
          level: level,
          traits: traits,
          creatureType: creatureType,
          rarity: rarity,
          size: size,
          hitPoints: hitPoints,
          armorClass: armorClass,
          hasSpells: hasSpells,
          alignment: alignment.toUpperCase(),
          description: system.details?.publicNotes || system.details?.biography || '',
          img: doc.img,
        },
        errors: 0,
      };
    } catch (error) {
      console.warn(`[${this.moduleId}] Failed to extract PF2e data from ${doc.name}:`, error);

      // Fallback with error count
      return {
        creature: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          pack: pack.metadata.id,
          packLabel: pack.metadata.label,
          level: 0,
          traits: [],
          creatureType: 'unknown',
          rarity: 'common',
          size: 'medium',
          hitPoints: 1,
          armorClass: 10,
          hasSpells: false,
          alignment: 'N',
          description: 'Data extraction failed',
          img: doc.img || '',
        },
        errors: 1,
      };
    }
  }

  /**
   * Build Cosmere RPG (Plotweaver) enhanced creature index.
   *
   * Indexes `adversary`-type actors. Player characters are excluded —
   * they're individual sheets, not encounter material.
   */
  private async buildCosmereRpgIndex(_force = false): Promise<CosmereRpgCreatureIndex[]> {
    this.buildInProgress = true;

    const startTime = Date.now();
    let progressNotification: any = null;
    let totalErrors = 0;

    try {
      const actorPacks = Array.from(game.packs.values()).filter(
        pack => pack.metadata.type === 'Actor'
      );
      const enhancedCreatures: CosmereRpgCreatureIndex[] = [];
      const packFingerprints = new Map<string, PackFingerprint>();

      ui.notifications?.info(
        `Starting Cosmere RPG creature index build from ${actorPacks.length} packs...`
      );

      for (let i = 0; i < actorPacks.length; i++) {
        const pack = actorPacks[i];
        const progressPercent = Math.round((i / actorPacks.length) * 100);

        if (i % 3 === 0 || pack.metadata.label.toLowerCase().includes('adversar')) {
          if (progressNotification) {
            progressNotification.remove();
          }
          progressNotification = ui.notifications?.info(
            `Building creature index... ${progressPercent}% (${i + 1}/${actorPacks.length}) Processing: ${pack.metadata.label}`
          );
        }

        try {
          if (!pack.indexed) {
            await pack.getIndex({});
          }

          packFingerprints.set(pack.metadata.id, this.generatePackFingerprint(pack));

          const packResult = await this.extractCosmereRpgDataFromPack(pack);
          enhancedCreatures.push(...packResult.creatures);
          totalErrors += packResult.errors;

          if (i === 0 || (i + 1) % 5 === 0 || i === actorPacks.length - 1) {
            const totalCreaturesSoFar = enhancedCreatures.length;
            if (progressNotification) {
              progressNotification.remove();
            }
            progressNotification = ui.notifications?.info(
              `Index Progress: ${i + 1}/${actorPacks.length} packs complete, ${totalCreaturesSoFar} creatures indexed`
            );
          }
        } catch (error) {
          console.warn(`[${this.moduleId}] Failed to process pack ${pack.metadata.label}:`, error);
          ui.notifications?.warn(
            `Warning: Failed to index pack "${pack.metadata.label}" - continuing with other packs`
          );
        }
      }

      if (progressNotification) {
        progressNotification.remove();
      }
      ui.notifications?.info(
        `Saving enhanced index to world database... (${enhancedCreatures.length} creatures)`
      );

      const persistentIndex: PersistentEnhancedIndex = {
        metadata: {
          version: this.INDEX_VERSION,
          timestamp: Date.now(),
          packFingerprints,
          totalCreatures: enhancedCreatures.length,
          gameSystem: 'cosmere-rpg',
        },
        creatures: enhancedCreatures,
      };

      await this.savePersistedIndex(persistentIndex);

      const buildTimeSeconds = Math.round((Date.now() - startTime) / 1000);
      const errorText = totalErrors > 0 ? ` (${totalErrors} extraction errors)` : '';
      const successMessage = `Cosmere RPG creature index complete! ${enhancedCreatures.length} creatures indexed from ${actorPacks.length} packs in ${buildTimeSeconds}s${errorText}`;

      ui.notifications?.info(successMessage);

      return enhancedCreatures;
    } catch (error) {
      if (progressNotification) {
        progressNotification.remove();
      }

      const errorMessage = `Failed to build Cosmere RPG creature index: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[${this.moduleId}] ${errorMessage}`);
      ui.notifications?.error(errorMessage);

      throw error;
    } finally {
      this.buildInProgress = false;
      if (progressNotification) {
        progressNotification.remove();
      }
    }
  }

  /**
   * Extract Cosmere RPG creatures from a single pack.
   */
  private async extractCosmereRpgDataFromPack(
    pack: any
  ): Promise<{ creatures: CosmereRpgCreatureIndex[]; errors: number }> {
    const creatures: CosmereRpgCreatureIndex[] = [];
    let errors = 0;

    try {
      const documents = await pack.getDocuments();

      for (const doc of documents) {
        try {
          if (doc.type !== 'adversary') {
            continue;
          }

          const result = this.extractCosmereRpgCreatureData(doc, pack);
          if (result) {
            creatures.push(result.creature);
            errors += result.errors;
          }
        } catch (error) {
          console.warn(
            `[${this.moduleId}] Failed to extract Cosmere RPG data from ${doc.name} in ${pack.metadata.label}:`,
            error
          );
          errors++;
        }
      }
    } catch (error) {
      console.warn(
        `[${this.moduleId}] Failed to load documents from ${pack.metadata.label}:`,
        error
      );
      errors++;
    }

    return { creatures, errors };
  }

  /**
   * Resolve a Cosmere DerivedValueField (`{value, derived, override?, useOverride, bonus?}`).
   * Honours `useOverride: true` so manually-typed values (like Investiture max
   * on a sheet the system can't auto-derive) come through correctly.
   */
  private readDerived(field: any): number | undefined {
    if (field == null) return undefined;
    if (typeof field === 'number') return field;
    if (typeof field === 'object') {
      if (field.useOverride === true && typeof field.override === 'number') {
        return field.override;
      }
      if (typeof field.value === 'number') return field.value;
      if (typeof field.derived === 'number') return field.derived;
    }
    return undefined;
  }

  /**
   * Extract a single Cosmere RPG adversary into the creature index format.
   */
  private extractCosmereRpgCreatureData(
    doc: any,
    pack: any
  ): { creature: CosmereRpgCreatureIndex; errors: number } | null {
    try {
      const system = doc.system ?? {};

      const tier = typeof system.tier === 'number' ? system.tier : 0;
      const role =
        typeof system.role === 'string' && system.role.length > 0
          ? system.role.toLowerCase()
          : 'unknown';

      const size =
        typeof system.size === 'string' && system.size.length > 0
          ? system.size.toLowerCase()
          : 'medium';

      const creatureType =
        typeof system.type?.id === 'string' && system.type.id.length > 0
          ? system.type.id.toLowerCase()
          : 'unknown';

      const subtype =
        typeof system.type?.subtype === 'string' && system.type.subtype.length > 0
          ? system.type.subtype
          : '';

      const hitPoints = this.readDerived(system.resources?.hea?.max) ?? 0;
      const focus = this.readDerived(system.resources?.foc?.max) ?? 0;
      const investiture = this.readDerived(system.resources?.inv?.max) ?? 0;

      const defensePhysical = this.readDerived(system.defenses?.phy) ?? 0;
      const defenseCognitive = this.readDerived(system.defenses?.cog) ?? 0;
      const defenseSpiritual = this.readDerived(system.defenses?.spi) ?? 0;

      const deflect = this.readDerived(system.deflect) ?? 0;
      const walkSpeed = this.readDerived(system.movement?.walk?.rate) ?? 0;

      return {
        creature: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          pack: pack.metadata.id,
          packLabel: pack.metadata.label,
          tier,
          role,
          creatureType,
          subtype,
          size,
          hitPoints,
          focus,
          investiture,
          hasInvestiture: investiture > 0,
          defensePhysical,
          defenseCognitive,
          defenseSpiritual,
          deflect,
          walkSpeed,
          img: doc.img,
        },
        errors: 0,
      };
    } catch (error) {
      console.warn(
        `[${this.moduleId}] Failed to extract Cosmere RPG data from ${doc.name}:`,
        error
      );
      return {
        creature: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          pack: pack.metadata.id,
          packLabel: pack.metadata.label,
          tier: 0,
          role: 'unknown',
          creatureType: 'unknown',
          subtype: '',
          size: 'medium',
          hitPoints: 0,
          focus: 0,
          investiture: 0,
          hasInvestiture: false,
          defensePhysical: 0,
          defenseCognitive: 0,
          defenseSpiritual: 0,
          deflect: 0,
          walkSpeed: 0,
          description: 'Data extraction failed',
          img: doc.img || '',
        },
        errors: 1,
      };
    }
  }
}

export class FoundryDataAccess {
  private moduleId: string = MODULE_ID;
  private persistentIndex: PersistentCreatureIndex = new PersistentCreatureIndex();

  constructor() {}

  /**
   * Force rebuild of enhanced creature index
   */
  async rebuildEnhancedCreatureIndex(): Promise<{
    success: boolean;
    totalCreatures: number;
    message: string;
  }> {
    try {
      const creatures = await this.persistentIndex.rebuildIndex();
      return {
        success: true,
        totalCreatures: creatures.length,
        message: `Enhanced creature index rebuilt: ${creatures.length} creatures indexed from all packs`,
      };
    } catch (error) {
      console.error(`[${this.moduleId}] Failed to rebuild enhanced creature index:`, error);
      return {
        success: false,
        totalCreatures: 0,
        message: `Failed to rebuild index: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get character/actor information by name or ID
   */
  async getCharacterInfo(identifier: string): Promise<CharacterInfo> {
    let actor: Actor | undefined;

    // Try to find by ID first, then by name
    if (identifier.length === 16) {
      // Foundry ID length
      actor = game.actors.get(identifier);
    }

    if (!actor) {
      actor = game.actors.find(a => a.name?.toLowerCase() === identifier.toLowerCase());
    }

    if (!actor) {
      throw new Error(`${ERROR_MESSAGES.CHARACTER_NOT_FOUND}: ${identifier}`);
    }

    // Build character data structure
    const characterData: CharacterInfo = {
      id: actor.id || '',
      name: actor.name || '',
      type: actor.type,
      ...(actor.img ? { img: actor.img } : {}),
      system: this.sanitizeData((actor as any).system),
      items: actor.items.map(item => {
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          ...(item.img ? { img: item.img } : {}),
          system: this.sanitizeData(item.system),
        };
      }),
      effects: actor.effects.map(effect => {
        const eff = effect as any;
        const dur = eff.duration;
        const durRaw = eff._source?.duration;
        return {
          id: effect.id,
          name: eff.name || eff.label || 'Unknown Effect',
          ...(eff.icon ? { icon: eff.icon } : {}),
          disabled: eff.disabled,
          ...(dur
            ? {
                duration: {
                  type: dur.units ?? durRaw?.type ?? 'none',
                  duration: dur.seconds ?? durRaw?.duration,
                  remaining: dur.remaining,
                },
              }
            : {}),
        };
      }),
    };

    // Add PF2e-specific data if available
    const actorAny = actor as any;

    // Include actions (PF2e strikes, spells, etc.)
    if (actorAny.system?.actions) {
      characterData.actions = actorAny.system.actions.map((action: any) => ({
        name: action.label || action.name,
        type: action.type,
        ...(action.item ? { itemId: action.item.id } : {}),
        ...(action.variants
          ? {
              variants: action.variants.map((v: any) => ({
                label: v.label,
                ...(v.traits ? { traits: v.traits } : {}),
              })),
            }
          : {}),
        ...(action.ready !== undefined ? { ready: action.ready } : {}),
      }));
    }

    // Include item variants and toggles
    const itemVariants: any[] = [];
    const itemToggles: any[] = [];

    actor.items.forEach(item => {
      const itemAny = item as any;

      // Extract rule element variants (e.g., weapon variants, stance toggles)
      if (itemAny.system?.rules) {
        itemAny.system.rules.forEach((rule: any, ruleIndex: number) => {
          // Variants (ChoiceSet, RollOption with choices)
          if (rule.key === 'ChoiceSet' || (rule.key === 'RollOption' && rule.choices)) {
            itemVariants.push({
              itemId: item.id,
              itemName: item.name,
              ruleIndex: ruleIndex,
              ruleKey: rule.key,
              label: rule.label || rule.prompt,
              ...(rule.selection ? { selected: rule.selection } : {}),
              ...(rule.choices ? { choices: rule.choices } : {}),
            });
          }

          // Toggles (RollOption toggleable, ToggleProperty)
          if ((rule.key === 'RollOption' && rule.toggleable) || rule.key === 'ToggleProperty') {
            itemToggles.push({
              itemId: item.id,
              itemName: item.name,
              ruleIndex: ruleIndex,
              ruleKey: rule.key,
              label: rule.label,
              option: rule.option,
              ...(rule.value !== undefined ? { enabled: rule.value } : {}),
              ...(rule.toggleable !== undefined ? { toggleable: rule.toggleable } : {}),
            });
          }
        });
      }

      // Also check for item-level toggles (e.g., equipped, identified)
      if (itemAny.system?.equipped !== undefined) {
        itemToggles.push({
          itemId: item.id,
          itemName: item.name,
          type: 'equipped',
          enabled: itemAny.system.equipped,
        });
      }
    });

    // Add to character data if any found
    if (itemVariants.length > 0) {
      characterData.itemVariants = itemVariants;
    }
    if (itemToggles.length > 0) {
      characterData.itemToggles = itemToggles;
    }

    // Extract spellcasting data (PF2e and D&D 5e)
    const spellcastingEntries = this.extractSpellcastingData(actor);
    if (spellcastingEntries.length > 0) {
      characterData.spellcasting = spellcastingEntries;
    }

    return characterData;
  }

  /**
   * Search within a character's items, spells, actions, and effects
   * More token-efficient than getCharacterInfo when you need specific items
   */
  async searchCharacterItems(params: {
    characterIdentifier: string;
    query?: string | undefined;
    type?: string | undefined;
    category?: string | undefined;
    limit?: number | undefined;
  }): Promise<{
    characterId: string;
    characterName: string;
    query?: string;
    type?: string;
    category?: string;
    matches: Array<{
      id: string;
      name: string;
      type: string;
      description?: string;
      // For spells
      level?: number;
      prepared?: boolean;
      expended?: boolean;
      range?: string;
      target?: string;
      area?: string;
      actionCost?: string;
      traits?: string[];
      // For items
      quantity?: number;
      equipped?: boolean;
      invested?: boolean;
      // For actions
      actionType?: string;
    }>;
    totalMatches: number;
  }> {
    this.validateFoundryState();

    const { characterIdentifier, query, type, category, limit = 20 } = params;

    // Find the actor
    const actor = this.findActorByIdentifier(characterIdentifier);
    if (!actor) {
      throw new Error(`Character not found: ${characterIdentifier}`);
    }

    const actorAny = actor as any;
    const systemId = (game.system as any).id;
    const matches: Array<any> = [];

    // Normalize search query
    const searchQuery = query?.toLowerCase().trim();
    const searchType = type?.toLowerCase().trim();
    const searchCategory = category?.toLowerCase().trim();

    // Helper to check if text matches query (safely handles non-strings)
    const matchesQuery = (text: unknown): boolean => {
      if (!searchQuery) return true;
      if (typeof text !== 'string') return false;
      return text.toLowerCase().includes(searchQuery);
    };

    // Helper to check if item matches type filter
    const matchesType = (itemType: string): boolean => {
      if (!searchType) return true;
      return itemType.toLowerCase() === searchType;
    };

    // Search items
    for (const item of actor.items) {
      const itemSystem = item.system as any;

      // Check type filter
      if (!matchesType(item.type)) continue;

      // Check query filter (name or description)
      // Ensure description is a string (could be an object in some systems)
      let description = itemSystem?.description?.value || itemSystem?.description;
      if (typeof description !== 'string') description = '';
      if (!matchesQuery(item.name) && !matchesQuery(description)) continue;

      // Build result based on item type
      const result: any = {
        id: item.id,
        name: item.name,
        type: item.type,
      };

      // Add description (truncated for token efficiency)
      if (description) {
        // Strip HTML and truncate
        const plainText = description.replace(/<[^>]*>/g, '').trim();
        result.description =
          plainText.length > 300 ? plainText.substring(0, 300) + '...' : plainText;
      }

      // Spell-specific fields
      if (item.type === 'spell') {
        result.level = itemSystem?.level?.value ?? itemSystem?.level ?? itemSystem?.rank ?? 0;
        const itemRaw = (item as any)._source?.system;
        result.prepared =
          itemSystem?.prepared ?? itemRaw?.preparation?.prepared ?? itemSystem?.location?.prepared;
        result.expended = itemSystem?.location?.expended;

        // Get targeting info
        if (systemId === 'pf2e') {
          const targeting = this.extractPF2eSpellTargeting(itemSystem);
          if (targeting.range) result.range = targeting.range;
          if (targeting.target) result.target = targeting.target;
          if (targeting.area) result.area = targeting.area;
          result.actionCost = this.formatPF2eActionCost(itemSystem?.time?.value);
          result.traits = itemSystem?.traits?.value || [];
        } else if (systemId === 'dnd5e') {
          const targeting = this.extractDnD5eSpellTargeting(itemSystem);
          if (targeting.range) result.range = targeting.range;
          if (targeting.target) result.target = targeting.target;
          if (targeting.area) result.area = targeting.area;
          result.actionCost = itemSystem?.activation?.type;
        } else if (systemId === 'dsa5') {
          const targeting = this.extractDSA5SpellTargeting(itemSystem);
          if (targeting.range) result.range = targeting.range;
          if (targeting.target) result.target = targeting.target;
          if (targeting.area) result.area = targeting.area;
          result.actionCost = itemSystem?.castingTime?.value;
        }

        // Category filter for spells
        if (searchCategory) {
          const spellLevel = result.level || 0;
          const isPrepared = result.prepared !== false;
          const isCantrip = spellLevel === 0;
          const isFocus =
            itemSystem?.traits?.value?.includes('focus') || itemSystem?.category?.value === 'focus';

          if (searchCategory === 'cantrip' && !isCantrip) continue;
          if (searchCategory === 'prepared' && !isPrepared) continue;
          if (searchCategory === 'focus' && !isFocus) continue;
        }
      }

      // Equipment-specific fields
      if (['weapon', 'armor', 'equipment', 'consumable', 'backpack', 'loot'].includes(item.type)) {
        result.quantity = itemSystem?.quantity ?? 1;
        result.equipped = itemSystem?.equipped ?? false;
        result.invested = itemSystem?.equipped?.invested ?? itemSystem?.invested ?? undefined;

        // Category filter for equipment
        if (searchCategory) {
          if (searchCategory === 'equipped' && !result.equipped) continue;
          if (searchCategory === 'invested' && !result.invested) continue;
        }
      }

      // Feat/feature fields
      if (['feat', 'feature', 'class', 'ancestry', 'heritage', 'background'].includes(item.type)) {
        if (systemId === 'pf2e') {
          result.traits = itemSystem?.traits?.value || [];
          result.level = itemSystem?.level?.value ?? undefined;
          result.actionCost = this.formatPF2eActionCost(itemSystem?.actionType?.value);
        }
      }

      // Action fields
      if (item.type === 'action') {
        if (systemId === 'pf2e') {
          result.traits = itemSystem?.traits?.value || [];
          result.actionCost = this.formatPF2eActionCost(
            itemSystem?.actionType?.value || itemSystem?.actions?.value
          );
        }
      }

      matches.push(result);

      // Stop if we've reached the limit
      if (matches.length >= limit) break;
    }

    // Also search actions if type filter includes 'action' or is empty
    if (!searchType || searchType === 'action') {
      const actions =
        actorAny.system?.actions || actorAny.items?.filter((i: any) => i.type === 'action') || [];
      for (const action of actions) {
        if (matches.length >= limit) break;

        const actionName = action.name || action.label || '';
        if (!matchesQuery(actionName)) continue;

        const result: any = {
          id: action.id || action.slug || actionName,
          name: actionName,
          type: 'action',
          actionType: action.type || action.actionType || 'action',
        };

        if (systemId === 'pf2e') {
          result.traits = action.traits || [];
          result.actionCost = this.formatPF2eActionCost(action.actionCost?.value || action.actions);
        }

        matches.push(result);
      }
    }

    // Search effects if type filter includes 'effect' or is empty
    if (!searchType || searchType === 'effect') {
      const effects = actor.effects || [];
      for (const effect of effects) {
        if (matches.length >= limit) break;

        const effectAny = effect as any;
        if (!matchesQuery(effectAny.name || effectAny.label)) continue;

        matches.push({
          id: effectAny.id,
          name: effectAny.name || effectAny.label,
          type: 'effect',
          description: effectAny.description || undefined,
        });
      }
    }

    this.auditLog(
      'searchCharacterItems',
      {
        characterId: actor.id,
        query,
        type,
        category,
        matchCount: matches.length,
      },
      'success'
    );

    const result: {
      characterId: string;
      characterName: string;
      query?: string;
      type?: string;
      category?: string;
      matches: any[];
      totalMatches: number;
    } = {
      characterId: actor.id || '',
      characterName: actor.name || '',
      matches,
      totalMatches: matches.length,
    };

    if (query) result.query = query;
    if (type) result.type = type;
    if (category) result.category = category;

    return result;
  }

  /**
   * Extract spellcasting data from an actor (supports PF2e and D&D 5e)
   */
  private extractSpellcastingData(actor: Actor): SpellcastingEntry[] {
    const entries: SpellcastingEntry[] = [];
    const actorAny = actor as any;
    const systemId = (game.system as any).id;

    // Get all spell items from the actor
    const spellItems = actor.items.filter(item => item.type === 'spell');

    if (systemId === 'pf2e') {
      // PF2e: Extract from spellcastingEntries
      const spellcastingEntries =
        actorAny.spellcasting?.contents ||
        actorAny.items?.filter((i: any) => i.type === 'spellcastingEntry') ||
        [];

      for (const entry of spellcastingEntries) {
        const entryData = entry.system || entry;
        const entrySpells: SpellInfo[] = [];

        // Get spells associated with this entry
        // In PF2e, spells have a location property pointing to their spellcasting entry
        const entryId = entry.id;
        const associatedSpells = spellItems.filter((spell: any) => {
          const spellSystem = spell.system as any;
          return spellSystem?.location?.value === entryId || spellSystem?.location === entryId;
        });

        for (const spell of associatedSpells) {
          const spellSystem = spell.system as any;
          const targeting = this.extractPF2eSpellTargeting(spellSystem);
          entrySpells.push({
            id: spell.id || '',
            name: spell.name || '',
            level: spellSystem?.level?.value ?? spellSystem?.rank ?? 0,
            prepared: spellSystem?.location?.prepared ?? true,
            expended: spellSystem?.location?.expended ?? false,
            traits: spellSystem?.traits?.value || [],
            actionCost: this.formatPF2eActionCost(spellSystem?.time?.value),
            range: targeting.range,
            target: targeting.target,
            area: targeting.area,
          });
        }

        // Also check for spells in the entry's spell collection
        if (entry.spells) {
          for (const [levelKey, levelData] of Object.entries(entry.spells as Record<string, any>)) {
            const spellsAtLevel = levelData?.value || levelData || [];
            if (Array.isArray(spellsAtLevel)) {
              for (const spellRef of spellsAtLevel) {
                // Skip if we already have this spell
                if (entrySpells.some(s => s.id === spellRef.id)) continue;

                const spellItem = actor.items.get(spellRef.id || spellRef);
                if (spellItem) {
                  const spellSystem = spellItem.system as any;
                  const targeting = this.extractPF2eSpellTargeting(spellSystem);
                  entrySpells.push({
                    id: spellItem.id || '',
                    name: spellItem.name || '',
                    level:
                      parseInt(levelKey.replace('spell', '')) || spellSystem?.level?.value || 0,
                    prepared: spellRef.prepared ?? true,
                    expended: spellRef.expended ?? false,
                    traits: spellSystem?.traits?.value || [],
                    actionCost: this.formatPF2eActionCost(spellSystem?.time?.value),
                    range: targeting.range,
                    target: targeting.target,
                    area: targeting.area,
                  });
                }
              }
            }
          }
        }

        entries.push({
          id: entry.id || '',
          name: entry.name || 'Spellcasting',
          tradition: entryData?.tradition?.value || entryData?.tradition || undefined,
          type: entryData?.prepared?.value || entryData?.prepared || 'prepared',
          ability: entryData?.ability?.value || entryData?.ability || undefined,
          dc: entryData?.spelldc?.dc || entryData?.dc?.value || undefined,
          attack: entryData?.spelldc?.value || entryData?.attack?.value || undefined,
          slots: this.extractPF2eSpellSlots(entryData),
          spells: entrySpells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
        });
      }

      // Also capture focus spells and innate spells that might not be in entries
      const focusSpells = spellItems.filter((spell: any) => {
        const spellSystem = spell.system as any;
        return (
          spellSystem?.traits?.value?.includes('focus') || spellSystem?.category?.value === 'focus'
        );
      });

      if (focusSpells.length > 0 && !entries.some(e => e.type === 'focus')) {
        entries.push({
          id: 'focus-spells',
          name: 'Focus Spells',
          type: 'focus',
          spells: focusSpells.map((spell: any) => {
            const spellSystem = spell.system as any;
            const targeting = this.extractPF2eSpellTargeting(spellSystem);
            return {
              id: spell.id || '',
              name: spell.name || '',
              level: spellSystem?.level?.value || 0,
              traits: spellSystem?.traits?.value || [],
              actionCost: this.formatPF2eActionCost(spellSystem?.time?.value),
              range: targeting.range,
              target: targeting.target,
              area: targeting.area,
            };
          }),
        });
      }
    } else if (systemId === 'dnd5e') {
      // D&D 5e: Extract from classes with spellcasting
      const classes = actor.items.filter(item => item.type === 'class');
      const spellSlots = actorAny.system?.spells || {};

      // Group spells by their source class or create a general entry
      const spellsByClass: Record<string, SpellInfo[]> = {};

      for (const spell of spellItems) {
        const spellSystem = spell.system as any;
        const spellRaw = (spell as any)._source?.system || spellSystem;
        const sourceItem = spellSystem?.sourceItem;
        const sourceClass =
          (sourceItem
            ? typeof sourceItem === 'string'
              ? sourceItem
              : sourceItem.identifier || sourceItem.id
            : spellRaw?.sourceClass) || 'general';

        if (!spellsByClass[sourceClass]) {
          spellsByClass[sourceClass] = [];
        }

        const targeting = this.extractDnD5eSpellTargeting(spellSystem);
        spellsByClass[sourceClass].push({
          id: spell.id || '',
          name: spell.name || '',
          level: spellSystem?.level || 0,
          prepared: spellSystem?.prepared ?? spellRaw?.preparation?.prepared ?? true,
          traits: [], // D&D 5e doesn't use traits the same way
          actionCost: spellSystem?.activation?.type || undefined,
          range: targeting.range,
          target: targeting.target,
          area: targeting.area,
        });
      }

      // Create entries for each spellcasting class
      for (const classItem of classes) {
        const classSystem = classItem.system as any;
        if (
          classSystem?.spellcasting?.progression &&
          classSystem.spellcasting.progression !== 'none'
        ) {
          const className = classItem.name || 'Unknown';
          const classSpells =
            spellsByClass[classItem.id || ''] || spellsByClass[className.toLowerCase()] || [];

          entries.push({
            id: classItem.id || '',
            name: `${className} Spellcasting`,
            type: classSystem?.spellcasting?.type || 'prepared',
            ability: classSystem?.spellcasting?.ability || undefined,
            slots: this.extractDnD5eSpellSlots(spellSlots),
            spells: classSpells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
          });
        }
      }

      // If no class-based entries found but we have spells, create a general entry
      if (entries.length === 0 && spellItems.length > 0) {
        const allSpells: SpellInfo[] = [];
        for (const spell of spellItems) {
          const spellSystem = spell.system as any;
          const targeting = this.extractDnD5eSpellTargeting(spellSystem);
          allSpells.push({
            id: spell.id || '',
            name: spell.name || '',
            level: spellSystem?.level || 0,
            prepared: spellSystem?.preparation?.prepared ?? true,
            actionCost: spellSystem?.activation?.type || undefined,
            range: targeting.range,
            target: targeting.target,
            area: targeting.area,
          });
        }

        entries.push({
          id: 'spellcasting',
          name: 'Spellcasting',
          type: 'prepared',
          slots: this.extractDnD5eSpellSlots(spellSlots),
          spells: allSpells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
        });
      }
    } else if (systemId === 'dsa5') {
      // DSA5: Extract Zauber (spells), Liturgien (liturgies), Zeremonien (ceremonies), Rituale (rituals)
      const astralSpells = actor.items.filter(item => item.type === 'spell');
      const karmaSpells = actor.items.filter(item => ['liturgy', 'ceremony'].includes(item.type));
      const rituals = actor.items.filter(item => item.type === 'ritual');

      // Get AsP and KaP from actor
      const asp = actorAny.system?.status?.astralenergy || actorAny.system?.astralenergy;
      const kap = actorAny.system?.status?.karmaenergy || actorAny.system?.karmaenergy;

      // Zauber (Arcane spells using AsP)
      if (astralSpells.length > 0) {
        entries.push({
          id: 'zauber',
          name: 'Zauber (Spells)',
          type: 'arcane',
          slots: asp
            ? {
                asp: { value: asp.value ?? 0, max: asp.max ?? 0 },
              }
            : undefined,
          spells: astralSpells
            .map((spell: any) => {
              const spellSystem = spell.system as any;
              const targeting = this.extractDSA5SpellTargeting(spellSystem);
              return {
                id: spell.id || '',
                name: spell.name || '',
                level: spellSystem?.level?.value ?? spellSystem?.level ?? 0,
                traits: spellSystem?.effect?.attributes || [],
                actionCost: spellSystem?.castingTime?.value || undefined,
                range: targeting.range,
                target: targeting.target,
                area: targeting.area,
              };
            })
            .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
        });
      }

      // Liturgien & Zeremonien (Divine spells using KaP)
      if (karmaSpells.length > 0) {
        entries.push({
          id: 'liturgien',
          name: 'Liturgien & Zeremonien (Liturgies)',
          type: 'divine',
          slots: kap
            ? {
                kap: { value: kap.value ?? 0, max: kap.max ?? 0 },
              }
            : undefined,
          spells: karmaSpells
            .map((spell: any) => {
              const spellSystem = spell.system as any;
              const targeting = this.extractDSA5SpellTargeting(spellSystem);
              return {
                id: spell.id || '',
                name: spell.name || '',
                level: spellSystem?.level?.value ?? spellSystem?.level ?? 0,
                traits: spellSystem?.effect?.attributes || [],
                actionCost: spellSystem?.castingTime?.value || undefined,
                range: targeting.range,
                target: targeting.target,
                area: targeting.area,
              };
            })
            .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
        });
      }

      // Rituale (Rituals - can use either AsP or KaP depending on tradition)
      if (rituals.length > 0) {
        entries.push({
          id: 'rituale',
          name: 'Rituale (Rituals)',
          type: 'ritual',
          spells: rituals
            .map((spell: any) => {
              const spellSystem = spell.system as any;
              const targeting = this.extractDSA5SpellTargeting(spellSystem);
              return {
                id: spell.id || '',
                name: spell.name || '',
                level: spellSystem?.level?.value ?? spellSystem?.level ?? 0,
                traits: spellSystem?.effect?.attributes || [],
                actionCost: spellSystem?.castingTime?.value || undefined,
                range: targeting.range,
                target: targeting.target,
                area: targeting.area,
              };
            })
            .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
        });
      }
    }

    return entries;
  }

  /**
   * Format PF2e action cost to human-readable string
   */
  private formatPF2eActionCost(actionValue: any): string | undefined {
    if (!actionValue) return undefined;
    if (typeof actionValue === 'number') {
      return actionValue === 1 ? '1 action' : `${actionValue} actions`;
    }
    if (actionValue === 'reaction') return 'reaction';
    if (actionValue === 'free') return 'free action';
    return String(actionValue);
  }

  /**
   * Extract PF2e spell slots from spellcasting entry data
   */
  private extractPF2eSpellSlots(
    entryData: any
  ): Record<string, { value: number; max: number }> | undefined {
    const slots: Record<string, { value: number; max: number }> = {};

    // PF2e stores slots per rank
    for (let rank = 1; rank <= 10; rank++) {
      const slotKey = `slot${rank}`;
      const slotData = entryData?.slots?.[slotKey] || entryData?.[slotKey];
      if (slotData && (slotData.max > 0 || slotData.value > 0)) {
        slots[`rank${rank}`] = {
          value: slotData.value ?? 0,
          max: slotData.max ?? 0,
        };
      }
    }

    return Object.keys(slots).length > 0 ? slots : undefined;
  }

  /**
   * Extract D&D 5e spell slots from actor system data
   */
  private extractDnD5eSpellSlots(
    spellsData: any
  ): Record<string, { value: number; max: number }> | undefined {
    const slots: Record<string, { value: number; max: number }> = {};

    // D&D 5e stores slots as spell1, spell2, etc.
    for (let level = 1; level <= 9; level++) {
      const slotKey = `spell${level}`;
      const slotData = spellsData?.[slotKey];
      if (slotData && (slotData.max > 0 || slotData.value > 0)) {
        slots[`level${level}`] = {
          value: slotData.value ?? 0,
          max: slotData.max ?? 0,
        };
      }
    }

    // Also check for pact slots (warlock)
    const pactSlot = spellsData?.pact;
    if (pactSlot && (pactSlot.max > 0 || pactSlot.value > 0)) {
      slots['pact'] = {
        value: pactSlot.value ?? 0,
        max: pactSlot.max ?? 0,
      };
    }

    return Object.keys(slots).length > 0 ? slots : undefined;
  }

  /**
   * Extract spell targeting info for D&D 5e
   * D&D 5e spells have: target.type ("self", "creature", "point", etc.), range.value, range.units
   */
  private extractDnD5eSpellTargeting(spellSystem: any): {
    range?: string;
    target?: string;
    area?: string;
  } {
    const result: { range?: string; target?: string; area?: string } = {};

    // Range (e.g., "60 feet", "Self", "Touch")
    const rangeValue = spellSystem?.range?.value;
    const rangeUnits = spellSystem?.range?.units;
    if (rangeUnits === 'self') {
      result.range = 'Self';
    } else if (rangeUnits === 'touch') {
      result.range = 'Touch';
    } else if (rangeUnits === 'spec') {
      result.range = spellSystem?.range?.special || 'Special';
    } else if (rangeValue && rangeUnits) {
      result.range = `${rangeValue} ${rangeUnits}`;
    }

    // Target type (e.g., "1 creature", "self", "area")
    const targetType = spellSystem?.target?.type;
    const targetValue = spellSystem?.target?.value;
    if (targetType === 'self') {
      result.target = 'self';
    } else if (targetType === 'creature' || targetType === 'ally' || targetType === 'enemy') {
      result.target = targetValue
        ? `${targetValue} ${targetType}${targetValue > 1 ? 's' : ''}`
        : targetType;
    } else if (targetType === 'object') {
      result.target = targetValue ? `${targetValue} object${targetValue > 1 ? 's' : ''}` : 'object';
    } else if (targetType === 'space' || targetType === 'point') {
      result.target = 'point';
    } else if (targetType) {
      result.target = targetType;
    }

    // Area (for AoE spells - e.g., "20-foot radius", "30-foot cone")
    const areaType = spellSystem?.target?.template?.type;
    const areaSize = spellSystem?.target?.template?.size;
    const areaUnits = spellSystem?.target?.template?.units || 'ft';
    if (areaType && areaSize) {
      result.area = `${areaSize}-${areaUnits} ${areaType}`;
      // If spell has area, target is usually "area"
      if (!result.target || result.target === 'point') {
        result.target = 'area';
      }
    }

    return result;
  }

  /**
   * Extract spell targeting info for PF2e
   * PF2e spells have: target (string), range.value, area.type, area.value
   */
  private extractPF2eSpellTargeting(spellSystem: any): {
    range?: string;
    target?: string;
    area?: string;
  } {
    const result: { range?: string; target?: string; area?: string } = {};

    // Range (e.g., "30 feet", "touch")
    const rangeValue = spellSystem?.range?.value;
    if (rangeValue) {
      result.range = String(rangeValue);
    }

    // Target (PF2e has a descriptive target string)
    const targetValue = spellSystem?.target?.value;
    if (targetValue) {
      result.target = String(targetValue);
    }

    // Area (e.g., "15-foot emanation", "30-foot cone")
    const areaType = spellSystem?.area?.type;
    const areaValue = spellSystem?.area?.value;
    if (areaType) {
      if (areaValue) {
        result.area = `${areaValue}-foot ${areaType}`;
      } else {
        result.area = areaType;
      }
      // If has area but no explicit target, it's an area spell
      if (!result.target) {
        result.target = 'area';
      }
    }

    return result;
  }

  /**
   * Extract spell targeting info for DSA5
   * DSA5 spells have: targetCategory, range, etc.
   */
  private extractDSA5SpellTargeting(spellSystem: any): {
    range?: string;
    target?: string;
    area?: string;
  } {
    const result: { range?: string; target?: string; area?: string } = {};

    // Range
    const rangeValue = spellSystem?.range?.value || spellSystem?.Reichweite;
    if (rangeValue) {
      result.range = String(rangeValue);
    }

    // Target category
    const targetCategory = spellSystem?.targetCategory?.value || spellSystem?.Zielkategorie;
    if (targetCategory) {
      result.target = String(targetCategory);
    }

    // Area (Wirkungsbereich)
    const areaValue = spellSystem?.effectRadius?.value || spellSystem?.Wirkungsbereich;
    if (areaValue) {
      result.area = String(areaValue);
    }

    return result;
  }

  /**
   * Search compendium packs for items matching query with optional filters
   */
  async searchCompendium(
    query: string,
    packType?: string,
    filters?: {
      challengeRating?: number | { min?: number; max?: number };
      creatureType?: string;
      size?: string;
      alignment?: string;
      hasLegendaryActions?: boolean;
      spellcaster?: boolean;
    }
  ): Promise<CompendiumSearchResult[]> {
    // Add defensive checks for query parameter
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      throw new Error('Search query must be a string with at least 2 characters');
    }

    // ENHANCED SEARCH: If we have creature-specific filters and Actor packType, use enhanced index
    if (
      filters &&
      packType === 'Actor' &&
      (filters.challengeRating || filters.creatureType || filters.hasLegendaryActions)
    ) {
      // Check if enhanced creature index is enabled
      const enhancedIndexEnabled = game.settings.get(this.moduleId, 'enableEnhancedCreatureIndex');

      if (enhancedIndexEnabled) {
        try {
          // Convert search criteria and use enhanced search
          const criteria: any = { limit: 100 }; // Default limit for search

          if (filters.challengeRating) criteria.challengeRating = filters.challengeRating;
          if (filters.creatureType) criteria.creatureType = filters.creatureType;
          if (filters.size) criteria.size = filters.size;
          if (filters.hasLegendaryActions)
            criteria.hasLegendaryActions = filters.hasLegendaryActions;

          const enhancedResult = await this.listCreaturesByCriteria(criteria);

          // No name filtering needed - trust the enhanced creature index!
          const filteredResults = enhancedResult.creatures;

          // Convert to CompendiumSearchResult format
          return filteredResults.map(
            creature =>
              ({
                id: creature.id || creature.name,
                name: creature.name,
                type: creature.type || 'npc',
                pack: creature.pack,
                packLabel: creature.packLabel || creature.pack,
                description: creature.description || '',
                hasImage: creature.hasImage || !!creature.img,
                summary: `CR ${creature.challengeRating} ${creature.creatureType} from ${creature.packLabel}`,
                // Enhanced data (not part of interface but will be included)
                challengeRating: creature.challengeRating,
                creatureType: creature.creatureType,
                size: creature.size,
                hasLegendaryActions: creature.hasLegendaryActions,
              }) as CompendiumSearchResult & {
                challengeRating: number;
                creatureType: string;
                size: string;
                hasLegendaryActions: boolean;
              }
          );
        } catch (error) {
          console.warn(
            `[${this.moduleId}] Enhanced search failed, falling back to basic search:`,
            error
          );
          // Continue to basic search below
        }
      }
    }

    const results: CompendiumSearchResult[] = [];
    const cleanQuery = query.toLowerCase().trim();
    const searchTerms = cleanQuery
      .split(' ')
      .filter(term => term && typeof term === 'string' && term.length > 0);

    if (searchTerms.length === 0) {
      throw new Error('Search query must contain valid search terms');
    }

    // Filter packs by type if specified
    const packs = Array.from(game.packs.values()).filter(pack => {
      if (packType && pack.metadata.type !== packType) {
        return false;
      }
      return pack.metadata.type !== 'Scene'; // Exclude scene packs for safety
    });

    for (const pack of packs) {
      try {
        // Ensure pack index is loaded
        if (!pack.indexed) {
          await pack.getIndex({});
        }

        // Use basic compendium index for all searches
        const entriesToSearch = Array.from(pack.index.values());

        for (const entry of entriesToSearch) {
          try {
            // Type assertion and comprehensive safety checks for entry properties
            const typedEntry = entry as any;
            if (
              !typedEntry ||
              !typedEntry.name ||
              typeof typedEntry.name !== 'string' ||
              typedEntry.name.trim().length === 0
            ) {
              continue;
            }

            // Ensure searchTerms are valid before using them
            if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) {
              continue;
            }

            // Use already created typedEntry

            const entryNameLower = typedEntry.name.toLowerCase();
            const nameMatch = searchTerms.every(term => {
              if (!term || typeof term !== 'string') {
                return false;
              }
              return entryNameLower.includes(term);
            });

            if (nameMatch) {
              // For Actor packs with filters, use simple name/description matching
              if (
                filters &&
                this.shouldApplyFilters(entry, filters) &&
                pack.metadata.type === 'Actor'
              ) {
                // Convert filters to search criteria for compatibility
                const searchCriteria: any = {};

                if (filters.challengeRating) {
                  const searchTerms = [];
                  if (typeof filters.challengeRating === 'number') {
                    if (filters.challengeRating >= 15) {
                      searchTerms.push('ancient', 'legendary', 'elder', 'greater');
                    } else if (filters.challengeRating >= 10) {
                      searchTerms.push('adult', 'warlord', 'champion', 'master');
                    } else if (filters.challengeRating >= 5) {
                      searchTerms.push('captain', 'knight', 'priest', 'mage');
                    } else {
                      searchTerms.push('guard', 'soldier', 'warrior', 'scout');
                    }
                  }
                  searchCriteria.searchTerms = searchTerms;
                }

                if (filters.creatureType) {
                  const typeTerms = [filters.creatureType];
                  if (filters.creatureType.toLowerCase() === 'humanoid') {
                    typeTerms.push('human', 'elf', 'dwarf', 'orc', 'goblin');
                  }
                  searchCriteria.searchTerms = [
                    ...(searchCriteria.searchTerms || []),
                    ...typeTerms,
                  ];
                }

                if (!this.matchesSearchCriteria(typedEntry, searchCriteria)) {
                  continue;
                }
              }

              // Standard index entry result
              results.push({
                id: typedEntry._id || '',
                name: typedEntry.name,
                type: typedEntry.type || 'unknown',
                img: typedEntry.img || undefined,
                pack: pack.metadata.id,
                packLabel: pack.metadata.label,
                description: typedEntry.description || '',
                hasImage: !!typedEntry.img,
                summary: `${typedEntry.type} from ${pack.metadata.label}`,
              });
            }
          } catch (entryError) {
            // Log individual entry errors but continue processing
            console.warn(
              `[${this.moduleId}] Error processing entry in pack ${pack.metadata.id}:`,
              entryError
            );
            continue;
          }

          // Limit results per pack to prevent overwhelming responses
          if (results.length >= 100) break;
        }
      } catch (error) {
        console.warn(`[${this.moduleId}] Failed to search pack ${pack.metadata.id}:`, error);
      }

      // Global limit to prevent memory issues
      if (results.length >= 100) break;
    }

    // Sort results by relevance with enhanced ranking for filtered searches
    results.sort((a, b) => {
      // Exact name matches first
      const aExact = a.name.toLowerCase() === query.toLowerCase();
      const bExact = b.name.toLowerCase() === query.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // If filters are used, prioritize by filter match quality
      if (filters) {
        const aScore = this.calculateRelevanceScore(a, filters, query);
        const bScore = this.calculateRelevanceScore(b, filters, query);
        if (aScore !== bScore) return bScore - aScore; // Higher score first
      }

      // Fallback to alphabetical
      return a.name.localeCompare(b.name);
    });

    return results.slice(0, 50); // Final limit
  }

  /**
   * Check if filters should be applied to this entry
   */
  private shouldApplyFilters(entry: any, filters: any): boolean {
    // Only apply filters to Actor entries (which includes NPCs/monsters/creatures)
    if (entry.type !== 'npc' && entry.type !== 'character' && entry.type !== 'creature') {
      return false;
    }

    // Check if any filters are actually specified
    return Object.keys(filters).some(key => filters[key] !== undefined);
  }

  /**
   * Check if entry passes all specified filters
   * @unused - Replaced with simple index-only approach
   */
  // @ts-ignore - Unused method kept for compatibility
  private passesFilters(
    entry: any,
    filters: {
      challengeRating?: number | { min?: number; max?: number };
      creatureType?: string;
      size?: string;
      alignment?: string;
      hasLegendaryActions?: boolean;
      spellcaster?: boolean;
    }
  ): boolean {
    const system = entry.system || {};

    // Challenge Rating filter
    if (filters.challengeRating !== undefined) {
      // Try multiple possible CR locations in D&D 5e data structure
      let entryCR =
        system.details?.cr?.value || system.details?.cr || system.cr?.value || system.cr || 0;

      // Handle fractional CRs (common in D&D 5e)
      if (typeof entryCR === 'string') {
        if (entryCR === '1/8') entryCR = 0.125;
        else if (entryCR === '1/4') entryCR = 0.25;
        else if (entryCR === '1/2') entryCR = 0.5;
        else entryCR = parseFloat(entryCR) || 0;
      }

      if (typeof filters.challengeRating === 'number') {
        // Exact CR match
        if (entryCR !== filters.challengeRating) {
          return false;
        }
      } else if (typeof filters.challengeRating === 'object') {
        // CR range
        const { min, max } = filters.challengeRating;
        if (min !== undefined && entryCR < min) {
          return false;
        }
        if (max !== undefined && entryCR > max) {
          return false;
        }
      }
    }

    // Creature Type filter
    if (filters.creatureType) {
      const entryType = system.details?.type?.value || system.type?.value || '';
      if (entryType.toLowerCase() !== filters.creatureType.toLowerCase()) {
        return false;
      }
    }

    // Size filter
    if (filters.size) {
      const entrySize = system.traits?.size || system.size || '';
      if (entrySize.toLowerCase() !== filters.size.toLowerCase()) {
        return false;
      }
    }

    // Alignment filter
    if (filters.alignment) {
      const entryAlignment = system.details?.alignment || system.alignment || '';
      if (!entryAlignment.toLowerCase().includes(filters.alignment.toLowerCase())) {
        return false;
      }
    }

    // Legendary Actions filter
    if (filters.hasLegendaryActions !== undefined) {
      const hasLegendary = !!(
        system.resources?.legact ||
        system.legendary ||
        (system.resources?.legres && system.resources.legres.value > 0)
      );
      if (hasLegendary !== filters.hasLegendaryActions) {
        return false;
      }
    }

    // Spellcaster filter
    if (filters.spellcaster !== undefined) {
      const isSpellcaster = !!(
        system.spells ||
        system.attributes?.spellcasting ||
        (system.details?.spellLevel && system.details.spellLevel > 0)
      );
      if (isSpellcaster !== filters.spellcaster) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate relevance score for search result ranking
   */
  private calculateRelevanceScore(entry: any, filters: any, query: string): number {
    let score = 0;
    const system = entry.system || {};

    // Bonus for creature type match (high importance for encounter building)
    if (filters.creatureType) {
      const entryType = system.details?.type?.value || system.type?.value || '';
      if (entryType.toLowerCase() === filters.creatureType.toLowerCase()) {
        score += 20;
      }
    }

    // Bonus for CR match (exact match gets higher score than range)
    if (filters.challengeRating !== undefined) {
      const entryCR = system.details?.cr || system.cr || 0;
      if (typeof filters.challengeRating === 'number') {
        if (entryCR === filters.challengeRating) score += 15;
      } else if (typeof filters.challengeRating === 'object') {
        const { min, max } = filters.challengeRating;
        if (min !== undefined && max !== undefined) {
          // Bonus for being in range, extra for being in middle of range
          if (entryCR >= min && entryCR <= max) {
            score += 10;
            const rangeMid = (min + max) / 2;
            const distFromMid = Math.abs(entryCR - rangeMid);
            score += Math.max(0, 5 - distFromMid); // Up to 5 bonus for being near middle
          }
        }
      }
    }

    // Bonus for common creature names (better for encounters)
    const commonNames = [
      'knight',
      'warrior',
      'guard',
      'soldier',
      'mage',
      'priest',
      'bandit',
      'orc',
      'goblin',
      'dragon',
    ];
    const lowerName = entry.name.toLowerCase();
    if (commonNames.some(name => lowerName.includes(name))) {
      score += 5;
    }

    // Bonus for query term matches in name
    const queryTerms = query.toLowerCase().split(' ');
    for (const term of queryTerms) {
      if (term.length > 2 && lowerName.includes(term)) {
        score += 3;
      }
    }

    return score;
  }

  /**
   * List creatures by criteria using enhanced persistent index - optimized for instant filtering
   */
  async listCreaturesByCriteria(criteria: {
    challengeRating?: number | { min?: number; max?: number };
    creatureType?: string;
    size?: string;
    hasSpells?: boolean;
    hasLegendaryActions?: boolean;
    limit?: number;
  }): Promise<{ creatures: any[]; searchSummary: any }> {
    const limit = criteria.limit || 500;

    // Check if enhanced creature index is enabled
    const enhancedIndexEnabled = game.settings.get(this.moduleId, 'enableEnhancedCreatureIndex');

    if (!enhancedIndexEnabled) {
      return this.fallbackBasicCreatureSearch(criteria, limit);
    }

    try {
      // Get enhanced creature index (builds if needed)
      const enhancedCreatures = await this.persistentIndex.getEnhancedIndex();

      // Apply filters to enhanced data
      let filteredCreatures = enhancedCreatures.filter(creature =>
        this.passesEnhancedCriteria(creature, criteria)
      );

      // Sort by power level then name for consistent ordering (system-aware).
      // Power-level dial: tier (cosmere), level (pf2e), challengeRating (dnd5e).
      const powerLevel = (c: EnhancedCreatureIndex): number => {
        if ('tier' in c) return (c as CosmereRpgCreatureIndex).tier;
        if ('level' in c) return (c as PF2eCreatureIndex).level;
        return (c as DnD5eCreatureIndex).challengeRating;
      };
      filteredCreatures.sort((a, b) => {
        const powerA = powerLevel(a);
        const powerB = powerLevel(b);
        if (powerA !== powerB) return powerA - powerB;
        return a.name.localeCompare(b.name);
      });

      // Apply limit
      if (filteredCreatures.length > limit) {
        filteredCreatures = filteredCreatures.slice(0, limit);
      }

      // Convert enhanced creatures to result format (system-aware)
      const results = filteredCreatures.map(creature => {
        const isCosmere = 'tier' in creature;
        const isPF2e = !isCosmere && 'level' in creature;

        const base = {
          id: creature.id,
          name: creature.name,
          type: creature.type,
          pack: creature.pack,
          packLabel: creature.packLabel,
          description: creature.description || '',
          hasImage: !!creature.img,
          creatureType: creature.creatureType,
          size: creature.size,
          hitPoints: creature.hitPoints,
        };

        if (isCosmere) {
          const c = creature as CosmereRpgCreatureIndex;
          return {
            ...base,
            summary: `Tier ${c.tier} ${c.role} ${c.creatureType} from ${c.packLabel}`,
            tier: c.tier,
            role: c.role,
            subtype: c.subtype,
            focus: c.focus,
            investiture: c.investiture,
            hasInvestiture: c.hasInvestiture,
            defenses: {
              physical: c.defensePhysical,
              cognitive: c.defenseCognitive,
              spiritual: c.defenseSpiritual,
            },
            deflect: c.deflect,
            walkSpeed: c.walkSpeed,
          };
        }

        if (isPF2e) {
          const p = creature as PF2eCreatureIndex;
          return {
            ...base,
            armorClass: p.armorClass,
            hasSpells: p.hasSpells,
            alignment: p.alignment,
            summary: `Level ${p.level} ${p.creatureType} (${p.rarity}) from ${p.packLabel}`,
            level: p.level,
            traits: p.traits,
            rarity: p.rarity,
          };
        }

        const d = creature as DnD5eCreatureIndex;
        return {
          ...base,
          armorClass: d.armorClass,
          hasSpells: d.hasSpells,
          alignment: d.alignment,
          summary: `CR ${d.challengeRating} ${d.creatureType} from ${d.packLabel}`,
          challengeRating: d.challengeRating,
          hasLegendaryActions: d.hasLegendaryActions,
        };
      });

      // Calculate pack distribution for summary
      const packResults = new Map();
      results.forEach(creature => {
        const count = packResults.get(creature.packLabel) || 0;
        packResults.set(creature.packLabel, count + 1);
      });

      // Get unique pack information
      const uniquePacks = Array.from(new Set(enhancedCreatures.map(c => c.pack)));
      const topPacks = uniquePacks.slice(0, 5).map(packId => {
        const sampleCreature = enhancedCreatures.find(c => c.pack === packId);
        return {
          id: packId,
          label: sampleCreature?.packLabel || 'Unknown Pack',
          priority: 100, // All packs are prioritized equally in enhanced index
        };
      });

      if (packResults.size > 0) {
      }

      return {
        creatures: results,
        searchSummary: {
          packsSearched: uniquePacks.length,
          topPacks,
          totalCreaturesFound: results.length,
          resultsByPack: Object.fromEntries(packResults),
          criteria: criteria,
          indexMetadata: {
            totalIndexedCreatures: enhancedCreatures.length,
            searchMethod: 'enhanced_persistent_index',
          },
        },
      };
    } catch (error) {
      console.error(`[${this.moduleId}] Enhanced creature search failed:`, error);
      // Fallback to basic search if enhanced index fails
      return this.fallbackBasicCreatureSearch(criteria, limit);
    }
  }

  /**
   * Check if enhanced creature passes all specified criteria (system-aware routing).
   *
   * Discriminator order matters: cosmere-rpg has a `tier` field, pf2e has
   * `level`, dnd5e has `challengeRating`. Check cosmere first (tier is the
   * narrowest signal), then pf2e, then fall through to dnd5e.
   */
  private passesEnhancedCriteria(creature: EnhancedCreatureIndex, criteria: any): boolean {
    if ('tier' in creature) {
      return this.passesCosmereRpgCriteria(creature as CosmereRpgCreatureIndex, criteria);
    }
    if ('level' in creature) {
      return this.passesPF2eCriteria(creature as PF2eCreatureIndex, criteria);
    }
    return this.passesDnD5eCriteria(creature as DnD5eCreatureIndex, criteria);
  }

  /**
   * Cosmere RPG criteria filter — tier, role, creatureType, size,
   * hasInvestiture, hitPoints range, defenses minimums, deflect minimum.
   */
  private passesCosmereRpgCriteria(
    creature: CosmereRpgCreatureIndex,
    criteria: {
      tier?: number | { min?: number; max?: number };
      role?: string;
      creatureType?: string;
      size?: string;
      hasInvestiture?: boolean;
      hitPoints?: number | { min?: number; max?: number };
      health?: number | { min?: number; max?: number };
      defensesMin?: { phy?: number; cog?: number; spi?: number };
      deflectMin?: number;
    }
  ): boolean {
    if (criteria.tier !== undefined) {
      if (typeof criteria.tier === 'number') {
        if (creature.tier !== criteria.tier) return false;
      } else {
        const { min, max } = criteria.tier;
        if (min !== undefined && creature.tier < min) return false;
        if (max !== undefined && creature.tier > max) return false;
      }
    }

    if (criteria.role && creature.role.toLowerCase() !== criteria.role.toLowerCase()) {
      return false;
    }

    if (
      criteria.creatureType &&
      creature.creatureType.toLowerCase() !== criteria.creatureType.toLowerCase()
    ) {
      return false;
    }

    if (criteria.size && creature.size.toLowerCase() !== criteria.size.toLowerCase()) {
      return false;
    }

    if (
      criteria.hasInvestiture !== undefined &&
      creature.hasInvestiture !== criteria.hasInvestiture
    ) {
      return false;
    }

    // Accept either `hitPoints` or `health` from callers — they're synonyms
    // here (hitPoints is the cross-system convention; health is the cosmere-
    // native term).
    const hpRange = criteria.hitPoints ?? criteria.health;
    if (hpRange !== undefined) {
      if (typeof hpRange === 'number') {
        if (creature.hitPoints !== hpRange) return false;
      } else {
        const { min, max } = hpRange;
        if (min !== undefined && creature.hitPoints < min) return false;
        if (max !== undefined && creature.hitPoints > max) return false;
      }
    }

    if (criteria.defensesMin) {
      const { phy, cog, spi } = criteria.defensesMin;
      if (phy !== undefined && creature.defensePhysical < phy) return false;
      if (cog !== undefined && creature.defenseCognitive < cog) return false;
      if (spi !== undefined && creature.defenseSpiritual < spi) return false;
    }

    if (criteria.deflectMin !== undefined && creature.deflect < criteria.deflectMin) {
      return false;
    }

    return true;
  }

  /**
   * Check if D&D 5e creature passes all specified criteria
   */
  private passesDnD5eCriteria(
    creature: DnD5eCreatureIndex,
    criteria: {
      challengeRating?: number | { min?: number; max?: number };
      creatureType?: string;
      size?: string;
      hasSpells?: boolean;
      hasLegendaryActions?: boolean;
    }
  ): boolean {
    // Challenge Rating filter
    if (criteria.challengeRating !== undefined) {
      if (typeof criteria.challengeRating === 'number') {
        if (creature.challengeRating !== criteria.challengeRating) {
          return false;
        }
      } else if (typeof criteria.challengeRating === 'object') {
        const { min, max } = criteria.challengeRating;
        if (min !== undefined && creature.challengeRating < min) {
          return false;
        }
        if (max !== undefined && creature.challengeRating > max) {
          return false;
        }
      }
    }

    // Creature Type filter
    if (criteria.creatureType) {
      if (creature.creatureType.toLowerCase() !== criteria.creatureType.toLowerCase()) {
        return false;
      }
    }

    // Size filter
    if (criteria.size) {
      if (creature.size.toLowerCase() !== criteria.size.toLowerCase()) {
        return false;
      }
    }

    // Spellcaster filter
    if (criteria.hasSpells !== undefined) {
      if (creature.hasSpells !== criteria.hasSpells) {
        return false;
      }
    }

    // Legendary Actions filter
    if (criteria.hasLegendaryActions !== undefined) {
      if (creature.hasLegendaryActions !== criteria.hasLegendaryActions) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if PF2e creature passes all specified criteria
   */
  private passesPF2eCriteria(
    creature: PF2eCreatureIndex,
    criteria: {
      level?: number | { min?: number; max?: number };
      traits?: string[];
      rarity?: string;
      creatureType?: string;
      size?: string;
      hasSpells?: boolean;
    }
  ): boolean {
    // Level filter
    if (criteria.level !== undefined) {
      if (typeof criteria.level === 'number') {
        if (creature.level !== criteria.level) {
          return false;
        }
      } else if (typeof criteria.level === 'object') {
        const { min = -1, max = 25 } = criteria.level;
        if (creature.level < min || creature.level > max) {
          return false;
        }
      }
    }

    // Traits filter (creature must have ALL specified traits)
    if (criteria.traits && criteria.traits.length > 0) {
      const hasAllTraits = criteria.traits.every(requiredTrait =>
        creature.traits.some(t => t.toLowerCase() === requiredTrait.toLowerCase())
      );
      if (!hasAllTraits) {
        return false;
      }
    }

    // Rarity filter
    if (criteria.rarity && creature.rarity !== criteria.rarity) {
      return false;
    }

    // Creature type filter
    if (
      criteria.creatureType &&
      creature.creatureType.toLowerCase() !== criteria.creatureType.toLowerCase()
    ) {
      return false;
    }

    // Size filter
    if (criteria.size && creature.size.toLowerCase() !== criteria.size.toLowerCase()) {
      return false;
    }

    // Spellcasting filter
    if (criteria.hasSpells !== undefined && creature.hasSpells !== criteria.hasSpells) {
      return false;
    }

    return true;
  }

  /**
   * Fallback to basic creature search if enhanced index fails
   */
  private async fallbackBasicCreatureSearch(
    criteria: any,
    limit: number
  ): Promise<{ creatures: any[]; searchSummary: any }> {
    console.warn(`[${this.moduleId}] Falling back to basic search due to enhanced index failure`);

    // Use a simple text-based search as fallback
    const searchTerms: string[] = [];

    if (criteria.creatureType) {
      searchTerms.push(criteria.creatureType);
    }

    if (criteria.challengeRating) {
      if (typeof criteria.challengeRating === 'number') {
        // Add CR-based name patterns as fallback
        if (criteria.challengeRating >= 15) searchTerms.push('ancient', 'legendary');
        else if (criteria.challengeRating >= 10) searchTerms.push('adult', 'champion');
        else if (criteria.challengeRating >= 5) searchTerms.push('captain', 'knight');
      }
    }

    const searchQuery = searchTerms.join(' ') || 'monster';
    const basicResults = await this.searchCompendium(searchQuery, 'Actor');

    return {
      creatures: basicResults.slice(0, limit),
      searchSummary: {
        packsSearched: 0,
        topPacks: [],
        totalCreaturesFound: basicResults.length,
        resultsByPack: {},
        criteria: criteria,
        fallback: true,
        searchMethod: 'basic_fallback',
      },
    };
  }

  /**
   * Prioritize compendium packs by likelihood of containing relevant creatures
   * @unused - Replaced by enhanced persistent index system
   */
  // @ts-ignore - Unused method kept for compatibility
  private prioritizePacksForCreatures(packs: any[]): any[] {
    const priorityOrder = [
      // Tier 1: Core D&D 5e content (highest priority)
      { pattern: /^dnd5e\.monsters/, priority: 100 }, // Core D&D 5e monsters
      { pattern: /^dnd5e\.actors/, priority: 95 }, // Core D&D 5e actors
      { pattern: /ddb.*monsters/i, priority: 90 }, // D&D Beyond monsters

      // Tier 2: Official modules and supplements
      { pattern: /^world\..*ddb.*monsters/i, priority: 85 }, // World-specific DDB monsters
      { pattern: /monsters/i, priority: 80 }, // Any pack with "monsters"

      // Tier 3: Campaign and adventure content
      { pattern: /^world\.(?!.*summon|.*hero)/i, priority: 70 }, // World packs (not summons/heroes)

      // Tier 4: Specialized content
      { pattern: /summon|familiar/i, priority: 40 }, // Summons and familiars

      // Tier 5: Unlikely to contain monsters (lowest priority)
      { pattern: /hero|player|pc/i, priority: 10 }, // Player characters
    ];

    return packs.sort((a, b) => {
      const aScore = this.getPackPriority(a.metadata.id, a.metadata.label, priorityOrder);
      const bScore = this.getPackPriority(b.metadata.id, b.metadata.label, priorityOrder);

      if (aScore !== bScore) {
        return bScore - aScore; // Higher score first
      }

      // Secondary sort by pack label alphabetically
      return a.metadata.label.localeCompare(b.metadata.label);
    });
  }

  /**
   * Get priority score for a pack based on ID and label
   */
  private getPackPriority(
    packId: string,
    packLabel: string,
    priorityOrder: { pattern: RegExp; priority: number }[]
  ): number {
    for (const rule of priorityOrder) {
      if (rule.pattern.test(packId) || rule.pattern.test(packLabel)) {
        return rule.priority;
      }
    }
    // Default priority for unmatched packs
    return 50;
  }

  /**
   * Check if creature entry passes the given criteria
   * @unused - Legacy method replaced by passesEnhancedCriteria
   */
  // @ts-ignore - Legacy method kept for compatibility
  private passesCriteria(
    entry: any,
    criteria: {
      challengeRating?: number | { min?: number; max?: number };
      creatureType?: string;
      size?: string;
      hasSpells?: boolean;
      hasLegendaryActions?: boolean;
    }
  ): boolean {
    const system = entry.system || {};

    // Challenge Rating filter - enhanced extraction
    if (criteria.challengeRating !== undefined) {
      // Try multiple possible CR locations in D&D 5e data structure
      let entryCR =
        system.details?.cr?.value || system.details?.cr || system.cr?.value || system.cr || 0;

      // Handle fractional CRs (common in D&D 5e)
      if (typeof entryCR === 'string') {
        if (entryCR === '1/8') entryCR = 0.125;
        else if (entryCR === '1/4') entryCR = 0.25;
        else if (entryCR === '1/2') entryCR = 0.5;
        else entryCR = parseFloat(entryCR) || 0;
      }

      if (typeof criteria.challengeRating === 'number') {
        if (entryCR !== criteria.challengeRating) {
          return false;
        }
      } else if (typeof criteria.challengeRating === 'object') {
        const { min = 0, max = 30 } = criteria.challengeRating;
        if (entryCR < min || entryCR > max) {
          return false;
        }
      }
    }

    // Creature Type filter - enhanced extraction
    if (criteria.creatureType) {
      // Try multiple possible type locations in D&D 5e data structure
      const entryType =
        system.details?.type?.value ||
        system.details?.type ||
        system.type?.value ||
        system.type ||
        '';
      if (entryType.toLowerCase() !== criteria.creatureType.toLowerCase()) {
        return false;
      }
    }

    // Size filter
    if (criteria.size) {
      const entrySize = system.traits?.size || system.size || '';
      if (entrySize.toLowerCase() !== criteria.size.toLowerCase()) return false;
    }

    // Spellcaster filter
    if (criteria.hasSpells !== undefined) {
      const isSpellcaster = !!(
        system.spells ||
        system.attributes?.spellcasting ||
        (system.details?.spellLevel && system.details.spellLevel > 0)
      );
      if (isSpellcaster !== criteria.hasSpells) return false;
    }

    // Legendary Actions filter
    if (criteria.hasLegendaryActions !== undefined) {
      const hasLegendary = !!(
        system.resources?.legact ||
        system.legendary ||
        (system.resources?.legres && system.resources.legres.value > 0)
      );
      if (hasLegendary !== criteria.hasLegendaryActions) return false;
    }

    return true;
  }

  /**
   * Simple name/description-based matching for creatures using index data only
   */
  private matchesSearchCriteria(
    entry: any,
    criteria: {
      searchTerms?: string[];
      excludeTerms?: string[];
      size?: string;
      hasSpells?: boolean;
      hasLegendaryActions?: boolean;
    }
  ): boolean {
    const name = (entry.name || '').toLowerCase();
    const description = (entry.description || '').toLowerCase();
    const searchText = `${name} ${description}`;

    // Include terms - at least one must match
    if (criteria.searchTerms && criteria.searchTerms.length > 0) {
      const hasMatch = criteria.searchTerms.some(term => searchText.includes(term.toLowerCase()));
      if (!hasMatch) {
        return false;
      }
    }

    // Exclude terms - none should match
    if (criteria.excludeTerms && criteria.excludeTerms.length > 0) {
      const hasExcluded = criteria.excludeTerms.some(term =>
        searchText.includes(term.toLowerCase())
      );
      if (hasExcluded) {
        return false;
      }
    }

    return true;
  }

  /**
   * List all actors with basic information
   */
  async listActors(): Promise<Array<{ id: string; name: string; type: string; img?: string }>> {
    return game.actors.map(actor => ({
      id: actor.id || '',
      name: actor.name || '',
      type: actor.type,
      ...(actor.img ? { img: actor.img } : {}),
    }));
  }

  /**
   * Get active scene information
   */
  async getActiveScene(): Promise<SceneInfo> {
    const scene = (game.scenes as any).current;
    if (!scene) {
      throw new Error(ERROR_MESSAGES.SCENE_NOT_FOUND);
    }

    const sceneData: SceneInfo = {
      id: scene.id,
      name: scene.name,
      img: scene.img || undefined,
      background: scene._source?.background?.src || undefined,
      width: scene.width,
      height: scene.height,
      padding: scene.padding,
      active: scene.active,
      navigation: scene.navigation,
      tokens: scene.tokens.map((token: any) => ({
        id: token.id,
        name: token.name,
        x: token.x,
        y: token.y,
        width: token.width,
        height: token.height,
        actorId: token.actorId || undefined,
        img: token.texture?.src || '',
        hidden: token.hidden,
        disposition: this.getTokenDisposition(token.disposition),
      })),
      walls: scene.walls.size,
      lights: scene.lights.size,
      sounds: scene.sounds.size,
      notes: scene.notes.map((note: any) => ({
        id: note.id,
        text: note.text || '',
        x: note.x,
        y: note.y,
      })),
    };

    return sceneData;
  }

  /**
   * Get world information
   */
  async getWorldInfo(): Promise<WorldInfo> {
    // World info doesn't require special permissions as it's basic metadata

    return {
      id: game.world.id,
      title: game.world.title,
      system: game.system.id,
      systemVersion: game.system.version,
      foundryVersion: game.version,
      users: game.users.map(user => ({
        id: user.id || '',
        name: user.name || '',
        active: user.active,
        isGM: user.isGM,
      })),
    };
  }

  /**
   * Get available compendium packs
   */
  async getAvailablePacks() {
    return Array.from(game.packs.values()).map(pack => ({
      id: pack.metadata.id,
      label: pack.metadata.label,
      type: pack.metadata.type,
      system: pack.metadata.system,
      private: pack.metadata.private,
    }));
  }

  /**
   * Sanitize data to remove sensitive information and make it JSON-safe
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    try {
      // removeSensitiveFields now returns a sanitized copy
      const sanitized = this.removeSensitiveFields(data);

      // Use custom JSON serializer to avoid deprecated property warnings
      const jsonString = this.safeJSONStringify(sanitized);
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn(`[${this.moduleId}] Failed to sanitize data:`, error);
      return {};
    }
  }

  /**
   * Remove sensitive fields from data object with circular reference protection
   * Returns a sanitized copy instead of modifying the original
   */
  private removeSensitiveFields(
    obj: any,
    visited: WeakSet<object> = new WeakSet(),
    depth: number = 0
  ): any {
    // Handle primitives
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Safety depth limit to prevent extremely deep recursion
    if (depth > 50) {
      console.warn(`[${this.moduleId}] Sanitization depth limit reached at depth ${depth}`);
      return '[Max depth reached]';
    }

    // Check for circular reference
    if (visited.has(obj)) {
      return '[Circular Reference]';
    }

    // Mark this object as visited
    visited.add(obj);

    try {
      // Handle arrays
      if (Array.isArray(obj)) {
        return obj.map(item => this.removeSensitiveFields(item, visited, depth + 1));
      }

      // Create a new sanitized object
      const sanitized: any = {};

      // Use Object.keys (does not invoke getters) so we can filter deprecated
      // accessor properties before reading their values.
      const keys = Object.keys(obj);

      // dnd5e 5.3 moved senses.darkvision/blindsight/tremorsense/truesight to
      // senses.ranges.*. The legacy keys remain as deprecated getters that
      // log a warning when read. Detect this shape and skip the legacy keys.
      const DEPRECATED_DND5E_SENSE_KEYS = ['darkvision', 'blindsight', 'tremorsense', 'truesight'];
      const isDnd5eSensesShape =
        keys.includes('ranges') && keys.some(k => DEPRECATED_DND5E_SENSE_KEYS.includes(k));

      for (const key of keys) {
        // Skip sensitive and problematic fields entirely
        if (this.isSensitiveOrProblematicField(key)) {
          continue;
        }

        // Skip most private properties except essential ones.
        // _stats (Foundry document audit metadata) and _source (raw stored data
        // duplicate) are bloat in tool output; we keep only _id.
        if (key.startsWith('_') && key !== '_id') {
          continue;
        }

        if (isDnd5eSensesShape && DEPRECATED_DND5E_SENSE_KEYS.includes(key)) {
          continue;
        }

        // Recursively sanitize the value (read only after filter to avoid getter-triggered warnings)
        sanitized[key] = this.removeSensitiveFields((obj as any)[key], visited, depth + 1);
      }

      return sanitized;
    } catch (error) {
      console.warn(`[${this.moduleId}] Error during sanitization at depth ${depth}:`, error);
      return '[Sanitization failed]';
    }
  }

  /**
   * Check if a field should be excluded from sanitized output
   */
  private isSensitiveOrProblematicField(key: string): boolean {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'credential',
      'session',
      'cookie',
      'private',
    ];

    const problematicKeys = [
      'parent',
      '_parent',
      'collection',
      'apps',
      'document',
      '_document',
      'constructor',
      'prototype',
      '__proto__',
      'valueOf',
      'toString',
      // dnd5e item leveling metadata; full of cycles back to the actor and other items.
      // Not gameplay-relevant for LLM consumers.
      'advancement',
    ];

    // Skip deprecated ability save properties that trigger warnings
    const deprecatedKeys = [
      'save', // Skip the deprecated 'save' property on abilities
    ];

    return (
      sensitiveKeys.includes(key) || problematicKeys.includes(key) || deprecatedKeys.includes(key)
    );
  }

  /**
   * Custom JSON serializer that handles Foundry objects safely
   */
  private safeJSONStringify(obj: any): string {
    try {
      return JSON.stringify(obj, (key, value) => {
        // Skip deprecated properties during JSON serialization
        if (key === 'save' && typeof value === 'object' && value !== null) {
          // If this looks like a deprecated ability save object, skip it
          return undefined;
        }
        return value;
      });
    } catch (error) {
      console.warn(`[${this.moduleId}] JSON stringify failed, using fallback:`, error);
      return '{}';
    }
  }

  /**
   * Get token disposition as number
   */
  private getTokenDisposition(disposition: any): number {
    if (typeof disposition === 'number') {
      return disposition;
    }

    // Default to neutral if unknown
    return TOKEN_DISPOSITIONS.NEUTRAL;
  }

  /**
   * Validate that Foundry is ready and world is active
   */
  validateFoundryState(): void {
    if (!game || !game.ready) {
      throw new Error('Foundry VTT is not ready');
    }

    if (!game.world) {
      throw new Error('No active world');
    }

    if (!game.user) {
      throw new Error('No active user');
    }
  }

  /**
   * Audit log for write operations
   */
  private auditLog(
    operation: string,
    data: any,
    result: 'success' | 'failure',
    error?: string
  ): void {
    // Always audit write operations (no setting required)
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      user: game.user?.name || 'Unknown',
      userId: game.user?.id || 'unknown',
      world: game.world?.id || 'unknown',
      data: this.sanitizeData(data),
      result,
      error,
    };

    // Store in flags for persistence (optional)
    if (game.world && (game.world as any).setFlag) {
      const auditLogs = (game.world as any).getFlag(this.moduleId, 'auditLogs') || [];
      auditLogs.push(logEntry);

      // Keep only last 100 entries to prevent bloat
      if (auditLogs.length > 100) {
        auditLogs.splice(0, auditLogs.length - 100);
      }

      (game.world as any).setFlag(this.moduleId, 'auditLogs', auditLogs);
    }
  }

  // ===== PHASE 2 & 3: WRITE OPERATIONS =====

  /**
   * Create journal entry for quests, with optional additional pages
   */
  async createJournalEntry(request: {
    name: string;
    content: string;
    folderName?: string;
    additionalPages?: Array<{ name: string; content: string }>;
  }): Promise<{ id: string; name: string; pageCount: number }> {
    this.validateFoundryState();

    // Use permission system for journal creation
    const permissionCheck = permissionManager.checkWritePermission('createActor', {
      quantity: 1, // Treat journal creation similar to actor creation for permissions
    });

    if (!permissionCheck.allowed) {
      throw new Error(`Journal creation denied: ${permissionCheck.reason}`);
    }

    try {
      // Build pages array: main page + any additional pages
      const pages: Array<{ type: string; name: string; text: { content: string } }> = [
        {
          type: 'text',
          name: 'Quest Details',
          text: {
            content: request.content,
          },
        },
      ];

      if (request.additionalPages) {
        for (const page of request.additionalPages) {
          pages.push({
            type: 'text',
            name: page.name,
            text: {
              content: page.content,
            },
          });
        }
      }

      // Create journal entry with proper Foundry v13 structure
      const journalData = {
        name: request.name,
        pages,
        ownership: { default: 0 }, // GM only by default
        folder: await this.getOrCreateFolder(request.folderName || request.name, 'JournalEntry'),
      };

      const journal = await JournalEntry.create(journalData);

      if (!journal) {
        throw new Error('Failed to create journal entry');
      }

      const result = {
        id: journal.id,
        name: journal.name || request.name,
        pageCount: pages.length,
      };

      this.auditLog('createJournalEntry', request, 'success');
      return result;
    } catch (error) {
      this.auditLog(
        'createJournalEntry',
        request,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Synchronise le Codex de lore : upsert IDEMPOTENT (clé = flag `codexSlug`) d'un lot d'entrées
   * d'entités vers DEUX cibles à la fois :
   *   (a) un VRAI pack Compendium `world.<packName>` de type JournalEntry (créé si absent), et
   *   (b) un dossier de journaux du MONDE (consultable/épinglable en jeu).
   * Range par catégorie en sous-dossiers, résout les renvois `<a data-codex-slug>` en liens
   * `@UUID` PROPRES À CHAQUE CIBLE (les liens du Codex pointent vers le Codex, ceux du pack vers le
   * pack), et SUPPRIME les entrées devenues orphelines. Re-synchroniser ne crée jamais de doublon.
   */
  async syncCodex(bundle: {
    packLabel?: string;
    packName?: string;
    folderName?: string;
    entries: Array<{
      slug: string;
      name: string;
      type: string;
      category: string;
      aliases?: string[];
      source?: string;
      summary?: string;
      links?: string[];
      html: string;
    }>;
  }): Promise<any> {
    this.validateFoundryState();

    const FLAG = 'codexSlug';
    const packName = bundle.packName || 'codex-therra';
    const packLabel = bundle.packLabel || 'Codex de Therra';
    const folderName = bundle.folderName || packLabel;
    const entries = Array.isArray(bundle.entries) ? bundle.entries : [];
    if (entries.length === 0) throw new Error('syncCodex: bundle.entries est vide');

    const escapeHtml = (s: any) =>
      String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // ── 1) Pack compendium (world) : réutiliser ou créer ──
    // v13+ a déplacé CompendiumCollection sous foundry.documents.collections.* ; le global nu peut
    // avoir disparu en v14 → résolution robuste avec repli.
    const packCollection = `world.${packName}`;
    let pack: any = (game as any).packs?.get(packCollection);
    if (!pack) {
      const CC =
        (globalThis as any).foundry?.documents?.collections?.CompendiumCollection ||
        (globalThis as any).CompendiumCollection;
      if (!CC || typeof CC.createCompendium !== 'function') {
        throw new Error('syncCodex: CompendiumCollection.createCompendium introuvable (API Foundry v14)');
      }
      pack = await CC.createCompendium({ type: 'JournalEntry', label: packLabel, name: packName });
    }
    if (!pack) throw new Error(`syncCodex: impossible de créer/ouvrir le pack ${packCollection}`);

    // ── 2) Dossiers par catégorie (monde imbriqué sous une racine, + dans le pack) ──
    const worldRoot = await this.ensureJournalFolder(folderName, null, null);
    const categories = [...new Set(entries.map((e) => e.category))];
    const worldCatFolder = new Map<string, string | null>();
    const packCatFolder = new Map<string, string | null>();
    for (const cat of categories) {
      worldCatFolder.set(cat, await this.ensureJournalFolder(cat, worldRoot, null));
      packCatFolder.set(cat, await this.ensureJournalFolder(cat, null, pack));
    }

    // ── Index des entrées existantes par slug (pour l'upsert) ──
    const worldBySlug = new Map<string, any>();
    for (const j of (game as any).journal) {
      const s = j.getFlag?.(this.moduleId, FLAG);
      if (s) worldBySlug.set(s, j);
    }
    const packDocs = await pack.getDocuments();
    const packBySlug = new Map<string, any>();
    for (const d of packDocs) {
      const s = d.getFlag?.(this.moduleId, FLAG);
      if (s) packBySlug.set(s, d);
    }

    // ── 3) PASS 1 : garantir l'existence (squelette) pour connaître les ids avant de lier ──
    const idWorld = new Map<string, string>();
    const idPack = new Map<string, string>();
    for (const e of entries) {
      let wj = worldBySlug.get(e.slug);
      if (!wj) {
        wj = await (globalThis as any).JournalEntry.create({
          name: e.name,
          folder: worldCatFolder.get(e.category) || worldRoot,
          ownership: { default: 0 },
          flags: { [this.moduleId]: { [FLAG]: e.slug, codex: true } },
          pages: [{ type: 'text', name: e.name, text: { content: '' } }],
        });
        worldBySlug.set(e.slug, wj);
      }
      idWorld.set(e.slug, wj.id);

      let pj = packBySlug.get(e.slug);
      if (!pj) {
        pj = await (globalThis as any).JournalEntry.create(
          {
            name: e.name,
            folder: packCatFolder.get(e.category) || null,
            flags: { [this.moduleId]: { [FLAG]: e.slug, codex: true } },
            pages: [{ type: 'text', name: e.name, text: { content: '' } }],
          },
          { pack: packCollection }
        );
        packBySlug.set(e.slug, pj);
      }
      idPack.set(e.slug, pj.id);
    }

    // ── 4) PASS 2 : écrire le contenu avec liens @UUID résolus par cible ──
    const buildContent = (e: any, resolve: (slug: string) => string | null): string => {
      const html = e.html.replace(
        /<a class="codex-link" data-codex-slug="([^"]+)">([\s\S]*?)<\/a>/g,
        (_m: string, slug: string, label: string) => {
          const uuid = resolve(slug);
          return uuid ? `@UUID[${uuid}]{${label}}` : `<strong>${label}</strong>`;
        }
      );
      const header = e.summary ? `<p><em>${escapeHtml(e.summary)}</em></p>\n<hr>\n` : '';
      const aliases =
        e.aliases && e.aliases.length ? ` · Alias : ${e.aliases.map(escapeHtml).join(', ')}` : '';
      const footer = `\n<hr>\n<p style="opacity:.6"><small>Type : ${escapeHtml(
        e.type
      )}${aliases} · Source : ${escapeHtml(e.source || '')}</small></p>`;
      return header + html + footer;
    };
    const resolveWorld = (slug: string) =>
      idWorld.has(slug) ? `JournalEntry.${idWorld.get(slug)}` : null;
    const resolvePack = (slug: string) =>
      idPack.has(slug) ? `Compendium.${packCollection}.JournalEntry.${idPack.get(slug)}` : null;

    for (const e of entries) {
      await this.upsertCodexPage(
        worldBySlug.get(e.slug),
        e.name,
        buildContent(e, resolveWorld),
        worldCatFolder.get(e.category) || worldRoot
      );
      await this.upsertCodexPage(
        packBySlug.get(e.slug),
        e.name,
        buildContent(e, resolvePack),
        packCatFolder.get(e.category) || null
      );
    }

    // ── 5) PASS 3 : retirer les entrées orphelines (slug absent du bundle) ──
    const wanted = new Set(entries.map((e) => e.slug));
    const removed = { world: 0, pack: 0 };
    for (const [slug, doc] of worldBySlug) {
      if (!wanted.has(slug)) {
        await doc.delete();
        removed.world++;
      }
    }
    for (const [slug, doc] of packBySlug) {
      if (!wanted.has(slug)) {
        await doc.delete();
        removed.pack++;
      }
    }

    this.auditLog('syncCodex', { count: entries.length, pack: packCollection }, 'success');
    return {
      success: true,
      pack: packCollection,
      packLabel,
      folder: folderName,
      upserted: entries.length,
      categories: categories.length,
      removedOrphans: removed,
    };
  }

  /**
   * Crée ou retrouve un dossier JournalEntry. Si `pack` est fourni → dossier DANS le compendium ;
   * sinon dossier du monde, éventuellement imbriqué sous `parentId`.
   */
  private async ensureJournalFolder(
    name: string,
    parentId: string | null,
    pack: any
  ): Promise<string | null> {
    try {
      if (pack) {
        const existing = pack.folders?.find((f: any) => f.name === name);
        if (existing) return existing.id;
        const f = await (globalThis as any).Folder.create(
          { name, type: 'JournalEntry' },
          { pack: pack.collection }
        );
        return f?.id || null;
      }
      const existing = (game as any).folders?.find(
        (f: any) =>
          f.type === 'JournalEntry' && f.name === name && (f.folder?.id || null) === (parentId || null)
      );
      if (existing) return existing.id;
      const f = await (globalThis as any).Folder.create({
        name,
        type: 'JournalEntry',
        folder: parentId || null,
        flags: { [this.moduleId]: { codex: true } },
      });
      return f?.id || null;
    } catch (error) {
      console.warn(`[${this.moduleId}] ensureJournalFolder("${name}") failed:`, error);
      return null;
    }
  }

  /** Met à jour le nom/dossier d'une entrée de codex + le contenu de sa page unique (idempotent). */
  private async upsertCodexPage(
    doc: any,
    name: string,
    content: string,
    folderId: string | null
  ): Promise<void> {
    const update: any = {};
    if (doc.name !== name) update.name = name;
    if ((doc.folder?.id || null) !== (folderId || null)) update.folder = folderId || null;
    if (Object.keys(update).length) await doc.update(update);

    const page = doc.pages?.contents?.[0];
    if (page) {
      await doc.updateEmbeddedDocuments('JournalEntryPage', [
        { _id: page.id, name, text: { content } },
      ]);
    } else {
      await doc.createEmbeddedDocuments('JournalEntryPage', [
        { type: 'text', name, text: { content } },
      ]);
    }
  }

  /**
   * List all journal entries with page metadata
   */
  async listJournals(): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      pageCount: number;
      pages: Array<{ id: string; name: string; type: string }>;
    }>
  > {
    this.validateFoundryState();

    return game.journal.map((journal: any) => ({
      id: journal.id || '',
      name: journal.name || '',
      type: 'JournalEntry',
      pageCount: journal.pages?.size || 0,
      pages:
        journal.pages?.map((page: any) => ({
          id: page.id || '',
          name: page.name || '',
          type: page.type || 'text',
        })) || [],
    }));
  }

  /**
   * Get journal entry content (first text page + page manifest)
   */
  async getJournalContent(journalId: string): Promise<{
    content: string;
    currentPage?: { id: string; name: string } | undefined;
    allPages: Array<{ id: string; name: string; type: string }>;
    pageCount: number;
    note?: string | undefined;
  } | null> {
    this.validateFoundryState();

    const journal = game.journal.get(journalId);
    if (!journal) {
      return null;
    }

    const allPages =
      journal.pages?.map((page: any) => ({
        id: page.id || '',
        name: page.name || '',
        type: page.type || 'text',
      })) || [];
    const pageCount = allPages.length;

    // Get first text page content
    const firstPage = journal.pages.find((page: any) => page.type === 'text');
    if (!firstPage) {
      return { content: '', allPages, pageCount };
    }

    return {
      content: firstPage.text?.content || '',
      currentPage: { id: firstPage.id || '', name: firstPage.name || '' },
      allPages,
      pageCount,
      note:
        pageCount > 1
          ? `This journal has ${pageCount} pages. Use list-journals with journalId and pageId to read other pages: ${allPages.map((p: any) => `"${p.name}" (${p.id})`).join(', ')}`
          : undefined,
    };
  }

  /**
   * Get a specific journal page's content by ID
   */
  async getJournalPageContent(
    journalId: string,
    pageId: string
  ): Promise<{ id: string; name: string; type: string; content: string } | null> {
    this.validateFoundryState();

    const journal = game.journal.get(journalId);
    if (!journal) {
      return null;
    }

    const page = journal.pages.get(pageId);
    if (!page) {
      return null;
    }

    return {
      id: page.id || '',
      name: page.name || '',
      type: page.type || 'text',
      content: page.type === 'text' ? page.text?.content || '' : page.src || '',
    };
  }

  /**
   * Update journal entry content
   * - No pageId/newPageName: update first text page (backward compat)
   * - With pageId: update that specific page
   * - With newPageName (no pageId): create a new page
   */
  async updateJournalContent(request: {
    journalId: string;
    content: string;
    pageId?: string | undefined;
    newPageName?: string | undefined;
  }): Promise<{ success: boolean; pageId?: string | undefined; pageName?: string | undefined }> {
    this.validateFoundryState();

    // Use permission system for journal updates - treating as createActor permission level
    const permissionCheck = permissionManager.checkWritePermission('createActor', {
      quantity: 1, // Treat journal updates similar to actor creation for permissions
    });

    if (!permissionCheck.allowed) {
      throw new Error(`Journal update denied: ${permissionCheck.reason}`);
    }

    try {
      const journal = game.journal.get(request.journalId);
      if (!journal) {
        throw new Error('Journal entry not found');
      }

      // Mode 1: Create a new page
      if (request.newPageName) {
        const created = await journal.createEmbeddedDocuments('JournalEntryPage', [
          {
            type: 'text',
            name: request.newPageName,
            text: {
              content: request.content,
            },
          },
        ]);
        const newPage = created?.[0];
        this.auditLog('updateJournalContent', request, 'success');
        return { success: true, pageId: newPage?.id || '', pageName: request.newPageName };
      }

      // Mode 2: Update a specific page by ID
      if (request.pageId) {
        const page = journal.pages.get(request.pageId);
        if (!page) {
          throw new Error(`Page not found: ${request.pageId}`);
        }
        await page.update({
          'text.content': request.content,
        });
        this.auditLog('updateJournalContent', request, 'success');
        return { success: true, pageId: page.id, pageName: page.name };
      }

      // Mode 3: Update first text page or create one if none exists (backward compat)
      const firstPage = journal.pages.find((page: any) => page.type === 'text');

      if (firstPage) {
        // Update existing page
        await firstPage.update({
          'text.content': request.content,
        });
        this.auditLog('updateJournalContent', request, 'success');
        return { success: true, pageId: firstPage.id, pageName: firstPage.name };
      } else {
        // Create new text page
        const created = await journal.createEmbeddedDocuments('JournalEntryPage', [
          {
            type: 'text',
            name: 'Quest Details',
            text: {
              content: request.content,
            },
          },
        ]);
        const newPage = created?.[0];
        this.auditLog('updateJournalContent', request, 'success');
        return { success: true, pageId: newPage?.id || '', pageName: 'Quest Details' };
      }
    } catch (error) {
      this.auditLog(
        'updateJournalContent',
        request,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Create actors from compendium entries with custom names
   */
  async createActorFromCompendium(request: ActorCreationRequest): Promise<ActorCreationResult> {
    this.validateFoundryState();

    // Use new permission system
    const permissionCheck = permissionManager.checkWritePermission('createActor', {
      quantity: request.quantity || 1,
    });

    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    // Audit the permission check
    permissionManager.auditPermissionCheck('createActor', permissionCheck, request);

    const maxActors = game.settings.get(this.moduleId, 'maxActorsPerRequest') as number;
    const quantity = Math.min(request.quantity || 1, maxActors);

    // Start transaction for rollback capability
    const transactionId = transactionManager.startTransaction(
      `Create ${quantity} actor(s) from compendium: ${request.creatureType}`
    );

    try {
      // Find matching compendium entry
      const compendiumEntry = await this.findBestCompendiumMatch(
        request.creatureType,
        request.packPreference
      );
      if (!compendiumEntry) {
        throw new Error(`No compendium entry found for "${request.creatureType}"`);
      }

      // Get full compendium document
      const sourceDoc = await this.getCompendiumDocumentFull(
        compendiumEntry.pack,
        compendiumEntry.id
      );

      const createdActors: CreatedActorInfo[] = [];
      const errors: string[] = [];

      // Create actors with custom names
      for (let i = 0; i < quantity; i++) {
        try {
          const customName =
            request.customNames?.[i] ||
            (quantity > 1 ? `${sourceDoc.name} ${i + 1}` : sourceDoc.name);

          const newActor = await this.createActorFromSource(sourceDoc, customName);

          // Track actor creation for rollback
          transactionManager.addAction(
            transactionId,
            transactionManager.createActorCreationAction(newActor.id)
          );

          createdActors.push({
            id: newActor.id,
            name: newActor.name,
            originalName: sourceDoc.name,
            type: newActor.type,
            sourcePackId: compendiumEntry.pack,
            sourcePackLabel: compendiumEntry.packLabel,
            img: newActor.img,
          });
        } catch (error) {
          errors.push(
            `Failed to create actor ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      let tokensPlaced = 0;

      // Add to scene if requested and permission allows
      if (request.addToScene && createdActors.length > 0) {
        try {
          const scenePermissionCheck = permissionManager.checkWritePermission('modifyScene', {
            targetIds: createdActors.map(a => a.id),
          });

          if (!scenePermissionCheck.allowed) {
            errors.push(`Cannot add to scene: ${scenePermissionCheck.reason}`);
          } else {
            const tokenResult = await this.addActorsToScene(
              {
                actorIds: createdActors.map(a => a.id),
                placement: 'random',
                hidden: false,
              },
              transactionId
            );
            tokensPlaced = tokenResult.tokensCreated;
          }
        } catch (error) {
          errors.push(
            `Failed to add actors to scene: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // If we had partial failure, decide whether to rollback
      if (errors.length > 0 && createdActors.length < quantity) {
        // Rollback if we failed to create more than half the requested actors
        if (createdActors.length < quantity / 2) {
          console.warn(
            `[${this.moduleId}] Rolling back due to significant failures (${createdActors.length}/${quantity} created)`
          );
          await transactionManager.rollbackTransaction(transactionId);
          throw new Error(`Actor creation failed: ${errors.join(', ')}`);
        }
      }

      // Commit transaction
      transactionManager.commitTransaction(transactionId);

      const result: ActorCreationResult = {
        success: createdActors.length > 0,
        actors: createdActors,
        ...(errors.length > 0 ? { errors } : {}),
        tokensPlaced,
        totalRequested: quantity,
        totalCreated: createdActors.length,
      };

      this.auditLog('createActorFromCompendium', request, 'success');
      return result;
    } catch (error) {
      // Rollback on complete failure
      try {
        await transactionManager.rollbackTransaction(transactionId);
      } catch (rollbackError) {
        console.error(`[${this.moduleId}] Failed to rollback transaction:`, rollbackError);
      }

      this.auditLog(
        'createActorFromCompendium',
        request,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Create actor from specific compendium entry using pack/item IDs
   */
  async createActorFromCompendiumEntry(request: {
    packId: string;
    itemId: string;
    customNames: string[];
    quantity?: number;
    addToScene?: boolean;
    placement?: {
      type: 'random' | 'grid' | 'center' | 'coordinates';
      coordinates?: { x: number; y: number }[];
    };
  }): Promise<ActorCreationResult> {
    this.validateFoundryState();

    try {
      const { packId, itemId, customNames, quantity = 1, addToScene = false, placement } = request;

      // Validate inputs
      if (!packId || !itemId) {
        throw new Error('Both packId and itemId are required');
      }

      // Get the pack
      const pack = game.packs.get(packId);
      if (!pack) {
        throw new Error(`Compendium pack "${packId}" not found`);
      }

      // Get the specific document
      const sourceDocument = await pack.getDocument(itemId);
      if (!sourceDocument) {
        throw new Error(`Document "${itemId}" not found in pack "${packId}"`);
      }

      // Validate that the document is an Actor (supports character, npc, creature, etc.)
      if (sourceDocument.documentName !== 'Actor') {
        throw new Error(
          `Document "${itemId}" is not an Actor (documentName: ${sourceDocument.documentName}, type: ${sourceDocument.type})`
        );
      }

      // Validate actor type - support all common actor types including DSA5 creatures
      // and Cosmere RPG adversaries.
      const validActorTypes = ['character', 'npc', 'creature', 'adversary'];
      if (!validActorTypes.includes(sourceDocument.type)) {
        throw new Error(
          `Document "${itemId}" has unsupported actor type: ${sourceDocument.type}. Supported types: ${validActorTypes.join(', ')}`
        );
      }

      const sourceActor = sourceDocument as Actor;

      // Prepare custom names
      const names = customNames.length > 0 ? customNames : [`${sourceActor.name} Copy`];
      const finalQuantity = Math.min(quantity, names.length);

      const createdActors: any[] = [];
      const errors: string[] = [];

      // Create actors
      for (let i = 0; i < finalQuantity; i++) {
        try {
          const customName = names[i] || `${sourceActor.name} ${i + 1}`;

          // Create actor data with full system, items, and effects
          const sourceData = sourceActor.toObject() as any;
          const actorData = {
            name: customName,
            type: sourceData.type,
            img: sourceData.img,
            system: sourceData.system || sourceData.data || {},
            items: sourceData.items || [],
            effects: sourceData.effects || [],
            folder: null, // Don't inherit folder
            prototypeToken: sourceData.prototypeToken, // Include prototype token
          };

          // Fix remote image URLs - normalize to local paths
          if (actorData.prototypeToken?.texture?.src?.startsWith('http')) {
            actorData.prototypeToken.texture.src = null; // Clear remote URL
          }

          // Organize created actors in a folder - use "Foundry MCP Creatures" for generic monsters
          const folderId = await this.getOrCreateFolder('Foundry MCP Creatures', 'Actor');
          if (folderId) {
            (actorData as any).folder = folderId;
          }

          // Create the actor
          const newActor = await Actor.create(actorData);
          if (!newActor) {
            throw new Error(`Failed to create actor "${customName}"`);
          }

          createdActors.push({
            id: newActor.id,
            name: newActor.name,
            originalName: sourceActor.name,
            sourcePackLabel: pack.metadata.label,
          });
        } catch (error) {
          const errorMsg = `Failed to create actor ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`[${MODULE_ID}] ${errorMsg}`, error);
        }
      }

      // Add to scene if requested
      let tokensPlaced = 0;
      if (addToScene && createdActors.length > 0) {
        try {
          const sceneResult = await this.addActorsToScene({
            actorIds: createdActors.map(a => a.id),
            placement: placement?.type || 'grid',
            hidden: false,
            ...(placement?.coordinates && { coordinates: placement.coordinates }),
          });
          tokensPlaced = sceneResult.success ? sceneResult.tokensCreated : 0;
        } catch (error) {
          errors.push(
            `Failed to add actors to scene: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      const result: ActorCreationResult = {
        success: createdActors.length > 0,
        totalCreated: createdActors.length,
        totalRequested: finalQuantity,
        actors: createdActors,
        tokensPlaced,
        errors: errors.length > 0 ? errors : undefined,
      };

      this.auditLog('createActorFromCompendiumEntry', request, 'success');
      return result;
    } catch (error) {
      console.error(`[${MODULE_ID}] Failed to create actor from compendium entry`, error);
      this.auditLog(
        'createActorFromCompendiumEntry',
        request,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Add one or more freshly-authored Item documents to an existing Actor.
   *
   * Unlike `createActorFromCompendium*`, the items here are constructed from
   * caller-supplied data — no compendium lookup. This is the path used to
   * push planner-authored content (talents, actions, powers, custom gear)
   * onto a PC or NPC sheet.
   *
   * Validation is intentionally light: name + type are required, and the
   * type is checked against the active system's declared Item document
   * types when available. Everything else (system schema validation,
   * required sub-fields) is delegated to Foundry's DataModel layer, which
   * will fill defaults or throw a meaningful error.
   */
  async addActorItems(params: {
    actorIdentifier: string;
    items: Array<{
      name: string;
      type: string;
      img?: string;
      system?: Record<string, any>;
    }>;
  }): Promise<{
    actorId: string;
    actorName: string;
    created: Array<{ id: string; name: string; type: string }>;
  }> {
    this.validateFoundryState();

    const { actorIdentifier, items } = params;

    if (!actorIdentifier) {
      throw new Error('actorIdentifier is required');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('items array is required and must contain at least one entry');
    }

    const actor = this.findActorByIdentifier(actorIdentifier);
    if (!actor) {
      throw new Error(`Actor not found: ${actorIdentifier}`);
    }

    // Discover the active system's declared Item types so we can give a
    // useful error before sending the doc to Foundry's DataModel layer.
    const itemDocTypes = (game as any).system?.documentTypes?.Item;
    const validTypes: string[] | null =
      itemDocTypes && typeof itemDocTypes === 'object' ? Object.keys(itemDocTypes) : null;

    const payload = items.map((it, idx) => {
      if (!it || typeof it.name !== 'string' || it.name.trim().length === 0) {
        throw new Error(`items[${idx}]: "name" is required and must be a non-empty string`);
      }
      if (typeof it.type !== 'string' || it.type.trim().length === 0) {
        throw new Error(`items[${idx}] ("${it.name}"): "type" is required`);
      }
      if (validTypes && !validTypes.includes(it.type)) {
        throw new Error(
          `items[${idx}] ("${it.name}"): unknown type "${it.type}" for system "${(game.system as any)?.id}". ` +
            `Valid Item types: ${validTypes.join(', ')}`
        );
      }

      const doc: Record<string, any> = { name: it.name, type: it.type };
      if (it.img) doc.img = it.img;
      if (it.system && typeof it.system === 'object') doc.system = it.system;
      return doc;
    });

    try {
      const created = await actor.createEmbeddedDocuments('Item', payload);

      const result = {
        actorId: actor.id,
        actorName: actor.name,
        created: (created || []).map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
        })),
      };

      this.auditLog(
        'addActorItems',
        { actorIdentifier, actorId: actor.id, count: payload.length },
        'success'
      );
      return result;
    } catch (error) {
      this.auditLog(
        'addActorItems',
        { actorIdentifier, actorId: actor.id, count: payload.length },
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * List world-level Item documents from the Items sidebar.
   * Optionally filters by type, folder (name or id), or a case-insensitive name substring.
   */
  async listWorldItems(params: { type?: string; folder?: string; nameFilter?: string }): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      img?: string;
      folderId: string | null;
      folderName: string | null;
    }>
  > {
    this.validateFoundryState();

    const { type, folder, nameFilter } = params;
    const nameLower = nameFilter ? nameFilter.toLowerCase() : null;

    // Resolve folder filter to an id if a name/id was provided
    let folderId: string | null = null;
    if (folder && folder.trim().length > 0) {
      const folderTrimmed = folder.trim();
      const folderDoc =
        (game as any).folders?.find(
          (f: any) => f.type === 'Item' && (f.name === folderTrimmed || f.id === folderTrimmed)
        ) ?? null;
      if (!folderDoc) {
        return [];
      }
      folderId = folderDoc.id;
    }

    const result: Array<{
      id: string;
      name: string;
      type: string;
      img?: string;
      folderId: string | null;
      folderName: string | null;
    }> = [];

    for (const item of (game as any).items) {
      if (type && item.type !== type) continue;
      if (folderId && item.folder?.id !== folderId) continue;
      if (nameLower && !(item.name ?? '').toLowerCase().includes(nameLower)) continue;

      result.push({
        id: item.id ?? '',
        name: item.name ?? '',
        type: item.type,
        ...(item.img ? { img: item.img } : {}),
        folderId: item.folder?.id ?? null,
        folderName: item.folder?.name ?? null,
      });
    }

    return result;
  }

  /**
   * Update one or more existing world-level Item documents.
   *
   * Each entry must supply an `id` plus at least one field to change (name,
   * img, system, folder). Uses Item.updateDocuments() for a single batched
   * write. Folder may be supplied as a name or id; if a name is given that
   * does not exist, it is created automatically (same behaviour as
   * createWorldItems).
   */
  async updateWorldItems(params: {
    updates: Array<{
      id: string;
      name?: string;
      img?: string;
      system?: Record<string, any>;
      folder?: string;
    }>;
  }): Promise<{
    updated: Array<{ id: string; name: string; type: string }>;
  }> {
    this.validateFoundryState();

    const { updates } = params;

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('updates array is required and must contain at least one entry');
    }

    // Cache folder resolutions so we only look up / create each folder once
    const folderCache = new Map<string, string>(); // folder param → folder id

    const resolveFolderId = async (folder: string): Promise<string> => {
      if (folderCache.has(folder)) return folderCache.get(folder)!;
      const folderTrimmed = folder.trim();
      let folderDoc =
        (game as any).folders?.find(
          (f: any) => f.type === 'Item' && (f.name === folderTrimmed || f.id === folderTrimmed)
        ) ?? null;
      if (!folderDoc) {
        folderDoc = await (Folder as any).create({
          name: folderTrimmed,
          type: 'Item',
          parent: null,
        });
      }
      folderCache.set(folder, folderDoc.id);
      return folderDoc.id;
    };

    const payload: Array<Record<string, any>> = [];

    for (let idx = 0; idx < updates.length; idx++) {
      const upd = updates[idx];
      if (!upd || typeof upd.id !== 'string' || upd.id.trim().length === 0) {
        throw new Error(`updates[${idx}]: "id" is required and must be a non-empty string`);
      }

      const item = (game as any).items?.get(upd.id);
      if (!item) {
        throw new Error(`updates[${idx}]: Item "${upd.id}" not found in world`);
      }

      const patch: Record<string, any> = { _id: upd.id };
      if (upd.name !== undefined) patch.name = upd.name;
      if (upd.img !== undefined) patch.img = upd.img;
      if (upd.system !== undefined) patch.system = upd.system;
      if (upd.folder !== undefined && upd.folder.trim().length > 0) {
        patch.folder = await resolveFolderId(upd.folder.trim());
      }

      payload.push(patch);
    }

    try {
      const updated = await (Item as any).updateDocuments(payload);

      const result = {
        updated: (updated || []).map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
        })),
      };

      this.auditLog('updateWorldItems', { count: payload.length }, 'success');
      return result;
    } catch (error) {
      this.auditLog(
        'updateWorldItems',
        { count: payload.length },
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Create one or more world-level Item documents (Items sidebar, not embedded on an actor).
   *
   * Uses Item.createDocuments() with no parent so items appear in the Foundry
   * Items sidebar and can be dragged onto any actor sheet. Optionally places
   * items inside a named/id-resolved folder, creating the folder if necessary.
   */
  async createWorldItems(params: {
    items: Array<{
      name: string;
      type: string;
      img?: string;
      system?: Record<string, any>;
    }>;
    folder?: string;
  }): Promise<{
    folderId: string | null;
    folderName: string | null;
    created: Array<{ id: string; name: string; type: string }>;
  }> {
    this.validateFoundryState();

    const { items, folder } = params;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('items array is required and must contain at least one entry');
    }

    const itemDocTypes = (game as any).system?.documentTypes?.Item;
    const validTypes: string[] | null =
      itemDocTypes && typeof itemDocTypes === 'object' ? Object.keys(itemDocTypes) : null;

    const payload = items.map((it, idx) => {
      if (!it || typeof it.name !== 'string' || it.name.trim().length === 0) {
        throw new Error(`items[${idx}]: "name" is required and must be a non-empty string`);
      }
      if (typeof it.type !== 'string' || it.type.trim().length === 0) {
        throw new Error(`items[${idx}] ("${it.name}"): "type" is required`);
      }
      if (validTypes && !validTypes.includes(it.type)) {
        throw new Error(
          `items[${idx}] ("${it.name}"): unknown type "${it.type}" for system "${(game.system as any)?.id}". ` +
            `Valid Item types: ${validTypes.join(', ')}`
        );
      }

      const doc: Record<string, any> = { name: it.name, type: it.type };
      if (it.img) doc.img = it.img;
      if (it.system && typeof it.system === 'object') doc.system = it.system;
      return doc;
    });

    // Resolve or create the target folder
    let folderDoc: any = null;
    if (folder && folder.trim().length > 0) {
      const folderTrimmed = folder.trim();
      folderDoc =
        (game as any).folders?.find(
          (f: any) => f.type === 'Item' && (f.name === folderTrimmed || f.id === folderTrimmed)
        ) ?? null;

      if (!folderDoc) {
        folderDoc = await (Folder as any).create({
          name: folderTrimmed,
          type: 'Item',
          parent: null,
        });
      }

      for (const doc of payload) {
        doc.folder = folderDoc.id;
      }
    }

    try {
      const created = await (Item as any).createDocuments(payload);

      const result = {
        folderId: folderDoc ? folderDoc.id : null,
        folderName: folderDoc ? folderDoc.name : null,
        created: (created || []).map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
        })),
      };

      this.auditLog(
        'createWorldItems',
        { folder: folder ?? null, count: payload.length },
        'success'
      );
      return result;
    } catch (error) {
      this.auditLog(
        'createWorldItems',
        { folder: folder ?? null, count: payload.length },
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Get full compendium document with all embedded data
   */
  async getCompendiumDocumentFull(
    packId: string,
    documentId: string
  ): Promise<CompendiumEntryFull> {
    const pack = game.packs.get(packId);
    if (!pack) {
      throw new Error(`Compendium pack ${packId} not found`);
    }

    const document = await pack.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found in pack ${packId}`);
    }

    // Build comprehensive data structure
    const fullEntry: CompendiumEntryFull = {
      id: document.id || '',
      name: document.name || '',
      type: (document as any).type || 'unknown',
      img: (document as any).img || undefined,
      pack: packId,
      packLabel: pack.metadata.label,
      system: this.sanitizeData((document as any).system || {}),
      fullData: this.sanitizeData(document.toObject()),
    };

    // Add items if the actor has them
    if ((document as any).items) {
      fullEntry.items = (document as any).items.map((item: any) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        img: item.img || undefined,
        system: this.sanitizeData(item.system || {}),
      }));
    }

    // Add effects if the actor has them
    if ((document as any).effects) {
      fullEntry.effects = (document as any).effects.map((effect: any) => ({
        id: effect.id,
        name: effect.name || effect.label || 'Unknown Effect',
        icon: effect.icon || undefined,
        disabled: effect.disabled || false,
        duration: this.sanitizeData(effect.duration || {}),
      }));
    }

    return fullEntry;
  }

  /**
   * Add actors to the current scene as tokens
   */
  async addActorsToScene(
    placement: SceneTokenPlacement,
    transactionId?: string
  ): Promise<TokenPlacementResult> {
    this.validateFoundryState();

    // Use new permission system
    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: placement.actorIds,
    });

    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    // Audit the permission check
    permissionManager.auditPermissionCheck('modifyScene', permissionCheck, placement);

    const scene = (game.scenes as any).current;
    if (!scene) {
      throw new Error('No active scene found');
    }

    this.auditLog('addActorsToScene', placement, 'success');

    try {
      const tokenData: any[] = [];
      const errors: string[] = [];

      for (const actorId of placement.actorIds) {
        try {
          const actor = game.actors.get(actorId);
          if (!actor) {
            errors.push(`Actor ${actorId} not found`);
            continue;
          }

          const tokenDoc = (actor as any).prototypeToken.toObject();
          const position = this.calculateTokenPosition(
            placement.placement,
            scene,
            tokenData.length,
            placement.coordinates
          );

          // Fix token texture if it's still a remote URL (Foundry may have overridden our actor creation fix)
          if (tokenDoc.texture?.src?.startsWith('http')) {
            console.error(
              `[${this.moduleId}] Token texture still has remote URL, clearing: ${tokenDoc.texture.src}`
            );
            tokenDoc.texture.src = null; // Use Foundry's fallback
          } else {
          }

          tokenData.push({
            ...tokenDoc,
            // Carry the actor's (possibly custom) name onto the token, instead of
            // the prototype token's base name (e.g. "Bandit" for "Sbire Couteau").
            name: (actor as any).name ?? tokenDoc.name,
            x: position.x,
            y: position.y,
            actorId: actorId,
            hidden: placement.hidden,
          });
        } catch (error) {
          errors.push(
            `Failed to prepare token for actor ${actorId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      const createdTokens = await scene.createEmbeddedDocuments('Token', tokenData);

      // Track token creation for rollback if transaction is active
      if (transactionId && createdTokens.length > 0) {
        for (const token of createdTokens) {
          transactionManager.addAction(
            transactionId,
            transactionManager.createTokenCreationAction(token.id)
          );
        }
      }

      const result: TokenPlacementResult = {
        success: createdTokens.length > 0,
        tokensCreated: createdTokens.length,
        tokenIds: createdTokens.map((token: any) => token.id),
        ...(errors.length > 0 ? { errors } : {}),
      };

      this.auditLog('addActorsToScene', placement, 'success');
      return result;
    } catch (error) {
      this.auditLog(
        'addActorsToScene',
        placement,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Find best matching compendium entry for creature type
   */
  private async findBestCompendiumMatch(
    creatureType: string,
    packPreference?: string
  ): Promise<CompendiumSearchResult | null> {
    // First try exact search
    const exactResults = await this.searchCompendium(creatureType, 'Actor');

    // Look for exact name match first
    const exactMatch = exactResults.find(
      result => result.name.toLowerCase() === creatureType.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // Look for partial matches, preferring specified pack
    if (packPreference) {
      const packMatch = exactResults.find(result => result.pack === packPreference);
      if (packMatch) return packMatch;
    }

    // Return best fuzzy match
    return exactResults.length > 0 ? exactResults[0] : null;
  }

  /**
   * Create actor from source document with custom name
   */
  private async createActorFromSource(
    sourceDoc: CompendiumEntryFull,
    customName: string
  ): Promise<any> {
    try {
      // Clone the source data
      const actorData = foundry.utils.deepClone(sourceDoc.fullData) as any;

      // Apply customizations
      actorData.name = customName;

      // Fix only token texture - leave portrait (actor.img) alone
      if (actorData.prototypeToken?.texture?.src?.startsWith('http')) {
        console.error(
          `[${this.moduleId}] Removing remote token texture URL: ${actorData.prototypeToken.texture.src}`
        );
        actorData.prototypeToken.texture.src = null; // Let Foundry use fallback
      }

      // Remove source-specific identifiers
      delete actorData._id;
      delete actorData.folder;
      delete actorData.sort;

      // Ensure required fields are present
      if (!actorData.name) actorData.name = customName;
      if (!actorData.type) actorData.type = sourceDoc.type || 'npc';

      // Organize created actors in a folder - use "Foundry MCP Creatures" for generic monsters
      const folderId = await this.getOrCreateFolder('Foundry MCP Creatures', 'Actor');
      if (folderId) {
        (actorData as any).folder = folderId;
      }

      // Create the new actor
      const createdDocs = await Actor.createDocuments([actorData]);
      if (!createdDocs || createdDocs.length === 0) {
        throw new Error('Failed to create actor document');
      }

      return createdDocs[0];
    } catch (error) {
      console.error(`[${this.moduleId}] Actor creation failed:`, error);
      throw error;
    }
  }

  /**
   * Calculate token position based on placement strategy
   */
  private calculateTokenPosition(
    placement: 'random' | 'grid' | 'center' | 'coordinates',
    scene: any,
    index: number,
    coordinates?: { x: number; y: number }[]
  ): { x: number; y: number } {
    const gridSize = scene.grid?.size || 100;

    switch (placement) {
      case 'coordinates':
        if (coordinates && coordinates[index]) {
          // Clamp explicit coordinates to the scene so tokens never spawn
          // off-canvas (where Foundry corner-clamps them and they get "stuck").
          const dims = (scene as any).dimensions || {};
          const dimW = dims.width ?? scene.width ?? 0;
          const dimH = dims.height ?? scene.height ?? 0;
          const c = coordinates[index];
          return {
            x: dimW ? Math.min(Math.max(0, c.x), Math.max(0, dimW - gridSize)) : c.x,
            y: dimH ? Math.min(Math.max(0, c.y), Math.max(0, dimH - gridSize)) : c.y,
          };
        }
        // Fallback to grid if coordinates not provided or insufficient
        const fallbackCols = Math.ceil(Math.sqrt(index + 1));
        const fallbackRow = Math.floor(index / fallbackCols);
        const fallbackCol = index % fallbackCols;
        return {
          x: gridSize + fallbackCol * gridSize * 2,
          y: gridSize + fallbackRow * gridSize * 2,
        };

      case 'center':
        return {
          x: scene.width / 2 + index * gridSize,
          y: scene.height / 2,
        };

      case 'grid':
        const cols = Math.ceil(Math.sqrt(index + 1));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          x: gridSize + col * gridSize * 2,
          y: gridSize + row * gridSize * 2,
        };

      case 'random':
      default:
        return {
          x: Math.random() * (scene.width - gridSize),
          y: Math.random() * (scene.height - gridSize),
        };
    }
  }

  /**
   * Validate write operation permissions
   */
  async validateWritePermissions(operation: 'createActor' | 'modifyScene'): Promise<{
    allowed: boolean;
    reason?: string;
    requiresConfirmation?: boolean;
    warnings?: string[];
  }> {
    this.validateFoundryState();

    const permissionCheck = permissionManager.checkWritePermission(operation);

    // Audit the permission check
    permissionManager.auditPermissionCheck(operation, permissionCheck);

    return {
      allowed: permissionCheck.allowed,
      ...(permissionCheck.reason ? { reason: permissionCheck.reason } : {}),
      ...(permissionCheck.requiresConfirmation
        ? { requiresConfirmation: permissionCheck.requiresConfirmation }
        : {}),
      ...(permissionCheck.warnings ? { warnings: permissionCheck.warnings } : {}),
    };
  }

  /**
   * Request player rolls - creates interactive roll buttons in chat
   */
  async requestPlayerRolls(data: {
    rollType: string;
    rollTarget: string;
    targetPlayer: string;
    isPublic: boolean;
    rollModifier: string;
    flavor: string;
  }): Promise<{ success: boolean; message: string; error?: string }> {
    this.validateFoundryState();

    try {
      // Resolve target player from character name or player name with enhanced error handling
      const playerInfo = this.resolveTargetPlayer(data.targetPlayer);
      if (!playerInfo.found) {
        // Provide structured error message for MCP that Claude Desktop can understand
        const errorMessage =
          playerInfo.errorMessage || `Could not find player or character: ${data.targetPlayer}`;

        return {
          success: false,
          message: '',
          error: errorMessage,
        };
      }

      // Build roll formula based on type and target
      const rollFormula = this.buildRollFormula(
        data.rollType,
        data.rollTarget,
        data.rollModifier,
        playerInfo.character
      );

      // Generate roll button HTML
      const buttonId = foundry.utils.randomID();
      const buttonLabel = this.buildRollButtonLabel(data.rollType, data.rollTarget, data.isPublic);

      // Check if this type of roll was already performed (optional: could check for duplicate recent rolls)
      // For now, we'll just create the button and let the rendering logic handle the state restoration

      const rollButtonHtml = `
        <div class="mcp-roll-request" style="margin: 12px 0; padding: 12px; border: 1px solid #ccc; border-radius: 8px; background: #f9f9f9;">
          <p><strong>Roll Request:</strong> ${buttonLabel}</p>
          <p><strong>Target:</strong> ${playerInfo.targetName} ${playerInfo.character ? `(${playerInfo.character.name})` : ''}</p>
          ${data.flavor ? `<p><strong>Context:</strong> ${data.flavor}</p>` : ''}
          
          <div style="text-align: center; margin-top: 8px;">
            <!-- Single Roll Button (clickable by both character owner and GM) -->
            <button class="mcp-roll-button mcp-button-active" 
                    data-button-id="${buttonId}"
                    data-roll-formula="${rollFormula}"
                    data-roll-label="${buttonLabel}"
                    data-is-public="${data.isPublic}"
                    data-character-id="${playerInfo.character?.id || ''}"
                    data-target-user-id="${playerInfo.user?.id || ''}">
              🎲 ${buttonLabel}
            </button>
          </div>
        </div>
      `;

      // Create chat message with roll button
      // For PUBLIC rolls: both roll request and results visible to all players
      // For PRIVATE rolls: both roll request and results visible to target player + GM only
      const whisperTargets: string[] = [];

      if (!data.isPublic) {
        // Private roll request: whisper to target player + GM only

        // Always whisper to the character owner if they exist
        if (playerInfo.user?.id) {
          whisperTargets.push(playerInfo.user.id);
        }

        // Also send to GM (GMs can see all whispered messages anyway, but this ensures they see it)
        const gmUsers = game.users?.filter((u: User) => u.isGM && u.active);
        if (gmUsers) {
          for (const gm of gmUsers) {
            if (gm.id && !whisperTargets.includes(gm.id)) {
              whisperTargets.push(gm.id);
            }
          }
        }
      } else {
        // Public roll request: visible to all players (empty whisperTargets array)
      }

      const messageData = {
        content: rollButtonHtml,
        speaker: ChatMessage.getSpeaker({ actor: game.user }),
        style: (CONST as any).CHAT_MESSAGE_STYLES?.OTHER || 0, // Use style instead of deprecated type
        whisper: whisperTargets,
        flags: {
          [MODULE_ID]: {
            rollButtons: {
              [buttonId]: {
                rolled: false,
                rollFormula: rollFormula,
                rollLabel: buttonLabel,
                isPublic: data.isPublic,
                characterId: playerInfo.character?.id || '',
                targetUserId: playerInfo.user?.id || '',
              },
            },
          },
        },
      };

      const chatMessage = await ChatMessage.create(messageData);

      // Store message ID for later updates
      this.saveRollButtonMessageId(buttonId, chatMessage.id);

      // Note: Click handlers are attached globally via renderChatMessageHTML hook in main.ts
      // This ensures all users get the handlers when they see the message

      return {
        success: true,
        message: `Roll request sent to ${playerInfo.targetName}. ${data.isPublic ? 'Public roll' : 'Private roll'} button created in chat.`,
      };
    } catch (error) {
      console.error(`[${MODULE_ID}] Error creating roll request:`, error);
      return {
        success: false,
        message: '',
        error: error instanceof Error ? error.message : 'Unknown error creating roll request',
      };
    }
  }

  /**
   * Enhanced player resolution with offline/non-existent player detection
   * Supports partial matching and provides structured error messages for MCP
   */
  private resolveTargetPlayer(targetPlayer: string): {
    found: boolean;
    user?: User;
    character?: Actor;
    targetName: string;
    errorType?: 'PLAYER_OFFLINE' | 'PLAYER_NOT_FOUND' | 'CHARACTER_NOT_FOUND';
    errorMessage?: string;
  } {
    const searchTerm = targetPlayer.toLowerCase().trim();

    // FIRST: Check all registered users (both active and inactive) for player name match
    const allUsers = Array.from(game.users?.values() || []);

    // Try exact player name match first (active and inactive users)
    let user = allUsers.find((u: User) => u.name?.toLowerCase() === searchTerm);

    if (user) {
      const isActive = user.active;

      if (!isActive) {
        // Player exists but is offline
        return {
          found: false,
          user,
          targetName: user.name || 'Unknown Player',
          errorType: 'PLAYER_OFFLINE',
          errorMessage: `Player "${user.name}" is registered but not currently logged in. They need to be online to receive roll requests.`,
        };
      }

      // Find the player's character for roll calculations
      const playerCharacter = game.actors?.find((actor: Actor) => {
        if (!user) return false;
        return actor.testUserPermission(user, 'OWNER') && !user.isGM;
      });

      return {
        found: true,
        user,
        ...(playerCharacter && { character: playerCharacter }), // Include character only if found
        targetName: user.name || 'Unknown Player',
      };
    }

    // Try partial player name match (active and inactive users)
    if (!user) {
      user = allUsers.find((u: User) => {
        return Boolean(u.name && u.name.toLowerCase().includes(searchTerm));
      });

      if (user) {
        const isActive = user.active;

        if (!isActive) {
          // Player exists but is offline
          return {
            found: false,
            user,
            targetName: user.name || 'Unknown Player',
            errorType: 'PLAYER_OFFLINE',
            errorMessage: `Player "${user.name}" is registered but not currently logged in. They need to be online to receive roll requests.`,
          };
        }

        // Find the player's character for roll calculations
        const playerCharacter = game.actors?.find((actor: Actor) => {
          if (!user) return false;
          return actor.testUserPermission(user, 'OWNER') && !user.isGM;
        });

        return {
          found: true,
          user,
          ...(playerCharacter && { character: playerCharacter }), // Include character only if found
          targetName: user.name || 'Unknown Player',
        };
      }
    }

    // SECOND: Try to find by character name (exact match, then partial match)
    let character = game.actors?.find(
      (actor: Actor) => actor.name?.toLowerCase() === searchTerm && actor.hasPlayerOwner
    );

    if (character) {
    }

    // If no exact character match, try partial match
    if (!character) {
      character = game.actors?.find((actor: Actor) => {
        return Boolean(
          actor.name && actor.name.toLowerCase().includes(searchTerm) && actor.hasPlayerOwner
        );
      });

      if (character) {
      }
    }

    if (character) {
      // Find the actual player owner (not GM) of this character
      const ownerUser = allUsers.find(
        (u: User) => character.testUserPermission(u, 'OWNER') && !u.isGM
      );

      if (ownerUser) {
        const isOwnerActive = ownerUser.active;

        if (!isOwnerActive) {
          // Character owner exists but is offline
          return {
            found: false,
            user: ownerUser,
            character,
            targetName: ownerUser.name || 'Unknown Player',
            errorType: 'PLAYER_OFFLINE',
            errorMessage: `Player "${ownerUser.name}" (owner of character "${character.name}") is registered but not currently logged in. They need to be online to receive roll requests.`,
          };
        }

        return {
          found: true,
          user: ownerUser,
          character,
          targetName: ownerUser.name || 'Unknown Player',
        };
      } else {
        // No player owner found - character is GM-only controlled
        // Still return found=true but without user, GM can still roll for it
        return {
          found: true,
          character,
          targetName: character.name || 'Unknown Character',
          // user is omitted (undefined) for GM-only characters
        };
      }
    }

    // THIRD: Check if the search term might be a character that exists but has no player owner
    const anyCharacter = game.actors?.find((actor: Actor) => {
      if (!actor.name) return false;
      return (
        actor.name.toLowerCase() === searchTerm || actor.name.toLowerCase().includes(searchTerm)
      );
    });

    if (anyCharacter && !anyCharacter.hasPlayerOwner) {
      return {
        found: true,
        character: anyCharacter,
        targetName: anyCharacter.name || 'Unknown Character',
        // No user for GM-controlled characters
      };
    }

    // No player or character found at all

    return {
      found: false,
      targetName: targetPlayer,
      errorType: 'PLAYER_NOT_FOUND',
      errorMessage: `No player or character named "${targetPlayer}" found. Available players: ${
        allUsers
          .filter(u => !u.isGM)
          .map(u => u.name)
          .join(', ') || 'none'
      }`,
    };
  }

  /**
   * Build roll formula based on roll type and target using Foundry's roll data system
   */
  private buildRollFormula(
    rollType: string,
    rollTarget: string,
    rollModifier: string,
    character?: Actor
  ): string {
    let baseFormula = '1d20';

    if (character) {
      // Use Foundry's getRollData() to get calculated modifiers including active effects
      const rollData = character.getRollData() as any; // Type assertion for Foundry's dynamic roll data

      switch (rollType) {
        case 'ability':
          // Use calculated ability modifier from roll data
          const abilityMod = rollData.abilities?.[rollTarget]?.mod ?? 0;
          baseFormula = `1d20+${abilityMod}`;
          break;

        case 'skill':
          // Map skill name to skill code (D&D 5e uses 3-letter codes)
          const skillCode = this.getSkillCode(rollTarget);
          // Use calculated skill total from roll data (includes ability mod + proficiency + bonuses)
          const skillMod = rollData.skills?.[skillCode]?.total ?? 0;
          baseFormula = `1d20+${skillMod}`;
          break;

        case 'save':
          // Use saving throw modifier from roll data
          const saveMod =
            rollData.abilities?.[rollTarget]?.save ?? rollData.abilities?.[rollTarget]?.mod ?? 0;
          baseFormula = `1d20+${saveMod}`;
          break;

        case 'initiative':
          // Use initiative modifier from attributes or dex mod
          const initMod = rollData.attributes?.init?.mod ?? rollData.abilities?.dex?.mod ?? 0;
          baseFormula = `1d20+${initMod}`;
          break;

        case 'custom':
          baseFormula = rollTarget; // Use rollTarget as the formula directly
          break;

        default:
          baseFormula = '1d20';
      }
    } else {
      console.warn(`[${MODULE_ID}] No character provided for roll formula, using base 1d20`);
    }

    // Add modifier if provided
    if (rollModifier && rollModifier.trim()) {
      const modifier =
        rollModifier.startsWith('+') || rollModifier.startsWith('-')
          ? rollModifier
          : `+${rollModifier}`;
      baseFormula += modifier;
    }

    return baseFormula;
  }

  /**
   * Map skill names to D&D 5e skill codes
   */
  private getSkillCode(skillName: string): string {
    const skillMap: { [key: string]: string } = {
      acrobatics: 'acr',
      'animal handling': 'ani',
      animalhandling: 'ani',
      arcana: 'arc',
      athletics: 'ath',
      deception: 'dec',
      history: 'his',
      insight: 'ins',
      intimidation: 'itm',
      investigation: 'inv',
      medicine: 'med',
      nature: 'nat',
      perception: 'prc',
      performance: 'prf',
      persuasion: 'per',
      religion: 'rel',
      'sleight of hand': 'slt',
      sleightofhand: 'slt',
      stealth: 'ste',
      survival: 'sur',
    };

    const normalizedName = skillName.toLowerCase().replace(/\s+/g, '');
    const skillCode =
      skillMap[normalizedName] || skillMap[skillName.toLowerCase()] || skillName.toLowerCase();

    return skillCode;
  }

  /**
   * Build roll button label
   */
  private buildRollButtonLabel(rollType: string, rollTarget: string, isPublic: boolean): string {
    const visibility = isPublic ? 'Public' : 'Private';

    switch (rollType) {
      case 'ability':
        return `${rollTarget.toUpperCase()} Ability Check (${visibility})`;
      case 'skill':
        return `${rollTarget.charAt(0).toUpperCase() + rollTarget.slice(1)} Skill Check (${visibility})`;
      case 'save':
        return `${rollTarget.toUpperCase()} Saving Throw (${visibility})`;
      case 'attack':
        return `${rollTarget} Attack (${visibility})`;
      case 'initiative':
        return `Initiative Roll (${visibility})`;
      case 'custom':
        return `Custom Roll (${visibility})`;
      default:
        return `Roll (${visibility})`;
    }
  }

  /**
   * Restore roll button states from persistent storage
   * Called when chat messages are rendered to maintain state across sessions
   */

  /**
   * Attach click handlers to roll buttons and handle visibility
   * Called by global renderChatMessageHTML hook in main.ts
   */
  public attachRollButtonHandlers(html: JQuery): void {
    const currentUserId = game.user?.id;
    const isGM = game.user?.isGM;

    // Note: Roll state restoration now handled by ChatMessage content, not DOM manipulation

    // Handle button visibility and styling based on permissions and public/private status
    // IMPORTANT: Skip styling for buttons that are already in rolled state
    html.find('.mcp-roll-button').each((_index, element) => {
      const button = $(element);
      const targetUserId = button.data('target-user-id');
      const isPublicRollRaw = button.data('is-public');
      const isPublicRoll = isPublicRollRaw === true || isPublicRollRaw === 'true';

      // Note: No need to check for rolled state - ChatMessage.update() replaces buttons with completion status

      // Determine if user can interact with this button
      const canClickButton = isGM || (targetUserId && targetUserId === currentUserId);

      if (isPublicRoll) {
        // Public roll: show to all players, but style differently for non-clickable users
        if (canClickButton) {
          // Can click: normal active button
          button.css({
            background: '#4CAF50',
            cursor: 'pointer',
            opacity: '1',
          });
        } else {
          // Cannot click: disabled/informational style
          button.css({
            background: '#9E9E9E',
            cursor: 'not-allowed',
            opacity: '0.7',
          });
          button.prop('disabled', true);
        }
      } else {
        // Private roll: only show to target user and GM
        if (canClickButton) {
          button.show();
        } else {
          button.hide();
        }
      }
    });

    // Attach click handlers to roll buttons
    html.find('.mcp-roll-button').on('click', async event => {
      const button = $(event.currentTarget);

      // Ignore clicks on disabled buttons
      if (button.prop('disabled')) {
        return;
      }

      // Prevent double-clicks by immediately disabling the button
      button.prop('disabled', true);
      const originalText = button.text();
      button.text('🎲 Rolling...');

      // Check if this button is already being processed by another user
      const buttonId = button.data('button-id');
      if (buttonId && this.isRollButtonProcessing(buttonId)) {
        button.text('🎲 Processing...');
        return;
      }

      // Mark this button as being processed
      if (buttonId) {
        this.setRollButtonProcessing(buttonId, true);
      }

      // Validate button has required data
      if (!buttonId) {
        console.warn(`[${MODULE_ID}] Button missing button-id data attribute`);
        button.prop('disabled', false);
        button.text(originalText);
        return;
      }

      const rollFormula = button.data('roll-formula');
      const rollLabel = button.data('roll-label');
      const isPublicRaw = button.data('is-public');
      const isPublic = isPublicRaw === true || isPublicRaw === 'true'; // Convert to proper boolean
      const characterId = button.data('character-id');
      const targetUserId = button.data('target-user-id');
      const isGmRoll = game.user?.isGM || false; // Determine if this is a GM executing the roll

      // Check if user has permission to execute this roll
      // Allow GM to roll for any character, or allow character owner to roll for their character
      const canExecuteRoll = game.user?.isGM || (targetUserId && targetUserId === game.user?.id);

      if (!canExecuteRoll) {
        console.warn(`[${MODULE_ID}] Permission denied for roll execution`);
        ui.notifications?.warn('You do not have permission to execute this roll');
        return;
      }

      try {
        // Create and evaluate the roll
        const roll = new Roll(rollFormula);
        await roll.evaluate();

        // Get the character for speaker info
        const character = characterId ? game.actors?.get(characterId) : null;

        // Use the modern Foundry v13 approach with roll.toMessage()
        const rollMode = isPublic ? 'publicroll' : 'whisper';
        const whisperTargets: string[] = [];

        if (!isPublic) {
          // For private rolls: whisper to target + GM
          if (targetUserId) {
            whisperTargets.push(targetUserId);
          }
          // Add all active GMs
          const gmUsers = game.users?.filter((u: User) => u.isGM && u.active);
          if (gmUsers) {
            for (const gm of gmUsers) {
              if (gm.id && !whisperTargets.includes(gm.id)) {
                whisperTargets.push(gm.id);
              }
            }
          }
        }

        const messageData: any = {
          speaker: ChatMessage.getSpeaker({ actor: character }),
          flavor: `${rollLabel} ${isGmRoll ? '(GM Override)' : ''}`,
          ...(whisperTargets.length > 0 ? { whisper: whisperTargets } : {}),
        };

        // Use roll.toMessage() with proper rollMode
        await roll.toMessage(messageData, {
          create: true,
          rollMode: rollMode,
        });

        // Update the ChatMessage to reflect rolled state
        const buttonId = button.data('button-id');
        if (buttonId && game.user?.id) {
          try {
            await this.updateRollButtonMessage(buttonId, game.user.id, rollLabel);
          } catch (updateError) {
            console.error(`[${MODULE_ID}] Failed to update chat message:`, updateError);
            console.error(
              `[${MODULE_ID}] Error details:`,
              updateError instanceof Error ? updateError.stack : updateError
            );
            // Fall back to DOM manipulation if message update fails
            button.prop('disabled', true).text('✓ Rolled');
          }
        } else {
          console.warn(`[${MODULE_ID}] Cannot update ChatMessage - missing buttonId or userId:`, {
            buttonId,
            userId: game.user?.id,
          });
        }
      } catch (error) {
        console.error(`[${MODULE_ID}] Error executing roll:`, error);
        ui.notifications?.error('Failed to execute roll');

        // Re-enable button on error so user can try again
        button.prop('disabled', false);
        button.text(originalText);
      } finally {
        // Clear processing state
        if (buttonId) {
          this.setRollButtonProcessing(buttonId, false);
        }
      }
    });
  }

  /**
   * Get enhanced creature index for campaign analysis
   */
  async getEnhancedCreatureIndex(): Promise<any[]> {
    this.validateFoundryState();

    // Get the enhanced creature index (builds if needed)
    const enhancedCreatures = await this.persistentIndex.getEnhancedIndex();

    return enhancedCreatures || [];
  }

  /**
   * Save roll button state to persistent storage
   */
  async saveRollState(buttonId: string, userId: string): Promise<void> {
    // LEGACY METHOD - Redirecting to new ChatMessage.update() system

    try {
      // Use the new ChatMessage.update() approach instead
      const rollLabel = 'Legacy Roll'; // We don't have the label here, use generic
      await this.updateRollButtonMessage(buttonId, userId, rollLabel);
    } catch (error) {
      console.error(`[${MODULE_ID}] Legacy saveRollState redirect failed:`, error);
      // Don't throw - we don't want to break the old system completely
    }
  }

  /**
   * Get roll button state from persistent storage
   */
  getRollState(
    buttonId: string
  ): { rolled: boolean; rolledBy?: string; rolledByName?: string; timestamp?: number } | null {
    this.validateFoundryState();

    try {
      const rollStates = game.settings.get(MODULE_ID, 'rollStates') || {};
      return rollStates[buttonId] || null;
    } catch (error) {
      console.error(`[${MODULE_ID}] Error getting roll state:`, error);
      return null;
    }
  }

  /**
   * Save button ID to message ID mapping for ChatMessage updates
   */
  saveRollButtonMessageId(buttonId: string, messageId: string): void {
    try {
      const buttonMessageMap = game.settings.get(MODULE_ID, 'buttonMessageMap') || {};
      buttonMessageMap[buttonId] = messageId;
      game.settings.set(MODULE_ID, 'buttonMessageMap', buttonMessageMap);
    } catch (error) {
      console.error(`[${MODULE_ID}] Error saving button-message mapping:`, error);
    }
  }

  /**
   * Get message ID for a roll button
   */
  getRollButtonMessageId(buttonId: string): string | null {
    try {
      const buttonMessageMap = game.settings.get(MODULE_ID, 'buttonMessageMap') || {};
      return buttonMessageMap[buttonId] || null;
    } catch (error) {
      console.error(`[${MODULE_ID}] Error getting button-message mapping:`, error);
      return null;
    }
  }

  /**
   * Get roll button state from ChatMessage flags
   */
  getRollStateFromMessage(chatMessage: any, buttonId: string): any {
    try {
      const rollButtons = chatMessage.getFlag(MODULE_ID, 'rollButtons');
      return rollButtons?.[buttonId] || null;
    } catch (error) {
      console.error(`[${MODULE_ID}] Error getting roll state from message:`, error);
      return null;
    }
  }

  /**
   * Update the ChatMessage to replace button with rolled state
   */
  async updateRollButtonMessage(
    buttonId: string,
    userId: string,
    rollLabel: string
  ): Promise<void> {
    try {
      // Get the message ID for this button
      const messageId = this.getRollButtonMessageId(buttonId);

      if (!messageId) {
        throw new Error(`No message ID found for button ${buttonId}`);
      }

      // Get the chat message
      const chatMessage = game.messages?.get(messageId);

      if (!chatMessage) {
        throw new Error(`ChatMessage ${messageId} not found`);
      }

      const rolledByName = game.users?.get(userId)?.name || 'Unknown';
      const timestamp = new Date().toLocaleString();

      // Check permissions before attempting update
      const canUpdate = chatMessage.canUserModify(game.user, 'update');

      if (!canUpdate && !game.user?.isGM) {
        // Non-GM user cannot update message - request GM to do it via socket

        // Find online GM
        const onlineGM = game.users?.find(u => u.isGM && u.active);
        if (!onlineGM) {
          throw new Error('No Game Master is online to update the chat message');
        }

        // Send socket request to GM
        if (game.socket) {
          game.socket.emit('module.jdr-mcp-bridge', {
            type: 'requestMessageUpdate',
            buttonId: buttonId,
            userId: userId,
            rollLabel: rollLabel,
            messageId: messageId,
            fromUserId: game.user.id,
            targetGM: onlineGM.id,
          });
          return; // Exit early - GM will handle the update
        } else {
          throw new Error('Socket not available for GM communication');
        }
      }

      // Update the message flags to mark button as rolled
      const currentFlags = chatMessage.flags || {};
      const moduleFlags = currentFlags[MODULE_ID] || {};
      const rollButtons = moduleFlags.rollButtons || {};

      rollButtons[buttonId] = {
        ...rollButtons[buttonId],
        rolled: true,
        rolledBy: userId,
        rolledByName: rolledByName,
        timestamp: Date.now(),
      };

      // Create the rolled state HTML
      const rolledHtml = `
        <div class="mcp-roll-request" style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px; background: #f9f9f9;">
          <p><strong>Roll Request:</strong> ${rollLabel}</p>
          <p><strong>Status:</strong> ✅ <strong>Completed by ${rolledByName}</strong> at ${timestamp}</p>
        </div>
      `;

      // Update the message content and flags
      await chatMessage.update({
        content: rolledHtml,
        flags: {
          ...currentFlags,
          [MODULE_ID]: {
            ...moduleFlags,
            rollButtons: rollButtons,
          },
        },
      });
    } catch (error) {
      console.error(`[${MODULE_ID}] Error updating roll button message:`, error);
      console.error(`[${MODULE_ID}] Error stack:`, error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  /**
   * Request GM to save roll state (for non-GM users who can't write to world settings)
   */
  requestRollStateSave(buttonId: string, userId: string): void {
    // LEGACY METHOD - Redirecting to new ChatMessage.update() system

    try {
      // Use the new ChatMessage.update() approach instead
      const rollLabel = 'Legacy Roll'; // We don't have the label here, use generic
      this.updateRollButtonMessage(buttonId, userId, rollLabel)
        .then(() => {})
        .catch(error => {
          console.error(`[${MODULE_ID}] Legacy requestRollStateSave redirect failed:`, error);
          // If the new system fails, just log it - don't use the old socket system
        });
    } catch (error) {
      console.error(`[${MODULE_ID}] Error in legacy requestRollStateSave redirect:`, error);
    }
  }

  /**
   * Broadcast roll state change to all connected users for real-time sync
   */
  broadcastRollState(_buttonId: string, _rollState: any): void {
    // LEGACY METHOD - No longer needed with ChatMessage.update() system
    // ChatMessage.update() automatically broadcasts to all clients, so this method is no longer needed
  }

  /**
   * Clean up old roll states (optional maintenance)
   * Removes roll states older than 30 days to prevent storage bloat
   */
  async cleanOldRollStates(): Promise<number> {
    this.validateFoundryState();

    try {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const rollStates = game.settings.get(MODULE_ID, 'rollStates') || {};
      let cleanedCount = 0;

      // Remove old roll states
      for (const [buttonId, rollState] of Object.entries(rollStates)) {
        if (rollState && typeof rollState === 'object' && 'timestamp' in rollState) {
          const timestamp = (rollState as any).timestamp;
          if (typeof timestamp === 'number' && timestamp < thirtyDaysAgo) {
            delete rollStates[buttonId];
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        await game.settings.set(MODULE_ID, 'rollStates', rollStates);
      }

      return cleanedCount;
    } catch (error) {
      console.error(`[${MODULE_ID}] Error cleaning old roll states:`, error);
      return 0;
    }
  }

  /**
   * Set actor ownership permission for a user
   */
  async setActorOwnership(data: {
    actorId: string;
    userId: string;
    permission: number;
  }): Promise<{ success: boolean; message: string; error?: string }> {
    this.validateFoundryState();

    try {
      const actor = game.actors?.get(data.actorId);
      if (!actor) {
        return { success: false, error: `Actor not found: ${data.actorId}`, message: '' };
      }

      const user = game.users?.get(data.userId);
      if (!user) {
        return { success: false, error: `User not found: ${data.userId}`, message: '' };
      }

      // Get current ownership
      const currentOwnership = (actor as any).ownership || {};
      const newOwnership = { ...currentOwnership };

      // Set the new permission level
      newOwnership[data.userId] = data.permission;

      // Update the actor
      await actor.update({ ownership: newOwnership });

      const permissionNames = { 0: 'NONE', 1: 'LIMITED', 2: 'OBSERVER', 3: 'OWNER' };
      const permissionName =
        permissionNames[data.permission as keyof typeof permissionNames] ||
        data.permission.toString();

      return {
        success: true,
        message: `Set ${actor.name} ownership to ${permissionName} for ${user.name}`,
      };
    } catch (error) {
      console.error(`[${MODULE_ID}] Error setting actor ownership:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '',
      };
    }
  }

  /**
   * Set an actor's portrait (actor.img) and/or prototype token texture, and optionally apply
   * sensible "player character" prototype-token defaults (linked, vision on, friendly, HP bar).
   * Images must already be Foundry web paths (uploaded beforehand) — remote http URLs are not
   * accepted for token textures in v14.
   */
  async setActorImage(data: {
    actorIdentifier: string;
    img?: string;
    tokenSrc?: string;
    applyPjDefaults?: boolean;
    dynamicRing?: boolean;
    disposition?: number;
    displayName?: number;
    displayBars?: number;
  }): Promise<{
    success: boolean;
    message: string;
    error?: string;
    actorId?: string;
    actorName?: string;
    applied?: Record<string, unknown>;
  }> {
    this.validateFoundryState();

    try {
      const actor = this.findActorByIdentifier(data.actorIdentifier);
      if (!actor) {
        return { success: false, error: `Actor not found: ${data.actorIdentifier}`, message: '' };
      }

      const patch: any = {};
      const applied: Record<string, unknown> = {};

      if (data.img) {
        patch.img = data.img;
        applied.img = data.img;
      }

      const proto: any = {};
      if (data.tokenSrc) {
        proto.texture = { src: data.tokenSrc };
        applied.tokenSrc = data.tokenSrc;
      }

      // TOKEN_DISPLAY_MODES.HOVER = 1 (name/bars shown on hover)
      const HOVER = 1;
      if (data.applyPjDefaults) {
        proto.actorLink = true;
        proto.sight = { enabled: true };
        proto.disposition = data.disposition ?? 1; // 1 = friendly
        proto.displayName = data.displayName ?? HOVER;
        proto.displayBars = data.displayBars ?? HOVER;
        proto.bar1 = { attribute: 'attributes.hp' };
        applied.pjDefaults = true;
      } else {
        if (data.disposition !== undefined) proto.disposition = data.disposition;
        if (data.displayName !== undefined) proto.displayName = data.displayName;
        if (data.displayBars !== undefined) proto.displayBars = data.displayBars;
      }

      if (data.dynamicRing) {
        proto.ring = { enabled: true };
        applied.dynamicRing = true;
      }

      if (Object.keys(proto).length > 0) {
        patch.prototypeToken = proto;
      }

      if (Object.keys(patch).length === 0) {
        return {
          success: false,
          error: 'Nothing to update: provide img, tokenSrc, or prototype-token config',
          message: '',
        };
      }

      await actor.update(patch);

      return {
        success: true,
        actorId: actor.id,
        actorName: actor.name,
        applied,
        message: `Updated token/image for ${actor.name}`,
      };
    } catch (error) {
      console.error(`[${MODULE_ID}] Error setting actor image:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '',
      };
    }
  }

  /**
   * Get actor ownership information
   */
  async getActorOwnership(data: {
    actorIdentifier?: string;
    playerIdentifier?: string;
  }): Promise<any> {
    this.validateFoundryState();

    try {
      const actors = data.actorIdentifier
        ? data.actorIdentifier === 'all'
          ? Array.from(game.actors || [])
          : [this.findActorByIdentifier(data.actorIdentifier)].filter(Boolean)
        : Array.from(game.actors || []);

      const users = data.playerIdentifier
        ? [
            game.users?.getName(data.playerIdentifier) || game.users?.get(data.playerIdentifier),
          ].filter(Boolean)
        : Array.from(game.users || []);

      const ownershipInfo = [];
      const permissionNames = { 0: 'NONE', 1: 'LIMITED', 2: 'OBSERVER', 3: 'OWNER' };

      for (const actor of actors) {
        const actorInfo: any = {
          id: actor.id,
          name: actor.name,
          type: actor.type,
          ownership: [],
        };

        for (const user of users.filter(u => u && !u.isGM)) {
          const permission = actor.testUserPermission(user, 'OWNER')
            ? 3
            : actor.testUserPermission(user, 'OBSERVER')
              ? 2
              : actor.testUserPermission(user, 'LIMITED')
                ? 1
                : 0;

          actorInfo.ownership.push({
            userId: user!.id,
            userName: user!.name,
            permission: permissionNames[permission as keyof typeof permissionNames],
            numericPermission: permission,
          });
        }

        ownershipInfo.push(actorInfo);
      }

      return ownershipInfo;
    } catch (error) {
      console.error(`[${MODULE_ID}] Error getting actor ownership:`, error);
      throw error;
    }
  }

  /**
   * Find actor by name or ID
   */
  private findActorByIdentifier(identifier: string): any {
    return (
      game.actors?.get(identifier) ||
      game.actors?.getName(identifier) ||
      Array.from(game.actors || []).find(a =>
        a.name?.toLowerCase().includes(identifier.toLowerCase())
      )
    );
  }

  /**
   * Get friendly NPCs from current scene
   */
  async getFriendlyNPCs(): Promise<Array<{ id: string; name: string }>> {
    this.validateFoundryState();

    try {
      const scene = game.scenes?.find(s => s.active);
      if (!scene) {
        return [];
      }

      const friendlyTokens = scene.tokens.filter(
        (token: any) => token.disposition === 1 // FRIENDLY disposition
      );

      return friendlyTokens
        .map((token: any) => ({
          id: token.actor?.id || token.id || '',
          name: token.name || token.actor?.name || 'Unknown',
        }))
        .filter(t => t.id);
    } catch (error) {
      console.error(`[${MODULE_ID}] Error getting friendly NPCs:`, error);
      return [];
    }
  }

  /**
   * Get party characters (player-owned actors)
   */
  async getPartyCharacters(): Promise<Array<{ id: string; name: string }>> {
    this.validateFoundryState();

    try {
      const partyCharacters = Array.from(game.actors || []).filter(
        actor => actor.hasPlayerOwner && actor.type === 'character'
      );

      return partyCharacters
        .map(actor => ({
          id: actor.id || '',
          name: actor.name || 'Unknown',
        }))
        .filter(c => c.id);
    } catch (error) {
      console.error(`[${MODULE_ID}] Error getting party characters:`, error);
      return [];
    }
  }

  /**
   * Get connected players (excluding GM)
   */
  async getConnectedPlayers(): Promise<Array<{ id: string; name: string }>> {
    this.validateFoundryState();

    try {
      const connectedPlayers = Array.from(game.users || []).filter(
        user => user.active && !user.isGM
      );

      return connectedPlayers
        .map(user => ({
          id: user.id || '',
          name: user.name || 'Unknown',
        }))
        .filter(u => u.id);
    } catch (error) {
      console.error(`[${MODULE_ID}] Error getting connected players:`, error);
      return [];
    }
  }

  /**
   * Find players by identifier with partial matching
   */
  async findPlayers(data: {
    identifier: string;
    allowPartialMatch?: boolean;
    includeCharacterOwners?: boolean;
  }): Promise<Array<{ id: string; name: string }>> {
    this.validateFoundryState();

    try {
      const { identifier, allowPartialMatch = true, includeCharacterOwners = true } = data;
      const searchTerm = identifier.toLowerCase();
      const players = [];

      // Direct user name matching
      for (const user of game.users || []) {
        if (user.isGM) continue;

        const userName = user.name?.toLowerCase() || '';
        if (userName === searchTerm || (allowPartialMatch && userName.includes(searchTerm))) {
          players.push({ id: user.id || '', name: user.name || 'Unknown' });
        }
      }

      // Character name matching (find owner of character)
      if (includeCharacterOwners && players.length === 0) {
        for (const actor of game.actors || []) {
          if (actor.type !== 'character') continue;

          const actorName = actor.name?.toLowerCase() || '';
          if (actorName === searchTerm || (allowPartialMatch && actorName.includes(searchTerm))) {
            // Find the player owner of this character
            const owner = game.users?.find(
              user => actor.testUserPermission(user, 'OWNER') && !user.isGM
            );

            if (owner && !players.some(p => p.id === owner.id)) {
              players.push({ id: owner.id || '', name: owner.name || 'Unknown' });
            }
          }
        }
      }

      return players.filter(p => p.id);
    } catch (error) {
      console.error(`[${MODULE_ID}] Error finding players:`, error);
      return [];
    }
  }

  /**
   * Find single actor by identifier
   */
  async findActor(data: { identifier: string }): Promise<{ id: string; name: string } | null> {
    this.validateFoundryState();

    try {
      const actor = this.findActorByIdentifier(data.identifier);
      return actor ? { id: actor.id, name: actor.name } : null;
    } catch (error) {
      console.error(`[${MODULE_ID}] Error finding actor:`, error);
      return null;
    }
  }

  // ===== Gestion des droits : rôles utilisateurs, perso par défaut, ownership de documents =====

  private readonly USER_ROLE_VALUES: Record<string, number> = {
    NONE: 0,
    PLAYER: 1,
    TRUSTED: 2,
    ASSISTANT: 3,
    GAMEMASTER: 4,
  };
  private readonly USER_ROLE_LABELS_FR: Record<number, string> = {
    0: 'Aucun',
    1: 'Joueur',
    2: 'De confiance',
    3: 'Assistant-MJ',
    4: 'MJ',
  };
  private readonly OWNERSHIP_LEVEL_NAMES: Record<number, string> = {
    0: 'NONE',
    1: 'LIMITED',
    2: 'OBSERVER',
    3: 'OWNER',
  };

  /** Numeric role for a user, tolerant of string roles. */
  private getUserRoleValue(user: any): number {
    if (typeof user?.role === 'number') return user.role;
    return this.USER_ROLE_VALUES[String(user?.role).toUpperCase()] ?? 1;
  }

  /** Find a Foundry user by id, exact name, or partial (case-insensitive) name. */
  private findUserByIdentifier(identifier: string): any {
    if (!identifier) return null;
    return (
      game.users?.get(identifier) ||
      game.users?.getName(identifier) ||
      Array.from(game.users || []).find((u: any) =>
        u.name?.toLowerCase().includes(identifier.toLowerCase())
      ) ||
      null
    );
  }

  /** List all users with role, assigned character and (optionally) explicitly owned actors. */
  async listUsers(data: { includeOwnedActors?: boolean } = {}): Promise<any> {
    this.validateFoundryState();
    const includeOwned = data?.includeOwnedActors !== false;
    const allActors = Array.from(game.actors || []) as any[];
    return (Array.from(game.users || []) as any[]).map(user => {
      const roleNum = this.getUserRoleValue(user);
      const charId =
        user.character?.id ?? (typeof user.character === 'string' ? user.character : null);
      const charActor = charId ? game.actors?.get(charId) : (user.character ?? null);
      const result: any = {
        id: user.id,
        name: user.name,
        role: this.USER_ROLE_LABELS_FR[roleNum] || String(roleNum),
        roleValue: roleNum,
        active: !!user.active,
        isGM: !!user.isGM,
        color: user.color ? String(user.color) : null,
        character: charActor ? { id: charActor.id, name: charActor.name } : null,
      };
      // Only meaningful for players (GM implicitly owns everything → don't list).
      if (includeOwned && !user.isGM) {
        result.ownedActors = allActors
          .filter(a => ((a.ownership || {})[user.id] ?? 0) === 3)
          .map(a => ({ id: a.id, name: a.name }));
      }
      return result;
    });
  }

  /** Change a user's role, with guards against lock-out and demoting the last GM. */
  async setUserRole(data: {
    userIdentifier: string;
    role: number;
    confirm?: boolean;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    this.validateFoundryState();
    try {
      const user = this.findUserByIdentifier(data.userIdentifier);
      if (!user) return { success: false, error: `Utilisateur introuvable : ${data.userIdentifier}` };

      const newRole = Number(data.role);
      if (!(newRole in this.USER_ROLE_LABELS_FR)) {
        return { success: false, error: `Rôle invalide : ${data.role}` };
      }
      // Guard: never change your own role (the GM running the bridge → avoid lock-out).
      if (user.id === game.user?.id) {
        return {
          success: false,
          error: 'Refus : impossible de modifier votre propre rôle (risque de blocage du MJ/bridge).',
        };
      }
      // Guard: promoting to GAMEMASTER requires explicit confirmation.
      if (newRole === 4 && !data.confirm) {
        return {
          success: false,
          error: `Promotion de ${user.name} en MJ : repassez avec confirm=true pour confirmer.`,
        };
      }
      // Guard: do not demote the last remaining GM.
      if (this.getUserRoleValue(user) === 4 && newRole < 4) {
        const gmCount = (Array.from(game.users || []) as any[]).filter(
          u => this.getUserRoleValue(u) === 4
        ).length;
        if (gmCount <= 1) {
          return { success: false, error: 'Refus : impossible de rétrograder le dernier MJ du monde.' };
        }
      }

      await user.update({ role: newRole });
      return { success: true, message: `Rôle de ${user.name} → ${this.USER_ROLE_LABELS_FR[newRole]}` };
    } catch (error) {
      console.error(`[${MODULE_ID}] Error setting user role:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /** Set (or clear) a user's default character, optionally granting OWNER of that actor. */
  async assignDefaultCharacter(data: {
    userIdentifier: string;
    actorIdentifier?: string;
    clear?: boolean;
    grantOwnership?: boolean;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    this.validateFoundryState();
    try {
      const user = this.findUserByIdentifier(data.userIdentifier);
      if (!user) return { success: false, error: `Utilisateur introuvable : ${data.userIdentifier}` };

      if (data.clear) {
        await user.update({ character: null });
        return { success: true, message: `Personnage par défaut de ${user.name} retiré.` };
      }
      if (!data.actorIdentifier) {
        return { success: false, error: 'actorIdentifier requis (ou clear=true).' };
      }
      const actor = this.findActorByIdentifier(data.actorIdentifier);
      if (!actor) return { success: false, error: `Acteur introuvable : ${data.actorIdentifier}` };

      await user.update({ character: actor.id });
      let ownershipNote = '';
      if (data.grantOwnership !== false && !user.isGM) {
        const newOwnership = { ...((actor as any).ownership || {}) };
        newOwnership[user.id] = 3; // OWNER
        await actor.update({ ownership: newOwnership });
        ownershipNote = ' (+ OWNER accordé)';
      }
      return {
        success: true,
        message: `Personnage par défaut de ${user.name} → ${actor.name}${ownershipNote}`,
      };
    } catch (error) {
      console.error(`[${MODULE_ID}] Error assigning default character:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /** Resolve a world document collection by document type. */
  private getDocumentCollection(documentType: string): any {
    const g = game as any;
    switch (documentType) {
      case 'JournalEntry':
        return g.journal;
      case 'Scene':
        return g.scenes;
      case 'Item':
        return g.items;
      case 'RollTable':
        return g.tables;
      case 'Macro':
        return g.macros;
      case 'Actor':
        return g.actors;
      default:
        return null;
    }
  }

  /** Find a document in a collection by id, exact name, or partial name. */
  private findDocumentByIdentifier(collection: any, identifier: string): any {
    if (!collection) return null;
    return (
      collection.get?.(identifier) ||
      collection.getName?.(identifier) ||
      (Array.from(collection) as any[]).find(d =>
        d.name?.toLowerCase().includes(identifier.toLowerCase())
      ) ||
      null
    );
  }

  /** Set ownership on a non-actor document (journal/scene/item/table/macro/actor). */
  async setDocumentOwnership(data: {
    documentType: string;
    documentIdentifier: string;
    target: string; // userIdentifier | 'default' | 'party' | 'all'
    permission: number;
    confirmBulkOperation?: boolean;
  }): Promise<{ success: boolean; message?: string; error?: string; ownership?: any }> {
    this.validateFoundryState();
    try {
      const collection = this.getDocumentCollection(data.documentType);
      if (!collection) {
        return { success: false, error: `Type de document non supporté : ${data.documentType}` };
      }
      const doc = this.findDocumentByIdentifier(collection, data.documentIdentifier);
      if (!doc) {
        return {
          success: false,
          error: `${data.documentType} introuvable : ${data.documentIdentifier}`,
        };
      }
      const perm = Number(data.permission);
      if (!(perm in this.OWNERSHIP_LEVEL_NAMES)) {
        return { success: false, error: `Niveau de permission invalide : ${data.permission}` };
      }

      const targetRaw = String(data.target || '').toLowerCase();
      const isBulk = targetRaw === 'default' || targetRaw === 'party' || targetRaw === 'all';
      if (isBulk && !data.confirmBulkOperation) {
        return {
          success: false,
          error: `Opération groupée (${data.target}) : repassez avec confirmBulkOperation=true.`,
        };
      }

      const newOwnership = { ...((doc as any).ownership || {}) };
      const affected: string[] = [];
      if (targetRaw === 'default' || targetRaw === 'all') {
        newOwnership.default = perm;
        affected.push('tout le monde (default)');
      }
      if (targetRaw === 'party' || targetRaw === 'all') {
        for (const u of Array.from(game.users || []) as any[]) {
          if (!u.isGM) {
            newOwnership[u.id] = perm;
            affected.push(u.name);
          }
        }
      }
      if (!isBulk) {
        const user = this.findUserByIdentifier(data.target);
        if (!user) return { success: false, error: `Utilisateur introuvable : ${data.target}` };
        newOwnership[user.id] = perm;
        affected.push(user.name);
      }

      await doc.update({ ownership: newOwnership });
      return {
        success: true,
        message: `${data.documentType} « ${doc.name} » : ${this.OWNERSHIP_LEVEL_NAMES[perm]} → ${affected.join(', ')}`,
        ownership: newOwnership,
      };
    } catch (error) {
      console.error(`[${MODULE_ID}] Error setting document ownership:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Private storage for tracking roll button processing states
  private rollButtonProcessingStates: Map<string, boolean> = new Map();

  /**
   * Check if a roll button is currently being processed
   */
  private isRollButtonProcessing(buttonId: string): boolean {
    return this.rollButtonProcessingStates.get(buttonId) || false;
  }

  /**
   * Set roll button processing state
   */
  private setRollButtonProcessing(buttonId: string, processing: boolean): void {
    if (processing) {
      this.rollButtonProcessingStates.set(buttonId, true);
    } else {
      this.rollButtonProcessingStates.delete(buttonId);
    }
  }

  /**
   * Get or create a folder for organizing MCP-generated content
   */
  private async getOrCreateFolder(
    folderName: string,
    type: 'Actor' | 'JournalEntry'
  ): Promise<string | null> {
    try {
      // Look for existing folder
      const existingFolder = game.folders?.find(
        (f: any) => f.name === folderName && f.type === type
      );

      if (existingFolder) {
        return existingFolder.id;
      }

      // Create appropriate descriptions
      let description = '';
      if (type === 'Actor') {
        if (folderName === 'Foundry MCP Creatures') {
          description = 'Creatures and monsters created via Foundry MCP Bridge';
        } else {
          description = `NPCs and creatures related to: ${folderName}`;
        }
      } else {
        description = `Quest and content for: ${folderName}`;
      }

      // Create new folder
      const folderData = {
        name: folderName,
        type: type,
        description: description,
        color: type === 'Actor' ? '#4a90e2' : '#f39c12', // Blue for actors, orange for journals
        sort: 0,
        parent: null,
        flags: {
          'jdr-mcp-bridge': {
            mcpGenerated: true,
            createdAt: new Date().toISOString(),
            questContext: type === 'JournalEntry' ? folderName : undefined,
          },
        },
      };

      const folder = await Folder.create(folderData);
      return folder?.id || null;
    } catch (error) {
      console.warn(`[${this.moduleId}] Failed to create folder "${folderName}":`, error);
      // Return null so items are created without folders rather than failing
      return null;
    }
  }

  /**
   * List all scenes with filtering options
   */
  async listScenes(
    options: { filter?: string; include_active_only?: boolean } = {}
  ): Promise<any[]> {
    this.validateFoundryState();

    try {
      let scenes = game.scenes?.contents || [];

      // Filter by active only if requested
      if (options.include_active_only) {
        scenes = scenes.filter((scene: any) => scene.active);
      }

      // Filter by name if provided
      if (options.filter) {
        const filterLower = options.filter.toLowerCase();
        scenes = scenes.filter((scene: any) => scene.name.toLowerCase().includes(filterLower));
      }

      // Map to consistent format
      return scenes.map((scene: any) => ({
        id: scene.id,
        name: scene.name,
        active: scene.active,
        dimensions: {
          width: scene.dimensions?.width || (scene as any).width || 0,
          height: scene.dimensions?.height || (scene as any).height || 0,
        },
        gridSize: scene.grid?.size || 100,
        background: scene._source?.background?.src || scene.img || '',
        walls: scene.walls?.size || 0,
        tokens: scene.tokens?.size || 0,
        lighting: scene.lights?.size || 0,
        sounds: scene.sounds?.size || 0,
        navigation: scene.navigation || false,
      }));
    } catch (error) {
      throw new Error(
        `Failed to list scenes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Switch to a different scene
   */
  async switchScene(options: { scene_identifier: string; optimize_view?: boolean }): Promise<any> {
    this.validateFoundryState();

    try {
      // Find the target scene by ID or name
      const scenes = game.scenes?.contents || [];
      const targetScene = scenes.find(
        (scene: any) =>
          scene.id === options.scene_identifier ||
          scene.name.toLowerCase() === options.scene_identifier.toLowerCase()
      );

      if (!targetScene) {
        throw new Error(`Scene not found: "${options.scene_identifier}"`);
      }

      // Activate the scene
      await targetScene.activate();

      // Optimize view if requested (default true)
      if (options.optimize_view !== false && typeof canvas !== 'undefined' && canvas?.scene) {
        const dimensions = targetScene.dimensions || {
          width: (targetScene as any).width || 0,
          height: (targetScene as any).height || 0,
        };
        const width = (dimensions as any).width || 0;
        const height = (dimensions as any).height || 0;

        if (width && height) {
          // Center the view on the scene
          await canvas.pan({
            x: width / 2,
            y: height / 2,
            scale: Math.min(
              (canvas as any).screenDimensions?.[0] / width || 1,
              (canvas as any).screenDimensions?.[1] / height || 1,
              1
            ),
          });
        }
      }

      return {
        success: true,
        sceneId: targetScene.id,
        sceneName: targetScene.name,
        dimensions: {
          width: (targetScene.dimensions as any)?.width || (targetScene as any).width || 0,
          height: (targetScene.dimensions as any)?.height || (targetScene as any).height || 0,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to switch scene: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ===== PHASE 7: CHARACTER ENTITY AND TOKEN MANIPULATION METHODS =====

  /**
   * Get detailed information about a specific entity within a character (item, action, or effect)
   */
  async getCharacterEntity(data: {
    characterIdentifier: string;
    entityIdentifier: string;
  }): Promise<any> {
    this.validateFoundryState();

    try {
      // Find the character first
      const actors = game.actors?.contents || [];
      const character = actors.find(
        (actor: any) =>
          actor.id === data.characterIdentifier ||
          actor.name.toLowerCase() === data.characterIdentifier.toLowerCase()
      );

      if (!character) {
        throw new Error(`Character not found: "${data.characterIdentifier}"`);
      }

      // Search in items first (by ID or name)
      const items = character.items?.contents || [];
      let entity = items.find(
        (item: any) =>
          item.id === data.entityIdentifier ||
          item.name.toLowerCase() === data.entityIdentifier.toLowerCase()
      );

      if (entity) {
        return {
          success: true,
          entityType: 'item',
          entity: {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            img: entity.img,
            description: entity.system?.description?.value || entity.system?.description || '',
            system: entity.system,
          },
        };
      }

      // Search in actions (for systems that have actions as separate entities)
      if ((character as any).system?.actions) {
        const actions = Array.isArray((character as any).system.actions)
          ? (character as any).system.actions
          : Object.values((character as any).system.actions || {});

        entity = actions.find(
          (action: any) =>
            action.id === data.entityIdentifier ||
            action.name?.toLowerCase() === data.entityIdentifier.toLowerCase()
        );

        if (entity) {
          return {
            success: true,
            entityType: 'action',
            entity,
          };
        }
      }

      // Search in effects
      const effects = character.effects?.contents || [];
      entity = effects.find(
        (effect: any) =>
          effect.id === data.entityIdentifier ||
          effect.name?.toLowerCase() === data.entityIdentifier.toLowerCase()
      );

      if (entity) {
        return {
          success: true,
          entityType: 'effect',
          entity: {
            id: entity.id,
            name: entity.name || entity.label,
            icon: entity.icon,
            disabled: entity.disabled,
            duration: entity.duration,
            changes: entity.changes,
          },
        };
      }

      throw new Error(
        `Entity not found: "${data.entityIdentifier}" in character "${character.name}"`
      );
    } catch (error) {
      throw new Error(
        `Failed to get character entity: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Move a token to a new position on the scene
   */
  async moveToken(data: {
    tokenId: string;
    x: number;
    y: number;
    animate?: boolean;
  }): Promise<any> {
    this.validateFoundryState();

    // Use permission system
    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: [data.tokenId],
    });

    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    try {
      const scene = (game.scenes as any).current;
      if (!scene) {
        throw new Error('No active scene found');
      }

      const token = scene.tokens.get(data.tokenId);
      if (!token) {
        throw new Error(`Token ${data.tokenId} not found in current scene`);
      }

      // Clamp the requested position to the scene bounds so a token can never be
      // pushed off-canvas (out-of-bounds tokens get silently corner-clamped by
      // Foundry and then become hard to move again).
      const dims = (scene as any).dimensions || {};
      const gridSize = (scene as any).grid?.size || 100;
      const sceneW = dims.width ?? (scene as any).width ?? 0;
      const sceneH = dims.height ?? (scene as any).height ?? 0;
      const tokW = ((token as any).width || 1) * gridSize;
      const tokH = ((token as any).height || 1) * gridSize;
      const clampedX = sceneW ? Math.min(Math.max(0, data.x), Math.max(0, sceneW - tokW)) : data.x;
      const clampedY = sceneH ? Math.min(Math.max(0, data.y), Math.max(0, sceneH - tokH)) : data.y;

      // Update token position
      await token.update(
        {
          x: clampedX,
          y: clampedY,
        },
        { animate: data.animate !== false }
      );

      // Read the position BACK from the document — never echo the input, or the
      // caller cannot tell whether Foundry actually committed/clamped the move.
      const fresh = scene.tokens.get(data.tokenId);
      const actualX = (fresh as any)?.x ?? clampedX;
      const actualY = (fresh as any)?.y ?? clampedY;

      this.auditLog('moveToken', { ...data, actualX, actualY }, 'success');

      return {
        success: true,
        tokenId: token.id,
        tokenName: token.name,
        requestedPosition: { x: data.x, y: data.y },
        position: { x: actualX, y: actualY },
        clamped: actualX !== data.x || actualY !== data.y,
        animated: data.animate !== false,
      };
    } catch (error) {
      this.auditLog(
        'moveToken',
        data,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new Error(
        `Failed to move token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update token properties
   */
  async updateToken(data: { tokenId: string; updates: Record<string, any> }): Promise<any> {
    this.validateFoundryState();

    // Use permission system
    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: [data.tokenId],
    });

    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    try {
      const scene = (game.scenes as any).current;
      if (!scene) {
        throw new Error('No active scene found');
      }

      const token = scene.tokens.get(data.tokenId);
      if (!token) {
        throw new Error(`Token ${data.tokenId} not found in current scene`);
      }

      // Filter out undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(data.updates).filter(([_, v]) => v !== undefined)
      );

      // Apply updates
      await token.update(cleanUpdates);

      this.auditLog('updateToken', { tokenId: data.tokenId, updates: cleanUpdates }, 'success');

      return {
        success: true,
        tokenId: token.id,
        tokenName: token.name,
        updatedProperties: Object.keys(cleanUpdates),
      };
    } catch (error) {
      this.auditLog(
        'updateToken',
        data,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new Error(
        `Failed to update token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete one or more tokens from the scene
   */
  async deleteTokens(data: { tokenIds: string[] }): Promise<any> {
    this.validateFoundryState();

    // Use permission system
    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: data.tokenIds,
    });

    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    try {
      const scene = (game.scenes as any).current;
      if (!scene) {
        throw new Error('No active scene found');
      }

      const deletedTokens: string[] = [];
      const failedTokens: string[] = [];

      for (const tokenId of data.tokenIds) {
        try {
          const token = scene.tokens.get(tokenId);
          if (token) {
            await token.delete();
            deletedTokens.push(tokenId);
          } else {
            failedTokens.push(tokenId);
          }
        } catch (error) {
          failedTokens.push(tokenId);
        }
      }

      this.auditLog(
        'deleteTokens',
        { tokenIds: data.tokenIds, deletedCount: deletedTokens.length },
        'success'
      );

      return {
        success: true,
        deletedCount: deletedTokens.length,
        deletedTokens,
        failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
      };
    } catch (error) {
      this.auditLog(
        'deleteTokens',
        data,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new Error(
        `Failed to delete tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete one or more scenes by id or name. If a target scene is active, another
   * scene is activated first (Foundry forbids deleting the active scene). The
   * background image file is left on disk.
   */
  async deleteScenes(data: { sceneIdentifiers: string[] }): Promise<any> {
    this.validateFoundryState();

    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: data.sceneIdentifiers,
    });
    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    try {
      const deleted: { id: string; name: string }[] = [];
      const failed: { identifier: string; reason: string }[] = [];

      for (const ident of data.sceneIdentifiers) {
        const scenes = game.scenes?.contents || [];
        const target = scenes.find(
          (s: any) => s.id === ident || s.name?.toLowerCase() === ident.toLowerCase()
        );
        if (!target) {
          failed.push({ identifier: ident, reason: 'not found' });
          continue;
        }
        try {
          if ((target as any).active) {
            const other = (game.scenes?.contents || []).find((s: any) => s.id !== target.id);
            if (other) {
              await (other as any).activate();
            }
          }
          await (target as any).delete();
          deleted.push({ id: String((target as any).id), name: (target as any).name });
        } catch (e) {
          failed.push({ identifier: ident, reason: e instanceof Error ? e.message : 'unknown' });
        }
      }

      this.auditLog('deleteScenes', { ...data, deletedCount: deleted.length }, 'success');

      return {
        success: deleted.length > 0,
        deletedCount: deleted.length,
        deleted,
        failed: failed.length ? failed : undefined,
      };
    } catch (error) {
      this.auditLog(
        'deleteScenes',
        data,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new Error(
        `Failed to delete scenes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete one or more journal entries by id or name.
   */
  async deleteJournals(data: { journalIdentifiers: string[] }): Promise<any> {
    this.validateFoundryState();

    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: data.journalIdentifiers,
    });
    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    try {
      const deleted: { id: string; name: string }[] = [];
      const failed: { identifier: string; reason: string }[] = [];

      for (const ident of data.journalIdentifiers) {
        const journals = (game as any).journal?.contents || [];
        const target = journals.find(
          (j: any) => j.id === ident || j.name?.toLowerCase() === ident.toLowerCase()
        );
        if (!target) {
          failed.push({ identifier: ident, reason: 'not found' });
          continue;
        }
        try {
          await target.delete();
          deleted.push({ id: target.id, name: target.name });
        } catch (e) {
          failed.push({ identifier: ident, reason: e instanceof Error ? e.message : 'unknown' });
        }
      }

      this.auditLog('deleteJournals', { ...data, deletedCount: deleted.length }, 'success');

      return {
        success: deleted.length > 0,
        deletedCount: deleted.length,
        deleted,
        failed: failed.length ? failed : undefined,
      };
    } catch (error) {
      this.auditLog(
        'deleteJournals',
        data,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new Error(
        `Failed to delete journals: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create map Notes (journal pins / "lieux-dits") on a scene.
   *
   * Each note marks a point of interest at image-pixel coordinates and, when resolvable, links
   * to a world JournalEntry so clicking the pin opens its lore. A note is linked by, in order of
   * priority: explicit `entryId` → Codex `codexSlug` flag → `journalName`. If none resolves, the
   * note is still created as a label-only pin (with a per-note warning). Used for city/village
   * overview scenes where we want lieu-dit markers instead of creature tokens.
   */
  async createSceneNotes(data: {
    sceneIdentifier?: string;
    notes: Array<{
      x: number;
      y: number;
      label?: string;
      codexSlug?: string;
      journalName?: string;
      entryId?: string;
      targetScene?: string;
      icon?: string;
      iconSize?: number;
      fontSize?: number;
    }>;
  }): Promise<any> {
    this.validateFoundryState();

    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: [data.sceneIdentifier ?? 'active'],
    });
    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    const notes = Array.isArray(data.notes) ? data.notes : [];
    if (notes.length === 0) {
      throw new Error('createSceneNotes requires a non-empty "notes" array');
    }

    // Resolve target scene: explicit identifier (id or name) or the active scene.
    const scenes = (game.scenes as any)?.contents || [];
    const scene = data.sceneIdentifier
      ? scenes.find(
          (s: any) =>
            s.id === data.sceneIdentifier ||
            s.name?.toLowerCase() === data.sceneIdentifier!.toLowerCase()
        )
      : (game.scenes as any).current;
    if (!scene) {
      throw new Error(
        data.sceneIdentifier
          ? `Scene "${data.sceneIdentifier}" not found`
          : 'No active scene found'
      );
    }

    // Find a world JournalEntry by Codex slug flag (set by syncCodex) or by name.
    const journals = (game as any).journal?.contents || [];
    const findBySlug = (slug: string) =>
      journals.find((j: any) => j.getFlag?.(this.moduleId, 'codexSlug') === slug);
    const findByName = (name: string) =>
      journals.find((j: any) => j.name?.toLowerCase() === name.toLowerCase());

    const DEFAULT_ICON = 'icons/svg/book.svg';
    const PASSAGE_ICON = 'icons/svg/door-exit.svg';
    const allScenes = (game.scenes as any)?.contents || [];
    const findScene = (ident: string) =>
      allScenes.find(
        (s: any) => s.id === ident || s.name?.toLowerCase() === ident.toLowerCase()
      );
    const notesData: any[] = [];
    const warnings: string[] = [];

    notes.forEach((n, i) => {
      let entry: any = null;
      if (n.entryId) {
        entry = (game as any).journal?.get(n.entryId) || null;
        if (!entry) warnings.push(`note #${i}: entryId "${n.entryId}" introuvable`);
      } else if (n.codexSlug) {
        entry = findBySlug(n.codexSlug) || null;
        if (!entry) warnings.push(`note #${i}: codexSlug "${n.codexSlug}" introuvable`);
      } else if (n.journalName) {
        entry = findByName(n.journalName) || null;
        if (!entry) warnings.push(`note #${i}: journal "${n.journalName}" introuvable`);
      }

      // Passage pin: resolve target scene → stored as a flag, read by the click hook (main.ts).
      let targetSceneId: string | undefined;
      if (n.targetScene) {
        const targetScene = findScene(n.targetScene);
        if (targetScene) targetSceneId = targetScene.id;
        else warnings.push(`note #${i}: targetScene "${n.targetScene}" introuvable`);
      }

      const label = n.label || entry?.name || (targetSceneId ? 'Passage' : 'Lieu');
      const pageId = entry?.pages?.contents?.[0]?.id ?? undefined;
      const icon = n.icon || (targetSceneId ? PASSAGE_ICON : DEFAULT_ICON);

      notesData.push({
        entryId: entry?.id ?? null,
        pageId,
        x: Math.round(n.x),
        y: Math.round(n.y),
        text: label,
        texture: { src: icon },
        iconSize: Math.max(32, Number(n.iconSize) || 40),
        fontSize: Math.max(8, Number(n.fontSize) || 28),
        textAnchor: 2, // CONST.TEXT_ANCHOR_POINTS.BOTTOM
        global: false,
        ...(targetSceneId
          ? { flags: { [this.moduleId]: { targetScene: targetSceneId } } }
          : {}),
      });
    });

    this.auditLog('createSceneNotes', { scene: scene.id, count: notesData.length }, 'success');

    try {
      const created = await scene.createEmbeddedDocuments('Note', notesData);
      return {
        success: created.length > 0,
        sceneId: scene.id,
        sceneName: scene.name,
        notesCreated: created.length,
        notes: created.map((note: any, i: number) => ({
          id: note.id,
          text: notesData[i]?.text,
          entryId: notesData[i]?.entryId,
          targetScene: notesData[i]?.flags?.[this.moduleId]?.targetScene,
          x: notesData[i]?.x,
          y: notesData[i]?.y,
        })),
        warnings: warnings.length ? warnings : undefined,
      };
    } catch (error) {
      this.auditLog(
        'createSceneNotes',
        data,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new Error(
        `Failed to create scene notes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Place decorative/loot Tiles on a scene (skill objets-de-scene). Each tile shows an
   * already-uploaded image (Pixelrepo prop) at image-pixel coordinates, sized in pixels.
   * A linked dnd5e item (uuid + name) is recorded as a module flag so the GM can grant it
   * to a player on pickup; the tile itself stays a plain visual (no extra module required).
   * Defaults to the active scene.
   */
  async createSceneTiles(data: {
    sceneIdentifier?: string;
    tiles: Array<{
      src: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      rotation?: number;
      label?: string;
      lootItemUuid?: string;
      lootItemName?: string;
      openSrc?: string;
      contents?: Array<{ uuid: string; name?: string; quantity?: number }>;
    }>;
  }): Promise<any> {
    this.validateFoundryState();

    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: [data.sceneIdentifier ?? 'active'],
    });
    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    const tiles = Array.isArray(data.tiles) ? data.tiles : [];
    if (tiles.length === 0) {
      throw new Error('createSceneTiles requires a non-empty "tiles" array');
    }

    // Resolve target scene: explicit identifier (id or name) or the active scene.
    const scenes = (game.scenes as any)?.contents || [];
    const scene = data.sceneIdentifier
      ? scenes.find(
          (s: any) =>
            s.id === data.sceneIdentifier ||
            s.name?.toLowerCase() === data.sceneIdentifier!.toLowerCase()
        )
      : (game.scenes as any).current;
    if (!scene) {
      throw new Error(
        data.sceneIdentifier
          ? `Scene "${data.sceneIdentifier}" not found`
          : 'No active scene found'
      );
    }

    const warnings: string[] = [];
    const tilesData = tiles.map((t, i) => {
      if (!t.src || typeof t.src !== 'string') {
        warnings.push(`tile #${i}: "src" manquant`);
      }
      const w = Math.max(1, Math.round(Number(t.width) || 100));
      const h = Math.max(1, Math.round(Number(t.height) || 100));
      const contents = Array.isArray(t.contents)
        ? t.contents.filter(c => c && c.uuid).map(c => ({
            uuid: c.uuid,
            name: c.name ?? null,
            quantity: Math.max(1, Number(c.quantity) || 1),
          }))
        : [];
      const isContainer = contents.length > 0;
      const flags: any = {};
      if (t.lootItemUuid || t.lootItemName || t.label || isContainer) {
        flags[this.moduleId] = {
          loot: true,
          lootItemUuid: t.lootItemUuid ?? null,
          lootItemName: t.lootItemName ?? null,
          label: t.label ?? t.lootItemName ?? null,
          // Chest support: a container tile holds several items and may carry an "opened" sprite.
          container: isContainer,
          contents: isContainer ? contents : null,
          openSrc: t.openSrc ?? null,
        };
      }
      // Foundry v13/v14: Tile texture lives at texture.src (legacy "img" was migrated).
      return {
        texture: { src: t.src },
        x: Math.round(t.x),
        y: Math.round(t.y),
        width: w,
        height: h,
        rotation: Number(t.rotation) || 0,
        // Above the background, below tokens (default token elevation/sort).
        sort: 10,
        hidden: false,
        ...(Object.keys(flags).length ? { flags } : {}),
      };
    });

    this.auditLog('createSceneTiles', { scene: scene.id, count: tilesData.length }, 'success');

    try {
      const created = await scene.createEmbeddedDocuments('Tile', tilesData);
      return {
        success: created.length > 0,
        sceneId: scene.id,
        sceneName: scene.name,
        tilesCreated: created.length,
        tiles: created.map((tile: any, i: number) => ({
          id: tile.id,
          src: tilesData[i]?.texture?.src,
          x: tilesData[i]?.x,
          y: tilesData[i]?.y,
          width: tilesData[i]?.width,
          height: tilesData[i]?.height,
          lootItemName: tilesData[i]?.flags?.[this.moduleId]?.lootItemName,
        })),
        warnings: warnings.length ? warnings : undefined,
      };
    } catch (error) {
      this.auditLog(
        'createSceneTiles',
        data,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new Error(
        `Failed to create scene tiles: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create ONE multi-LEVEL scene (Foundry v14 native Scene Levels): the scene's `levels[]` stacks
   * one background image per floor at its elevation band, and walls are bound to their level via
   * `wall.levels`. Powers the maison multi-étages pipeline (tous les étages sur une seule scène).
   * Voir mémoire foundry-v14-scene-levels. GM-only (validated by the query handler).
   */
  async createSceneLevels(data: {
    sceneName: string;
    folderName?: string;
    gridSize?: number;
    gridEnabled?: boolean;
    width: number;
    height: number;
    active?: boolean;
    levels: Array<{
      name: string;
      src: string;
      elevationBottom: number;
      elevationTop: number;
      walls?: Array<any>;
      // Phase B: walkable surface (defineSurface) — pixel rectangles covering the floor footprint.
      footprint?: Array<{ x: number; y: number; w: number; h: number }>;
    }>;
    // Phase B: stairs (changeLevel) linking two floors (indices into `levels`).
    stairs?: Array<{ x: number; y: number; fromFloorIndex: number; toFloorIndex: number }>;
  }): Promise<any> {
    this.validateFoundryState();
    const g = globalThis as any;

    const levelsIn = Array.isArray(data.levels) ? data.levels : [];
    if (!data.sceneName) throw new Error('createSceneLevels requires "sceneName"');
    if (levelsIn.length === 0)
      throw new Error('createSceneLevels requires a non-empty "levels" array');

    // Scene folder (created if missing), e.g. "ACT I".
    const folderName = data.folderName?.trim() || 'AI Generated Maps';
    let folderId: string | null = null;
    const existingFolder = (game.folders as any)?.find(
      (f: any) => f.type === 'Scene' && f.name === folderName
    );
    if (existingFolder) folderId = existingFolder.id;
    else {
      const folder = await (g.Folder as any).create({ name: folderName, type: 'Scene', sorting: 'a' });
      folderId = folder?.id ?? null;
    }

    const gridEnabled = data.gridEnabled !== false;
    const gridSize = Math.max(1, Number(data.gridSize) || 100);
    const width = Math.round(Number(data.width) || 1000);
    const height = Math.round(Number(data.height) || 1000);

    // Pre-generate a Level _id per floor so walls can bind to their level immediately. If Foundry
    // does not keep our ids, we fall back to creation order below (levels keep their input order).
    const levelDocs = levelsIn.map((l, i) => ({
      _id: (g.foundry?.utils?.randomID?.() as string) || undefined,
      name: l.name || `Niveau ${i}`,
      sort: i,
      elevation: {
        bottom: Number(l.elevationBottom ?? i * 10),
        top: Number(l.elevationTop ?? (i + 1) * 10),
      },
      background: { src: l.src },
    }));

    // Background image lives on each Level (not the scene root) in the Scene Levels model.
    const sceneData: any = {
      name: data.sceneName.trim(),
      ...(folderId ? { folder: folderId } : {}),
      width,
      height,
      padding: 0,
      background: { src: '' },
      levels: levelDocs,
      initial: { x: Math.round(width / 2), y: Math.round(height / 2), scale: 0.3 },
      backgroundColor: '#000000',
      grid: { type: gridEnabled ? 1 : 0, size: gridSize, color: '#000000', alpha: 0.2, distance: 5, units: 'ft' },
      tokenVision: gridEnabled,
      fogExploration: gridEnabled,
      globalLight: !gridEnabled,
      darkness: 0,
      navigation: true,
      active: false,
    };

    const scene = await (g.Scene as any).create(sceneData, { keepEmbeddedIds: true });
    if (!scene) throw new Error('Scene.create returned null');

    // Map each input level (by our pre-set id, else by creation order) to its created Level id.
    const createdLevels: any[] = (scene.levels as any)?.contents ?? [];
    const levelIdOf = (i: number): string | undefined => {
      const want = levelDocs[i]?._id;
      const byId = want ? createdLevels.find((cl: any) => cl.id === want) : null;
      return byId?.id || createdLevels[i]?.id;
    };

    // Build walls per level. Map our logical fields (movement/sight/door/doorState/direction) to
    // v14 wall fields (move/sight/light/sound/door/ds/dir) and bind each wall to its level.
    const wallsData: any[] = [];
    levelsIn.forEach((l, i) => {
      const lid = levelIdOf(i);
      for (const w of Array.isArray(l.walls) ? l.walls : []) {
        if (!w?.c || !Array.isArray(w.c) || w.c.length !== 4) continue;
        if (!w.c.every((n: any) => typeof n === 'number' && !isNaN(n))) continue;
        wallsData.push({
          c: w.c,
          move: w.movement ?? 20,
          sight: w.sight ?? 20,
          // Block LIGHT wherever movement is blocked (solid walls, windows AND closed doors).
          // Mapping light to `sight` let windows (sight:0, see-through) leak light → light=movement.
          light: w.movement ?? 20,
          sound: w.movement ?? 20,
          dir: w.direction ?? 0,
          door: w.door ?? 0,
          ds: w.doorState ?? 0,
          doorSound: '',
          ...(lid ? { levels: [lid] } : {}),
        });
      }
    });
    if (wallsData.length) await scene.createEmbeddedDocuments('Wall', wallsData);

    // ---- Phase B: REGIONS (v14 Scene Levels) — walkable surfaces + stairs ----
    // Structure calquée sur le module de démo officiel « Restored Keep » (ground truth).
    const allLevelIds = createdLevels.map((cl: any) => cl.id).filter(Boolean);
    const regionsData: any[] = [];

    // Surface marchable par étage : région à élévation PLATE (bottom==top au plancher), forme =
    // rectangles de l'empreinte, visible sur tous les niveaux du bâtiment (groupe connecté).
    levelsIn.forEach((l, i) => {
      const fp = Array.isArray(l.footprint) ? l.footprint : [];
      if (!fp.length) return;
      const bottom = Number(l.elevationBottom ?? i * 10);
      regionsData.push({
        name: `Surface — ${l.name || `Niveau ${i}`}`,
        levels: allLevelIds,
        elevation: { bottom, top: bottom, topInclusive: false },
        shapes: fp.map((r) => ({
          type: 'rectangle',
          x: Math.round(r.x), y: Math.round(r.y),
          width: Math.round(r.w), height: Math.round(r.h),
          hole: false,
        })),
        behaviors: [
          {
            type: 'defineSurface',
            system: { placement: 'bottom', light: true, move: true, sight: true, sound: true, occlusion: false, exposure: true, culling: false },
          },
        ],
      });
    });

    // Escaliers : petite région (1 carré) à la position de l'escalier, reliant 2 niveaux. Élévation
    // enjambe le palier (bottom du bas → top du bas +5). movementActions vide = vrai escalier (on
    // change de niveau en marchant ; ['climb'] serait pour une échelle).
    for (const s of Array.isArray(data.stairs) ? data.stairs : []) {
      const fi = s.fromFloorIndex, ti = s.toFloorIndex;
      const fId = levelIdOf(fi), tId = levelIdOf(ti);
      if (!fId || !tId) continue;
      const fb = Number(levelsIn[fi]?.elevationBottom ?? fi * 10);
      const tb = Number(levelsIn[ti]?.elevationBottom ?? ti * 10);
      const lowIsFrom = fb <= tb;
      const lowerBottom = lowIsFrom ? fb : tb;
      const lowerTop = Number((lowIsFrom ? levelsIn[fi] : levelsIn[ti])?.elevationTop ?? lowerBottom + 10);
      const half = Math.round(gridSize / 2);
      regionsData.push({
        name: `Escalier ${levelsIn[fi]?.name || fi} ⇄ ${levelsIn[ti]?.name || ti}`,
        levels: [fId, tId],
        elevation: { bottom: lowerBottom, top: lowerTop + 5, topInclusive: false },
        shapes: [
          {
            type: 'rectangle',
            x: Math.round(s.x) - half, y: Math.round(s.y) - half,
            width: gridSize, height: gridSize, hole: false,
          },
        ],
        behaviors: [{ type: 'changeLevel', system: { movementActions: [] } }],
      });
    }

    let regionsCreated = 0;
    if (regionsData.length) {
      try {
        const created = await scene.createEmbeddedDocuments('Region', regionsData);
        regionsCreated = created?.length ?? 0;
      } catch (err) {
        // Non-fatal: levels + walls already exist; surfaces/stairs are an enhancement.
        this.auditLog('createSceneLevels.regions', { error: err instanceof Error ? err.message : String(err) }, 'failure');
      }
    }

    if (data.active !== false) await scene.activate();

    this.auditLog(
      'createSceneLevels',
      { scene: scene.id, levels: createdLevels.length, walls: wallsData.length, regions: regionsCreated },
      'success'
    );

    return {
      success: true,
      sceneId: scene.id,
      sceneName: scene.name,
      levelCount: createdLevels.length,
      levels: createdLevels.map((cl: any, i: number) => ({
        id: cl.id,
        name: cl.name,
        elevation: cl.elevation,
        wallCount: Array.isArray(levelsIn[i]?.walls) ? levelsIn[i]!.walls!.length : 0,
      })),
      totalWalls: wallsData.length,
      regionsCreated,
    };
  }

  /**
   * Delete map Notes from a scene, by id list or all of them. Lets pins be re-placed/edited
   * without re-importing the whole scene.
   */
  async deleteSceneNotes(data: {
    sceneIdentifier?: string;
    noteIds?: string[];
    all?: boolean;
  }): Promise<any> {
    this.validateFoundryState();

    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: [data.sceneIdentifier ?? 'active'],
    });
    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    // Resolve target scene: explicit identifier (id or name) or the active scene.
    const scenes = (game.scenes as any)?.contents || [];
    const scene = data.sceneIdentifier
      ? scenes.find(
          (s: any) =>
            s.id === data.sceneIdentifier ||
            s.name?.toLowerCase() === data.sceneIdentifier!.toLowerCase()
        )
      : (game.scenes as any).current;
    if (!scene) {
      throw new Error(
        data.sceneIdentifier ? `Scene "${data.sceneIdentifier}" not found` : 'No active scene found'
      );
    }

    const existingIds = scene.notes.map((n: any) => n.id);
    let ids = data.all
      ? existingIds
      : Array.isArray(data.noteIds)
        ? data.noteIds.filter((id) => existingIds.includes(id))
        : [];
    if (ids.length === 0) {
      return {
        success: true,
        sceneId: scene.id,
        sceneName: scene.name,
        deletedCount: 0,
        message: data.all ? 'No notes on scene' : 'No matching note ids on scene',
      };
    }

    this.auditLog('deleteSceneNotes', { scene: scene.id, count: ids.length }, 'success');

    try {
      await scene.deleteEmbeddedDocuments('Note', ids);
      return {
        success: true,
        sceneId: scene.id,
        sceneName: scene.name,
        deletedCount: ids.length,
        deletedIds: ids,
      };
    } catch (error) {
      this.auditLog(
        'deleteSceneNotes',
        data,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new Error(
        `Failed to delete scene notes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set a scene's dynamic-lighting environment and ambient FX (skill mise-en-scene, étape 3ter).
   * Adjusts the global darkness level, global illumination, and the core weather/particle effect,
   * and optionally (re)creates AmbientLight sources at image-pixel coordinates (torches, hearths,
   * windows…). Lights created here carry a module flag so `replaceLights` can wipe only our own
   * ambiance lights without touching hand-placed ones. Foundry v14 schema:
   * `environment.darknessLevel` + `environment.globalLight.enabled`; `weather` is a core effect id
   * (e.g. rain, snow, fog, leaves, blizzard, rainStorm — '' clears it). Defaults to the active scene.
   */
  async setSceneAmbiance(data: {
    sceneIdentifier?: string;
    darkness?: number;
    globalLight?: boolean;
    weather?: string | null;
    lights?: Array<{
      x: number;
      y: number;
      dim?: number;
      bright?: number;
      color?: string;
      alpha?: number;
      angle?: number;
      rotation?: number;
      animationType?: string;
      animationSpeed?: number;
      animationIntensity?: number;
      // v14 Scene Levels: bind a light to one floor so it only lights that level (otherwise an
      // unbound light shines on every stacked floor). `level` = a Level name or id on the scene.
      elevation?: number;
      level?: string;
    }>;
    replaceLights?: boolean;
  }): Promise<any> {
    this.validateFoundryState();

    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: [data.sceneIdentifier ?? 'active'],
    });
    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    // Resolve target scene: explicit identifier (id or name) or the active scene.
    const scenes = (game.scenes as any)?.contents || [];
    const scene = data.sceneIdentifier
      ? scenes.find(
          (s: any) =>
            s.id === data.sceneIdentifier ||
            s.name?.toLowerCase() === data.sceneIdentifier!.toLowerCase()
        )
      : (game.scenes as any).current;
    if (!scene) {
      throw new Error(
        data.sceneIdentifier ? `Scene "${data.sceneIdentifier}" not found` : 'No active scene found'
      );
    }

    // 1) Environment (darkness / global light / weather). v14 lives under `environment.*`.
    const update: any = {};
    if (typeof data.darkness === 'number') {
      update['environment.darknessLevel'] = Math.min(1, Math.max(0, data.darkness));
    }
    if (typeof data.globalLight === 'boolean') {
      update['environment.globalLight.enabled'] = data.globalLight;
    }
    if (data.weather !== undefined) {
      update['weather'] = data.weather || '';
    }
    if (Object.keys(update).length > 0) {
      await scene.update(update);
    }

    // 2) Ambient light sources. Replace only our own (flagged) lights when asked.
    let deletedLights = 0;
    let createdLights = 0;
    const lights = Array.isArray(data.lights) ? data.lights : [];
    if (data.replaceLights) {
      const ourIds = scene.lights
        .filter((l: any) => l.getFlag?.(this.moduleId, 'ambiance'))
        .map((l: any) => l.id);
      if (ourIds.length > 0) {
        await scene.deleteEmbeddedDocuments('AmbientLight', ourIds);
        deletedLights = ourIds.length;
      }
    }
    if (lights.length > 0) {
      // Resolve a Level name/id (per light) to its id on this scene, to bind the light to one floor.
      const sceneLevels: any[] = (scene.levels as any)?.contents ?? [];
      const resolveLevel = (ref?: string): string | undefined => {
        if (!ref) return undefined;
        const byId = sceneLevels.find((lv: any) => lv.id === ref);
        if (byId) return byId.id;
        const byName = sceneLevels.find(
          (lv: any) => (lv.name || '').toLowerCase() === ref.toLowerCase()
        );
        return byName?.id;
      };
      const lightsData = lights.map((l) => {
        const levelId = resolveLevel(l.level);
        return {
          x: Math.round(l.x),
          y: Math.round(l.y),
          rotation: l.rotation ?? 0,
          walls: true,
          vision: false,
          ...(typeof l.elevation === 'number' ? { elevation: l.elevation } : {}),
          ...(levelId ? { levels: [levelId] } : {}),
          config: {
            dim: l.dim ?? 40,
            bright: l.bright ?? 20,
            color: l.color ?? '#ffaa55',
            alpha: typeof l.alpha === 'number' ? l.alpha : 0.5,
            angle: l.angle ?? 360,
            animation: l.animationType
              ? {
                  type: l.animationType,
                  speed: l.animationSpeed ?? 3,
                  intensity: l.animationIntensity ?? 5,
                }
              : { type: null },
          },
          flags: { [this.moduleId]: { ambiance: true } },
        };
      });
      const created = await scene.createEmbeddedDocuments('AmbientLight', lightsData);
      createdLights = created.length;
    }

    this.auditLog(
      'setSceneAmbiance',
      { scene: scene.id, env: update, createdLights, deletedLights },
      'success'
    );

    return {
      success: true,
      sceneId: scene.id,
      sceneName: scene.name,
      darkness: scene.environment?.darknessLevel,
      globalLight: scene.environment?.globalLight?.enabled,
      weather: scene.weather || '',
      lightsCreated: createdLights,
      lightsDeleted: deletedLights,
    };
  }

  /**
   * Get detailed information about a token
   */
  async getTokenDetails(data: { tokenId: string }): Promise<any> {
    this.validateFoundryState();

    try {
      const scene = (game.scenes as any).current;
      if (!scene) {
        throw new Error('No active scene found');
      }

      const token = scene.tokens.get(data.tokenId);
      if (!token) {
        throw new Error(`Token ${data.tokenId} not found in current scene`);
      }

      // Return flat structure that matches MCP server expectations
      return {
        success: true,
        id: token.id,
        name: token.name,
        x: token.x,
        y: token.y,
        width: token.width,
        height: token.height,
        rotation: token.rotation,
        scale: token.texture?.scaleX || 1,
        alpha: token.alpha,
        hidden: token.hidden,
        disposition: token.disposition,
        elevation: token.elevation,
        lockRotation: token.lockRotation,
        img: token.texture?.src,
        actorId: token.actor?.id,
        actorData: token.actor
          ? {
              name: token.actor.name,
              type: token.actor.type,
              img: token.actor.img,
            }
          : null,
        actorLink: token.actorLink,
      };
    } catch (error) {
      throw new Error(
        `Failed to get token details: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Toggle a status condition on a token
   */
  async toggleTokenCondition(data: {
    tokenId: string;
    conditionId: string;
    active: boolean;
  }): Promise<any> {
    this.validateFoundryState();

    // Use permission system
    const permissionCheck = permissionManager.checkWritePermission('modifyScene', {
      targetIds: [data.tokenId],
    });

    if (!permissionCheck.allowed) {
      throw new Error(`${ERROR_MESSAGES.ACCESS_DENIED}: ${permissionCheck.reason}`);
    }

    try {
      const scene = (game.scenes as any).current;
      if (!scene) {
        throw new Error('No active scene found');
      }

      const token = scene.tokens.get(data.tokenId);
      if (!token) {
        throw new Error(`Token ${data.tokenId} not found in current scene`);
      }

      const actor = token.actor;
      if (!actor) {
        throw new Error(`Token ${data.tokenId} has no associated actor`);
      }

      // Get the condition configuration for the game system
      const conditions = (CONFIG as any).statusEffects || [];
      const condition = conditions.find(
        (c: any) =>
          c.id === data.conditionId || c.name?.toLowerCase() === data.conditionId.toLowerCase()
      );

      if (!condition) {
        throw new Error(`Condition not found: ${data.conditionId}`);
      }

      if (data.active) {
        // Add the condition - handle DSA5 and other systems
        const effectData: any = {
          name: condition.name || condition.label || condition.id,
          icon: condition.icon || condition.img,
        };

        // Add statuses for systems that support it (D&D5e, PF2e)
        if (condition.id) {
          effectData.statuses = [condition.id];
        }

        // DSA5-specific: Copy all properties from the condition
        // DSA5 conditions have different structure than D&D5e/PF2e
        if ((game.system as any)?.id === 'dsa5') {
          // For DSA5, use the condition's full data structure
          Object.assign(effectData, {
            flags: condition.flags || {},
            changes: condition.changes || [],
            duration: condition.duration || {},
            origin: condition.origin,
          });
        }

        await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
      } else {
        // Remove the condition
        const effects = actor.effects?.contents || [];
        const effectsToRemove = effects.filter((effect: any) => {
          // Check by status (D&D5e, PF2e)
          if (effect.statuses?.has(data.conditionId)) {
            return true;
          }
          // Check by name (fallback for all systems including DSA5)
          if (effect.name?.toLowerCase() === data.conditionId.toLowerCase()) {
            return true;
          }
          // Check by label (some systems use label instead of name)
          if (effect.label?.toLowerCase() === data.conditionId.toLowerCase()) {
            return true;
          }
          return false;
        });

        if (effectsToRemove.length > 0) {
          await actor.deleteEmbeddedDocuments(
            'ActiveEffect',
            effectsToRemove.map((e: any) => e.id)
          );
        }
      }

      this.auditLog('toggleTokenCondition', data, 'success');

      return {
        success: true,
        tokenId: token.id,
        tokenName: token.name,
        conditionId: data.conditionId,
        conditionName: condition.name || condition.label || condition.id,
        isActive: data.active,
        active: data.active,
        message: data.active
          ? `Applied ${data.conditionId} to ${token.name}`
          : `Removed ${data.conditionId} from ${token.name}`,
      };
    } catch (error) {
      this.auditLog(
        'toggleTokenCondition',
        data,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new Error(
        `Failed to toggle token condition: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all available conditions for the current game system
   */
  async getAvailableConditions(): Promise<any> {
    this.validateFoundryState();

    try {
      const conditions = (CONFIG as any).statusEffects || [];

      return {
        success: true,
        gameSystem: game.system?.id,
        conditions: conditions.map((condition: any) => ({
          id: condition.id,
          name: condition.name || condition.label || condition.id,
          icon: condition.icon || condition.img,
          description: condition.description || '',
        })),
      };
    } catch (error) {
      throw new Error(
        `Failed to get available conditions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Move a token to a new position
   */

  /**
   * Use an item on a character (cast spell, use ability, consume item, etc.)
   * This triggers the item's default use behavior in Foundry VTT
   */
  async useItem(params: {
    actorIdentifier: string;
    itemIdentifier: string;
    targets?: string[] | undefined; // Target character/token names or IDs. "self" targets the caster.
    options?:
      | {
          consume?: boolean | undefined; // Whether to consume charges/uses
          configureDialog?: boolean | undefined; // Whether to show configuration dialog
          skipDialog?: boolean | undefined; // Skip confirmation dialogs (default: true for MCP)
          spellLevel?: number | undefined; // For spells: cast at higher level
          versatile?: boolean | undefined; // For versatile weapons: use versatile damage
        }
      | undefined;
  }): Promise<{
    success: boolean;
    status?: string;
    message: string;
    itemName?: string;
    actorName?: string;
    targets?: string[];
    requiresGMInteraction?: boolean;
  }> {
    this.validateFoundryState();

    const { actorIdentifier, itemIdentifier, targets, options = {} } = params;

    // Find the actor
    const actor = this.findActorByIdentifier(actorIdentifier);
    if (!actor) {
      throw new Error(`Actor not found: ${actorIdentifier}`);
    }

    // Find the item on the actor
    const item = actor.items.find(
      (i: any) => i.id === itemIdentifier || i.name.toLowerCase() === itemIdentifier.toLowerCase()
    );

    if (!item) {
      throw new Error(`Item "${itemIdentifier}" not found on actor "${actor.name}"`);
    }

    const itemAny = item as any;
    const systemId = (game.system as any).id;

    // Handle targeting if targets are specified
    const resolvedTargetNames: string[] = [];
    if (targets && targets.length > 0) {
      // Get all tokens on the current scene
      const scene = (game.scenes as any)?.active;
      if (!scene) {
        throw new Error('No active scene to find targets on');
      }

      const sceneTokens = scene.tokens;
      const tokenIds: string[] = [];

      for (const targetIdentifier of targets) {
        // Handle "self" - target the caster's token
        if (targetIdentifier.toLowerCase() === 'self') {
          // Find token for the caster actor
          const selfToken = sceneTokens.find(
            (t: any) => t.actor?.id === actor.id || t.actorId === actor.id
          );
          if (selfToken) {
            tokenIds.push(selfToken.id);
            resolvedTargetNames.push(actor.name);
          } else {
            console.warn(
              `[jdr-mcp-bridge] No token found on scene for actor "${actor.name}" (self)`
            );
          }
          continue;
        }

        // Find token by name or ID
        const targetToken = sceneTokens.find(
          (t: any) =>
            t.id === targetIdentifier ||
            t.name?.toLowerCase() === targetIdentifier.toLowerCase() ||
            t.actor?.name?.toLowerCase() === targetIdentifier.toLowerCase()
        );

        if (targetToken) {
          tokenIds.push(targetToken.id);
          resolvedTargetNames.push(targetToken.name || targetToken.actor?.name || targetIdentifier);
        } else {
          console.warn(`[jdr-mcp-bridge] Target not found: "${targetIdentifier}"`);
        }
      }

      // Set targets using Foundry's targeting system
      if (tokenIds.length > 0 && game.user) {
        await (game.user as any).updateTokenTargets(tokenIds);
        console.log(`[jdr-mcp-bridge] Set targets: ${resolvedTargetNames.join(', ')}`);
      }
    }

    try {
      // For items that may show dialogs (spells with choices, etc.),
      // we fire-and-forget to avoid timeout issues. The GM will interact
      // with the dialog in Foundry, and the result appears in chat.

      // Check if item has a use() method (common in D&D 5e, PF2e)
      if (typeof itemAny.use === 'function') {
        // D&D 5e and similar systems
        // Only pass options that D&D 5e's item.use() expects
        const useOptions: Record<string, any> = {
          createMessage: true,
        };

        // D&D 5e specific options
        if (systemId === 'dnd5e') {
          useOptions.consumeResource = options.consume ?? true;
          useOptions.consumeSpellSlot = options.consume ?? true;
          useOptions.consumeUsage = options.consume ?? true;
          // Always show dialog so GM can make choices
          useOptions.configureDialog = true;
        }

        // Spell level for upcasting
        if (options.spellLevel !== undefined) {
          useOptions.slotLevel = options.spellLevel; // D&D 5e
          useOptions.level = options.spellLevel; // generic
        }

        // Fire and forget - don't await, as dialogs block the promise
        itemAny.use(useOptions).catch((err: Error) => {
          console.error(`[jdr-mcp-bridge] Error using item ${item.name}:`, err);
        });
      } else if (typeof itemAny.toChat === 'function') {
        // PF2e and some other systems use toChat
        if (typeof itemAny.toMessage === 'function') {
          itemAny.toMessage(undefined, { create: true }).catch((err: Error) => {
            console.error(`[jdr-mcp-bridge] Error using item ${item.name}:`, err);
          });
        } else {
          itemAny.toChat().catch((err: Error) => {
            console.error(`[jdr-mcp-bridge] Error using item ${item.name}:`, err);
          });
        }
      } else if (typeof itemAny.roll === 'function') {
        // Some items have a roll method
        itemAny.roll().catch((err: Error) => {
          console.error(`[jdr-mcp-bridge] Error using item ${item.name}:`, err);
        });
      } else if (systemId === 'dsa5') {
        // DSA5 specific handling
        if (
          item.type === 'spell' ||
          item.type === 'liturgy' ||
          item.type === 'ceremony' ||
          item.type === 'ritual'
        ) {
          if (typeof itemAny.postItem === 'function') {
            itemAny.postItem().catch((err: Error) => {
              console.error(`[jdr-mcp-bridge] Error using item ${item.name}:`, err);
            });
          } else if (typeof itemAny.setupEffect === 'function') {
            itemAny.setupEffect().catch((err: Error) => {
              console.error(`[jdr-mcp-bridge] Error using item ${item.name}:`, err);
            });
          } else {
            // Fallback: create a chat message describing the item
            const chatData = {
              user: game.user?.id,
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<h3>${item.name}</h3><p>${actor.name} uses ${item.name}.</p>`,
            };
            ChatMessage.create(chatData);
          }
        } else {
          if (typeof itemAny.postItem === 'function') {
            itemAny.postItem().catch((err: Error) => {
              console.error(`[jdr-mcp-bridge] Error using item ${item.name}:`, err);
            });
          }
        }
      } else {
        // Generic fallback: create a chat message
        const chatData = {
          user: game.user?.id,
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<h3>${item.name}</h3><p>${actor.name} uses ${item.name}.</p>`,
        };
        ChatMessage.create(chatData);
      }

      this.auditLog(
        'useItem',
        {
          actorId: actor.id,
          itemId: item.id,
          itemName: item.name,
          targets: resolvedTargetNames,
        },
        'success'
      );

      const targetInfo =
        resolvedTargetNames.length > 0 ? ` targeting ${resolvedTargetNames.join(', ')}` : '';

      const result: {
        success: boolean;
        status?: string;
        message: string;
        itemName?: string;
        actorName?: string;
        targets?: string[];
        requiresGMInteraction?: boolean;
      } = {
        success: true,
        status: 'initiated',
        message: `Item use initiated for ${actor.name} using ${item.name}${targetInfo}. If a dialog appeared in Foundry VTT, the GM should select options and confirm. The result will appear in chat.`,
        itemName: item.name,
        actorName: actor.name,
        requiresGMInteraction: true,
      };

      if (resolvedTargetNames.length > 0) {
        result.targets = resolvedTargetNames;
      }

      return result;
    } catch (error) {
      this.auditLog(
        'useItem',
        {
          actorId: actor.id,
          itemId: item.id,
        },
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw new Error(
        `Failed to use item "${item.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ===========================================================================
  // CHARACTER PORTAL — questionnaire en ligne -> acteur dnd5e
  //
  // Le portail web (service autonome sur le VPS, voir tools/character-portal) met les
  // soumissions des joueurs en file d'attente. Ces méthodes tournent dans le navigateur
  // MJ : elles génèrent les liens OTP, publient le catalogue SRD, tirent la file et
  // construisent l'acteur. Tout passe par fetch HTTPS vers le portail ; rien ne touche
  // au lien WebRTC MCP. (Réservé au MJ — appelé depuis le menu de réglages / le poller.)
  // ===========================================================================

  /** Lit la configuration du portail depuis les réglages du module. */
  private portalConfig(): { enabled: boolean; baseUrl: string; token: string } {
    return {
      enabled: !!game.settings.get(MODULE_ID, 'portalEnabled'),
      baseUrl: String(game.settings.get(MODULE_ID, 'portalBaseUrl') || '').replace(/\/+$/, ''),
      token: String(game.settings.get(MODULE_ID, 'portalAdminToken') || ''),
    };
  }

  /** Appel authentifié vers une route /api/admin/* du portail. */
  private async portalAdminFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { baseUrl, token } = this.portalConfig();
    if (!baseUrl) throw new Error('URL du portail non configurée (menu Portail).');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...((init.headers as Record<string, string>) || {}),
    };
    if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const res = await fetch(baseUrl + path, { ...init, headers });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.json())?.error || '';
      } catch {
        /* ignore */
      }
      throw new Error(`Portail ${path} → HTTP ${res.status}${detail ? ` (${detail})` : ''}`);
    }
    return res;
  }

  /** Le MJ génère un lien OTP à usage unique pour un joueur. */
  async portalIssueOtp(data: {
    playerLabel?: string;
    foundryUser?: string;
    ttlDays?: number;
  }): Promise<{ success: boolean; url?: string; token?: string; error?: string }> {
    try {
      const res = await this.portalAdminFetch('/api/admin/otp', {
        method: 'POST',
        body: JSON.stringify({
          playerLabel: data.playerLabel || null,
          foundryUser: data.foundryUser || null,
          ttlDays: data.ttlDays || undefined,
        }),
      });
      const out = await res.json();
      return { success: true, url: out.url, token: out.token };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /** Construit puis publie le catalogue SRD (options du formulaire) vers le portail. */
  async portalPublishCatalog(): Promise<{ success: boolean; counts?: any; error?: string }> {
    try {
      const catalog = await this.buildPortalCatalog();
      await this.portalAdminFetch('/api/admin/catalog', {
        method: 'POST',
        body: JSON.stringify(catalog),
      });
      const counts = {
        races: catalog.races.length,
        classes: catalog.classes.length,
        subclasses: Object.values(catalog.subclassesByClass).reduce(
          (n: number, a: any) => n + a.length,
          0
        ),
        backgrounds: catalog.backgrounds.length,
        spells: catalog.spells.length,
        equipment: catalog.equipment.length,
      };
      return { success: true, counts };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Parcourt les packs d'Items et regroupe les entrées SRD par type. Agnostique des ids de
   * pack (ne code rien en dur) : marche tant que les compendiums dnd5e sont présents.
   */
  async buildPortalCatalog(): Promise<{
    abilities: string[];
    alignments: string[];
    races: any[];
    classes: any[];
    subclassesByClass: Record<string, any[]>;
    backgrounds: any[];
    spellsByClass: Record<string, any[]>;
    spells: any[];
    equipment: any[];
  }> {
    const races: any[] = [];
    const classes: any[] = [];
    const backgrounds: any[] = [];
    const equipment: any[] = [];
    const subclassesByClass: Record<string, any[]> = {};
    const spells: any[] = [];

    const EQUIP_TYPES = new Set([
      'weapon',
      'equipment',
      'consumable',
      'tool',
      'loot',
      'container',
    ]);
    const slug = (s: string) =>
      String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

    // Le monde peut contenir DEUX jeux de règles : 2014 « DRS » (SRD 5.1) et 2024 (packs `*24`).
    // Choix de la table : on source le 2024 (espèces/historiques dans `origins24`, type `race`/
    // `background` ; classes/sorts/équipement dans `*24`). Mettre `false` pour revenir au 2014 DRS.
    // On exclut les packs d'aptitudes de monstres : ils portent des items `weapon` (attaques
    // naturelles) qui pollueraient la liste d'équipement.
    const useRuleset2024 = true;
    const itemPacks = Array.from(game.packs.values()).filter((p: any) => {
      const id = p.metadata?.id || '';
      if (p.metadata?.type !== 'Item') return false;
      if (/monsterfeatures/i.test(id)) return false;
      return useRuleset2024 ? /24$/.test(id) : !/24$/.test(id);
    });
    for (const pack of itemPacks) {
      let index: any;
      try {
        index = await (pack as any).getIndex({
          fields: [
            'type',
            'system.identifier',
            'system.classIdentifier',
            'system.level',
            'system.hd',
            'system.hd.denomination',
            'system.hitDice',
            'system.sourceClass',
          ],
        });
      } catch (e) {
        console.warn(`[${MODULE_ID}] Portal catalog: getIndex échoué pour ${pack.metadata?.id}`, e);
        continue;
      }
      for (const e of index) {
        const ref = { packId: pack.metadata.id, itemId: e._id, name: e.name };
        switch (e.type) {
          case 'race':
            races.push(ref);
            break;
          case 'background':
            backgrounds.push(ref);
            break;
          case 'class':
            classes.push({
              ...ref,
              identifier: e.system?.identifier || slug(e.name),
              hitDie: this.parseHitDie(e.system),
            });
            break;
          case 'subclass': {
            const cid = e.system?.classIdentifier || '';
            (subclassesByClass[cid] ||= []).push(ref);
            break;
          }
          case 'spell':
            spells.push({ ...ref, level: e.system?.level ?? 0, sourceClass: e.system?.sourceClass || null });
            break;
          default:
            if (EQUIP_TYPES.has(e.type)) equipment.push(ref);
        }
      }
    }

    // spellsByClass : à partir de system.sourceClass quand disponible (best-effort en 5.3.3).
    const spellsByClass: Record<string, any[]> = {};
    for (const s of spells) {
      if (s.sourceClass) {
        (spellsByClass[s.sourceClass] ||= []).push({
          packId: s.packId,
          itemId: s.itemId,
          name: s.name,
          level: s.level,
        });
      }
    }

    const byName = (a: any, b: any) => String(a.name).localeCompare(String(b.name));
    races.sort(byName);
    classes.sort(byName);
    backgrounds.sort(byName);
    equipment.sort(byName);
    Object.values(subclassesByClass).forEach((a) => a.sort(byName));
    Object.values(spellsByClass).forEach((a) => a.sort(byName));

    return {
      abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
      alignments: [
        'Loyal Bon',
        'Neutre Bon',
        'Chaotique Bon',
        'Loyal Neutre',
        'Neutre',
        'Chaotique Neutre',
        'Loyal Mauvais',
        'Neutre Mauvais',
        'Chaotique Mauvais',
      ],
      races,
      classes,
      subclassesByClass,
      backgrounds,
      spellsByClass,
      spells: spells
        .map((s) => ({ packId: s.packId, itemId: s.itemId, name: s.name, level: s.level }))
        .sort(byName),
      equipment,
    };
  }

  /** Dé de vie d'une classe (5e) : tolère hd.denomination / hd.die / hitDice ; défaut d8. */
  private parseHitDie(sys: any): number {
    const fromStr = (v: any) => {
      const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
      return Number.isFinite(n) && n >= 4 && n <= 12 ? n : null;
    };
    if (sys?.hd) {
      if (typeof sys.hd.denomination === 'number') return sys.hd.denomination;
      const a = fromStr(sys.hd.denomination) ?? fromStr(sys.hd.die);
      if (a) return a;
    }
    return fromStr(sys?.hitDice) ?? 8;
  }

  /** Lecture seule de la file d'actions (pour l'affichage du menu) : nombre + libellés. */
  async portalListPendingActions(): Promise<{ success: boolean; count?: number; items?: any[]; error?: string }> {
    try {
      const res = await this.portalAdminFetch('/api/admin/actions?status=pending');
      const pending: any[] = await res.json();
      return {
        success: true,
        count: pending.length,
        items: pending.map((a) => ({
          id: a.id,
          type: a.type,
          name: a.payload?.characterName || a.type,
          playerLabel: a.playerLabel,
          createdAt: a.createdAt,
        })),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Tire la file d'actions en attente et exécute chacune selon son `type` (dispatch). Idempotent
   * par ack (chaque action sort de la file). Point d'extension : ajouter un `case` pour un futur
   * type d'action, sans toucher au reste de la chaîne (portail / poller).
   */
  async portalProcessPendingActions(): Promise<{ skipped?: boolean; count?: number; results?: any[] }> {
    const { enabled, baseUrl } = this.portalConfig();
    if (!enabled || !baseUrl) return { skipped: true };

    const res = await this.portalAdminFetch('/api/admin/actions?status=pending');
    const pending: any[] = await res.json();
    const results: any[] = [];

    for (const action of pending) {
      try {
        let result: any;
        switch (action.type) {
          case 'create-character': {
            const built = await this.importCharacterAction(action);
            result = { actorId: built.actorId, actorName: built.actorName };
            ui.notifications?.info(`🧙 Personnage importé depuis le portail : ${built.actorName}`);
            break;
          }
          default:
            throw new Error(`Type d'action inconnu : ${action.type}`);
        }
        await this.portalAckAction(action.id, { status: 'done', result });
        results.push({ id: action.id, type: action.type, ok: true, result });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[${MODULE_ID}] Action ${action.id} (${action.type}) échouée :`, error);
        // Marque rejetée pour la sortir de la file (évite une boucle d'échec sur la même action).
        await this.portalAckAction(action.id, { status: 'rejected', note: msg.slice(0, 400) }).catch(
          () => {}
        );
        ui.notifications?.warn(`Portail : action refusée (${msg.slice(0, 80)})`);
        results.push({ id: action.id, type: action.type, ok: false, error: msg });
      }
    }
    return { count: pending.length, results };
  }

  /** Acquitte une action auprès du portail (terminée ou rejetée). */
  private async portalAckAction(
    actionId: string,
    ack: { status: 'done' | 'rejected'; result?: any; note?: string }
  ): Promise<void> {
    await this.portalAdminFetch(`/api/admin/actions/${actionId}/ack`, {
      method: 'POST',
      body: JSON.stringify(ack),
    });
  }

  /** Handler du type `create-character` : acteur dnd5e + portrait + liaison joueur. */
  private async importCharacterAction(action: any): Promise<{ actorId: string; actorName: string }> {
    const built = await this.buildCharacterActorFromSubmission(action.payload);

    if (action.hasAttachment) {
      try {
        const imgPath = await this.portalDownloadAttachment(action.id);
        await this.setActorImage({
          actorIdentifier: built.actorId,
          img: imgPath,
          tokenSrc: imgPath,
          applyPjDefaults: true,
        });
      } catch (e) {
        console.warn(`[${MODULE_ID}] Portrait non appliqué pour ${built.actorName} :`, e);
      }
    }

    if (action.foundryUser) {
      try {
        await this.assignDefaultCharacter({
          userIdentifier: action.foundryUser,
          actorIdentifier: built.actorId,
          grantOwnership: true,
        });
      } catch (e) {
        console.warn(`[${MODULE_ID}] Liaison joueur impossible (${action.foundryUser}) :`, e);
      }
    }

    return built;
  }

  /** Récupère la pièce jointe binaire d'une action et la téléverse dans le monde Foundry. */
  private async portalDownloadAttachment(actionId: string): Promise<string> {
    const res = await this.portalAdminFetch(`/api/admin/actions/${actionId}/attachment`);
    const blob = await res.blob();
    const type = blob.type || 'image/png';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const safeId = String(actionId).replace(/[^a-zA-Z0-9_-]/g, '');

    const worldId = (game as any).world?.id || 'unknown-world';
    const uploadPath = `worlds/${worldId}/portal-portraits`;
    const FilePickerAPI =
      (globalThis as any).foundry?.applications?.apps?.FilePicker?.implementation ||
      (globalThis as any).FilePicker;
    try {
      await FilePickerAPI.createDirectory('data', uploadPath, { bucket: null });
    } catch (e: any) {
      if (!e?.message?.includes('EEXIST') && !e?.message?.includes('already exists')) {
        console.warn(`[${MODULE_ID}] createDirectory portraits :`, e?.message);
      }
    }
    const file = new File([blob], `${safeId}.${ext}`, { type });
    const up = await FilePickerAPI.upload('data', uploadPath, file, {}, { notify: false });
    return up.path;
  }

  /**
   * Construit un acteur dnd5e `character` à partir d'une soumission validée.
   * MVP (advancements NON exécutés) : items SRD embarqués en données brutes + scores/PV/bio
   * écrits directement. Voir le plan pour le périmètre différé.
   */
  async buildCharacterActorFromSubmission(payload: any): Promise<{
    actorId: string;
    actorName: string;
    hp: number;
    itemsAdded: number;
  }> {
    if (!payload || !payload.characterName) throw new Error('Soumission sans nom de personnage.');

    // Charge un item de compendium en données brutes (toObject), avec contrôle de type par emplacement.
    const loadTyped = async (
      ref: any,
      allowed: string[] | null,
      slotName: string
    ): Promise<any | null> => {
      if (!ref || !ref.packId || !ref.itemId) return null;
      const pack = game.packs.get(ref.packId);
      if (!pack) throw new Error(`${slotName} : pack introuvable (${ref.packId}).`);
      const doc = await (pack as any).getDocument(ref.itemId);
      if (!doc) throw new Error(`${slotName} : item introuvable (${ref.itemId}).`);
      if (allowed && !allowed.includes((doc as any).type)) {
        throw new Error(`${slotName} : type inattendu « ${(doc as any).type} ».`);
      }
      return doc.toObject();
    };

    const raceObj = await loadTyped(payload.race, ['race'], 'Race');
    const classObj = await loadTyped(payload.class, ['class'], 'Classe');
    const level = Math.max(1, Math.min(20, Number(payload.class?.level) || 1));
    if (classObj?.system) classObj.system.levels = level;
    const subclassObj = await loadTyped(payload.subclass, ['subclass'], 'Sous-classe');
    const backgroundObj = await loadTyped(payload.background, ['background'], 'Historique');

    const spellObjs: any[] = [];
    for (const s of payload.spells || []) {
      const o = await loadTyped(s, ['spell'], 'Sort');
      if (o) spellObjs.push(o);
    }
    const equipObjs: any[] = [];
    for (const eq of payload.equipment || []) {
      const o = await loadTyped(eq, null, 'Équipement');
      if (o) {
        if (o.system && 'quantity' in o.system) o.system.quantity = Math.max(1, Number(eq.quantity) || 1);
        equipObjs.push(o);
      }
    }

    const ab = payload.abilities || {};
    // hitDie vient du catalogue (calculé par parseHitDie à la publication) ; défaut d8.
    const hitDie = Number(payload.class?.hitDie) || 8;
    const hp = this.computeStartingHp(hitDie, level, Number(ab.con) || 10);

    const abilities: any = {};
    for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      abilities[k] = { value: Math.max(1, Math.min(30, Number(ab[k]) || 10)) };
    }

    const folderId = await this.getOrCreateFolder('Personnages — Portail', 'Actor');
    const actorData: any = {
      name: String(payload.characterName).slice(0, 80),
      type: 'character',
      folder: folderId || null,
      system: {
        abilities,
        attributes: { hp: { value: hp, max: hp } },
        details: {
          biography: { value: this.sanitizeBiographyHtml(payload.biography) },
          alignment: payload.alignment || '',
        },
      },
    };

    const actor = await Actor.create(actorData);
    if (!actor) throw new Error("Création de l'acteur échouée.");

    const items = [raceObj, classObj, subclassObj, backgroundObj, ...spellObjs, ...equipObjs].filter(
      Boolean
    );
    if (items.length) {
      await (actor as any).createEmbeddedDocuments('Item', items);
    }

    return { actorId: actor.id as string, actorName: actor.name as string, hp, itemsAdded: items.length };
  }

  /** PV de départ déterministes (pas de jet) : niv.1 = max(dé)+mod CON ; suivants = moyenne PHB. */
  private computeStartingHp(hitDie: number, level: number, con: number): number {
    const conMod = Math.floor((con - 10) / 2);
    const avg = Math.floor(hitDie / 2) + 1;
    let hp = hitDie + conMod;
    for (let l = 2; l <= level; l++) hp += avg + conMod;
    return Math.max(1, hp);
  }

  /** Échappe la biographie (anti-XSS stocké) et conserve les paragraphes/sauts de ligne. */
  private sanitizeBiographyHtml(text: any): string {
    const esc = String(text || '').replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
    );
    if (!esc.trim()) return '';
    return esc
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
}
