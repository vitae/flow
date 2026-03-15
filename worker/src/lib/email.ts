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

interface PlatformResult {
  id: string | null;
  error: string | null;
}

interface PostNotification {
  title: string;
  igPermalink: string;
  igLikeCount: number;
  youtube: PlatformResult;
  igReels: PlatformResult;
  fbReels: PlatformResult;
  totalPosted: number;
}

function statusBadge(result: PlatformResult): string {
  if (result.error) {
    return `<span style="background: #fef2f2; color: #dc2626; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 13px;">Error</span>`;
  }
  return `<span style="background: #f0fdf4; color: #16a34a; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 13px;">No Errors</span>`;
}

function platformRow(icon: string, name: string, result: PlatformResult, urlPrefix: string): string {
  const badge = statusBadge(result);
  const link = result.id
    ? `<a href="${urlPrefix}${result.id}" style="color: #7c3aed; text-decoration: none; word-break: break-all;">${urlPrefix}${result.id}</a>`
    : '<span style="color: #9ca3af;">—</span>';
  const errorDetail = result.error
    ? `<div style="color: #dc2626; font-size: 12px; margin-top: 4px;">${result.error}</div>`
    : '';

  return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; width: 160px;">
        <span style="font-size: 18px;">${icon}</span> <strong>${name}</strong><br/>
        ${badge}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
        ${link}${errorDetail}
      </td>
    </tr>
  `;
}

export async function sendPostNotification(post: PostNotification): Promise<void> {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.log('[email] GMAIL_APP_PASSWORD not set, skipping notification');
    return;
  }

  const hasAnyError = post.youtube.error || post.igReels.error || post.fbReels.error;
  const subject = hasAnyError
    ? `Flow AI: Video #${post.totalPosted} Posted (with errors) - ${post.title}`
    : `Flow AI: Video #${post.totalPosted} Posted - ${post.title}`;

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
          <td style="padding: 8px 12px;"><a href="${post.igPermalink}" style="color: #7c3aed;">${post.igPermalink}</a></td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Total Videos Today</td>
          <td style="padding: 8px 12px; font-size: 18px; font-weight: bold;">${post.totalPosted} / 24</td>
        </tr>
      </table>
      <h3 style="color: #7c3aed;">Platform Status:</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
        ${platformRow('▶️', 'YouTube Shorts', post.youtube, 'https://youtube.com/shorts/')}
        ${platformRow('📸', 'Instagram Reels', post.igReels, 'https://www.instagram.com/reel/')}
        ${platformRow('👥', 'Facebook Reels', post.fbReels, 'https://www.facebook.com/reel/')}
      </table>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Sent by Flow AI Pipeline | gwdf.pro</p>
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
