// index.js
import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import OpenAI from "openai";
import parseTimeframe from "./parseTimeframe.js";
import { chunkMessages } from "./chunkUtils.js";
import { registerCommands } from "./registerCommands.js";

/**
 * Initialize Discord.js client
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

/**
 * Initialize the OpenAI client.
 * If OPENAI_API_KEY is in process.env, the new OpenAI library picks it up automatically.
 */
const openai = new OpenAI();

/**
 * Summarize a single chunk using GPT-4
 */
async function summarizeChunk(chunk) {
  const prompt = `
Summarize the following messages into bullet points (and short paragraphs if needed). Try not to make the summary or bullet points longer than the messages themselves. Reading the summary should be quicker than reading the messages themselves.
If possible, group the points by the users that made them.:

${chunk.join("\n")}
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // Adjust if you prefer "gpt-3.5-turbo"
    messages: [
      {
        role: "system",
        content:
          "You are a helpful summarizer for a discord server. Your role is to give a TLDR of conversations",
      },
      { role: "user", content: prompt },
    ],
  });

  return completion.choices[0].message.content.trim();
}

/**
 * Summarize multiple chunk-level summaries.
 */
async function summarizeChunkSummaries(chunkSummaries) {
  const combinedText = chunkSummaries
    .map((summary, i) => `Chunk ${i + 1} summary:\n${summary}`)
    .join("\n\n");

  const prompt = `
We have multiple chunk summaries. Combine them into one cohesive summary with bullet points. The chunks are chat messages that are potentially grouped by users. Combine each users' point to maintain that grouping.

${combinedText}
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful summarizer for a discord server. Your role is to give a TLDR of conversations",
      },
      { role: "user", content: prompt },
    ],
  });

  return completion.choices[0].message.content.trim();
}

/**
 * replyToContext:
 * - If slash command was deferred, we edit the deferred reply or follow up.
 * - If mention-based message, we just send to channel.
 */
async function replyToContext(context, text) {
  // Check if it's an Interaction (slash command)
  if (context.isChatInputCommand?.()) {
    // We already called "context.deferReply()", so now use editReply or followUp
    try {
      await context.editReply(text);
    } catch (err) {
      // If editReply fails for some reason (rare), fallback to followUp
      await context.followUp(text);
    }
  } else {
    // It's a normal message
    await context.channel.send(text);
  }
}

/**
 * Main Summarize Handler
 * - Defer if slash command
 * - Parse timeframe
 * - Fetch messages
 * - Chunk & Summarize
 * - Edit/followUp or channel.send final summary
 */
async function handleSummarize(context, timeframeArg) {
  try {
    // 1) If it's a slash command, defer immediately
    if (context.isChatInputCommand?.()) {
      await context.deferReply();
    }

    // 2) Parse timeframe
    const startTime = parseTimeframe(timeframeArg);

    // 3) Ensure text-based channel
    const channel = context.channel;
    if (!channel || !channel.isTextBased()) {
      return replyToContext(context, "I can only summarize in text channels!");
    }

    // 4) Fetch up to 100 messages
    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
    const relevant = fetchedMessages.filter(
      (msg) => msg.createdTimestamp >= startTime.getTime(),
    );

    // 5) Sort messages from oldest to newest
    const sorted = [...relevant.values()].sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp,
    );

    // Convert to "Username: message"
    const lines = sorted.map((msg) => `${msg.author.username}: ${msg.content}`);

    // 6) Chunk if needed
    const chunks = chunkMessages(lines);

    // 7) Summarize each chunk
    const chunkSummaries = [];
    for (const c of chunks) {
      const summary = await summarizeChunk(c);
      chunkSummaries.push(summary);
    }

    // 8) If multiple chunks, do a final summary
    let finalSummary;
    if (chunkSummaries.length === 1) {
      finalSummary = chunkSummaries[0];
    } else {
      finalSummary = await summarizeChunkSummaries(chunkSummaries);
    }

    // 9) Reply
    await replyToContext(context, finalSummary);
  } catch (error) {
    console.error("Error handling summarize:", error);
    await replyToContext(context, "Sorry, I ran into an error.");
  }
}

/**
 * -------------
 *  DISCORD EVENTS
 * -------------
 */

// Ready event
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  // Optionally register slash commands at startup
  await registerCommands();
});

// Slash command
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "summarize") {
    const timeframeArg = interaction.options.getString("timeframe");
    await handleSummarize(interaction, timeframeArg);
  }
});

// Mention-based command
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // e.g. "@BotName summarize last hour"
  if (
    message.mentions.users.has(client.user.id) &&
    message.content.toLowerCase().includes("summarize")
  ) {
    const match = message.content.toLowerCase().match(/summarize\s+(.*)/);
    const timeframeArg = match ? match[1].trim() : null;
    await handleSummarize(message, timeframeArg);
  }
});

// Login
client.login(process.env.DISCORD_BOT_TOKEN);
