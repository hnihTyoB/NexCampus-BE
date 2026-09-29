import dotenv from 'dotenv';
dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN || '';
const guildId = process.env.DISCORD_GUILD_ID || '';
const standupChannelId = process.env.DISCORD_STANDUP_CHANNEL_ID || '';
const ownerUserId = process.env.DISCORD_OWNER_USER_ID || '';

async function testFullFlow() {
  console.log('--- 1. Create Role ---');
  const roleRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Ban Kỹ Thuật Phần Mềm',
      color: 0x00f0ff,
      mentionable: true,
    }),
  });
  const role = await roleRes.json();
  console.log('Role created:', role.id, role.name);

  console.log('--- 2. Create Private Thread ---');
  const threadRes = await fetch(`https://discord.com/api/v10/channels/${standupChannelId}/threads`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: '🔒 [Ban Kỹ Thuật] Standup',
      type: 12, // GUILD_PRIVATE_THREAD
      auto_archive_duration: 10080,
      invitable: false,
    }),
  });
  const thread = await threadRes.json();
  console.log('Thread created:', thread.id, thread.name);

  console.log('--- 3. Add Member to Role ---');
  const addRoleRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${ownerUserId}/roles/${role.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${token}` },
  });
  console.log('Add member to role status:', addRoleRes.status); // 204 is success

  console.log('--- 4. Add Member to Private Thread ---');
  const addThreadRes = await fetch(`https://discord.com/api/v10/channels/${thread.id}/thread-members/${ownerUserId}`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${token}` },
  });
  console.log('Add member to thread status:', addThreadRes.status); // 204 is success

  console.log('--- 5. Post Message to Private Thread via Webhook or Channel Msg ---');
  const msgRes = await fetch(`https://discord.com/api/v10/channels/${thread.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: '👋 Chào mừng bạn vào Luồng Riêng Tư (Private Thread) của Ban Kỹ Thuật Phần Mềm!',
    }),
  });
  const msg = await msgRes.json();
  console.log('Message posted in thread:', msg.id);

  console.log('--- 6. Remove Member from Thread & Role ---');
  const remThreadRes = await fetch(`https://discord.com/api/v10/channels/${thread.id}/thread-members/${ownerUserId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${token}` },
  });
  console.log('Remove member from thread status:', remThreadRes.status);

  const remRoleRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${ownerUserId}/roles/${role.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${token}` },
  });
  console.log('Remove member from role status:', remRoleRes.status);

  console.log('--- 7. Cleanup Role and Thread ---');
  const delThreadRes = await fetch(`https://discord.com/api/v10/channels/${thread.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${token}` },
  });
  console.log('Delete thread status:', delThreadRes.status);

  const delRoleRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles/${role.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${token}` },
  });
  console.log('Delete role status:', delRoleRes.status);
}

testFullFlow().catch(console.error);
