import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';

// Template-based metadata generation (no external API needed)
const ADJECTIVES = [
  'Mesmerizing', 'Insane', 'Epic', 'Incredible', 'Hypnotic',
  'Mind-Blowing', 'Unreal', 'Stunning', 'Breathtaking', 'Next-Level',
  'Jaw-Dropping', 'Otherworldly', 'Electrifying', 'Wild', 'Unbelievable',
];

const TYPES = [
  'Flow Arts Performance', 'Spinning Session', 'Flow Routine',
  'Performance', 'Skills', 'Moves', 'Flow', 'Tricks',
];

const SUFFIXES = [
  'Must Watch', 'Pure Fire', 'Festival Vibes', 'Flow State',
  'INSANE', 'Wait For It', 'Goals', 'Next Level', 'So Satisfying',
];

const EMOJIS = ['🔥', '✨', '🌊', '💫', '🎪', '⚡', '🌀', '💜', '🎭', '🪩'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTitle(): string {
  const templates = [
    () => `${pick(EMOJIS)} ${pick(ADJECTIVES)} ${pick(TYPES)} | ${pick(SUFFIXES)}`,
    () => `${pick(EMOJIS)} This ${pick(TYPES)} Is On Another Level`,
    () => `${pick(EMOJIS)} When Flow Arts Hit Different | ${pick(SUFFIXES)}`,
    () => `${pick(EMOJIS)} You Won't Believe This ${pick(TYPES)}`,
    () => `${pick(EMOJIS)} ${pick(ADJECTIVES)} ${pick(TYPES)} ${pick(EMOJIS)}`,
  ];
  const title = pick(templates)();
  return title.length > 100 ? title.slice(0, 97) + '...' : title;
}

function generateDescription(permalink: string): string {
  const intros = [
    'This flow artist is absolutely incredible!',
    'Pure flow state energy in this performance!',
    'When the flow hits different... this is pure magic.',
    'Absolutely mesmerizing performance that will leave you speechless.',
    'Flow arts at its finest — watch this and try not to be amazed.',
  ];
  return `${pick(intros)}

🌊 Discover more amazing flow arts at gwdf.pro

Original: ${permalink}`;
}

const HASHTAG_POOL = [
  'flowarts', 'dance', 'edm', 'rave', 'hulahoop', 'poi', 'firedance',
  'juggling', 'hooping', 'circus', 'festival', 'performance', 'firespinner',
  'led', 'gloving', 'shuffle', 'flow', 'spinning', 'shorts', 'viral',
];

function pickHashtags(count: number = 8): string[] {
  const shuffled = [...HASHTAG_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function handlePost(post: CuratedPost) {
  console.log(`[copywriter] Generating metadata for post ${post.id}`);
  const title = generateTitle();
  const description = generateDescription(post.ig_permalink);
  const hashtags = pickHashtags(8);
  console.log(`[copywriter] Title: "${title}"`);

  return { title, description, hashtags };
}

export const copywriterAgent = createAgentLoop(
  {
    name: 'copywriter',
    inputStatus: 'edited',
    processingStatus: 'processing',
    outputStatus: 'metadata_ready',
    pollIntervalMs: 10_000,
    batchSize: 3,
  },
  handlePost,
);
