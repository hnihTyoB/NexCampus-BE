import dotenv from 'dotenv';
dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN || '';
const guildId = process.env.DISCORD_GUILD_ID || '';

async function test() {
  const meRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${token}` }
  });
  console.log('Bot user:', await meRes.json());

  const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${token}` }
  });
  console.log('Guild:', await guildRes.json());

  const channelsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${token}` }
  });
  const channels = await channelsRes.json();
  console.log('Channels count:', Array.isArray(channels) ? channels.length : channels);
  if (Array.isArray(channels)) {
    channels.forEach(c => console.log(` - Channel: id=${c.id}, name=${c.name}, type=${c.type}`));
  }

  const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${token}` }
  });
  const roles = await rolesRes.json();
  console.log('Roles count:', Array.isArray(roles) ? roles.length : roles);
  if (Array.isArray(roles)) {
    roles.forEach(r => console.log(` - Role: id=${r.id}, name=${r.name}`));
  }
}

test().catch(console.error);
