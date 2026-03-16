import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/swarm/shortcut
 *
 * Generates and serves a downloadable .shortcut (Apple plist) file
 * with the base URL baked in. One-tap install on iOS.
 */

const P = '\uFFFC'; // Object Replacement Character — Apple Shortcuts variable placeholder

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Token builders ──────────────────────────────────────────────────────────

/** Plain text token */
function txt(s: string): string {
  return `<dict>
            <key>Value</key>
            <dict><key>string</key><string>${esc(s)}</string></dict>
            <key>WFSerializationType</key>
            <string>WFTextTokenString</string>
          </dict>`;
}

/** Named variable reference token (for text fields like JSON body values, headers) */
function v(name: string): string {
  return `<dict>
            <key>Value</key>
            <dict>
              <key>string</key><string>${P}</string>
              <key>attachmentsByRange</key>
              <dict>
                <key>{0, 1}</key>
                <dict><key>Type</key><string>Variable</string><key>VariableName</key><string>${name}</string></dict>
              </dict>
            </dict>
            <key>WFSerializationType</key>
            <string>WFTextTokenString</string>
          </dict>`;
}

/** Attachment reference (for WFInput, WFRequestVariable) */
function att(varName: string): string {
  return `<dict>
            <key>Value</key>
            <dict><key>Type</key><string>Variable</string><key>VariableName</key><string>${varName}</string></dict>
            <key>WFSerializationType</key>
            <string>WFTextTokenAttachment</string>
          </dict>`;
}

/** Extension input (Shortcut Input) attachment */
function extInput(): string {
  return `<dict>
            <key>Value</key>
            <dict><key>Type</key><string>ExtensionInput</string></dict>
            <key>WFSerializationType</key>
            <string>WFTextTokenAttachment</string>
          </dict>`;
}

/** Dictionary field (for JSON body or headers) */
function field(key: string, value: string): string {
  return `<dict>
              <key>WFItemType</key><integer>0</integer>
              <key>WFKey</key>${txt(key)}
              <key>WFValue</key>${value}
            </dict>`;
}

/** Wrap fields into a dictionary value (for headers or JSON body) */
function dictValue(fields: string[]): string {
  return `<dict>
          <key>Value</key>
          <dict>
            <key>WFDictionaryFieldValueItems</key>
            <array>
              ${fields.join('\n              ')}
            </array>
          </dict>
          <key>WFSerializationType</key>
          <string>WFDictionaryFieldValue</string>
        </dict>`;
}

/** Generate a stable UUID for grouping If/Otherwise/EndIf blocks */
function groupId(label: string): string {
  // Deterministic UUID-like string from label
  const hash = label.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(1, 4)}-${hex}${hex.slice(0, 4)}`;
}

// ── Action builders ─────────────────────────────────────────────────────────

function actionSetVar(name: string, input?: string): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.setvariable</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFVariableName</key><string>${name}</string>
        ${input ? `<key>WFInput</key>${input}` : ''}
      </dict>
    </dict>`;
}

function actionGetName(input: string): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.getitemname</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFInput</key>${input}
      </dict>
    </dict>`;
}

function actionGetDictValue(key: string, input: string): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.getvalueforkey</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFDictionaryKey</key><string>${key}</string>
        <key>WFInput</key>${input}
      </dict>
    </dict>`;
}

function actionUrlPostJson(url: string, headers: string[], jsonFields: string[]): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.downloadurl</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFURL</key><string>${esc(url)}</string>
        <key>WFHTTPMethod</key><string>POST</string>
        <key>WFHTTPHeaders</key>${dictValue(headers)}
        <key>WFHTTPBodyType</key><string>Json</string>
        <key>WFJSONValues</key>${dictValue(jsonFields)}
      </dict>
    </dict>`;
}

/**
 * POST file to a literal URL with token/path in headers.
 * No variable URLs needed — all dynamic data goes in headers where v() works.
 */
function actionUploadFileViaProxy(
  url: string,
  tokenVar: string,
  storagePathVar: string,
  fileIdVar: string,
  fileNameVar: string,
  fileVar: string,
): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.downloadurl</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFURL</key><string>${esc(url)}</string>
        <key>WFHTTPMethod</key><string>POST</string>
        <key>WFHTTPHeaders</key>${dictValue([
          field('X-Upload-Token', v(tokenVar)),
          field('X-Storage-Path', v(storagePathVar)),
          field('X-File-Id', v(fileIdVar)),
          field('X-File-Name', v(fileNameVar)),
          field('Content-Type', txt('video/mp4')),
        ])}
        <key>WFHTTPBodyType</key><string>File</string>
        <key>WFRequestVariable</key>${att(fileVar)}
      </dict>
    </dict>`;
}

function actionNotification(title: string, body: string): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.notification</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFNotificationActionTitle</key><string>${esc(title)}</string>
        <key>WFNotificationActionBody</key><string>${esc(body)}</string>
      </dict>
    </dict>`;
}

/** Get URLs from input */
function actionGetUrls(input: string): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.detect.link</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFInput</key>${input}
      </dict>
    </dict>`;
}

/** Count items */
function actionCount(): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.count</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFCountType</key><string>Items</string>
      </dict>
    </dict>`;
}

/** If (condition on number: 4 = greater than) */
function actionIf(gid: string, condition: number, value: string): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.conditional</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFControlFlowMode</key><integer>0</integer>
        <key>WFCondition</key><integer>${condition}</integer>
        <key>WFNumberValue</key><string>${value}</string>
        <key>GroupingIdentifier</key><string>${gid}</string>
      </dict>
    </dict>`;
}

/** Otherwise block */
function actionOtherwise(gid: string): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.conditional</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFControlFlowMode</key><integer>1</integer>
        <key>GroupingIdentifier</key><string>${gid}</string>
      </dict>
    </dict>`;
}

/** End If block */
function actionEndIf(gid: string): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.conditional</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFControlFlowMode</key><integer>2</integer>
        <key>GroupingIdentifier</key><string>${gid}</string>
      </dict>
    </dict>`;
}

/** Get first item from a list */
function actionGetFirstItem(): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.getitemfromlist</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFItemSpecifier</key><string>First Item</string>
      </dict>
    </dict>`;
}

function actionComment(text: string): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.comment</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFCommentActionText</key><string>${esc(text)}</string>
      </dict>
    </dict>`;
}

function buildShortcut(baseUrl: string): string {
  const submitUrl = `${baseUrl}/api/swarm/submit`;
  const uploadUrl = `${baseUrl}/api/swarm/upload`;

  const jsonHeaders = [
    field('Content-Type', txt('application/json')),
  ];

  const gid = groupId('url-or-file');

  const actions = [
    // Store the input
    actionComment('Upload to Flow — works with Safari URLs and video files for YouTube Shorts'),
    actionSetVar('input', extInput()),

    // Detect if the input is a URL (from Safari Share Sheet)
    actionGetUrls(att('input')),
    actionSetVar('detectedUrls'),
    actionCount(),
    actionSetVar('urlCount'),

    // If URLs detected → use URL mode (Safari path)
    // Condition 4 = "is greater than", comparing against "0"
    actionIf(gid, 4, '0'),

    // ── URL PATH (Safari) ──
    actionComment('Safari URL detected — server will download the video'),
    actionGetFirstItem(),
    actionSetVar('videoUrl'),

    // Warm up the server
    actionUrlPostJson(submitUrl, jsonHeaders, [
      field('mode', txt('sign')),
      field('filename', txt('safari_video.mp4')),
    ]),

    // Send URL to server for download + pipeline registration
    actionUrlPostJson(submitUrl, jsonHeaders, [
      field('mode', txt('url')),
      field('url', v('videoUrl')),
    ]),
    actionSetVar('urlResponse'),
    actionNotification('Flow AI', 'Video URL sent to pipeline! Server is downloading it now.'),

    // ── FILE PATH (direct video share) ──
    actionOtherwise(gid),

    actionComment('Video file shared — uploading directly'),
    actionSetVar('videoFile', att('input')),

    // Get the filename
    actionGetName(att('videoFile')),
    actionSetVar('fileName'),

    // Sign — get upload token and path
    actionUrlPostJson(submitUrl, jsonHeaders, [
      field('mode', txt('sign')),
      field('filename', v('fileName')),
    ]),
    actionSetVar('signResponse'),

    // Extract values from sign response
    actionGetDictValue('id', att('signResponse')),
    actionSetVar('fileId'),
    actionGetDictValue('storagePath', att('signResponse')),
    actionSetVar('storagePath'),
    actionGetDictValue('token', att('signResponse')),
    actionSetVar('uploadToken'),

    // Upload file and auto-register in pipeline
    actionUploadFileViaProxy(uploadUrl, 'uploadToken', 'storagePath', 'fileId', 'fileName', 'videoFile'),
    actionNotification('Flow AI', 'Video uploaded to pipeline!'),

    actionEndIf(gid),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>WFWorkflowMinimumClientVersion</key>
  <integer>900</integer>
  <key>WFWorkflowMinimumClientVersionString</key>
  <string>900</string>
  <key>WFWorkflowIcon</key>
  <dict>
    <key>WFWorkflowIconStartColor</key>
    <integer>463140863</integer>
    <key>WFWorkflowIconGlyphNumber</key>
    <integer>59722</integer>
  </dict>
  <key>WFWorkflowTypes</key>
  <array>
    <string>ActionExtension</string>
  </array>
  <key>WFWorkflowInputContentItemClasses</key>
  <array>
    <string>WFURLContentItem</string>
    <string>WFAVAssetContentItem</string>
    <string>WFGenericFileContentItem</string>
    <string>WFImageContentItem</string>
  </array>
  <key>WFWorkflowActions</key>
  <array>
    ${actions.join('\n    ')}
  </array>
</dict>
</plist>`;
}

/** Sign a shortcut plist via RoutineHub's HubSign service */
async function signShortcut(unsignedPlist: string): Promise<ArrayBuffer> {
  const res = await fetch('https://hubsign.routinehub.services/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'flow/1.0',
    },
    body: JSON.stringify({
      shortcutName: 'Upload to Flow',
      shortcut: unsignedPlist,
    }),
  });
  if (!res.ok) {
    throw new Error(`HubSign returned ${res.status}: ${await res.text()}`);
  }
  const buf = await res.arrayBuffer();
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
  if (magic !== 'AEA1') {
    throw new Error('HubSign did not return a valid signed shortcut');
  }
  return buf;
}

export async function GET(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || 'gwdf.pro';
  const baseUrl = `${proto}://${host}`;

  const plist = buildShortcut(baseUrl);
  try {
    const signed = await signShortcut(plist);
    return new NextResponse(signed, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="Upload to Flow.shortcut"',
      },
    });
  } catch (err) {
    console.error('Shortcut signing failed:', err);
    return NextResponse.json(
      { error: 'Failed to sign shortcut. Try again later.', details: String(err) },
      { status: 502 },
    );
  }
}
