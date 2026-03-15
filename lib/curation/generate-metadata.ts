import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface VideoMetadata {
  title: string;
  description: string;
  hashtags: string[];
}

export async function generateVideoMetadata(
  igUsername: string,
  igCaption?: string,
): Promise<VideoMetadata> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are creating metadata for a YouTube Short video repost from Instagram.

Original creator: @${igUsername}
Original caption: ${igCaption || 'Flow arts performance'}

Generate:
1. A catchy YouTube Short title (under 100 chars, SEO-optimized, include emoji)
2. A description (2-3 sentences, credit @${igUsername}, mention gwdf.pro, engaging)
3. Exactly 5 hashtags that fit this specific video. Pick from contextually appropriate tags like: #flowarts #dance #edm #rave #hulahoop #poi #firedance #juggling #hooping #circus #festival #performance #firespinner #led #gloving

Respond ONLY in JSON format:
{"title": "...", "description": "...", "hashtags": ["flowarts", "dance", "edm", "rave", "hulahoop"]}`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON');

  return JSON.parse(jsonMatch[0]);
}
