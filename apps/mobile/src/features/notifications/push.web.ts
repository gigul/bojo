// Web has no push (§6): stub with the same exports as push.ts so expo-notifications never enters
// the web bundle (A8). The in-app inbox + Realtime toast still work.

export async function registerForPush(_opts: { channelName: string }): Promise<string | null> {
  return null;
}

export async function listenForPushTaps(_onUrl: (url: string) => void): Promise<() => void> {
  return () => undefined;
}
