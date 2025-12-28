require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

function reqEnv(name) {
  if (!process.env[name]) throw new Error(`Missing env var: ${name}`);
  return process.env[name];
}

const casefile = new SlashCommandBuilder()
  .setName("casefile")
  .setDescription("Submit a casefile for a user (restricted).")
  .addUserOption((opt) => opt.setName("user").setDescription("User to casefile").setRequired(true))
  .addStringOption((opt) => opt.setName("casefile_doc").setDescription("Casefile doc").setRequired(true))
  .addStringOption((opt) => opt.setName("punishment_given").setDescription("Punishment given").setRequired(true))
  .addStringOption((opt) => opt.setName("signed_off_by").setDescription("Signed off by").setRequired(true));

const report = new SlashCommandBuilder()
  .setName("report")
  .setDescription("Report a user to staff.")
  .addUserOption((opt) => opt.setName("user").setDescription("User to report").setRequired(true))
  .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(true))
  .addStringOption((opt) => opt.setName("proof").setDescription("Proof").setRequired(true));

const createcase = new SlashCommandBuilder()
  .setName("createcase")
  .setDescription("Create a staff case from a report (restricted).")
  .addStringOption((opt) => opt.setName("report_id").setDescription("Report ID").setRequired(true))
  .addUserOption((opt) => opt.setName("case_against").setDescription("Case against").setRequired(true))
  .addStringOption((opt) => opt.setName("reasons").setDescription("Reasons").setRequired(true));

const viewcase = new SlashCommandBuilder()
  .setName("viewcase")
  .setDescription("View a staff case by CaseID (restricted).")
  .addStringOption((opt) => opt.setName("case_id").setDescription("CaseID").setRequired(true));

const addevidence = new SlashCommandBuilder()
  .setName("addevidence")
  .setDescription("Add evidence to an existing case (restricted).")
  .addStringOption((opt) => opt.setName("case_id").setDescription("CaseID").setRequired(true))
  .addStringOption((opt) => opt.setName("evidence_link").setDescription("Evidence link").setRequired(true));

const blacklistadd = new SlashCommandBuilder()
  .setName("blacklistadd")
  .setDescription("Add a user to the blacklist (restricted).")
  .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
  .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(true))
  .addStringOption((opt) => opt.setName("case_id").setDescription("Case ID").setRequired(true));

const blacklistview = new SlashCommandBuilder()
  .setName("blacklistview")
  .setDescription("View a user's blacklist record (restricted).")
  .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true));

const blacklistrevoke = new SlashCommandBuilder()
  .setName("blacklistrevoke")
  .setDescription("Revoke a user's blacklist entry (restricted).")
  .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
  .addStringOption((opt) => opt.setName("reason").setDescription("Reason for revoke").setRequired(true));

const viewallblacklist = new SlashCommandBuilder()
  .setName("viewallblacklist")
  .setDescription("DMs you the full blacklist (restricted).");

const apply = new SlashCommandBuilder()
  .setName("apply")
  .setDescription("Apply for Medical/Security (DM interview).");

const applicationreview = new SlashCommandBuilder()
  .setName("applicationreview")
  .setDescription("Review an application (restricted).")
  .addStringOption((opt) => opt.setName("application_id").setDescription("Application ID").setRequired(true))
  .addStringOption((opt) =>
    opt.setName("decision").setDescription("Accept or deny").setRequired(true).addChoices(
      { name: "Accept", value: "ACCEPT" },
      { name: "Deny", value: "DENY" }
    )
  )
  .addStringOption((opt) => opt.setName("notes").setDescription("Reason / notes").setRequired(true));

const eventlog = new SlashCommandBuilder()
  .setName("eventlog")
  .setDescription("Log an event for XP.")
  .addStringOption((opt) => opt.setName("event").setDescription("Event").setRequired(true))
  .addStringOption((opt) => opt.setName("start").setDescription("Start time (ex: 3:15pm or 15:15)").setRequired(true))
  .addStringOption((opt) => opt.setName("end").setDescription("End time (ex: 4:00pm or 16:00)").setRequired(true))
  .addStringOption((opt) => opt.setName("proof").setDescription("Proof").setRequired(true));

const xp = new SlashCommandBuilder()
  .setName("xp")
  .setDescription("View XP (your own or someone else's).")
  .addUserOption((opt) => opt.setName("user").setDescription("View someone else's XP (staff only)").setRequired(false));

const promote = new SlashCommandBuilder()
  .setName("promote")
  .setDescription("Promote a user by 1 Roblox group rank (restricted).")
  .addUserOption((opt) => opt.setName("user").setDescription("Discord user").setRequired(true));

const demote = new SlashCommandBuilder()
  .setName("demote")
  .setDescription("Demote a user by 1 Roblox group rank (restricted).")
  .addUserOption((opt) => opt.setName("user").setDescription("Discord user").setRequired(true));

const setrank = new SlashCommandBuilder()
  .setName("setrank")
  .setDescription("Set a user's Roblox rank by role name (restricted).")
  .addUserOption((opt) => opt.setName("user").setDescription("Discord user").setRequired(true))
  .addStringOption((opt) => opt.setName("rankname").setDescription("Roblox role name").setRequired(true));

const academyeventlog = new SlashCommandBuilder()
  .setName("academyeventlog")
  .setDescription("Log academy-related events and sessions (restricted).")
  .addUserOption((opt) => opt.setName("trainee").setDescription("Trainee").setRequired(true))
  .addStringOption((opt) => opt.setName("event").setDescription("Event").setRequired(true))
  .addStringOption((opt) => opt.setName("proof").setDescription("Proof").setRequired(true));

const academyprogress = new SlashCommandBuilder()
  .setName("academyprogress")
  .setDescription("View trainee academy progress records.")
  .addUserOption((opt) => opt.setName("user").setDescription("User (optional)").setRequired(false));

const assigndept = new SlashCommandBuilder()
  .setName("assigndept")
  .setDescription("Assign academy dept to a trainee (restricted).")
  .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
  .addStringOption((opt) =>
    opt.setName("dept").setDescription("Dept").setRequired(true).addChoices(
      { name: "Security", value: "Security" },
      { name: "Medical", value: "Medical" },
      { name: "Both", value: "Both" }
    )
  );

const appeal = new SlashCommandBuilder()
  .setName("appeal")
  .setDescription("Submit an appeal (DM questions).");

(async () => {
  const token = reqEnv("BOT_TOKEN");
  const clientId = reqEnv("CLIENT_ID");
  const guildId = reqEnv("GUILD_ID");

  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    {
      body: [
        casefile.toJSON(),
        report.toJSON(),
        createcase.toJSON(),
        viewcase.toJSON(),
        addevidence.toJSON(),
        blacklistadd.toJSON(),
        blacklistview.toJSON(),
        blacklistrevoke.toJSON(),
        viewallblacklist.toJSON(),
        apply.toJSON(),
        applicationreview.toJSON(),
        eventlog.toJSON(),
        xp.toJSON(),
        promote.toJSON(),
        demote.toJSON(),
        setrank.toJSON(),
        academyeventlog.toJSON(),
        academyprogress.toJSON(),
        assigndept.toJSON(),
        appeal.toJSON(),
      ],
    }
  );

  console.log("✅ Commands registered");
})();
