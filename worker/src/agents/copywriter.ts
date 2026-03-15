import Anthropic from '@anthropic-ai/sdk';
import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';

async function generateMetadata(igUsername: string, igCaption?: string) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Create YouTube Short metadata for a flow arts video repost.
Creator: @${igUsername} on Instagram
Caption: ${igCaption || 'Flow arts performance'}

Return ONLY JSON: {"title":"<catchy title under 100 chars with emoji>","description":"<2-3 sentences, credit @${igUsername}, mention gwdf.pro>","hashtags":["<5 contextual hashtags from: flowarts,dance,edm,rave,hulahoop,poi,firedance,juggling,hooping,circus,festival,performance,firespinner,led,gloving>"]}`
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
}

async function handlePost(post: CuratedPost) {
  console.log(`[copywriter] Generating metadata for @${post.ig_username}`);
  const metadata = await generateMetadata(post.ig_username, post.ig_permalink);
  console.log(`[copywriter] Title: "${metadata.title}"`);

  return {
    title: metadata.title,
    description: metadata.description,
    hashtags: metadata.hashtags,
  };
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
