// registerCommands.js

import 'dotenv/config';
import { REST, Routes, ApplicationCommandOptionType } from 'discord.js';

export async function registerCommands() {
  const commands = [
    {
      name: 'summarize',
      description: 'Summarize recent channel messages.',
      options: [
        {
          name: 'timeframe',
          description: 'e.g. "last hour", "this morning", "last day"',
          type: ApplicationCommandOptionType.String,
          required: false
        }
      ]
    }
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log('Started refreshing application (/) commands.');
    // For global commands:
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
      body: commands
    });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
}