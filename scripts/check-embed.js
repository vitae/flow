const fs = require('fs');
const d = fs.readFileSync('/tmp/ig_embed.html', 'utf8');
console.log('has video_url:', d.includes('video_url'));
console.log('has .mp4:', d.includes('.mp4'));
const videoMatch = d.match(/"video_url":"([^"]+)"/);
if (videoMatch) {
  console.log('VIDEO URL:', videoMatch[1].replace(/\\u0026/g, '&'));
} else {
  console.log('No video_url found in embed');
  // Try looking for other video patterns
  const srcMatch = d.match(/src="(https:\/\/[^"]*\.mp4[^"]*)"/);
  if (srcMatch) console.log('MP4 SRC:', srcMatch[1]);
}
