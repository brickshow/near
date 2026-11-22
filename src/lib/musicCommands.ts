const DEFAULT_MUSIC = "uplifting worship music";

function musicRequest(message: string) {
  const text = message.trim().replace(/[\u2018\u2019]/gu, "'").replace(/[.!?]+$/u, "")
    .replace(/^(?:hey|hi|hello)[, ]+(?:near[, ]+)?(?=\S)/iu, "")
    .replace(/^near[, :]+/iu, "")
    .replace(/^(?:I want|I need|I'd like|I would like)\s+(?=(?:some |a )?(?:music|song))/iu, "play ")
    .replace(/^(?:I want|I'd like|I would like) (?:you )?to (?:listen to|hear)/iu, "play")
    .replace(/^(?:I want|I'd like|I would like) you to /iu, "");
  const command = text.match(/^(?:(?:hey\s+)?near[, ]+)?(?:(?:can|could|would|will) you\s+)?(?:please\s+)?(?:(?:open|go to) (youtube) and )?(?:play|put on|pa-?play|patukar|ipatukar|tukari)\b(?:\s+(?:me|ko|kog|og|ug|of|a|some)\b)*\s*(.*?)$/iu);
  if (!command) return null;
  const target = command[2].replace(/\s+(?:for me|please|bai)$/iu, "").trim();
  const youtube = Boolean(command[1]) || /(?:^|\s)on youtube$/iu.test(target);
  const query = target.replace(/(?:^|\s)on (?:youtube|spotify)$/iu, "").trim();
  return {
    youtube,
    query: /^(?:music|songs?|musika|kanta|something|anything)?$/iu.test(query)
      ? ""
      : Array.from(query).slice(0, 240).join(""),
  };
}

export function createMusicCommands(
  resolve: (query: string) => Promise<{ url: string; matched: boolean; title?: string | null }>,
  open: (url: string) => Promise<unknown>,
  startPlayback?: (title: string) => Promise<unknown> | unknown,
  playSpotify?: (query: string) => Promise<boolean>,
) {
  return async (message: string): Promise<string | null> => {
    const request = musicRequest(message);
    if (request === null) return null;
    const query = request.query || DEFAULT_MUSIC;
    try {
      if (!request.youtube && await playSpotify?.(request.query).catch(() => false)) return "Playing music on Spotify.";
      const result = await resolve(query);
      await open(result.url);
      if (result.matched && result.title && startPlayback) {
        try {
          await startPlayback(result.title);
        } catch {
          return `I opened ${query} on YouTube, but the browser did not accept the Play command. Press Play on the video to start it.`;
        }
      }
      return result.matched
        ? result.title && startPlayback ? `Playing ${query} on YouTube.` : `I opened ${query} on YouTube.`
        : `I opened YouTube search results for ${query}. I could not select a video automatically, so please choose the result you want.`;
    } catch {
      return "I could not open YouTube. You can ask me to play the song again.";
    }
  };
}
