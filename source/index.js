const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");

// Discord client (btw they need some intents)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Bot token endpoint
app.post("/set-bot-token", async (req, res) => {
  const { bot_token } = req.body;

  try {
    await client.login(bot_token); // Log-In by the provided Token

    // Is it Logged it? Great. Take the username and the User id
    const botUser = client.user;
    const username = botUser.username;
    const userId = botUser.id;

    res.json({ success: true, username, userId });
  } catch (error) {
    console.error("Error setting bot token:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to set bot token!" }); // Failed. Then your bot token isnt tokening.
  }
});

// So Channel ID here can act as a DM or a Server's channel. Yes, those DM are channels too.
app.post("/get-server-name", async (req, res) => {
  const { channel_id } = req.body;

  try {
    const channel = await client.channels.fetch(channel_id);
    const guild = channel.guild;
    res.json({ success: true, server_name: guild.name });
  } catch (error) {
    console.error("Error fetching server name:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch server name!" });
  }
});

// GET all members that can be mentioned within the server
app.post("/get-members", async (req, res) => {
  const { channel_id } = req.body;

  try {
    const channel = await client.channels.fetch(channel_id);
    const guild = channel.guild;
    const members = await guild.members.fetch();

    // List the mentionable members
    const memberList = members.map((member) => ({
      id: member.id,
      username: member.user.username,
    }));

    res.json({ success: true, members: memberList });
  } catch (error) {
    console.error("Error fetching members:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch members!" });
  }
});

let lastMessageId = {}; // Tracker for last message id

app.post("/get-recent-messages", async (req, res) => {
  const { channel_id } = req.body;

  try {
    const channel = await client.channels.fetch(channel_id);

    // fetch last 10 messages (modifiable)
    const messages = await channel.messages.fetch({ limit: 100 });

    // Get recent message id
    const recentMessage = messages.first();
    const recentMessageId = recentMessage ? recentMessage.id : null;

    // If there are new messages, return immediately.
    if (lastMessageId[channel_id] !== recentMessageId) {
      lastMessageId[channel_id] = recentMessageId; // Update to the latest message ID

      // List the recent message with the username
      const messageList = messages.map((message) => ({
        id: message.id,
        content: message.content || "[Embed or Attachment]",
        username: message.author.username, // fetch message's usern
      }));

      return res.json({ success: true, messages: messageList });
    }

    // LONG-POLLING HTTP:REQ HOLD (30SEC)
    setTimeout(async () => {
      const newMessages = await channel.messages.fetch({ limit: 10 });
      const newRecentMessage = newMessages.first();
      const newRecentMessageId = newRecentMessage ? newRecentMessage.id : null;

      // Make sure that there are new messages
      if (lastMessageId[channel_id] !== newRecentMessageId) {
        lastMessageId[channel_id] = newRecentMessageId;

        const newMessageList = newMessages.map((message) => ({
          id: message.id,
          content: message.content || "[Embed or Attachment]",
          username: message.author.username,
        }));

        return res.json({ success: true, messages: newMessageList });
      }

      res.json({ success: false, message: "No new messages." });
    }, 1000); // 5 Seconds POLLING
  } catch (error) {
    console.error("Error fetching messages:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch messages!" });
  }
});

// Send message or send imagetoo
app.post("/send-message", async (req, res) => {
  const {
    channel_id,
    user_to_reply,
    text_to_say,
    image_url,
    message_id_to_reply,
  } = req.body;

  try {
    const channel = await client.channels.fetch(channel_id);
    if (channel) {
      let messageContent = text_to_say;
      if (user_to_reply) {
        messageContent = `<@${user_to_reply}> ${text_to_say}`;
      }

      const messagePayload = {
        content: messageContent,
        ...(message_id_to_reply && {
          reply: { messageReference: message_id_to_reply },
        }),
      };

      if (image_url) {
        messagePayload.files = [{ attachment: image_url }];
      }

      await channel.send(messagePayload);
      res.json({ success: true, message: "Message sent!" });
    } else {
      res.status(404).json({ success: false, message: "Channel not found!" });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to send message!" });
  }
});

// START
app.listen(port, () => {
  console.log(
    `SERVER ROLLING ::: http://localhost:${port}\nOpen your localhonest`
  );
});
