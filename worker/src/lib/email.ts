import nodemailer from 'nodemailer';

const NOTIFY_EMAIL = 'glowwitdaflow@gmail.com';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: NOTIFY_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

interface PostNotification {
  title: string;
  igPermalink: string;
  igLikeCount: number;
  youtubeVideoId: string | null;
  igReelsId: string | null;
  fbReelsId: string | null;
  totalPosted: number;
}

export async function sendPostNotification(post: PostNotification): Promise<void> {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.log('[email] GMAIL_APP_PASSWORD not set, skipping notification');
    return;
  }

  const platforms: string[] = [];
  if (post.youtubeVideoId) platforms.push(`YouTube Shorts: https://youtube.com/shorts/${post.youtubeVideoId}`);
  if (post.igReelsId) platforms.push(`Instagram Reels: posted (ID: ${post.igReelsId})`);
  if (post.fbReelsId) platforms.push(`Facebook Reels: posted (ID: ${post.fbReelsId})`);

  const subject = `Flow AI: Video #${post.totalPosted} Posted - ${post.title}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #7c3aed;">New Video Posted</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Title</td>
          <td style="padding: 8px 12px;">${post.title}</td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Original IG Likes</td>
          <td style="padding: 8px 12px; font-size: 18px; font-weight: bold; color: #ef4444;">${post.igLikeCount.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Original Post</td>
          <td style="padding: 8px 12px;"><a href="${post.igPermalink}">${post.igPermalink}</a></td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Total Videos Posted</td>
          <td style="padding: 8px 12px; font-size: 18px; font-weight: bold;">${post.totalPosted}</td>
        </tr>
      </table>
      <h3 style="color: #7c3aed;">Posted To:</h3>
      <ul style="list-style: none; padding: 0;">
        ${platforms.map(p => `<li style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">${p.includes('https://') ? p.replace(/(https:\/\/[^\s]+)/, '<a href="$1">$1</a>') : p}</li>`).join('')}
      </ul>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Sent by Flow AI Pipeline</p>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"Flow AI" <${NOTIFY_EMAIL}>`,
      to: NOTIFY_EMAIL,
      subject,
      html,
    });
    console.log(`[email] Notification sent: ${subject}`);
  } catch (err: any) {
    console.error(`[email] Failed to send notification:`, err.message);
  }
}
