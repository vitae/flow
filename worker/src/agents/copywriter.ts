import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';

// Template-based metadata generation — pure viral content
const ADJECTIVES = [
  'Insane', 'Epic', 'Incredible', 'Mind-Blowing', 'Unreal',
  'Stunning', 'Breathtaking', 'Next-Level', 'Jaw-Dropping',
  'Wild', 'Unbelievable', 'Ridiculous', 'Legendary', 'Genius',
];

const HOOKS = [
  'Wait For It', 'Must Watch', 'You Need To See This',
  'INSANE', 'Watch Till The End', 'Goals', 'Next Level',
  'So Satisfying', 'Pure Fire', 'How Is This Real',
  'I Watched This 10 Times', 'Try Not To Be Amazed',
];

const EMOJIS = ['🔥', '✨', '😱', '💯', '⚡', '🤯', '👀', '💫', '🎯', '🫠'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTitle(): string {
  const templates = [
    () => `${pick(EMOJIS)} ${pick(ADJECTIVES)}! ${pick(HOOKS)}`,
    () => `${pick(EMOJIS)} This Is ${pick(ADJECTIVES)} | ${pick(HOOKS)}`,
    () => `${pick(EMOJIS)} ${pick(HOOKS)} | ${pick(ADJECTIVES)}`,
    () => `${pick(EMOJIS)} How Is This Even Possible?! ${pick(HOOKS)}`,
    () => `${pick(EMOJIS)} ${pick(ADJECTIVES)} Content | ${pick(HOOKS)} ${pick(EMOJIS)}`,
  ];
  const title = pick(templates)();
  return title.length > 100 ? title.slice(0, 97) + '...' : title;
}

function generateDescription(permalink: string): string {
  const intros = [
    'This is absolutely wild — you need to see this!',
    'I can\'t stop watching this. Pure internet gold.',
    'When content hits different... this is the one.',
    'This might be the most viral video you see today.',
    'How is this even real?! Watch and be amazed.',
  ];
  return `${pick(intros)}

Original: ${permalink}

#shorts #viral #trending #fyp #mustwatch`;
}

const HASHTAG_POOL = [
  'viral', 'trending', 'fyp', 'shorts', 'mustwatch',
  'flowarts', 'dance', 'edm', 'rave', 'plur',
  'satisfying', 'mindblowing', 'nextlevel', 'skills', 'talent',
  'festival', 'hooping', 'poi', 'firedance', 'viralshorts',
];

// These hashtags are always included for YouTube Shorts discoverability
const REQUIRED_HASHTAGS = ['shorts', 'viral', 'trending', 'fyp'];

function pickHashtags(count: number = 10): string[] {
  const remaining = HASHTAG_POOL.filter(h => !REQUIRED_HASHTAGS.includes(h));
  const shuffled = [...remaining].sort(() => Math.random() - 0.5);
  return [...REQUIRED_HASHTAGS, ...shuffled.slice(0, count - REQUIRED_HASHTAGS.length)];
}

async function handlePost(post: CuratedPost) {
  console.log(`[copywriter] Generating metadata for post ${post.id}`);
  const title = generateTitle();
  const description = generateDescription(post.ig_permalink);
  const hashtags = pickHashtags(10);
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
