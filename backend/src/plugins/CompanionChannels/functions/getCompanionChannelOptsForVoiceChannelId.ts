import { StageChannel, VoiceChannel } from "discord.js";
import { GuildPluginData } from "vety";
import { CompanionChannelsPluginType, TCompanionChannelOpts } from "../types.js";
import { Snowflake } from "../../../utils.js";

const defaultCompanionChannelOpts: Partial<TCompanionChannelOpts> = {
  enabled: true,
};

export async function getCompanionChannelOptsForVoiceChannelId(
  pluginData: GuildPluginData<CompanionChannelsPluginType>,
  userId: string,
  voiceChannel: VoiceChannel | StageChannel,
): Promise<TCompanionChannelOpts[]> {
  const config = await pluginData.config.getMatchingConfig({ userId, channelId: voiceChannel.id });
  return Object.values(config.entries)
    .filter(
      (opts) =>
        opts.voice_channel_ids.includes(voiceChannel.id as Snowflake) ||
        (voiceChannel.parentId && opts.voice_channel_ids.includes(voiceChannel.parentId as Snowflake)),
    )
    .map((opts) => Object.assign({}, defaultCompanionChannelOpts, opts));
}
