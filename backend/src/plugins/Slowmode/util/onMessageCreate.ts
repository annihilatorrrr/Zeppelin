import { ChannelType, GuildTextBasedChannel, Snowflake } from "discord.js";
import { GuildPluginData } from "knub";
import { SavedMessage } from "../../../data/entities/SavedMessage.js";
import { SlowmodeChannel } from "../../../data/entities/SlowmodeChannel.js";
import { hasPermission } from "../../../pluginUtils.js";
import { resolveMember } from "../../../utils.js";
import { getMissingChannelPermissions } from "../../../utils/getMissingChannelPermissions.js";
import { messageLock } from "../../../utils/lockNameHelpers.js";
import { missingPermissionError } from "../../../utils/missingPermissionError.js";
import { LogsPlugin } from "../../Logs/LogsPlugin.js";
import { BOT_SLOWMODE_PERMISSIONS } from "../requiredPermissions.js";
import { SlowmodePluginType } from "../types.js";
import { applyBotSlowmodeToUserId } from "./applyBotSlowmodeToUserId.js";

export async function onMessageCreate(pluginData: GuildPluginData<SlowmodePluginType>, msg: SavedMessage) {
  if (msg.is_bot) return;

  const channel = pluginData.guild.channels.cache.get(msg.channel_id as Snowflake) as GuildTextBasedChannel;
  if (!channel?.isTextBased() || channel.type === ChannelType.GuildStageVoice) return;

  // Don't apply slowmode if the lock was interrupted earlier (e.g. the message was caught by word filters)
  const thisMsgLock = await pluginData.locks.acquire(messageLock(msg));
  if (thisMsgLock.interrupted) return;

  // Check if this channel even *has* a bot-maintained slowmode
  let channelSlowmode: SlowmodeChannel | null;
  if (pluginData.state.channelSlowmodeCache.has(channel.id)) {
    channelSlowmode = pluginData.state.channelSlowmodeCache.get(channel.id) ?? null;
  } else {
    channelSlowmode = (await pluginData.state.slowmodes.getChannelSlowmode(channel.id)) ?? null;
    pluginData.state.channelSlowmodeCache.set(channel.id, channelSlowmode);
  }
  if (!channelSlowmode) {
    return thisMsgLock.unlock();
  }

  // Make sure this user is affected by the slowmode
  const member = await resolveMember(pluginData.client, pluginData.guild, msg.user_id);
  const isAffected = await hasPermission(pluginData, "is_affected", {
    channelId: channel.id,
    userId: msg.user_id,
    member,
  });
  if (!isAffected) {
    return thisMsgLock.unlock();
  }

  // Make sure we have the appropriate permissions to manage this slowmode
  const me = pluginData.guild.members.cache.get(pluginData.client.user!.id)!;
  const missingPermissions = getMissingChannelPermissions(me, channel, BOT_SLOWMODE_PERMISSIONS);
  if (missingPermissions) {
    const logs = pluginData.getPlugin(LogsPlugin);
    logs.logBotAlert({
      body: `Unable to manage bot slowmode in <#${channel.id}>. ${missingPermissionError(missingPermissions)}`,
    });
    return;
  }

  // Delete any extra messages sent after a slowmode was already applied
  const userHasSlowmode = await pluginData.state.slowmodes.userHasSlowmode(channel.id, msg.user_id);
  if (userHasSlowmode) {
    try {
      // FIXME: Debug
      // tslint:disable-next-line:no-console
      console.log(
        `[DEBUG] [SLOWMODE] Deleting message ${msg.id} from channel ${channel.id} in guild ${pluginData.guild.id}`,
      );
      await channel.messages.delete(msg.id);
      thisMsgLock.interrupt();
    } catch (err) {
      thisMsgLock.unlock();
    }

    return;
  }

  await applyBotSlowmodeToUserId(pluginData, channel, msg.user_id);
  thisMsgLock.unlock();
}
