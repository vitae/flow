import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@/lib/supabase/client';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    const { video_id, transcript, platforms } = await request.json();
    const supabase = createServerClient();

    // Fetch trending data from RapidAPI
    let trendingTags: string[] = [];
    try {
      if (process.env.RAPIDAPI_KEY) {
        const trendRes = await fetch(
          'https://ritetag.p.rapidapi.com/v1/stats/trending',
          {
            headers: {
              'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
              'X-RapidAPI-Host': 'ritetag.p.rapidapi.com',
            },
          }
        );
        const trendData = await trendRes.json();
        trendingTags = trendData.tags?.map((t: any) => t.tag) || [];
      }
    } catch {
      console.log('Trending API unavailable, using Claude only');
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are a social media hashtag expert. Return ONLY a JSON object:
{
  "hashtags": ["tag1", "tag2"],
  "trending": ["tag1", "tag2"],
  "niche": ["tag1", "tag2"],
  "platform_specific": {
    "youtube": ["tag1"],
    "instagram": ["tag1"],
    "facebook": ["tag1"],
    "twitter": ["tag1"]
  }
}
No # symbol. No markdown. JSON only.`,
      messages: [{
        role: 'user',
        content: `Generate 25 hashtags for this video.

Transcript: "${transcript || 'Flow arts performance video'}"
Trending tags: ${trendingTags.slice(0, 20).join(', ') || 'none'}
Platforms: ${platforms?.join(', ') || 'youtube, instagram, facebook, twitter'}

Mix: 10 trending, 10 niche, 5 platform-specific. All lowercase.`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    let hashtags;
    try {
      hashtags = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      hashtags = { hashtags: [], trending: [], niche: [], platform_specific: {} };
    }

    if (video_id) {
      await supabase.from('videos').update({ hashtags: hashtags.hashtags }).eq('id', video_id);
    }

    return NextResponse.json(hashtags);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
