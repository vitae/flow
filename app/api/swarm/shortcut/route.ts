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

function actionUrlGet(url: string): string {
  return `<dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.downloadurl</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFURL</key><string>${esc(url)}</string>
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

  const actions = [
    // Store the input file
    actionComment('Upload to Flow — saves video to your AI pipeline for YouTube Shorts'),
    actionSetVar('videoFile', extInput()),

    // Get the filename
    actionGetName(att('videoFile')),
    actionSetVar('fileName'),

    // Warm up the server (avoids cold-start timeout)
    actionComment('Wake up the server'),
    actionUrlGet(submitUrl),

    // Sign — get upload token and path
    actionComment('Get a signed upload URL'),
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

    // Upload file via our server proxy (literal URL — no variable URL needed!)
    // Token and path go in headers, file goes in body
    actionComment('Upload video to storage'),
    actionUploadFileViaProxy(uploadUrl, 'uploadToken', 'storagePath', 'videoFile'),

    // Register in pipeline
    actionComment('Register in the agent pipeline'),
    actionUrlPostJson(submitUrl, jsonHeaders, [
      field('mode', txt('register')),
      field('id', v('fileId')),
      field('storagePath', v('storagePath')),
      field('filename', v('fileName')),
    ]),

    // Done!
    actionNotification('Flow AI', 'Video uploaded to pipeline!'),
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
