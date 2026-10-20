import { readFileSync } from 'node:fs';

const {
  DISCORD_BOT_TOKEN: botToken,
  DISCORD_ANNOUNCEMENTS_CHANNEL_ID: channelId,
  DISCORD_NO_MENTIONS: noMentions,
  DISCORD_RELEASE_ROLE_ID: releaseRoleId,
  DISCORD_BETA_ROLE_ID: betaRoleId,
  RELEASE_TAG: tag,
  NOTES_FILE: notesFile,
  PRERELEASE: prerelease,
  DRY_RUN: dryRun,
} = process.env;

if (!tag || !notesFile) {
  console.error('RELEASE_TAG and NOTES_FILE are required');
  process.exit(1);
}

const RELEASE_URL = `https://github.com/connorgallopo/Tracearr/releases/tag/${tag}`;
const ISSUE_URL = 'https://github.com/connorgallopo/Tracearr/issues/';
const DOCS_URL = 'https://docs.tracearr.com';
const DISCORD_URL = 'https://discord.gg/a7n3sFd2Yw';
const BANNER_URL = 'https://tracearr.com/images/og-image.png';
const IMAGE = 'ghcr.io/connorgallopo/tracearr';
const ACCENT = 0x3498db;
const IS_COMPONENTS_V2 = 1 << 15;
// Component type ids and the link button style, from the Components reference.
const ACTION_ROW = 1;
const BUTTON = 2;
const TEXT = 10;
const MEDIA_GALLERY = 12;
const SEPARATOR = 14;
const CONTAINER = 17;
const LINK_STYLE = 5;
const SPACING_SMALL = 1;
const SPACING_LARGE = 2;
// The Components reference caps a message at 40 components, a button label at 80 characters
// and the text across every text display at 4000 characters.
const MAX_COMPONENTS = 40;
const MAX_BUTTON_LABEL = 80;
const MAX_TEXT = 4000;

/**
 * @typedef {{ type: string; text: string; refs?: string[] }} Change
 * @typedef {{ title: string; body: string; docs?: string }} Highlight
 * @typedef {{ date?: string; headline?: string; upgradeWarning?: string; highlights?: Highlight[]; changes?: Change[] }} Notes
 */
/** @type {Notes} */
const notes = JSON.parse(readFileSync(notesFile, 'utf8'));
const version = tag.replace(/^v/, '');
const isPrerelease = prerelease === 'true';
const isPatch = !isPrerelease && !version.endsWith('.0');

// Notes go first: when a long list is cut, what an operator must know survives.
const SECTION_LABELS = {
  note: 'Before you update',
  new: 'New',
  improved: 'Improved',
  fix: 'Fixes',
  security: 'Security',
};

const text = (content) => ({ type: TEXT, content });
const separator = (spacing, divider = true) => ({ type: SEPARATOR, divider, spacing });
const subtext = (line) => `-# ${line}`;
const highlightBlock = (highlight) =>
  text(
    [
      `### ${highlight.title}`,
      highlight.body,
      highlight.docs && subtext(`[Read the docs](${highlight.docs})`),
    ]
      .filter(Boolean)
      .join('\n')
  );
const refLink = (ref) => `[${ref}](${ISSUE_URL}${ref.replace('#', '')})`;
const changeLine = (change) => {
  let line = `- ${change.text}`;
  if (change.refs?.length) line += ` (${change.refs.map(refLink).join(', ')})`;
  return line;
};
const textLength = (list) =>
  list.reduce(
    (sum, block) => sum + (block.content?.length ?? 0) + textLength(block.components ?? []),
    0
  );

/** The changes grouped under headings, cut at a line when the budget runs out. */
function changeList(changes, budget) {
  const groups = Object.entries(SECTION_LABELS)
    .map(([type, label]) => [label, changes.filter((change) => change.type === type)])
    .filter(([, list]) => list.length > 0);
  const lines = groups.flatMap(([label, list], index) => [
    `${index > 0 ? '\n' : ''}### ${label}`,
    ...list.map(changeLine),
  ]);
  const more = (n) => `\n${subtext(`and ${n} more in the [full notes](${RELEASE_URL})`)}`;
  const out = [];
  let shown = 0;
  for (const line of lines) {
    const left = changes.length - shown;
    if (out.join('\n').length + line.length + 1 + more(left).length > budget) {
      // Never leave a heading with nothing under it.
      while (out.length > 0 && !out.at(-1).startsWith('- ')) out.pop();
      return out.join('\n') + more(left);
    }
    out.push(line);
    if (line.startsWith('- ')) shown++;
  }
  return out.join('\n');
}

// Discord renders <t:unix:D> as a long date in the reader's locale.
function dateStamp(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  if (!match) return null;
  const unix = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) / 1000;
  return `<t:${unix}:D>`;
}

// Stable releases page everyone plus the release alerts role; betas page the beta role only.
// DISCORD_NO_MENTIONS posts the card silently, for a test run.
const roleId = isPrerelease ? betaRoleId : releaseRoleId;
const mentionLine = noMentions
  ? ''
  : [!isPrerelease && '@everyone', roleId && `<@&${roleId}>`].filter(Boolean).join(' ');
const allowedMentions = noMentions
  ? { parse: [] }
  : {
      ...(isPrerelease ? {} : { parse: ['everyone'] }),
      ...(roleId ? { roles: [roleId] } : {}),
    };

const blocks = [];
blocks.push({ type: MEDIA_GALLERY, items: [{ media: { url: BANNER_URL } }] });

// A beta carries the whole file for its base version, so its card reads as the release so far.
const kind = isPrerelease
  ? `Beta of ${version.replace(/-.*$/, '')}`
  : isPatch
    ? 'Patch release'
    : 'Release';
const header = [
  `## Tracearr v${version}`,
  subtext([kind, dateStamp(notes.date)].filter(Boolean).join(' · ')),
  notes.headline && `**${notes.headline}**`,
].filter(Boolean);
blocks.push(text(header.join('\n')));
if (notes.upgradeWarning) blocks.push(text(`> **Before you update:** ${notes.upgradeWarning}`));
blocks.push(separator(SPACING_LARGE));

for (const [index, highlight] of (notes.highlights ?? []).entries()) {
  if (index > 0) blocks.push(separator(SPACING_SMALL, false));
  blocks.push(highlightBlock(highlight));
}
if (notes.highlights?.length) blocks.push(separator(SPACING_LARGE));

const footer = text(subtext(`\`docker pull ${IMAGE}:${version}\``));
const used = textLength(blocks) + footer.content.length + (mentionLine?.length ?? 0);
const list = changeList(notes.changes ?? [], MAX_TEXT - used);
if (list) blocks.push(text(list));
blocks.push(separator(SPACING_SMALL));
blocks.push(footer);

blocks.push({
  type: ACTION_ROW,
  components: [
    { type: BUTTON, style: LINK_STYLE, label: 'Release notes', url: RELEASE_URL },
    { type: BUTTON, style: LINK_STYLE, label: 'Docs', url: DOCS_URL },
    { type: BUTTON, style: LINK_STYLE, label: 'Discord', url: DISCORD_URL },
  ],
});

const components = [
  ...(mentionLine ? [text(mentionLine)] : []),
  { type: CONTAINER, accent_color: ACCENT, components: blocks },
];

const flatten = (list) => list.flatMap((block) => [block, ...flatten(block.components ?? [])]);
const all = flatten(components);
if (all.length > MAX_COMPONENTS) {
  console.error(
    `Card has ${all.length} components, over Discord's ${MAX_COMPONENTS}; trim the notes`
  );
  process.exit(1);
}
if (textLength(components) > MAX_TEXT) {
  console.error(`Card text is ${textLength(components)} characters, over Discord's ${MAX_TEXT}`);
  process.exit(1);
}
const longLabel = all.find(
  (block) => block.type === BUTTON && block.label.length > MAX_BUTTON_LABEL
);
if (longLabel) {
  console.error(`Button label "${longLabel.label}" is over ${MAX_BUTTON_LABEL} characters`);
  process.exit(1);
}

const payload = {
  flags: IS_COMPONENTS_V2,
  components,
  allowed_mentions: allowedMentions,
};

if (dryRun) {
  console.log(`[dry-run] ${tag} (${all.length} components)\n${JSON.stringify(payload, null, 2)}`);
  process.exit(0);
}

if (!botToken || !channelId) {
  console.log('Discord bot token or channel not configured - skipping announcement post');
  process.exit(0);
}

const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
  method: 'POST',
  headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!response.ok) {
  console.error(`Discord post failed (${response.status}):`, await response.text());
  process.exit(1);
}
const message = await response.json();
console.log(`Posted to Discord: message ${message.id ?? '(no id returned)'}`);
