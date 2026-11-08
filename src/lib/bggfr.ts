// Catégories et mécanismes BoardGameGeek : traduction française + types courts.
// Les termes absents du dictionnaire restent en anglais.

export const GAME_TYPES = ['Plateau', 'Cartes', 'Tuiles', 'Dés', 'Ambiance', 'Enquête', 'Coopératif', 'Solo'] as const
export type GameType = (typeof GAME_TYPES)[number]

const CATEGORIES: Record<string, string> = {
  'Abstract Strategy': 'Stratégie abstraite',
  'Action / Dexterity': 'Adresse',
  Adventure: 'Aventure',
  'Age of Reason': 'Siècle des Lumières',
  'American West': 'Far West',
  Ancient: 'Antiquité',
  Animals: 'Animaux',
  Arabian: 'Orient',
  'Aviation / Flight': 'Aviation',
  Bluffing: 'Bluff',
  Book: 'Livre',
  'Card Game': 'Jeu de cartes',
  "Children's Game": 'Jeu pour enfants',
  'City Building': 'Construction de ville',
  'Civil War': 'Guerre civile',
  Civilization: 'Civilisation',
  'Collectible Components': 'Éléments à collectionner',
  'Comic Book / Strip': 'Bande dessinée',
  Deduction: 'Déduction',
  Dice: 'Jeu de dés',
  Economic: 'Économie',
  Educational: 'Éducatif',
  Electronic: 'Électronique',
  Environmental: 'Environnement',
  'Expansion for Base-game': 'Extension',
  Exploration: 'Exploration',
  'Fan Expansion': 'Extension de fan',
  Fantasy: 'Fantasy',
  Farming: 'Agriculture',
  Fighting: 'Combat',
  'Game System': 'Système de jeu',
  Horror: 'Horreur',
  Humor: 'Humour',
  'Industry / Manufacturing': 'Industrie',
  Mafia: 'Mafia',
  Math: 'Mathématiques',
  'Mature / Adult': 'Adulte',
  Maze: 'Labyrinthe',
  Medical: 'Médecine',
  Medieval: 'Moyen Âge',
  Memory: 'Mémoire',
  Miniatures: 'Figurines',
  'Modern Warfare': 'Guerre moderne',
  'Movies / TV / Radio theme': 'Cinéma / TV',
  'Murder / Mystery': 'Meurtre / mystère',
  Music: 'Musique',
  Mythology: 'Mythologie',
  Napoleonic: 'Époque napoléonienne',
  Nautical: 'Marine',
  Negotiation: 'Négociation',
  'Novel-based': 'Tiré d’un roman',
  Number: 'Nombres',
  'Party Game': 'Jeu d’ambiance',
  Pirates: 'Pirates',
  Political: 'Politique',
  Prehistoric: 'Préhistoire',
  'Print & Play': 'Print & Play',
  Puzzle: 'Casse-tête',
  Racing: 'Course',
  'Real-time': 'Temps réel',
  Religious: 'Religion',
  Renaissance: 'Renaissance',
  'Science Fiction': 'Science-fiction',
  'Space Exploration': 'Exploration spatiale',
  'Spies / Secret Agents': 'Espionnage',
  Sports: 'Sport',
  'Territory Building': 'Conquête de territoire',
  Trains: 'Trains',
  Transportation: 'Transport',
  Travel: 'Voyage',
  Trivia: 'Culture générale',
  'Video Game Theme': 'Univers de jeu vidéo',
  Wargame: 'Wargame',
  'Word Game': 'Jeu de lettres',
  'World War I': 'Première Guerre mondiale',
  'World War II': 'Seconde Guerre mondiale',
  Zombies: 'Zombies',
}

const MECHANICS: Record<string, string> = {
  'Action Drafting': 'Draft d’actions',
  'Action Points': 'Points d’action',
  'Action Queue': 'File d’actions',
  'Action Retrieval': 'Récupération d’actions',
  'Action Timer': 'Actions chronométrées',
  'Advantage Token': 'Jeton d’avantage',
  Alliances: 'Alliances',
  'Area Majority / Influence': 'Majorité',
  'Area Movement': 'Déplacement par zones',
  'Area-Impulse': 'Impulsions par zones',
  'Auction / Bidding': 'Enchères',
  'Auction: Dutch': 'Enchères descendantes',
  'Auction: English': 'Enchères',
  'Auction: Sealed Bid': 'Enchères secrètes',
  'Auction: Turn Order Until Pass': 'Enchères',
  'Automatic Resource Growth': 'Croissance automatique',
  'Betting and Bluffing': 'Paris et bluff',
  Bingo: 'Bingo',
  'Bribery': 'Corruption',
  'Campaign / Battle Card Driven': 'Campagne pilotée par cartes',
  'Card Play Conflict Resolution': 'Combat par cartes',
  'Chit-Pull System': 'Tirage de pions',
  'Closed Drafting': 'Draft',
  'Closed Economy Auction': 'Enchères',
  'Command Cards': 'Cartes de commandement',
  'Commodity Speculation': 'Spéculation',
  'Communication Limits': 'Communication limitée',
  'Connections': 'Connexion',
  'Constrained Bidding': 'Enchères contraintes',
  Contracts: 'Contrats',
  'Cooperative Game': 'Coopération',
  'Crayon Rail System': 'Tracé de rails',
  'Critical Hits and Failures': 'Réussites et échecs critiques',
  'Cube Tower': 'Tour à cubes',
  'Deck Construction': 'Construction de deck',
  'Deck, Bag, and Pool Building': 'Deck building',
  Deduction: 'Déduction',
  'Delayed Purchase': 'Achat différé',
  'Dice Rolling': 'Lancer de dés',
  'Die Icon Resolution': 'Résolution par icônes de dés',
  'Different Dice Movement': 'Déplacement par dés',
  'Drawing': 'Dessin',
  'Elapsed Real Time Ending': 'Fin en temps réel',
  Enclosure: 'Encerclement',
  'End Game Bonuses': 'Bonus de fin de partie',
  Events: 'Événements',
  'Finale Ending': 'Fin en apothéose',
  Flicking: 'Pichenette',
  Follow: 'Suivre l’action',
  'Grid Coverage': 'Remplissage de grille',
  'Grid Movement': 'Déplacement sur grille',
  'Hand Management': 'Gestion de main',
  'Hexagon Grid': 'Plateau hexagonal',
  'Hidden Movement': 'Déplacement caché',
  'Hidden Roles': 'Rôles cachés',
  'Hidden Victory Points': 'Points de victoire cachés',
  'Highest-Lowest Scoring': 'Score du plus faible',
  'I Cut, You Choose': 'Je coupe, tu choisis',
  Income: 'Revenus',
  'Increase Value of Unchosen Resources': 'Valeur croissante des ressources délaissées',
  Induction: 'Induction',
  Interrupts: 'Interruptions',
  Investment: 'Investissement',
  'Kill Steal': 'Vol de victoire',
  'King of the Hill': 'Roi de la colline',
  'Ladder Climbing': 'Combinaisons montantes',
  Layering: 'Superposition',
  'Legacy Game': 'Legacy',
  'Line Drawing': 'Tracé de lignes',
  'Line of Sight': 'Ligne de vue',
  Loans: 'Emprunts',
  'Lose a Turn': 'Tour passé',
  Mancala: 'Semailles (mancala)',
  'Map Addition': 'Plateau évolutif',
  'Map Deformation': 'Plateau déformable',
  'Map Reduction': 'Plateau qui rétrécit',
  Market: 'Marché',
  Matching: 'Association',
  'Measurement Movement': 'Déplacement au mètre',
  'Melding and Splaying': 'Combinaisons posées',
  Memory: 'Mémoire',
  'Modular Board': 'Plateau modulaire',
  'Move Through Deck': 'Parcours du paquet',
  'Movement Points': 'Points de déplacement',
  'Multi-Use Cards': 'Cartes à usages multiples',
  'Multiple Maps': 'Plusieurs plateaux',
  'Narrative Choice / Paragraph': 'Choix narratifs',
  Negotiation: 'Négociation',
  'Neighbor Scope': 'Interaction entre voisins',
  'Network and Route Building': 'Construction de réseau',
  'Once-Per-Game Abilities': 'Pouvoirs à usage unique',
  'Open Drafting': 'Draft ouvert',
  'Order Counters': 'Pions d’ordre',
  Ownership: 'Propriété',
  'Paper-and-Pencil': 'Papier-crayon',
  'Passed Action Token': 'Jeton d’action transmis',
  'Pattern Building': 'Construction de motifs',
  'Pattern Movement': 'Déplacement en motif',
  'Pattern Recognition': 'Reconnaissance de motifs',
  'Physical Removal': 'Retrait physique',
  'Pick-up and Deliver': 'Transport de marchandises',
  'Pieces as Map': 'Pièces formant le plateau',
  'Player Elimination': 'Élimination',
  'Player Judge': 'Joueur juge',
  'Point to Point Movement': 'Déplacement de point à point',
  'Predictive Bid': 'Pari sur ses plis',
  'Prisoner’s Dilemma': 'Dilemme du prisonnier',
  "Prisoner's Dilemma": 'Dilemme du prisonnier',
  'Programmed Movement': 'Programmation',
  'Push Your Luck': 'Stop ou encore',
  'Questions and Answers': 'Questions et réponses',
  Race: 'Course',
  'Random Production': 'Production aléatoire',
  'Ratio / Combat Results Table': 'Table de combat',
  'Re-rolling and Locking': 'Relance de dés',
  'Real-Time': 'Temps réel',
  'Relative Movement': 'Déplacement relatif',
  'Resource Queue': 'File de ressources',
  'Resource to Move': 'Ressource pour se déplacer',
  'Rock-Paper-Scissors': 'Pierre-feuille-ciseaux',
  'Role Playing': 'Jeu de rôle',
  'Roles with Asymmetric Information': 'Rôles à information asymétrique',
  'Roll / Spin and Move': 'Lancer et déplacer',
  Rondel: 'Rondelle',
  'Scenario / Mission / Campaign Game': 'Scénarios / campagne',
  'Score-and-Reset Game': 'Manches avec remise à zéro',
  'Secret Unit Deployment': 'Déploiement secret',
  'Selection Order Bid': 'Enchère d’ordre de choix',
  'Semi-Cooperative Game': 'Semi-coopératif',
  'Set Collection': 'Collection',
  'Simulation': 'Simulation',
  'Simultaneous Action Selection': 'Choix simultanés',
  'Singing': 'Chant',
  'Single Loser Game': 'Un seul perdant',
  'Slide / Push': 'Glisser / pousser',
  'Solo / Solitaire Game': 'Jeu en solo',
  'Speed Matching': 'Rapidité',
  'Square Grid': 'Plateau quadrillé',
  'Stacking and Balancing': 'Empilement et équilibre',
  'Stat Check Resolution': 'Test de caractéristique',
  'Static Capture': 'Capture',
  'Stock Holding': 'Actions en bourse',
  Storytelling: 'Narration',
  'Sudden Death Ending': 'Fin par mort subite',
  'Tableau Building': 'Construction de tableau',
  'Take That': 'Attaques directes',
  'Targeted Clues': 'Indices ciblés',
  'Team-Based Game': 'Par équipes',
  'Tech Trees / Tech Tracks': 'Arbre technologique',
  'Three Dimensional Movement': 'Déplacement en 3D',
  'Tile Placement': 'Placement de tuiles',
  'Track Movement': 'Déplacement sur piste',
  Trading: 'Échanges',
  'Traitor Game': 'Traître',
  'Trick-taking': 'Plis',
  'Tug of War': 'Tir à la corde',
  'Turn Order: Auction': 'Ordre du tour aux enchères',
  'Turn Order: Claim Action': 'Ordre du tour réservé',
  'Turn Order: Pass Order': 'Ordre du tour par passe',
  'Turn Order: Progressive': 'Ordre du tour tournant',
  'Turn Order: Random': 'Ordre du tour aléatoire',
  'Turn Order: Role Order': 'Ordre du tour par rôles',
  'Turn Order: Stat-Based': 'Ordre du tour par score',
  'Turn Order: Time Track': 'Piste de temps',
  'Variable Phase Order': 'Phases variables',
  'Variable Player Powers': 'Pouvoirs asymétriques',
  'Variable Set-up': 'Mise en place variable',
  'Victory Points as a Resource': 'Points de victoire comme ressource',
  Voting: 'Vote',
  'Worker Placement': 'Placement d’ouvriers',
  'Worker Placement with Dice Workers': 'Placement de dés',
  'Worker Placement, Different Worker Types': 'Placement d’ouvriers',
  'Zone of Control': 'Zone de contrôle',
}

const tr = (dict: Record<string, string>) => (terms: string[]) => [...new Set(terms.map((t) => dict[t.trim()] ?? t.trim()).filter(Boolean))]
export const translateCategories = tr(CATEGORIES)
export const translateMechanics = tr(MECHANICS)

// Catégories qui décrivent le format du jeu : elles deviennent des types, pas des thèmes.
const FORMAT_CATEGORIES = new Set(['Card Game', 'Dice', 'Party Game', 'Expansion for Base-game', 'Fan Expansion', 'Print & Play'])

// Indices d'un jeu qui se joue sur un plateau.
const BOARD_MECHANICS = new Set([
  'Worker Placement',
  'Worker Placement, Different Worker Types',
  'Worker Placement with Dice Workers',
  'Network and Route Building',
  'Grid Movement',
  'Point to Point Movement',
  'Area Movement',
  'Hexagon Grid',
  'Square Grid',
  'Modular Board',
  'Map Reduction',
  'Map Deformation',
  'Pick-up and Deliver',
  'Roll / Spin and Move',
  'Track Movement',
  'Rondel',
  'Movement Points',
  'Hidden Movement',
  'Zone of Control',
  'Line of Sight',
  'Crayon Rail System',
  'Area-Impulse',
])
// (Majorité, plateau évolutif, encerclement : aussi fréquents dans les jeux de cartes et de tuiles, donc non retenus.)
const BOARD_CATEGORIES = new Set(['Territory Building', 'Wargame', 'Trains', 'Racing'])
const CARD_MECHANICS = new Set(['Trick-taking', 'Ladder Climbing', 'Melding and Splaying', 'Deck Construction'])

export interface TypeInput {
  categories: string[] // BGG, en anglais
  mechanics: string[] // BGG, en anglais
  title: string
  players_min: number | null
  previous: string[] // genres actuels (MyLudo), pour l'escape game
}

export interface TypeResult {
  types: GameType[]
  doubt: string | null // raison de vérifier, sinon null
  themes: string[] // catégories BGG traduites, hors format
  mechanics: string[] // mécanismes BGG traduits
}

/** Types courts déduits des catégories et mécanismes BGG. */
export function computeTypes(i: TypeInput): TypeResult {
  const cat = new Set(i.categories)
  const mec = new Set(i.mechanics)
  const prev = i.previous.map((p) => p.toLowerCase())
  const types: GameType[] = []
  let doubt: string | null = null

  const boardMec = [...mec].filter((m) => BOARD_MECHANICS.has(m)).length
  const boardSignals = boardMec + [...cat].filter((c) => BOARD_CATEGORIES.has(c)).length
  const tiles = mec.has('Tile Placement') || mec.has('Grid Coverage')
  const card = cat.has('Card Game') || [...mec].some((m) => CARD_MECHANICS.has(m))
  const party = cat.has('Party Game')
  const escape = /\b(escape|unlock|exit)\b/i.test(i.title) || prev.some((p) => p.includes('escape'))
  const mystery = cat.has('Murder / Mystery') || escape || (cat.has('Deduction') && (mec.has('Storytelling') || mec.has('Narrative Choice / Paragraph') || mec.has('Scenario / Mission / Campaign Game')))

  // Format principal (un seul) : tuiles (si rien d'autre ne fait plateau) > plateau > dés > cartes.
  // « Conquête de territoire » seule ne fait pas un plateau pour un jeu de tuiles (Carcassonne).
  if (tiles && boardMec === 0) types.push('Tuiles')
  else if (boardSignals > 0) types.push('Plateau')
  else if (cat.has('Dice') || mec.has('Re-rolling and Locking')) types.push('Dés')
  else if (card) types.push('Cartes')

  if (party) types.push('Ambiance')
  if (mystery) types.push('Enquête')
  if (mec.has('Cooperative Game')) types.push('Coopératif')
  if (mec.has('Solo / Solitaire Game') || i.players_min === 1) types.push('Solo')

  if (!i.categories.length && !i.mechanics.length) doubt = 'BGG ne donne ni catégorie ni mécanisme'
  else if (!types.some((t) => ['Plateau', 'Dés', 'Tuiles', 'Cartes', 'Ambiance', 'Enquête'].includes(t))) {
    types.unshift('Plateau')
    doubt = 'format non déterminé, plateau par défaut'
  } else if (types[0] === 'Plateau' && card && boardSignals === 1) doubt = 'jeu de cartes avec un seul indice de plateau'

  return {
    types,
    doubt,
    themes: translateCategories(i.categories.filter((c) => !FORMAT_CATEGORIES.has(c))),
    mechanics: translateMechanics(i.mechanics),
  }
}
