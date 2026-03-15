const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;

interface TrendingAudio {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
}

export async function findTrendingShortAudio(mood?: string): Promise<TrendingAudio[]> {
  const queries = [
    'trending shorts music 2026',
    'viral dance music shorts',
    'edm rave music shorts',
    mood ? `${mood} music shorts` : 'flow arts music',
  ];

  const allResults: TrendingAudio[] = [];

  for (const query of queries) {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        videoDuration: 'short',
        order: 'viewCount',
        maxResults: '10',
        key: YOUTUBE_API_KEY,
      })
    );
    const data = await res.json();
    if (!data.items) continue;

    const ids = data.items.map((i: any) => i.id.videoId).join(',');
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?` +
      new URLSearchParams({
        part: 'statistics',
        id: ids,
        key: YOUTUBE_API_KEY,
      })
    );
    const statsData = await statsRes.json();
    const viewMap = new Map<string, number>(
      (statsData.items || []).map((i: any) => [i.id, parseInt(i.statistics.viewCount || '0')])
    );

    for (const item of data.items) {
      allResults.push({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        viewCount: viewMap.get(item.id.videoId) || 0,
      });
    }
  }

  allResults.sort((a, b) => b.viewCount - a.viewCount);
  return allResults.slice(0, 5);
}
