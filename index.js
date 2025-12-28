require("dotenv").config();
const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

// ===== Crash logs =====
process.on("unhandledRejection", (err) => console.error("UNHANDLED REJECTION:", err));
process.on("uncaughtException", (err) => console.error("UNCAUGHT EXCEPTION:", err));

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const CASEFILE_CHANNEL_ID = process.env.CASEFILE_CHANNEL_ID;
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID;
const CASES_CHANNEL_ID = process.env.CASES_CHANNEL_ID;
const APPLICATIONS_CHANNEL_ID = process.env.APPLICATIONS_CHANNEL_ID;
const EVENTLOG_CHANNEL_ID = process.env.EVENTLOG_CHANNEL_ID;

const RANKLOG_CHANNEL_ID = process.env.RANKLOG_CHANNEL_ID;
const BLACKLIST_LOG_CHANNEL_ID = process.env.BLACKLIST_LOG_CHANNEL_ID;

const ACADEMY_LOG_CHANNEL_ID = process.env.ACADEMY_LOG_CHANNEL_ID;
const APPEALS_CHANNEL_ID = process.env.APPEALS_CHANNEL_ID;

const ROWIFI_TOKEN = process.env.ROWIFI_TOKEN;

const BLACKLIST_SHEET_ID = process.env.BLACKLIST_SHEET_ID;
const BLACKLIST_SHEET_GID = process.env.BLACKLIST_SHEET_GID;

const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID;
const ROBLOX_OPEN_CLOUD_KEY = process.env.ROBLOX_OPEN_CLOUD_KEY;

// ===== Role Rules =====

// Case permissions (ONLY these 3)
const CASE_ROLE_IDS = new Set([
  "1453937133701173422",
  "1453929754674597971",
  "1453929411081404416",
]);

// Blacklist add/revoke ONLY this one
const BLACKLIST_MANAGER_ROLE_ID = "1453929411081404416";

// Applications reviewers (kept from before)
const APPLICATION_REVIEW_ROLE_IDS = new Set([
  "1453929803273994291",
  "1453929455398682645",
]);

// Rank manager ONLY this one
const RANK_MANAGER_ROLE_ID = "1453929411081404416";

// Eventlog blocked role
const EVENTLOG_BLOCKED_ROLE_ID = "1453931984463073341";

// Academy eventlog restricted role
const ACADEMY_EVENTLOG_ROLE_ID = "1454291032119181324";

// Assign dept restricted role
const ASSIGNDEPT_ROLE_ID = "1453929455398682645";

function hasRole(member, roleId) {
  return !!member?.roles?.cache?.has(roleId);
}
function hasAnyRole(member, roleSet) {
  return member?.roles?.cache?.some((r) => roleSet.has(r.id));
}
function isCaseStaff(member) {
  return hasAnyRole(member, CASE_ROLE_IDS);
}
function isBlacklistManager(member) {
  return hasRole(member, BLACKLIST_MANAGER_ROLE_ID);
}
function isApplicationReviewer(member) {
  return hasAnyRole(member, APPLICATION_REVIEW_ROLE_IDS);
}
function isRankManager(member) {
  return hasRole(member, RANK_MANAGER_ROLE_ID);
}
function isEventlogBlocked(member) {
  return hasRole(member, EVENTLOG_BLOCKED_ROLE_ID);
}
function isAcademyLogger(member) {
  return hasRole(member, ACADEMY_EVENTLOG_ROLE_ID);
}
function isAssignDept(member) {
  return hasRole(member, ASSIGNDEPT_ROLE_ID);
}

async function getTextChannel(guild, id) {
  if (!id) return null;
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (!ch || !ch.isTextBased()) return null;
  return ch;
}

function chunkText(text, max = 1900) {
  const chunks = [];
  for (let i = 0; i < text.length; i += max) chunks.push(text.slice(i, i + max));
  return chunks;
}

function norm(str) {
  return String(str || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function normKey(str) {
  return String(str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ===== Safe interaction helpers (fix double reply) =====
async function safeAck(interaction) {
  if (!interaction.isRepliable()) return;
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferReply({ ephemeral: true });
}
async function safeReply(interaction, content) {
  if (!interaction.isRepliable()) return;
  if (interaction.deferred) return interaction.editReply({ content });
  if (interaction.replied) return interaction.followUp({ content, ephemeral: true });
  return interaction.reply({ content, ephemeral: true });
}

// ===== JSON storage helpers =====
function loadJsonMap(filePath) {
  const map = new Map();
  try {
    if (!fs.existsSync(filePath)) return map;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return map;
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) map.set(k, v);
  } catch (e) {
    console.error("Failed load:", filePath, e);
  }
  return map;
}
function saveJsonMap(filePath, map) {
  try {
    const obj = Object.fromEntries(map.entries());
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    console.error("Failed save:", filePath, e);
  }
}

// ===== Stores =====
const CASES_FILE = path.join(__dirname, "cases.json");
const cases = loadJsonMap(CASES_FILE);
const saveCases = () => saveJsonMap(CASES_FILE, cases);

const CASEFILES_FILE = path.join(__dirname, "casefiles.json");
const casefiles = loadJsonMap(CASEFILES_FILE);
const saveCasefiles = () => saveJsonMap(CASEFILES_FILE, casefiles);

const BLACKLIST_FILE = path.join(__dirname, "blacklist.json");
const blacklist = loadJsonMap(BLACKLIST_FILE);
const saveBlacklist = () => saveJsonMap(BLACKLIST_FILE, blacklist);

const APPLICATIONS_FILE = path.join(__dirname, "applications.json");
const applications = loadJsonMap(APPLICATIONS_FILE);
const saveApplications = () => saveJsonMap(APPLICATIONS_FILE, applications);

const EVENTLOG_FILE = path.join(__dirname, "eventlogs.json");
const eventLogs = loadJsonMap(EVENTLOG_FILE);
const saveEventLogs = () => saveJsonMap(EVENTLOG_FILE, eventLogs);

const XP_FILE = path.join(__dirname, "xp.json");
const xpStore = loadJsonMap(XP_FILE);
const saveXP = () => saveJsonMap(XP_FILE, xpStore);

const ACADEMY_FILE = path.join(__dirname, "academy.json");
const academy = loadJsonMap(ACADEMY_FILE);
const saveAcademy = () => saveJsonMap(ACADEMY_FILE, academy);

const APPEALS_FILE = path.join(__dirname, "appeals.json");
const appeals = loadJsonMap(APPEALS_FILE);
const saveAppeals = () => saveJsonMap(APPEALS_FILE, appeals);

// ===== IDs =====
function genId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
function generateCaseId() {
  let id = genId("CASE");
  while (cases.has(id)) id = genId("CASE");
  return id;
}
function generateApplicationId() {
  let id = genId("APP");
  while (applications.has(id)) id = genId("APP");
  return id;
}
function generateAppealId() {
  let id = genId("APL");
  while (appeals.has(id)) id = genId("APL");
  return id;
}

// ===== XP =====
function getXP(userId) {
  return Number(xpStore.get(String(userId)) ?? 0) || 0;
}
function addXP(userId, amount) {
  const id = String(userId);
  const cur = getXP(id);
  xpStore.set(id, cur + (Number(amount) || 0));
  saveXP();
}

// ===== Time parsing for /eventlog =====
function parseTimeToMinutes(inputRaw) {
  const input = String(inputRaw).trim().toLowerCase();

  const m24 = input.match(/^(\d{1,2})\s*:\s*(\d{2})$/);
  if (m24) {
    const h = Number(m24[1]);
    const min = Number(m24[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  const m12 = input.match(/^(\d{1,2})(?:\s*:\s*(\d{2}))?\s*(am|pm)$/);
  if (m12) {
    let h = Number(m12[1]);
    const min = m12[2] ? Number(m12[2]) : 0;
    const ap = m12[3];
    if (h < 1 || h > 12 || min < 0 || min > 59) return null;
    if (ap === "am") {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h += 12;
    }
    return h * 60 + min;
  }

  const mShort = input.match(/^(\d{1,2})\s*(am|pm)$/);
  if (mShort) {
    let h = Number(mShort[1]);
    const ap = mShort[2];
    if (h < 1 || h > 12) return null;
    if (ap === "am") {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h += 12;
    }
    return h * 60;
  }

  return null;
}
function formatDuration(totalMinutes) {
  const mins = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ===== RoWifi =====
async function getRoWifiRobloxId(discordUserId) {
  if (!ROWIFI_TOKEN || !GUILD_ID) return null;
  const url = `https://api.rowifi.xyz/v3/guilds/${GUILD_ID}/members/${discordUserId}`;
  const res = await fetch(url, { headers: { Authorization: `Bot ${ROWIFI_TOKEN}` } }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.roblox_id ? String(data.roblox_id) : null;
}
async function getRobloxUsername(robloxId) {
  const res = await fetch(`https://users.roblox.com/v1/users/${robloxId}`).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.name ?? null;
}

// ===== CSV parsing for Google sheet blacklist =====
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

async function checkSheetBlacklist(discordUserId) {
  if (!BLACKLIST_SHEET_ID || !BLACKLIST_SHEET_GID) {
    return { isBlacklisted: false, robloxUsernameFromSheet: null };
  }

  const url = `https://docs.google.com/spreadsheets/d/${BLACKLIST_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${BLACKLIST_SHEET_GID}`;
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) return { isBlacklisted: false, robloxUsernameFromSheet: null };

  const text = await res.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { isBlacklisted: false, robloxUsernameFromSheet: null };

  // D=discord id (3), E=roblox username (4), I=status (8), J=type (9)
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 10) continue;

    const dDiscordId = row[3];
    const eRobloxUser = row[4] || null;
    const iStatus = (row[8] || "").trim();
    const jType = (row[9] || "").trim();

    if (String(dDiscordId).trim() !== String(discordUserId).trim()) continue;

    const typeMatch =
      jType.toLowerCase() === "prohibited from all" || jType.toLowerCase() === "business staff";

    const statusLower = iStatus.toLowerCase();
    const statusMatch = statusLower !== "appealed" && statusLower !== "expired";

    if (typeMatch && statusMatch) return { isBlacklisted: true, robloxUsernameFromSheet: eRobloxUser };
    return { isBlacklisted: false, robloxUsernameFromSheet: eRobloxUser };
  }

  return { isBlacklisted: false, robloxUsernameFromSheet: null };
}

function isBotBlacklisted(discordUserId) {
  const entry = blacklist.get(String(discordUserId));
  if (!entry) return false;
  return entry.revoked ? false : true;
}

// ===== Academy logic =====
const REQUIRED_EVENTS = {
  security: ["Guarding training (for secruity dept)", "Guarding formation training (Secruity dept)", "Final eval (both depts)"],
  medical: ["Medical Training (for Medical dept)", "Medical RP training (Medical dept)", "Final eval (both depts)"],
  both: [
    "Guarding training (for secruity dept)",
    "Medical Training (for Medical dept)",
    "Medical RP training (Medical dept)",
    "Guarding formation training (Secruity dept)",
    "Final eval (both depts)",
  ],
};

function getAcademyRecord(discordUserId) {
  const id = String(discordUserId);
  const rec = academy.get(id) || {
    discordUserId: id,
    robloxUsername: "Unknown",
    dept: "Unassigned", // Security / Medical / Both / Unassigned
    logs: [], // {event, proof, at, loggedById}
  };
  return rec;
}

function computeProgress(rec) {
  const deptKey =
    normKey(rec.dept) === "security"
      ? "security"
      : normKey(rec.dept) === "medical"
      ? "medical"
      : normKey(rec.dept) === "both"
      ? "both"
      : null;

  const required = deptKey ? REQUIRED_EVENTS[deptKey] : [];
  const requiredNorm = required.map(normKey);

  const doneSet = new Set();
  for (const l of rec.logs || []) {
    const ev = normKey(l.event);
    for (let i = 0; i < requiredNorm.length; i++) {
      if (ev.includes(requiredNorm[i]) || requiredNorm[i].includes(ev)) {
        doneSet.add(requiredNorm[i]);
      }
    }
  }

  const done = doneSet.size;
  const total = required.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return { total, done, pct, required };
}

// ===== Roblox Open Cloud functions (rank cmds kept) =====
async function rbxFetch(url, options = {}) {
  if (!ROBLOX_OPEN_CLOUD_KEY) throw new Error("Missing ROBLOX_OPEN_CLOUD_KEY");
  const headers = { ...(options.headers || {}), "x-api-key": ROBLOX_OPEN_CLOUD_KEY };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { res, json, text };
}
async function getGroupRolesAll() {
  if (!ROBLOX_GROUP_ID) throw new Error("Missing ROBLOX_GROUP_ID");
  const roles = [];
  let pageToken = null;
  for (let loops = 0; loops < 30; loops++) {
    const url =
      `https://apis.roblox.com/cloud/v2/groups/${ROBLOX_GROUP_ID}/roles?maxPageSize=100` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const { res, json } = await rbxFetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Roles fetch failed: ${res.status} ${JSON.stringify(json)}`);
    const batch = json?.groupRoles || [];
    for (const r of batch) roles.push(r);
    pageToken = json?.nextPageToken || null;
    if (!pageToken) break;
  }
  return roles;
}
async function findMembershipIdByUserId(targetRobloxUserId) {
  if (!ROBLOX_GROUP_ID) throw new Error("Missing ROBLOX_GROUP_ID");
  let pageToken = null;

  for (let loops = 0; loops < 80; loops++) {
    const url =
      `https://apis.roblox.com/cloud/v2/groups/${ROBLOX_GROUP_ID}/memberships?maxPageSize=100` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const { res, json } = await rbxFetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Memberships fetch failed: ${res.status} ${JSON.stringify(json)}`);

    const memberships = json?.groupMemberships || [];
    for (const m of memberships) {
      const parts = String(m.user || "").split("/");
      const userId = parts[parts.length - 1];
      if (String(userId) === String(targetRobloxUserId)) {
        const pathParts = String(m.path || "").split("/");
        const membershipId = pathParts[3];
        return membershipId || null;
      }
    }

    pageToken = json?.nextPageToken || null;
    if (!pageToken) break;
  }
  return null;
}
async function getMembership(membershipId) {
  const url = `https://apis.roblox.com/cloud/v2/groups/${ROBLOX_GROUP_ID}/memberships/${membershipId}`;
  const { res, json } = await rbxFetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Membership get failed: ${res.status} ${JSON.stringify(json)}`);
  return json;
}
async function setMembershipRole(membershipId, roleId) {
  const url = `https://apis.roblox.com/cloud/v2/groups/${ROBLOX_GROUP_ID}/memberships/${membershipId}`;
  const { res, json } = await rbxFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: `groups/${ROBLOX_GROUP_ID}/roles/${roleId}` }),
  });
  if (!res.ok) throw new Error(`Role update failed: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// ===== Rank log embed =====
async function logRankAction(guild, payload) {
  const ch = await getTextChannel(guild, RANKLOG_CHANNEL_ID);
  if (!ch) return;

  const embed = {
    title: "🪪 Roblox Rank Action",
    color: payload.success ? 0x2ecc71 : 0xe74c3c,
    fields: [
      { name: "Action", value: payload.action, inline: true },
      { name: "Moderator", value: payload.moderator, inline: true },
      { name: "Target (Discord)", value: payload.targetDiscord, inline: false },
      { name: "Roblox", value: payload.robloxLine, inline: false },
      { name: "Result", value: payload.result, inline: false },
    ],
    timestamp: new Date().toISOString(),
  };

  await ch.send({ embeds: [embed] });
}

// ===== Blacklist log =====
async function logBlacklist(guild, title, fields, color = 0xff0000) {
  const ch = await getTextChannel(guild, BLACKLIST_LOG_CHANNEL_ID);
  if (!ch) return;
  await ch.send({
    embeds: [
      {
        title,
        color,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

// ===== Application DM Q&A =====
async function askQuestion(dmChannel, userId, question) {
  await dmChannel.send(question);
  const collected = await dmChannel.awaitMessages({
    filter: (m) => m.author.id === userId && !m.author.bot,
    max: 1,
    time: 10 * 60 * 1000,
    errors: ["time"],
  });
  return collected.first().content.trim();
}

// ===== Appeal cooldown =====
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
function getUserAppealState(userId) {
  const id = String(userId);
  return appeals.get(id) || {
    userId: id,
    pending: null, // {appealId, createdAt, messageId, caseId}
    deniedUntil: 0, // timestamp ms
    history: [], // list of appeals
  };
}
function setUserAppealState(userId, state) {
  appeals.set(String(userId), state);
  saveAppeals();
}

// ===== Find latest active case =====
function findLatestActiveCaseAgainst(discordUserId) {
  const id = String(discordUserId);
  const all = Array.from(cases.values())
    .filter((c) => String(c.caseAgainstId) === id)
    .filter((c) => (c.status || "ACTIVE") !== "APPEALED")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return all[0] || null;
}
function findLatestCasefileFor(discordUserId) {
  const id = String(discordUserId);
  const all = Array.from(casefiles.values())
    .filter((c) => String(c.targetDiscordId) === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return all[0] || null;
}

// ===== Client =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel, Partials.GuildMember],
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // =========================
    // Buttons
    // =========================
    if (interaction.isButton()) {
      // ---------- APPEAL BUTTONS ----------
      if (interaction.customId.startsWith("appeal:")) {
        if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ Staff only.");

        const parts = interaction.customId.split(":");
        // appeal:accept:APL-XXXXXX
        const action = parts[1];
        const appealId = parts[2];

        if (!action || !appealId) return safeReply(interaction, "❌ Invalid appeal button data.");

        // find which user has this pending appeal
        const userStateEntries = Array.from(appeals.entries());
        let foundUserId = null;
        let foundState = null;
        let foundPending = null;

        for (const [uid, st] of userStateEntries) {
          if (st?.pending?.appealId === appealId) {
            foundUserId = uid;
            foundState = st;
            foundPending = st.pending;
            break;
          }
        }

        if (!foundUserId || !foundState || !foundPending) {
          return safeReply(interaction, "❌ Appeal not found in database.");
        }

        const applicant = await client.users.fetch(foundUserId).catch(() => null);

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`appeal:accept:${appealId}`).setLabel("Accept").setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId(`appeal:deny:${appealId}`).setLabel("Deny").setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId(`appeal:redirect:${appealId}`).setLabel("Redirect").setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        if (action === "redirect") {
          foundState.history.push({
            appealId,
            status: "REDIRECTED",
            handledById: interaction.user.id,
            handledAt: new Date().toISOString(),
            notes: "Redirected to MoL server",
          });
          foundState.pending = null;
          setUserAppealState(foundUserId, foundState);

          if (applicant) {
            try {
              await applicant.send("Sorry but your punishment isnt by us join https://discord.gg/ymD8VM2VcA and appeal there");
            } catch {}
          }

          await interaction.message.edit({ components: [disabledRow] }).catch(() => {});
          return safeReply(interaction, "✅ Redirected.");
        }

        if (action === "accept") {
          // mark case as APPEALED
          if (foundPending.caseId && cases.has(foundPending.caseId)) {
            const c = cases.get(foundPending.caseId);
            c.status = "APPEALED";
            c.appealedAt = new Date().toISOString();
            c.appealedById = interaction.user.id;
            cases.set(foundPending.caseId, c);
            saveCases();
          }

          foundState.history.push({
            appealId,
            status: "ACCEPTED",
            handledById: interaction.user.id,
            handledAt: new Date().toISOString(),
            notes: "Accepted",
          });
          foundState.pending = null;
          setUserAppealState(foundUserId, foundState);

          if (applicant) {
            try {
              await applicant.send(`Your appeal was accepted by: ${interaction.user}\n-kind regards discipline dept`);
            } catch {}
          }

          await interaction.message.edit({ components: [disabledRow] }).catch(() => {});
          return safeReply(interaction, "✅ Accepted.");
        }

        if (action === "deny") {
          const modal = new ModalBuilder().setCustomId(`appeal_deny_modal:${appealId}`).setTitle("Deny Appeal");

          const reasonInput = new TextInputBuilder()
            .setCustomId("deny_reason")
            .setLabel("Reason for denial")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          return interaction.showModal(modal);
        }

        return safeReply(interaction, "❌ Unknown appeal action.");
      }

      // ---------- EVENTLOG BUTTONS ----------
      if (interaction.customId.startsWith("eventlog_") || interaction.customId.startsWith("eventlog")) {
        if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ Staff only.");

        const msgId = interaction.message?.id;
        const record = eventLogs.get(String(msgId));
        if (!record) return safeReply(interaction, "❌ This event log is not in the database.");

        if (record.status === "ACCEPTED" || record.status === "DENIED") {
          return safeReply(interaction, "❌ This log is already finalized.");
        }

        if (interaction.customId === "eventlog_adjust") {
          const modal = new ModalBuilder().setCustomId(`eventlog_adjust_modal:${msgId}`).setTitle("Adjust Event Log Times");

          const startInput = new TextInputBuilder()
            .setCustomId("start")
            .setLabel("New Start (ex: 3:15pm or 15:15)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(record.startStr);

          const endInput = new TextInputBuilder()
            .setCustomId("end")
            .setLabel("New End (ex: 4:00pm or 16:00)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(record.endStr);

          modal.addComponents(new ActionRowBuilder().addComponents(startInput), new ActionRowBuilder().addComponents(endInput));
          return interaction.showModal(modal);
        }

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("eventlog_adjust").setLabel("Adjust").setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId("eventlog_deny").setLabel("Deny").setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId("eventlog_accept").setLabel("Accept").setStyle(ButtonStyle.Success).setDisabled(true)
        );

        if (interaction.customId === "eventlog_deny") {
          record.status = "DENIED";
          record.reviewedById = interaction.user.id;
          record.reviewedAt = new Date().toISOString();
          eventLogs.set(String(msgId), record);
          saveEventLogs();

          const updated = structuredClone(interaction.message.embeds[0]?.data ?? {});
          updated.fields = updated.fields || [];
          const idx = updated.fields.findIndex((f) => f.name === "Status");
          const statusValue = `❌ Denied\nReviewed by: ${interaction.user}`;
          if (idx >= 0) updated.fields[idx].value = statusValue;
          else updated.fields.push({ name: "Status", value: statusValue, inline: false });

          await interaction.message.edit({ embeds: [updated], components: [disabledRow] });
          return safeReply(interaction, "❌ Event log denied.");
        }

        if (interaction.customId === "eventlog_accept") {
          const startMin = parseTimeToMinutes(record.startStr);
          const endMinRaw = parseTimeToMinutes(record.endStr);
          if (startMin === null || endMinRaw === null) {
            return safeReply(interaction, "❌ Stored times are invalid — use Adjust first.");
          }

          let endMin = endMinRaw;
          if (endMin < startMin) endMin += 24 * 60;
          const totalMinutes = endMin - startMin;
          const xpEarned = Math.floor(totalMinutes / 15);

          record.status = "ACCEPTED";
          record.reviewedById = interaction.user.id;
          record.reviewedAt = new Date().toISOString();

          if (!record.xpCredited) {
            addXP(record.submitterId, xpEarned);
            record.xpCredited = true;
            record.xpAmount = xpEarned;
          }

          eventLogs.set(String(msgId), record);
          saveEventLogs();

          const updated = structuredClone(interaction.message.embeds[0]?.data ?? {});
          updated.fields = updated.fields || [];
          const idx = updated.fields.findIndex((f) => f.name === "Status");
          const statusValue = `✅ Accepted\nReviewed by: ${interaction.user}\nXP credited: ${record.xpAmount ?? xpEarned}`;
          if (idx >= 0) updated.fields[idx].value = statusValue;
          else updated.fields.push({ name: "Status", value: statusValue, inline: false });

          await interaction.message.edit({ embeds: [updated], components: [disabledRow] });
          return safeReply(interaction, `✅ Accepted. XP credited: ${record.xpAmount ?? xpEarned}`);
        }
      }
    }

    // =========================
    // Modals
    // =========================
    if (interaction.isModalSubmit()) {
      // eventlog adjust modal
      if (interaction.customId.startsWith("eventlog_adjust_modal:")) {
        if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ Staff only.");

        const msgId = interaction.customId.split(":")[1];
        const record = eventLogs.get(String(msgId));
        if (!record) return safeReply(interaction, "❌ This event log is not in the database.");

        if (record.status === "ACCEPTED" || record.status === "DENIED") {
          return safeReply(interaction, "❌ This log is already finalized.");
        }

        const newStart = interaction.fields.getTextInputValue("start").trim();
        const newEnd = interaction.fields.getTextInputValue("end").trim();

        const startMin = parseTimeToMinutes(newStart);
        const endMinRaw = parseTimeToMinutes(newEnd);
        if (startMin === null || endMinRaw === null) {
          return safeReply(interaction, "❌ Invalid time format. Use `3:15pm` or `15:15`.");
        }

        let endMin = endMinRaw;
        if (endMin < startMin) endMin += 24 * 60;
        const totalMinutes = endMin - startMin;
        const xp = Math.floor(totalMinutes / 15);

        record.startStr = newStart;
        record.endStr = newEnd;
        eventLogs.set(String(msgId), record);
        saveEventLogs();

        const targetMessage = interaction.message;
        const updated = structuredClone(targetMessage.embeds[0]?.data ?? {});
        updated.fields = updated.fields || [];

        const replaceField = (name, value) => {
          const i = updated.fields.findIndex((f) => f.name === name);
          if (i >= 0) updated.fields[i].value = value;
        };

        replaceField("Start:", newStart);
        replaceField("End:", newEnd);
        replaceField("Total active time:", formatDuration(totalMinutes));
        replaceField("XP amount: 1xp every 15 mins", String(xp));

        const idx = updated.fields.findIndex((f) => f.name === "Status");
        const statusValue = `⏳ Pending Review (Adjusted)\nAdjusted by: ${interaction.user}`;
        if (idx >= 0) updated.fields[idx].value = statusValue;
        else updated.fields.push({ name: "Status", value: statusValue, inline: false });

        await targetMessage.edit({ embeds: [updated] });
        return safeReply(interaction, `✅ Updated. Total: ${formatDuration(totalMinutes)} | XP: ${xp}`);
      }

      // appeal deny modal
      if (interaction.customId.startsWith("appeal_deny_modal:")) {
        if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ Staff only.");

        const appealId = interaction.customId.split(":")[1];
        const denyReason = interaction.fields.getTextInputValue("deny_reason").trim();

        // find state with this pending appealId
        const userStateEntries = Array.from(appeals.entries());
        let foundUserId = null;
        let foundState = null;
        let foundPending = null;

        for (const [uid, st] of userStateEntries) {
          if (st?.pending?.appealId === appealId) {
            foundUserId = uid;
            foundState = st;
            foundPending = st.pending;
            break;
          }
        }
        if (!foundUserId || !foundState || !foundPending) {
          return safeReply(interaction, "❌ Appeal not found in database.");
        }

        const applicant = await client.users.fetch(foundUserId).catch(() => null);

        // deny => cooldown 7 days
        foundState.deniedUntil = Date.now() + SEVEN_DAYS_MS;

        foundState.history.push({
          appealId,
          status: "DENIED",
          handledById: interaction.user.id,
          handledAt: new Date().toISOString(),
          notes: denyReason,
        });
        foundState.pending = null;
        setUserAppealState(foundUserId, foundState);

        if (applicant) {
          try {
            await applicant.send(
              `Your appeal was denied for: ${denyReason} by: ${interaction.user}\nYou may try again in 7 days`
            );
          } catch {}
        }

        // disable buttons (MATCH THE SAME customIds YOU CREATED)
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`appeal:accept:${appealId}`).setLabel("Accept").setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId(`appeal:deny:${appealId}`).setLabel("Deny").setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId(`appeal:redirect:${appealId}`).setLabel("Redirect").setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await interaction.message.edit({ components: [row] }).catch(() => {});
        return safeReply(interaction, "✅ Denied + cooldown applied.");
      }
    }

    // =========================
    // Commands
    // =========================
    if (!interaction.isChatInputCommand()) return;

    // ---------- CASEFILE ----------
    if (interaction.commandName === "casefile") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const targetUser = interaction.options.getUser("user", true);
      const casefileDoc = interaction.options.getString("casefile_doc", true);
      const punishment = interaction.options.getString("punishment_given", true);
      const signedOffBy = interaction.options.getString("signed_off_by", true);

      const robloxId = await getRoWifiRobloxId(targetUser.id);
      const robloxUser = robloxId ? await getRobloxUsername(robloxId) : null;

      const channel = await getTextChannel(interaction.guild, CASEFILE_CHANNEL_ID);
      if (!channel) return safeReply(interaction, "❌ Casefile channel not found.");

      const casefileId = genId("CF");
      const entry = {
        casefileId,
        createdAt: new Date().toISOString(),
        submittedById: interaction.user.id,
        targetDiscordId: targetUser.id,
        targetDiscordTag: targetUser.username,
        robloxId: robloxId || null,
        robloxUser: robloxUser || null,
        punishmentGiven: punishment,
        casefileDoc,
        signedOffBy,
      };
      casefiles.set(casefileId, entry);
      saveCasefiles();

      const embed = {
        title: "📁 Casefile Submitted",
        color: 0xff0000,
        fields: [
          { name: "User who submitted", value: `${interaction.user}`, inline: false },
          { name: "Sign Off Officer", value: signedOffBy, inline: false },
          { name: "Casefiled user", value: `${targetUser}`, inline: false },
          { name: "Roblox user", value: robloxUser ?? "Unknown (not verified)", inline: true },
          { name: "Roblox ID", value: robloxId ?? "Unknown", inline: true },
          { name: "Punishment given", value: punishment, inline: false },
          { name: "Casefile doc", value: casefileDoc, inline: false },
          { name: "Casefile ID", value: casefileId, inline: false },
        ],
        timestamp: entry.createdAt,
      };

      await channel.send({ embeds: [embed] });
      return safeReply(interaction, "✅ Casefile submitted.");
    }

    // ---------- REPORT ----------
    if (interaction.commandName === "report") {
      await safeAck(interaction);

      const targetUser = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);
      const proof = interaction.options.getString("proof", true);

      const channel = await getTextChannel(interaction.guild, REPORT_CHANNEL_ID);
      if (!channel) return safeReply(interaction, "❌ Report channel not found.");

      const reportId = `R-${Date.now().toString(36).toUpperCase()}`;

      const embed = {
        title: `🚨 New Report (${reportId})`,
        color: 0xffa500,
        fields: [
          { name: "Reporter", value: `${interaction.user}`, inline: false },
          { name: "Reported", value: `${targetUser}`, inline: false },
          { name: "Reason", value: reason, inline: false },
          { name: "Proof", value: proof, inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

      await channel.send({ embeds: [embed] });
      return safeReply(interaction, `✅ Report submitted. (ID: ${reportId})`);
    }

    // ---------- CREATECASE ----------
    if (interaction.commandName === "createcase") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const reportId = interaction.options.getString("report_id", true);
      const caseAgainst = interaction.options.getUser("case_against", true);
      const reasons = interaction.options.getString("reasons", true);

      const channel = await getTextChannel(interaction.guild, CASES_CHANNEL_ID);
      if (!channel) return safeReply(interaction, "❌ Cases channel not found.");

      const caseId = generateCaseId();

      const caseObj = {
        caseId,
        reportId,
        caseAgainstId: caseAgainst.id,
        reasons,
        evidence: [],
        status: "ACTIVE",
        createdById: interaction.user.id,
        createdAt: new Date().toISOString(),
        appealedAt: null,
        appealedById: null,
      };

      cases.set(caseId, caseObj);
      saveCases();

      const embed = {
        title: `⚖️ Staff Case Created (${caseId})`,
        color: 0x7b2cff,
        fields: [
          { name: "Created by", value: `${interaction.user}`, inline: false },
          { name: "Report ID", value: reportId, inline: false },
          { name: "Case against", value: `${caseAgainst}`, inline: false },
          { name: "Reasons", value: reasons, inline: false },
          { name: "Status", value: caseObj.status, inline: false },
        ],
        timestamp: caseObj.createdAt,
      };

      await channel.send({ embeds: [embed] });
      return safeReply(interaction, `✅ Case created. CaseID: ${caseId}`);
    }

    // ---------- VIEWCASE ----------
    if (interaction.commandName === "viewcase") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const caseIdInput = interaction.options.getString("case_id", true).trim().toUpperCase();
      const found = cases.get(caseIdInput);
      if (!found) return safeReply(interaction, `❌ Case not found: ${caseIdInput}`);

      const evidenceLines =
        Array.isArray(found.evidence) && found.evidence.length
          ? found.evidence.slice(-10).map((e, i) => `${i + 1}. ${e.link} (by <@${e.addedById}>)`).join("\n")
          : "None";

      const embed = {
        title: `📄 Case Details (${found.caseId})`,
        color: 0x00b3ff,
        fields: [
          { name: "Created by", value: `<@${found.createdById}>`, inline: false },
          { name: "Report ID", value: found.reportId, inline: false },
          { name: "Case against", value: `<@${found.caseAgainstId}>`, inline: false },
          { name: "Reasons", value: found.reasons, inline: false },
          { name: "Evidence (latest)", value: evidenceLines, inline: false },
          { name: "Status", value: found.status || "ACTIVE", inline: false },
          { name: "Created at", value: found.createdAt, inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

      return interaction.editReply({ embeds: [embed] });
    }

    // ---------- ADDEVIDENCE ----------
    if (interaction.commandName === "addevidence") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const caseIdInput = interaction.options.getString("case_id", true).trim().toUpperCase();
      const evidenceLink = interaction.options.getString("evidence_link", true).trim();

      const found = cases.get(caseIdInput);
      if (!found) return safeReply(interaction, `❌ Case not found: ${caseIdInput}`);

      if (!Array.isArray(found.evidence)) found.evidence = [];
      found.evidence.push({ link: evidenceLink, addedById: interaction.user.id, addedAt: new Date().toISOString() });

      cases.set(caseIdInput, found);
      saveCases();

      const channel = await getTextChannel(interaction.guild, CASES_CHANNEL_ID);
      if (channel) {
        await channel.send({
          embeds: [
            {
              title: `🧾 Evidence Added (${found.caseId})`,
              color: 0x00ff99,
              fields: [
                { name: "Case ID", value: found.caseId, inline: false },
                { name: "Added by", value: `${interaction.user}`, inline: false },
                { name: "Evidence link", value: evidenceLink, inline: false },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }

      return safeReply(interaction, "✅ Evidence added.");
    }

    // ---------- BLACKLIST ADD ----------
    if (interaction.commandName === "blacklistadd") {
      if (!isBlacklistManager(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);
      const caseId = interaction.options.getString("case_id", true).trim().toUpperCase();

      blacklist.set(user.id, {
        userId: user.id,
        userTag: user.username,
        reason,
        caseId,
        addedById: interaction.user.id,
        addedAt: new Date().toISOString(),
        revoked: false,
        revokedAt: null,
        revokedById: null,
        revokeReason: null,
      });
      saveBlacklist();

      await logBlacklist(
        interaction.guild,
        "⛔ Blacklist Added",
        [
          { name: "User", value: `${user} (ID: ${user.id})`, inline: false },
          { name: "Reason", value: reason, inline: false },
          { name: "Case ID", value: caseId, inline: false },
          { name: "Added by", value: `${interaction.user}`, inline: false },
        ],
        0xff0000
      );

      return safeReply(interaction, `✅ Blacklisted ${user} (Case: ${caseId}).`);
    }

    // ---------- BLACKLIST VIEW ----------
    if (interaction.commandName === "blacklistview") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const user = interaction.options.getUser("user", true);
      const entry = blacklist.get(user.id);
      if (!entry) return safeReply(interaction, `❌ No blacklist record for ${user}.`);

      const embed = {
        title: "⛔ Blacklist Record",
        color: entry.revoked ? 0x888888 : 0xff0000,
        fields: [
          { name: "User", value: `${user} (ID: ${user.id})`, inline: false },
          { name: "Status", value: entry.revoked ? "REVOKED" : "ACTIVE", inline: true },
          { name: "Case ID", value: entry.caseId || "N/A", inline: true },
          { name: "Reason", value: entry.reason || "N/A", inline: false },
          { name: "Added by", value: `<@${entry.addedById}>`, inline: true },
          { name: "Added at", value: entry.addedAt || "N/A", inline: true },
          { name: "Revoked by", value: entry.revokedById ? `<@${entry.revokedById}>` : "N/A", inline: true },
          { name: "Revoked at", value: entry.revokedAt || "N/A", inline: true },
          { name: "Revoke reason", value: entry.revokeReason || "N/A", inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

      return interaction.editReply({ embeds: [embed] });
    }

    // ---------- BLACKLIST REVOKE ----------
    if (interaction.commandName === "blacklistrevoke") {
      if (!isBlacklistManager(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const user = interaction.options.getUser("user", true);
      const revokeReason = interaction.options.getString("reason", true);

      const entry = blacklist.get(user.id);
      if (!entry) return safeReply(interaction, `❌ No blacklist record for ${user}.`);

      entry.revoked = true;
      entry.revokedAt = new Date().toISOString();
      entry.revokedById = interaction.user.id;
      entry.revokeReason = revokeReason;

      blacklist.set(user.id, entry);
      saveBlacklist();

      await logBlacklist(
        interaction.guild,
        "✅ Blacklist Revoked",
        [
          { name: "User", value: `${user} (ID: ${user.id})`, inline: false },
          { name: "Revoke reason", value: revokeReason, inline: false },
          { name: "Revoked by", value: `${interaction.user}`, inline: false },
        ],
        0x2ecc71
      );

      return safeReply(interaction, `✅ Blacklist revoked for ${user}.`);
    }

    // ---------- VIEW ALL BLACKLIST ----------
    if (interaction.commandName === "viewallblacklist") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const entries = Array.from(blacklist.values());
      if (!entries.length) return safeReply(interaction, "✅ Blacklist is empty.");

      const lines = entries.map((e) => {
        const status = e.revoked ? "REVOKED" : "ACTIVE";
        return `• ${status} | ${e.userTag || "Unknown"} (ID: ${e.userId}) | Case: ${e.caseId || "N/A"} | Reason: ${
          e.reason || "N/A"
        }`;
      });

      const fullText = `BLACKLIST (${entries.length})\n\n${lines.join("\n")}`;
      const chunks = chunkText(fullText);

      try {
        await interaction.user.send("📩 Here is the full blacklist:");
        for (const c of chunks) await interaction.user.send(c);
      } catch {
        return safeReply(interaction, "❌ I couldn’t DM you. Enable DMs and try again.");
      }

      return safeReply(interaction, "✅ Sent blacklist to your DMs.");
    }

    // ---------- APPLY ----------
    if (interaction.commandName === "apply") {
      await safeAck(interaction);

      const botBL = isBotBlacklisted(interaction.user.id);
      const sheetBL = await checkSheetBlacklist(interaction.user.id);
      if (botBL || sheetBL.isBlacklisted) {
        try {
          const dm = await interaction.user.createDM();
          await dm.send("You cant apply as you are blacklisted from Aegis Secruity and Medical services");
        } catch {}
        return safeReply(interaction, "❌ You are blacklisted and cannot apply.");
      }

      let dm;
      try {
        dm = await interaction.user.createDM();
      } catch {
        return safeReply(interaction, "❌ I couldn’t DM you. Enable DMs and try again.");
      }

      const q1 = "**Application Q1:** What do you wish to apply for? (Medical / Security / Both)";
      const q2 = "**Application Q2:** How active are you?";
      const q3 = "**Application Q3:** Why should we choose you over others?";
      const q4 = "**Application Q4:** What are your IRF ranks?";
      const q5 = "**Application Q5:** Any past experience?";

      let a1, a2, a3, a4, a5;
      try {
        await dm.send("📝 **Application Started**\nAnswer the questions below. (10 minutes per question.)");
        a1 = await askQuestion(dm, interaction.user.id, q1);
        a2 = await askQuestion(dm, interaction.user.id, q2);
        a3 = await askQuestion(dm, interaction.user.id, q3);
        a4 = await askQuestion(dm, interaction.user.id, q4);
        a5 = await askQuestion(dm, interaction.user.id, q5);
      } catch {
        try {
          await dm.send("⏳ Application timed out. Run **/apply** again when ready.");
        } catch {}
        return safeReply(interaction, "❌ Application timed out (check your DMs).");
      }

      let robloxUsername = "Unknown";
      const robloxId = await getRoWifiRobloxId(interaction.user.id);
      if (robloxId) {
        const name = await getRobloxUsername(robloxId);
        if (name) robloxUsername = name;
      }

      const transcript = `Q1: What do you wish to apply for?
A1: ${a1}

Q2: How active are you?
A2: ${a2}

Q3: Why should we choose you over others?
A3: ${a3}

Q4: What are your IRF ranks?
A4: ${a4}

Q5: Any past experience?
A5: ${a5}`;

      const appId = generateApplicationId();

      applications.set(appId, {
        appId,
        applicantId: interaction.user.id,
        applicantTag: interaction.user.username,
        robloxUsername,
        blacklisted: false,
        transcript,
        submittedAt: new Date().toISOString(),
      });
      saveApplications();

      const appChannel = await getTextChannel(interaction.guild, APPLICATIONS_CHANNEL_ID);
      if (!appChannel) return safeReply(interaction, "❌ Applications channel not configured.");

      const embed = {
        title: `📨 New Application (${appId})`,
        color: 0x2ecc71,
        fields: [
          { name: "Username:", value: `${interaction.user} (ID: ${interaction.user.id})`, inline: false },
          { name: "Roblox Username:", value: robloxUsername, inline: false },
          { name: "Answers and questions:", value: transcript.length > 1024 ? transcript.slice(0, 1021) + "..." : transcript, inline: false },
          { name: "Blacklisted:", value: "NO", inline: true },
        ],
        timestamp: new Date().toISOString(),
      };

      await appChannel.send({ embeds: [embed] });
      try {
        await dm.send(`✅ Submitted. **Application ID:** ${appId}`);
      } catch {}
      return safeReply(interaction, "✅ Application submitted (check your DMs).");
    }

    // ---------- APPLICATION REVIEW ----------
    if (interaction.commandName === "applicationreview") {
      if (!isApplicationReviewer(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const applicationId = interaction.options.getString("application_id", true).trim().toUpperCase();
      const decision = interaction.options.getString("decision", true);
      const notes = interaction.options.getString("notes", true);

      const app = applications.get(applicationId);
      if (!app) return safeReply(interaction, `❌ Application not found: ${applicationId}`);

      const applicant = await client.users.fetch(app.applicantId).catch(() => null);
      if (applicant) {
        try {
          await applicant.send(`Your application was : **${decision}**\nNotes: ${notes}\nreviewed by: ${interaction.user}`);
        } catch {}
      }

      const appChannel = await getTextChannel(interaction.guild, APPLICATIONS_CHANNEL_ID);
      if (!appChannel) return safeReply(interaction, "❌ Applications channel not found.");

      await appChannel.send({
        embeds: [
          {
            title: `📋 Application Review (${applicationId})`,
            color: decision === "ACCEPT" ? 0x2ecc71 : 0xe74c3c,
            fields: [
              { name: "Applicant", value: `<@${app.applicantId}>`, inline: false },
              { name: "Decision", value: decision, inline: true },
              { name: "Notes", value: notes, inline: false },
              { name: "Reviewed by", value: `${interaction.user}`, inline: false },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return safeReply(interaction, "✅ Review submitted.");
    }

    // ---------- EVENTLOG ----------
    if (interaction.commandName === "eventlog") {
      if (isEventlogBlocked(interaction.member)) return safeReply(interaction, "❌ You can’t use /eventlog.");
      await safeAck(interaction);

      const eventName = interaction.options.getString("event", true);
      const startStr = interaction.options.getString("start", true);
      const endStr = interaction.options.getString("end", true);
      const proof = interaction.options.getString("proof", true);

      const startMin = parseTimeToMinutes(startStr);
      const endMinRaw = parseTimeToMinutes(endStr);
      if (startMin === null || endMinRaw === null) {
        return safeReply(interaction, "❌ Invalid time format. Use `3:15pm` or `15:15`.");
      }

      let endMin = endMinRaw;
      if (endMin < startMin) endMin += 24 * 60;
      const totalMinutes = endMin - startMin;
      const xp = Math.floor(totalMinutes / 15);

      const channel = await getTextChannel(interaction.guild, EVENTLOG_CHANNEL_ID);
      if (!channel) return safeReply(interaction, "❌ Event log channel not found.");

      const embed = {
        title: "📌 Event Log Submission",
        color: 0x3498db,
        fields: [
          { name: "Username:", value: `${interaction.user} (ID: ${interaction.user.id})`, inline: false },
          { name: "Event:", value: eventName, inline: false },
          { name: "Start:", value: startStr, inline: true },
          { name: "End:", value: endStr, inline: true },
          { name: "Total active time:", value: formatDuration(totalMinutes), inline: true },
          { name: "XP amount: 1xp every 15 mins", value: String(xp), inline: true },
          { name: "Proof:", value: proof, inline: false },
          { name: "Status", value: "⏳ Pending Review", inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("eventlog_adjust").setLabel("Adjust").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("eventlog_deny").setLabel("Deny").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("eventlog_accept").setLabel("Accept").setStyle(ButtonStyle.Success)
      );

      const sent = await channel.send({ embeds: [embed], components: [row] });

      eventLogs.set(String(sent.id), {
        messageId: sent.id,
        submitterId: interaction.user.id,
        startStr,
        endStr,
        status: "PENDING",
        reviewedById: null,
        reviewedAt: null,
        xpCredited: false,
        xpAmount: 0,
      });
      saveEventLogs();

      return safeReply(interaction, `✅ Submitted for review. Total: ${formatDuration(totalMinutes)} | XP: ${xp}`);
    }

    // ---------- XP ----------
    if (interaction.commandName === "xp") {
      await safeAck(interaction);

      const target = interaction.options.getUser("user", false);
      if (target && target.id !== interaction.user.id && !isCaseStaff(interaction.member)) {
        return safeReply(interaction, "❌ You can only view your own XP.");
      }
      const who = target ?? interaction.user;
      return safeReply(interaction, `🏅 **XP for ${who}**: **${getXP(who.id)}**`);
    }

    // ---------- ACADEMY: ASSIGNDEPT ----------
    if (interaction.commandName === "assigndept") {
      if (!isAssignDept(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const user = interaction.options.getUser("user", true);
      const dept = interaction.options.getString("dept", true);

      const robloxId = await getRoWifiRobloxId(user.id);
      const robloxUsername = robloxId ? await getRobloxUsername(robloxId) : null;

      const rec = getAcademyRecord(user.id);
      rec.dept = dept;
      if (robloxUsername) rec.robloxUsername = robloxUsername;

      academy.set(String(user.id), rec);
      saveAcademy();

      const academyCh = await getTextChannel(interaction.guild, ACADEMY_LOG_CHANNEL_ID);
      if (academyCh) {
        await academyCh.send({
          embeds: [
            {
              title: "🏫 Academy Dept Assigned",
              color: 0x00d1b2,
              fields: [
                { name: "Trainee", value: `${user} (ID: ${user.id})`, inline: false },
                { name: "Roblox Username", value: rec.robloxUsername || "Unknown", inline: true },
                { name: "Dept", value: dept, inline: true },
                { name: "Assigned by", value: `${interaction.user}`, inline: false },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }

      return safeReply(interaction, `✅ Assigned dept **${dept}** to ${user}.`);
    }

    // ---------- ACADEMY: EVENTLOG ----------
    if (interaction.commandName === "academyeventlog") {
      if (!isAcademyLogger(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const trainee = interaction.options.getUser("trainee", true);
      const event = interaction.options.getString("event", true);
      const proof = interaction.options.getString("proof", true);

      const robloxId = await getRoWifiRobloxId(trainee.id);
      const robloxUsername = robloxId ? await getRobloxUsername(robloxId) : null;

      const rec = getAcademyRecord(trainee.id);
      if (robloxUsername) rec.robloxUsername = robloxUsername;

      rec.logs = Array.isArray(rec.logs) ? rec.logs : [];
      rec.logs.push({
        event,
        proof,
        at: new Date().toISOString(),
        loggedById: interaction.user.id,
      });

      academy.set(String(trainee.id), rec);
      saveAcademy();

      const { total, done, pct } = computeProgress(rec);

      const academyCh = await getTextChannel(interaction.guild, ACADEMY_LOG_CHANNEL_ID);
      if (academyCh) {
        await academyCh.send({
          embeds: [
            {
              title: "🏫 Academy Event Logged",
              color: 0x4aa3ff,
              fields: [
                { name: "Trainee", value: `${trainee} (ID: ${trainee.id})`, inline: false },
                { name: "Roblox Username", value: rec.robloxUsername || "Unknown", inline: true },
                { name: "Dept", value: rec.dept || "Unassigned", inline: true },
                { name: "Event", value: event, inline: false },
                { name: "Proof", value: proof, inline: false },
                { name: "Logged by", value: `${interaction.user}`, inline: false },
                { name: "Progress", value: `Done: ${done}/${total} (${pct}%)`, inline: false },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }

      return safeReply(interaction, `✅ Logged academy event for ${trainee}. Progress: ${done}/${total} (${pct}%).`);
    }

    // ---------- ACADEMY: PROGRESS ----------
    if (interaction.commandName === "academyprogress") {
      await safeAck(interaction);

      const user = interaction.options.getUser("user", false) ?? interaction.user;
      const rec = getAcademyRecord(user.id);

      const robloxId = await getRoWifiRobloxId(user.id);
      const robloxUsername = robloxId ? await getRobloxUsername(robloxId) : null;
      if (robloxUsername) {
        rec.robloxUsername = robloxUsername;
        academy.set(String(user.id), rec);
        saveAcademy();
      }

      const { total, done, pct } = computeProgress(rec);

      const embed = {
        title: "🏫 Academy Progress",
        color: 0x9b59b6,
        fields: [
          { name: "User", value: `${user} (ID: ${user.id})`, inline: false },
          { name: "Roblox Username:", value: rec.robloxUsername || "Unknown", inline: true },
          { name: "Dept:", value: rec.dept || "Unassigned", inline: true },
          { name: "Total events:", value: String(total), inline: true },
          { name: "Amount done:", value: String(done), inline: true },
          { name: "Progress in percentage:", value: `${pct}%`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      };

      return interaction.editReply({ embeds: [embed] });
    }

    // ---------- APPEAL ----------
    if (interaction.commandName === "appeal") {
      await safeAck(interaction);

      const st = getUserAppealState(interaction.user.id);

      if (st.pending) return safeReply(interaction, "❌ You already have a pending appeal.");

      if (st.deniedUntil && Date.now() < st.deniedUntil) {
        const remainingMs = st.deniedUntil - Date.now();
        const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
        return safeReply(interaction, `❌ You can submit another appeal in **${days} day(s)**.`);
      }

      const activeCase = findLatestActiveCaseAgainst(interaction.user.id);
      if (!activeCase) return safeReply(interaction, "❌ No active case found to appeal.");

      let dm;
      try {
        dm = await interaction.user.createDM();
      } catch {
        return safeReply(interaction, "❌ I couldn’t DM you. Enable DMs and try again.");
      }

      const q1 = "Why should we accept your appeal?";
      const q2 = "Do you show remorse for your actions?:";
      const q3 = "Is this an MoL punishment or Aegis punishment:";

      let a1, a2, a3;
      try {
        await dm.send("📝 **Appeal Started**\nAnswer the questions below. (10 minutes per question.)");
        a1 = await askQuestion(dm, interaction.user.id, q1);
        a2 = await askQuestion(dm, interaction.user.id, q2);
        a3 = await askQuestion(dm, interaction.user.id, q3);
      } catch {
        try {
          await dm.send("⏳ Appeal timed out. Run **/appeal** again when ready.");
        } catch {}
        return safeReply(interaction, "❌ Appeal timed out (check your DMs).");
      }

      const robloxId = await getRoWifiRobloxId(interaction.user.id);
      const robloxUsername = robloxId ? (await getRobloxUsername(robloxId)) : "Unknown";

      const cf = findLatestCasefileFor(interaction.user.id);
      const punishmentGiven = cf?.punishmentGiven || "Unknown";
      const casefileDoc = cf?.casefileDoc || "Unknown";

      const appealId = generateAppealId();

      const appealsCh = await getTextChannel(interaction.guild, APPEALS_CHANNEL_ID);
      if (!appealsCh) return safeReply(interaction, "❌ Appeals channel not found.");

      const embed = {
        title: `📨 Appeal Submitted (${appealId})`,
        color: 0xf1c40f,
        fields: [
          { name: "Roblox Username:", value: robloxUsername || "Unknown", inline: true },
          { name: "Discord Username:", value: `${interaction.user} (ID: ${interaction.user.id})`, inline: false },
          { name: "Reason for punishment:", value: activeCase.reasons || "Unknown", inline: false },
          { name: "Case id:", value: activeCase.caseId || "Unknown", inline: true },
          { name: "Punishment given:", value: punishmentGiven, inline: false },
          { name: "Casefile doc:", value: casefileDoc, inline: false },
          { name: "Appeal Answers", value: `1) ${a1}\n2) ${a2}\n3) ${a3}`, inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`appeal:accept:${appealId}`).setLabel("Accept").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`appeal:deny:${appealId}`).setLabel("Deny").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`appeal:redirect:${appealId}`).setLabel("Redirect").setStyle(ButtonStyle.Secondary)
      );

      const sent = await appealsCh.send({ embeds: [embed], components: [row] });

      st.pending = {
        appealId,
        messageId: sent.id,
        caseId: activeCase.caseId,
        createdAt: new Date().toISOString(),
      };
      setUserAppealState(interaction.user.id, st);

      try {
        await dm.send(`✅ Appeal submitted. ID: ${appealId}`);
      } catch {}
      return safeReply(interaction, "✅ Appeal submitted (check your DMs).");
    }

    // ---------- Roblox Rank Commands ----------
    async function getVerifiedRobloxIdOrNull(targetDiscordUser) {
      const rid = await getRoWifiRobloxId(targetDiscordUser.id);
      return rid ? rid : null;
    }

    if (interaction.commandName === "promote") {
      if (!isRankManager(interaction.member)) return safeReply(interaction, "❌ No permission.");
      if (!ROBLOX_GROUP_ID || !ROBLOX_OPEN_CLOUD_KEY) return safeReply(interaction, "❌ Roblox Open Cloud not configured.");
      await safeAck(interaction);

      const target = interaction.options.getUser("user", true);

      try {
        const robloxId = await getVerifiedRobloxIdOrNull(target);
        if (!robloxId) {
          await logRankAction(interaction.guild, {
            success: false,
            action: "PROMOTE",
            moderator: `${interaction.user}`,
            targetDiscord: `${target} (ID:${target.id})`,
            robloxLine: "Unknown",
            result: "FAILED: Not verified",
          });
          return safeReply(interaction, "❌ User not RoWifi-verified.");
        }

        const membershipId = await findMembershipIdByUserId(robloxId);
        if (!membershipId) {
          const rbName = await getRobloxUsername(robloxId);
          await logRankAction(interaction.guild, {
            success: false,
            action: "PROMOTE",
            moderator: `${interaction.user}`,
            targetDiscord: `${target} (ID:${target.id})`,
            robloxLine: `${rbName ?? "Unknown"} (${robloxId})`,
            result: "FAILED: Not in group",
          });
          return safeReply(interaction, "❌ Roblox user not in group.");
        }

        const roles = await getGroupRolesAll();
        const membership = await getMembership(membershipId);

        const currentRoleId = String(membership?.role || "").split("/").pop();
        const currentRole = roles.find((r) => String(r.id) === String(currentRoleId));
        if (!currentRole) throw new Error("Could not resolve current role.");

        const sorted = roles.filter((r) => typeof r.rank === "number").sort((a, b) => a.rank - b.rank);
        const idx = sorted.findIndex((r) => String(r.id) === String(currentRole.id));
        if (idx < 0 || idx === sorted.length - 1) return safeReply(interaction, "❌ Already at highest role.");

        const nextRole = sorted[idx + 1];
        await setMembershipRole(membershipId, nextRole.id);

        const rbName = await getRobloxUsername(robloxId);
        await logRankAction(interaction.guild, {
          success: true,
          action: "PROMOTE",
          moderator: `${interaction.user}`,
          targetDiscord: `${target} (ID:${target.id})`,
          robloxLine: `${rbName ?? "Unknown"} (${robloxId})`,
          result: `SUCCESS: ${currentRole.displayName} → ${nextRole.displayName}`,
        });

        return safeReply(interaction, `✅ Promoted ${target}\n**${currentRole.displayName}** → **${nextRole.displayName}**`);
      } catch (e) {
        await logRankAction(interaction.guild, {
          success: false,
          action: "PROMOTE",
          moderator: `${interaction.user}`,
          targetDiscord: `${target} (ID:${target.id})`,
          robloxLine: "Unknown",
          result: `FAILED: ${String(e?.message || e)}`,
        });
        return safeReply(interaction, "❌ Promote failed (see rank logs).");
      }
    }

    if (interaction.commandName === "demote") {
      if (!isRankManager(interaction.member)) return safeReply(interaction, "❌ No permission.");
      if (!ROBLOX_GROUP_ID || !ROBLOX_OPEN_CLOUD_KEY) return safeReply(interaction, "❌ Roblox Open Cloud not configured.");
      await safeAck(interaction);

      const target = interaction.options.getUser("user", true);

      try {
        const robloxId = await getVerifiedRobloxIdOrNull(target);
        if (!robloxId) {
          await logRankAction(interaction.guild, {
            success: false,
            action: "DEMOTE",
            moderator: `${interaction.user}`,
            targetDiscord: `${target} (ID:${target.id})`,
            robloxLine: "Unknown",
            result: "FAILED: Not verified",
          });
          return safeReply(interaction, "❌ User not RoWifi-verified.");
        }

        const membershipId = await findMembershipIdByUserId(robloxId);
        if (!membershipId) {
          const rbName = await getRobloxUsername(robloxId);
          await logRankAction(interaction.guild, {
            success: false,
            action: "DEMOTE",
            moderator: `${interaction.user}`,
            targetDiscord: `${target} (ID:${target.id})`,
            robloxLine: `${rbName ?? "Unknown"} (${robloxId})`,
            result: "FAILED: Not in group",
          });
          return safeReply(interaction, "❌ Roblox user not in group.");
        }

        const roles = await getGroupRolesAll();
        const membership = await getMembership(membershipId);

        const currentRoleId = String(membership?.role || "").split("/").pop();
        const currentRole = roles.find((r) => String(r.id) === String(currentRoleId));
        if (!currentRole) throw new Error("Could not resolve current role.");

        const sorted = roles.filter((r) => typeof r.rank === "number").sort((a, b) => a.rank - b.rank);
        const idx = sorted.findIndex((r) => String(r.id) === String(currentRole.id));
        if (idx <= 0) return safeReply(interaction, "❌ Already at lowest role.");

        const nextRole = sorted[idx - 1];
        await setMembershipRole(membershipId, nextRole.id);

        const rbName = await getRobloxUsername(robloxId);
        await logRankAction(interaction.guild, {
          success: true,
          action: "DEMOTE",
          moderator: `${interaction.user}`,
          targetDiscord: `${target} (ID:${target.id})`,
          robloxLine: `${rbName ?? "Unknown"} (${robloxId})`,
          result: `SUCCESS: ${currentRole.displayName} → ${nextRole.displayName}`,
        });

        return safeReply(interaction, `✅ Demoted ${target}\n**${currentRole.displayName}** → **${nextRole.displayName}**`);
      } catch (e) {
        await logRankAction(interaction.guild, {
          success: false,
          action: "DEMOTE",
          moderator: `${interaction.user}`,
          targetDiscord: `${target} (ID:${target.id})`,
          robloxLine: "Unknown",
          result: `FAILED: ${String(e?.message || e)}`,
        });
        return safeReply(interaction, "❌ Demote failed (see rank logs).");
      }
    }

    if (interaction.commandName === "setrank") {
      if (!isRankManager(interaction.member)) return safeReply(interaction, "❌ No permission.");
      if (!ROBLOX_GROUP_ID || !ROBLOX_OPEN_CLOUD_KEY) return safeReply(interaction, "❌ Roblox Open Cloud not configured.");
      await safeAck(interaction);

      const target = interaction.options.getUser("user", true);
      const rankname = interaction.options.getString("rankname", true);

      try {
        const robloxId = await getVerifiedRobloxIdOrNull(target);
        if (!robloxId) {
          await logRankAction(interaction.guild, {
            success: false,
            action: "SETRANK",
            moderator: `${interaction.user}`,
            targetDiscord: `${target} (ID:${target.id})`,
            robloxLine: "Unknown",
            result: "FAILED: Not verified",
          });
          return safeReply(interaction, "❌ User not RoWifi-verified.");
        }

        const membershipId = await findMembershipIdByUserId(robloxId);
        if (!membershipId) {
          const rbName = await getRobloxUsername(robloxId);
          await logRankAction(interaction.guild, {
            success: false,
            action: "SETRANK",
            moderator: `${interaction.user}`,
            targetDiscord: `${target} (ID:${target.id})`,
            robloxLine: `${rbName ?? "Unknown"} (${robloxId})`,
            result: "FAILED: Not in group",
          });
          return safeReply(interaction, "❌ Roblox user not in group.");
        }

        const roles = await getGroupRolesAll();
        const membership = await getMembership(membershipId);

        const currentRoleId = String(membership?.role || "").split("/").pop();
        const currentRole = roles.find((r) => String(r.id) === String(currentRoleId));

        const want = normKey(rankname);
        const matched =
          roles.find((r) => normKey(r.displayName) === want) ||
          roles.find((r) => normKey(r.name) === want) ||
          roles.find((r) => normKey(r.displayName).includes(want)) ||
          roles.find((r) => normKey(r.name).includes(want));

        if (!matched) {
          const rbName = await getRobloxUsername(robloxId);
          await logRankAction(interaction.guild, {
            success: false,
            action: "SETRANK",
            moderator: `${interaction.user}`,
            targetDiscord: `${target} (ID:${target.id})`,
            robloxLine: `${rbName ?? "Unknown"} (${robloxId})`,
            result: `FAILED: Role not found: ${rankname}`,
          });
          return safeReply(interaction, `❌ Role not found: ${rankname}`);
        }

        await setMembershipRole(membershipId, matched.id);

        const rbName = await getRobloxUsername(robloxId);
        await logRankAction(interaction.guild, {
          success: true,
          action: "SETRANK",
          moderator: `${interaction.user}`,
          targetDiscord: `${target} (ID:${target.id})`,
          robloxLine: `${rbName ?? "Unknown"} (${robloxId})`,
          result: `SUCCESS: ${(currentRole?.displayName ?? "Unknown")} → ${matched.displayName}`,
        });

        return safeReply(
          interaction,
          `✅ Set rank for ${target}\n**${currentRole?.displayName ?? "Unknown"}** → **${matched.displayName}**`
        );
      } catch (e) {
        await logRankAction(interaction.guild, {
          success: false,
          action: "SETRANK",
          moderator: `${interaction.user}`,
          targetDiscord: `${target} (ID:${target.id})`,
          robloxLine: "Unknown",
          result: `FAILED: ${String(e?.message || e)}`,
        });
        return safeReply(interaction, "❌ Setrank failed (see rank logs).");
      }
    }
  } catch (err) {
    console.error("InteractionCreate error:", err);
    try {
      if (!interaction.isRepliable()) return;
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "❌ An error occurred.", ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ An error occurred.", ephemeral: true });
      }
    } catch {}
  }
});

if (!BOT_TOKEN) {
  console.error("❌ Missing BOT_TOKEN in .env");
  process.exit(1);
}

client.login(BOT_TOKEN);
