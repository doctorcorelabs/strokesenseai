// Original practice content for the speech and aphasia labs in this folder.
// Every word list, cue sentence, story, and question below was written for
// this project. Nothing is reproduced from published therapy materials or
// standardized tests, and the pictures are emoji and text, not artwork.

export type NamingLevel = 1 | 2 | 3;

export interface NamingItem {
  id: string;
  /** The target word the learner tries to produce. */
  word: string;
  /** Emoji picture shown as the naming stimulus. */
  emoji: string;
  /** Broad category, also usable as a category cue. */
  category: string;
  level: NamingLevel;
  /** One sentence semantic hint. Never contains the target word itself. */
  semanticCue: string;
  /**
   * Curated words from the same semantic field. An answer in this list is a
   * semantic near miss, which is exactly what the deterministic layer scores.
   */
  semanticRelatives: string[];
}

export const NAMING_ITEMS: NamingItem[] = [
  // Level 1: high frequency everyday words.
  {
    id: 'apple',
    word: 'apple',
    emoji: '🍎',
    category: 'food',
    level: 1,
    semanticCue: 'It is a round fruit that grows on a tree and is often red or green.',
    semanticRelatives: ['orange', 'pear', 'fruit', 'banana'],
  },
  {
    id: 'banana',
    word: 'banana',
    emoji: '🍌',
    category: 'food',
    level: 1,
    semanticCue: 'It is a long yellow fruit with a peel you pull down before eating.',
    semanticRelatives: ['orange', 'pear', 'fruit', 'apple'],
  },
  {
    id: 'dog',
    word: 'dog',
    emoji: '🐶',
    category: 'animal',
    level: 1,
    semanticCue: 'It is a pet animal that barks and likes to go for walks.',
    semanticRelatives: ['puppy', 'cat', 'pet', 'animal'],
  },
  {
    id: 'cat',
    word: 'cat',
    emoji: '🐱',
    category: 'animal',
    level: 1,
    semanticCue: 'It is a pet animal that purrs and sleeps for much of the day.',
    semanticRelatives: ['kitten', 'dog', 'pet', 'animal'],
  },
  {
    id: 'cup',
    word: 'cup',
    emoji: '☕',
    category: 'household',
    level: 1,
    semanticCue: 'You drink hot tea or coffee from it, and it has a handle.',
    semanticRelatives: ['mug', 'glass', 'teacup', 'drink'],
  },
  {
    id: 'book',
    word: 'book',
    emoji: '📖',
    category: 'household',
    level: 1,
    semanticCue: 'It has pages with words and pictures that you read.',
    semanticRelatives: ['novel', 'magazine', 'story', 'pages'],
  },
  {
    id: 'chair',
    word: 'chair',
    emoji: '🪑',
    category: 'household',
    level: 1,
    semanticCue: 'You sit on it at a table, and it usually has four legs and a back.',
    semanticRelatives: ['stool', 'seat', 'table', 'sofa'],
  },
  {
    id: 'key',
    word: 'key',
    emoji: '🔑',
    category: 'household',
    level: 1,
    semanticCue: 'You turn it in a lock to open a door.',
    semanticRelatives: ['lock', 'door', 'metal'],
  },
  {
    id: 'fish',
    word: 'fish',
    emoji: '🐟',
    category: 'animal',
    level: 1,
    semanticCue: 'It lives in water and breathes through gills.',
    semanticRelatives: ['shark', 'whale', 'animal', 'sea'],
  },
  {
    id: 'bird',
    word: 'bird',
    emoji: '🐦',
    category: 'animal',
    level: 1,
    semanticCue: 'It has wings and feathers and most kinds can fly.',
    semanticRelatives: ['duck', 'eagle', 'animal', 'chicken'],
  },
  // Level 2: common but slightly less frequent words.
  {
    id: 'umbrella',
    word: 'umbrella',
    emoji: '☂️',
    category: 'weather',
    level: 2,
    semanticCue: 'You hold it over your head to stay dry when it rains.',
    semanticRelatives: ['rain', 'raincoat', 'cover', 'shade'],
  },
  {
    id: 'scissors',
    word: 'scissors',
    emoji: '✂️',
    category: 'tool',
    level: 2,
    semanticCue: 'They have two blades and two finger holes, and they cut paper.',
    semanticRelatives: ['knife', 'blades', 'cutter', 'shears'],
  },
  {
    id: 'toothbrush',
    word: 'toothbrush',
    emoji: '🪥',
    category: 'household',
    level: 2,
    semanticCue: 'You put paste on its bristles and use it to clean your teeth.',
    semanticRelatives: ['brush', 'toothpaste', 'teeth', 'comb'],
  },
  {
    id: 'candle',
    word: 'candle',
    emoji: '🕯️',
    category: 'household',
    level: 2,
    semanticCue: 'It is made of wax with a wick that you light for a small flame.',
    semanticRelatives: ['lamp', 'light', 'flame', 'lantern'],
  },
  {
    id: 'glasses',
    word: 'glasses',
    emoji: '👓',
    category: 'clothing',
    level: 2,
    semanticCue: 'You wear them in front of your eyes to see more clearly.',
    semanticRelatives: ['spectacles', 'sunglasses', 'lenses', 'eyes'],
  },
  {
    id: 'envelope',
    word: 'envelope',
    emoji: '✉️',
    category: 'household',
    level: 2,
    semanticCue: 'You fold a letter inside it and seal it before posting.',
    semanticRelatives: ['letter', 'paper', 'mail', 'stamp'],
  },
  {
    id: 'clock',
    word: 'clock',
    emoji: '🕐',
    category: 'household',
    level: 2,
    semanticCue: 'It hangs on a wall or stands on a shelf and tells the time.',
    semanticRelatives: ['watch', 'time', 'timer', 'alarm'],
  },
  {
    id: 'bicycle',
    word: 'bicycle',
    emoji: '🚲',
    category: 'transport',
    level: 2,
    semanticCue: 'It has two wheels and pedals, and you ride it by pushing the pedals.',
    semanticRelatives: ['bike', 'motorcycle', 'scooter', 'wheels'],
  },
  {
    id: 'turtle',
    word: 'turtle',
    emoji: '🐢',
    category: 'animal',
    level: 2,
    semanticCue: 'It is a slow animal that carries a hard shell on its back.',
    semanticRelatives: ['tortoise', 'frog', 'animal', 'shell'],
  },
  {
    id: 'ladder',
    word: 'ladder',
    emoji: '🪜',
    category: 'tool',
    level: 2,
    semanticCue: 'You climb its steps to reach something high up.',
    semanticRelatives: ['stairs', 'steps', 'stool', 'climb'],
  },
  // Level 3: lower frequency words for a harder round.
  {
    id: 'anchor',
    word: 'anchor',
    emoji: '⚓',
    category: 'sea',
    level: 3,
    semanticCue: 'A heavy metal piece dropped from a boat to hold it in one place.',
    semanticRelatives: ['boat', 'ship', 'hook', 'chain'],
  },
  {
    id: 'compass',
    word: 'compass',
    emoji: '🧭',
    category: 'tool',
    level: 3,
    semanticCue: 'Its needle always points north, so travellers use it to find direction.',
    semanticRelatives: ['map', 'needle', 'direction', 'magnet'],
  },
  {
    id: 'feather',
    word: 'feather',
    emoji: '🪶',
    category: 'animal',
    level: 3,
    semanticCue: 'It is one of the light, soft parts that cover a bird and help it fly.',
    semanticRelatives: ['wing', 'down', 'quill', 'bird'],
  },
  {
    id: 'volcano',
    word: 'volcano',
    emoji: '🌋',
    category: 'nature',
    level: 3,
    semanticCue: 'It is a mountain that can erupt with hot lava and ash.',
    semanticRelatives: ['mountain', 'lava', 'eruption', 'crater'],
  },
  {
    id: 'snowflake',
    word: 'snowflake',
    emoji: '❄️',
    category: 'weather',
    level: 3,
    semanticCue: 'It is a single tiny crystal of frozen water that falls in winter.',
    semanticRelatives: ['snow', 'ice', 'crystal', 'winter'],
  },
  {
    id: 'telescope',
    word: 'telescope',
    emoji: '🔭',
    category: 'tool',
    level: 3,
    semanticCue: 'You look through this tube to see distant stars and planets.',
    semanticRelatives: ['binoculars', 'microscope', 'stars', 'lens'],
  },
  {
    id: 'kangaroo',
    word: 'kangaroo',
    emoji: '🦘',
    category: 'animal',
    level: 3,
    semanticCue: 'It is an Australian animal that hops and carries its baby in a pouch.',
    semanticRelatives: ['koala', 'wallaby', 'animal', 'marsupial'],
  },
  {
    id: 'pineapple',
    word: 'pineapple',
    emoji: '🍍',
    category: 'food',
    level: 3,
    semanticCue: 'It is a tropical fruit with spiky skin and a crown of leaves on top.',
    semanticRelatives: ['mango', 'coconut', 'fruit', 'papaya'],
  },
  {
    id: 'mushroom',
    word: 'mushroom',
    emoji: '🍄',
    category: 'nature',
    level: 3,
    semanticCue: 'It is a fungus with a stem and a cap that grows in damp places.',
    semanticRelatives: ['fungus', 'toadstool', 'plant', 'forest'],
  },
  {
    id: 'octopus',
    word: 'octopus',
    emoji: '🐙',
    category: 'animal',
    level: 3,
    semanticCue: 'It is a sea animal with eight arms and a soft, round body.',
    semanticRelatives: ['squid', 'crab', 'animal', 'tentacles'],
  },
];

// ---------------------------------------------------------------------------
// Communication board
// ---------------------------------------------------------------------------

export type BoardWordKind = 'person' | 'action' | 'thing' | 'feeling' | 'place' | 'question';

export interface BoardWord {
  label: string;
  emoji: string;
  kind: BoardWordKind;
}

export interface BoardCategory {
  id: string;
  title: string;
  words: BoardWord[];
}

export const BOARD_CATEGORIES: BoardCategory[] = [
  {
    id: 'people',
    title: 'People',
    words: [
      { label: 'I', emoji: '🙋', kind: 'person' },
      { label: 'you', emoji: '🫵', kind: 'person' },
      { label: 'we', emoji: '👥', kind: 'person' },
      { label: 'family', emoji: '👨‍👩‍👧', kind: 'person' },
      { label: 'doctor', emoji: '🧑‍⚕️', kind: 'person' },
      { label: 'nurse', emoji: '🧑‍⚕️', kind: 'person' },
      { label: 'friend', emoji: '🧑‍🤝‍🧑', kind: 'person' },
    ],
  },
  {
    id: 'actions',
    title: 'Actions',
    words: [
      { label: 'want', emoji: '🤲', kind: 'action' },
      { label: 'need', emoji: '❗', kind: 'action' },
      { label: 'like', emoji: '👍', kind: 'action' },
      { label: 'go', emoji: '🚶', kind: 'action' },
      { label: 'eat', emoji: '🍽️', kind: 'action' },
      { label: 'drink', emoji: '🥤', kind: 'action' },
      { label: 'help', emoji: '🆘', kind: 'action' },
      { label: 'stop', emoji: '✋', kind: 'action' },
      { label: 'wait', emoji: '⏸️', kind: 'action' },
      { label: 'sleep', emoji: '😴', kind: 'action' },
    ],
  },
  {
    id: 'needs',
    title: 'Needs and things',
    words: [
      { label: 'water', emoji: '💧', kind: 'thing' },
      { label: 'food', emoji: '🍲', kind: 'thing' },
      { label: 'toilet', emoji: '🚻', kind: 'thing' },
      { label: 'medicine', emoji: '💊', kind: 'thing' },
      { label: 'phone', emoji: '📱', kind: 'thing' },
      { label: 'home', emoji: '🏠', kind: 'thing' },
      { label: 'bed', emoji: '🛏️', kind: 'thing' },
      { label: 'glasses', emoji: '👓', kind: 'thing' },
      { label: 'book', emoji: '📖', kind: 'thing' },
    ],
  },
  {
    id: 'feelings',
    title: 'Feelings',
    words: [
      { label: 'good', emoji: '👍', kind: 'feeling' },
      { label: 'bad', emoji: '👎', kind: 'feeling' },
      { label: 'tired', emoji: '😪', kind: 'feeling' },
      { label: 'hungry', emoji: '🍽️', kind: 'feeling' },
      { label: 'in pain', emoji: '😣', kind: 'feeling' },
      { label: 'hot', emoji: '🥵', kind: 'feeling' },
      { label: 'cold', emoji: '🥶', kind: 'feeling' },
      { label: 'happy', emoji: '😊', kind: 'feeling' },
      { label: 'sad', emoji: '😢', kind: 'feeling' },
    ],
  },
  {
    id: 'where-when',
    title: 'Where and when',
    words: [
      { label: 'here', emoji: '📍', kind: 'place' },
      { label: 'there', emoji: '👉', kind: 'place' },
      { label: 'now', emoji: '⏰', kind: 'place' },
      { label: 'later', emoji: '🕑', kind: 'place' },
      { label: 'today', emoji: '📅', kind: 'place' },
      { label: 'tomorrow', emoji: '🌅', kind: 'place' },
      { label: 'where', emoji: '❓', kind: 'question' },
      { label: 'when', emoji: '❓', kind: 'question' },
      { label: 'why', emoji: '❓', kind: 'question' },
    ],
  },
  {
    id: 'answers',
    title: 'Answers',
    words: [
      { label: 'yes', emoji: '✅', kind: 'action' },
      { label: 'no', emoji: '🚫', kind: 'action' },
      { label: 'more', emoji: '➕', kind: 'action' },
      { label: 'finished', emoji: '🏁', kind: 'action' },
      { label: 'again', emoji: '🔁', kind: 'action' },
      { label: 'thank you', emoji: '🙏', kind: 'feeling' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Comprehension check
// ---------------------------------------------------------------------------

export interface SceneObject {
  id: string;
  label: string;
  emoji: string;
}

export const SCENE_OBJECTS: SceneObject[] = [
  { id: 'apple', label: 'apple', emoji: '🍎' },
  { id: 'cup', label: 'cup', emoji: '☕' },
  { id: 'book', label: 'book', emoji: '📖' },
  { id: 'key', label: 'key', emoji: '🔑' },
  { id: 'dog', label: 'dog', emoji: '🐶' },
  { id: 'chair', label: 'chair', emoji: '🪑' },
  { id: 'fish', label: 'fish', emoji: '🐟' },
  { id: 'banana', label: 'banana', emoji: '🍌' },
];

export interface OneStepCommand {
  id: string;
  text: string;
  targetId: string;
}

export const ONE_STEP_COMMANDS: OneStepCommand[] = [
  { id: 'one-1', text: 'Touch the apple', targetId: 'apple' },
  { id: 'one-2', text: 'Touch the key', targetId: 'key' },
  { id: 'one-3', text: 'Touch the fish', targetId: 'fish' },
  { id: 'one-4', text: 'Touch the chair', targetId: 'chair' },
  { id: 'one-5', text: 'Touch the banana', targetId: 'banana' },
  { id: 'one-6', text: 'Touch the dog', targetId: 'dog' },
];

export interface TwoStepCommand {
  id: string;
  text: string;
  /** Target ids in the order they must be touched. */
  targetIds: [string, string];
}

export const TWO_STEP_COMMANDS: TwoStepCommand[] = [
  { id: 'two-1', text: 'Touch the cup, then touch the book', targetIds: ['cup', 'book'] },
  { id: 'two-2', text: 'Touch the dog, then touch the apple', targetIds: ['dog', 'apple'] },
  { id: 'two-3', text: 'Touch the banana, then touch the key', targetIds: ['banana', 'key'] },
  { id: 'two-4', text: 'Touch the fish, then touch the chair', targetIds: ['fish', 'chair'] },
];

export interface StoryQuestion {
  id: string;
  question: string;
  /** The factually correct yes or no, from the story text alone. */
  answer: boolean;
}

export interface StorySet {
  id: string;
  title: string;
  story: string;
  questions: StoryQuestion[];
}

export const STORY_SETS: StorySet[] = [
  {
    id: 'story-market',
    title: 'The Morning Market',
    story:
      'Sari went to the market early in the morning. She bought rice, eggs, and a bunch of bananas. On the way home, it started to rain, so she waited under a shop roof until the rain stopped.',
    questions: [
      { id: 'market-1', question: 'Did Sari go to the market in the evening?', answer: false },
      { id: 'market-2', question: 'Did Sari buy bananas?', answer: true },
      { id: 'market-3', question: 'Did Sari walk home in the rain?', answer: false },
    ],
  },
  {
    id: 'story-garden',
    title: 'The Garden Gate',
    story:
      'Bimo planted tomato seeds in a small pot by the window. He watered them every day before breakfast. After three weeks, small green leaves appeared, and he moved the pot outside into the sun.',
    questions: [
      { id: 'garden-1', question: 'Did Bimo plant tomato seeds?', answer: true },
      { id: 'garden-2', question: 'Did Bimo water the seeds after dinner?', answer: false },
      { id: 'garden-3', question: 'Did the leaves appear after three days?', answer: false },
    ],
  },
  {
    id: 'story-train',
    title: 'The Late Train',
    story:
      'The train to the city was one hour late because of heavy rain on the tracks. Rina read her book at the station and drank a cup of tea. When the train finally arrived, she found a seat by the window.',
    questions: [
      { id: 'train-1', question: 'Was the train late because of heavy rain?', answer: true },
      { id: 'train-2', question: 'Did Rina drink a cup of coffee?', answer: false },
      { id: 'train-3', question: 'Did Rina sit by the window?', answer: true },
    ],
  },
];
