import { commandTypeHelpers as ct } from "../../../commandTypes.js";
import { isStaffPreFilter } from "../../../pluginUtils.js";
import { updateGuildInfo } from "../../GuildInfoSaver/GuildInfoSaverPlugin.js";
import { botControlCmd } from "../types.js";

export const RefreshServerInfoCmd = botControlCmd({
  trigger: ["refresh_server_info", "refresh_guild_info"],
  permission: null,
  config: {
    preFilters: [isStaffPreFilter],
  },

  signature: {
    guildId: ct.anyId(),
  },

  async run({ pluginData, message: msg, args }) {
    const latestGuildData = await pluginData.client.guilds.fetch(args.guildId).catch(() => null);
    if (!latestGuildData) {
      void msg.channel.send("Could not fetch guild information");
      return;
    }

    await updateGuildInfo(latestGuildData, true);
    void msg.channel.send("Guild information updated");
  },
});
