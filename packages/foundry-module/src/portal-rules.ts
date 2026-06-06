// Tables de règles SRD 2024 curées pour le créateur de personnage du portail.
//
// Les compendiums dnd5e 2024 n'exposent PAS en données structurées : les listes de sorts par
// classe, ni les bonus d'historique (ASI/compétences/don, qui sont en HTML). On encode donc ici
// le minimum nécessaire à un créateur précis au niveau 1 : maîtrises, choix de compétences,
// lanceur de sorts, or de départ (classes) ; ASI/compétences/don/or (historiques) ; taille/
// vitesse/vision/traits (espèces). Tout contenu hors table retombe sur des défauts sûrs
// (cf. classRule/backgroundRule/speciesRule) → couverture totale préservée.
//
// Abréviations de compétences dnd5e : acr ani arc ath dec his ins itm inv med nat prc prf per
// slt ste sur. JdS = clés de caractéristiques (str dex con int wis cha).

export interface SpellcastingRule {
  ability: 'int' | 'wis' | 'cha';
  /** Prépare (clerc/druide/mage/paladin) vs connaît (barde/ensorceleur/occultiste/rôdeur). */
  prepares: boolean;
  cantrips1: number;
  /** Nombre de sorts de niv.1 connus à L1 (lanceurs « connus ») ; null = préparés (mod+niveau). */
  known1: number | null;
  /** Emplacements de sorts au niveau 1, par niveau de sort. */
  slots1: Record<number, number>;
}

export interface ClassRule {
  hitDie: number;
  saves: string[];
  skillChoices: { count: number; from: string[] };
  spellcasting?: SpellcastingRule;
  /** Or de départ (alternative « B ») en pièces d'or. */
  startingGold: number;
  /** Indicatif (affichage + CA estimée) : 'light'|'medium'|'heavy'|'shield'. */
  armor: string[];
}

export interface BackgroundRule {
  /** Les 3 caractéristiques de l'historique 2024 (le joueur répartit +2/+1 ou +1/+1/+1). */
  abilities: string[];
  skills: string[];
  tool?: string;
  featName?: string;
  gold: number;
}

export interface SpeciesRule {
  size: 'tiny' | 'sm' | 'med' | 'lg';
  speed: number;
  darkvision?: number;
  traits: string[];
}

const ALL_SKILLS = [
  'acr', 'ani', 'arc', 'ath', 'dec', 'his', 'ins', 'itm', 'inv',
  'med', 'nat', 'prc', 'prf', 'per', 'slt', 'ste', 'sur',
];

// --- Classes (SRD 2024, valeurs au niveau 1) -------------------------------

export const CLASS_RULES: Record<string, ClassRule> = {
  barbarian: {
    hitDie: 12, saves: ['str', 'con'], armor: ['light', 'medium', 'shield'],
    skillChoices: { count: 2, from: ['ani', 'ath', 'itm', 'nat', 'prc', 'sur'] },
    startingGold: 75,
  },
  bard: {
    hitDie: 8, saves: ['dex', 'cha'], armor: ['light'],
    skillChoices: { count: 3, from: ALL_SKILLS },
    spellcasting: { ability: 'cha', prepares: false, cantrips1: 2, known1: 4, slots1: { 1: 2 } },
    startingGold: 90,
  },
  cleric: {
    hitDie: 8, saves: ['wis', 'cha'], armor: ['light', 'medium', 'shield'],
    skillChoices: { count: 2, from: ['his', 'ins', 'med', 'per', 'rel'] },
    spellcasting: { ability: 'wis', prepares: true, cantrips1: 3, known1: null, slots1: { 1: 2 } },
    startingGold: 110,
  },
  druid: {
    hitDie: 8, saves: ['int', 'wis'], armor: ['light', 'shield'],
    skillChoices: { count: 2, from: ['arc', 'ani', 'ins', 'med', 'nat', 'prc', 'rel', 'sur'] },
    spellcasting: { ability: 'wis', prepares: true, cantrips1: 2, known1: null, slots1: { 1: 2 } },
    startingGold: 50,
  },
  fighter: {
    hitDie: 10, saves: ['str', 'con'], armor: ['light', 'medium', 'heavy', 'shield'],
    skillChoices: { count: 2, from: ['acr', 'ani', 'ath', 'his', 'ins', 'itm', 'per', 'prc', 'sur'] },
    startingGold: 155,
  },
  monk: {
    hitDie: 8, saves: ['str', 'dex'], armor: [],
    skillChoices: { count: 2, from: ['acr', 'ath', 'his', 'ins', 'rel', 'ste'] },
    startingGold: 50,
  },
  paladin: {
    // Lanceur à partir du niveau 2 → aucun sort/emplacement au niveau 1.
    hitDie: 10, saves: ['wis', 'cha'], armor: ['light', 'medium', 'heavy', 'shield'],
    skillChoices: { count: 2, from: ['ath', 'ins', 'itm', 'med', 'per', 'rel'] },
    startingGold: 150,
  },
  ranger: {
    // Lanceur à partir du niveau 2 → aucun sort au niveau 1.
    hitDie: 10, saves: ['str', 'dex'], armor: ['light', 'medium', 'shield'],
    skillChoices: { count: 3, from: ['ani', 'ath', 'ins', 'inv', 'nat', 'prc', 'ste', 'sur'] },
    startingGold: 150,
  },
  rogue: {
    hitDie: 8, saves: ['dex', 'int'], armor: ['light'],
    skillChoices: {
      count: 4,
      from: ['acr', 'ath', 'dec', 'ins', 'itm', 'inv', 'prc', 'prf', 'per', 'slt', 'ste'],
    },
    startingGold: 100,
  },
  sorcerer: {
    hitDie: 6, saves: ['con', 'cha'], armor: [],
    skillChoices: { count: 2, from: ['arc', 'dec', 'ins', 'itm', 'per', 'rel'] },
    spellcasting: { ability: 'cha', prepares: false, cantrips1: 4, known1: 2, slots1: { 1: 2 } },
    startingGold: 50,
  },
  warlock: {
    hitDie: 8, saves: ['wis', 'cha'], armor: ['light'],
    skillChoices: { count: 2, from: ['arc', 'dec', 'his', 'itm', 'inv', 'nat', 'rel'] },
    spellcasting: { ability: 'cha', prepares: false, cantrips1: 2, known1: 2, slots1: { 1: 1 } },
    startingGold: 100,
  },
  wizard: {
    hitDie: 6, saves: ['int', 'wis'], armor: [],
    skillChoices: { count: 2, from: ['arc', 'his', 'ins', 'inv', 'med', 'nat', 'rel'] },
    // Grimoire : 6 sorts de niv.1 à L1 (préparés ensuite via mod+niveau, simplifié ici).
    spellcasting: { ability: 'int', prepares: true, cantrips1: 3, known1: 6, slots1: { 1: 2 } },
    startingGold: 55,
  },
};

// --- Historiques (SRD 2024) ------------------------------------------------

export const BACKGROUND_RULES: Record<string, BackgroundRule> = {
  acolyte: { abilities: ['int', 'wis', 'cha'], skills: ['ins', 'rel'], tool: 'Calligraphie', featName: 'Initié à la magie (Clerc)', gold: 50 },
  artisan: { abilities: ['str', 'dex', 'int'], skills: ['inv', 'per'], tool: "Outils d'artisan", featName: 'Doué', gold: 32 },
  charlatan: { abilities: ['dex', 'con', 'cha'], skills: ['dec', 'slt'], tool: 'Déguisement', featName: 'Magicien improvisé', gold: 15 },
  criminal: { abilities: ['dex', 'con', 'int'], skills: ['slt', 'ste'], tool: 'Voleur', featName: 'Talentueux', gold: 16 },
  entertainer: { abilities: ['str', 'dex', 'cha'], skills: ['acr', 'prf'], tool: 'Instrument de musique', featName: 'Musicien', gold: 40 },
  farmer: { abilities: ['str', 'con', 'wis'], skills: ['ani', 'nat'], tool: "Outils de charpentier", featName: 'Robuste', gold: 30 },
  guard: { abilities: ['str', 'int', 'wis'], skills: ['ath', 'prc'], tool: 'Jeu', featName: 'Vigilant', gold: 12 },
  guide: { abilities: ['dex', 'con', 'wis'], skills: ['ste', 'sur'], tool: 'Cartographie', featName: 'Initié à la magie (Druide)', gold: 3 },
  hermit: { abilities: ['con', 'wis', 'cha'], skills: ['med', 'rel'], tool: 'Herboristerie', featName: 'Guérisseur', gold: 8 },
  merchant: { abilities: ['con', 'int', 'cha'], skills: ['ani', 'per'], tool: 'Navigation', featName: 'Chanceux', gold: 22 },
  noble: { abilities: ['str', 'int', 'cha'], skills: ['his', 'per'], tool: 'Jeu', featName: 'Talentueux', gold: 29 },
  sage: { abilities: ['con', 'int', 'wis'], skills: ['arc', 'his'], tool: 'Calligraphie', featName: 'Initié à la magie (Magicien)', gold: 50 },
  sailor: { abilities: ['str', 'dex', 'wis'], skills: ['acr', 'prc'], tool: 'Navigation', featName: 'Bagarreur de taverne', gold: 20 },
  scribe: { abilities: ['dex', 'int', 'wis'], skills: ['inv', 'prc'], tool: 'Calligraphie', featName: 'Doué', gold: 23 },
  soldier: { abilities: ['str', 'dex', 'con'], skills: ['ath', 'itm'], tool: 'Jeu', featName: 'Initié au combat', gold: 14 },
  wayfarer: { abilities: ['dex', 'wis', 'cha'], skills: ['ins', 'slt'], tool: 'Voleur', featName: 'Chanceux', gold: 16 },
};

// --- Espèces (SRD 2024) ----------------------------------------------------

export const SPECIES_RULES: Record<string, SpeciesRule> = {
  human: { size: 'med', speed: 30, traits: ['Polyvalent', 'Ingénieux', 'Compétent'] },
  elf: { size: 'med', speed: 30, darkvision: 60, traits: ['Ascendance féerique', 'Transe', 'Sens aiguisés'] },
  dwarf: { size: 'med', speed: 30, darkvision: 120, traits: ['Résistance naine', 'Connaissance de la pierre', 'Ténacité naine'] },
  halfling: { size: 'sm', speed: 30, traits: ['Chanceux', 'Brave', 'Agilité halfeline', 'Discrétion naturelle'] },
  orc: { size: 'med', speed: 30, darkvision: 120, traits: ['Poussée d’adrénaline', 'Endurance implacable'] },
  tiefling: { size: 'med', speed: 30, darkvision: 60, traits: ['Ascendance infernale', 'Résistance', 'Présence diabolique'] },
  dragonborn: { size: 'med', speed: 30, traits: ['Souffle', 'Résistance aux dégâts', 'Ascendance draconique'] },
  gnome: { size: 'sm', speed: 30, darkvision: 60, traits: ['Ruse gnome', 'Connaissance gnome'] },
  goliath: { size: 'med', speed: 35, traits: ['Ascendance de géant', 'Stature imposante', 'Carrure puissante'] },
  aasimar: { size: 'med', speed: 30, darkvision: 60, traits: ['Résistance céleste', 'Mains guérisseuses', 'Révélation céleste'] },
};

// --- Accès avec défauts sûrs (couverture totale) ---------------------------

const DEFAULT_CLASS: ClassRule = {
  hitDie: 8, saves: [], armor: ['light'],
  skillChoices: { count: 2, from: ALL_SKILLS },
  startingGold: 50,
};

/** Slugify FR/EN simple pour retrouver une règle par nom quand l'identifier manque. */
export function slugify(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// Synonymes FR → clés de table (les noms FR des compendiums diffèrent des clés EN).
const CLASS_ALIASES: Record<string, string> = {
  barbare: 'barbarian', barde: 'bard', clerc: 'cleric', druide: 'druid',
  guerrier: 'fighter', moine: 'monk', paladin: 'paladin', rodeur: 'ranger',
  roublard: 'rogue', ensorceleur: 'sorcerer', occultiste: 'warlock', magicien: 'wizard',
};
const BG_ALIASES: Record<string, string> = {
  acolyte: 'acolyte', artisan: 'artisan', charlatan: 'charlatan', criminel: 'criminal',
  artiste: 'entertainer', fermier: 'farmer', garde: 'guard', guide: 'guide', ermite: 'hermit',
  marchand: 'merchant', noble: 'noble', sage: 'sage', marin: 'sailor', scribe: 'scribe',
  soldat: 'soldier', voyageur: 'wayfarer',
};
const SPECIES_ALIASES: Record<string, string> = {
  humain: 'human', elfe: 'elf', nain: 'dwarf', halfelin: 'halfling', halfeline: 'halfling',
  orc: 'orc', tieffelin: 'tiefling', tieffeline: 'tiefling', drakeide: 'dragonborn',
  gnome: 'gnome', goliath: 'goliath', aasimar: 'aasimar',
};

function resolve<T>(table: Record<string, T>, aliases: Record<string, string>, identifier: string | undefined, name: string): T | undefined {
  const id = (identifier && slugify(identifier)) || slugify(name);
  if (table[id]) return table[id];
  if (aliases[id] && table[aliases[id]]) return table[aliases[id]];
  // Tente un préfixe (ex. « hauteflin des pieds légers » → halfling) sur le slug du nom.
  const nslug = slugify(name);
  for (const key of Object.keys(aliases)) {
    if (nslug.startsWith(key) && table[aliases[key]]) return table[aliases[key]];
  }
  return undefined;
}

export function classRule(identifier: string | undefined, name: string): ClassRule {
  return resolve(CLASS_RULES, CLASS_ALIASES, identifier, name) || DEFAULT_CLASS;
}
export function backgroundRule(identifier: string | undefined, name: string): BackgroundRule | null {
  return resolve(BACKGROUND_RULES, BG_ALIASES, identifier, name) || null;
}
export function speciesRule(identifier: string | undefined, name: string): SpeciesRule {
  return resolve(SPECIES_RULES, SPECIES_ALIASES, identifier, name) || { size: 'med', speed: 30, traits: [] };
}

export const POINT_BUY_COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
