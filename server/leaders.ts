// Circle leaders' app accounts, so a leader sees the circle they host on their feed. A circle's `leaders`
// field names the pair by first name ("Luis + EZ"). LEADER_ACCOUNTS in the env adds or overrides entries
// ("Mario=username,Name=username") — for usernames that shouldn't sit in this public repo.
const DEFAULT_ACCOUNTS: Record<string, string> = {
  Luis: "Luislucero.03",
  EZ: "ez_escarez",
  Jonathan: "G3tsome",
  Miguel: "mguel",
};

const accounts = (): Record<string, string> => ({
  ...DEFAULT_ACCOUNTS,
  ...Object.fromEntries(String(process.env.LEADER_ACCOUNTS || "").split(",")
    .map((s) => s.split("=").map((x) => x.trim())).filter(([n, u]) => n && u)),
});

export const leaderNames = (leaders: string | null | undefined) =>
  String(leaders || "").split("+").map((s) => s.trim()).filter(Boolean);

// The leader names that belong to this username ([] for everyone who isn't on the team)
export const leaderNamesFor = (username: string | null | undefined) =>
  username ? Object.entries(accounts()).filter(([, u]) => u.toLowerCase() === username.toLowerCase()).map(([n]) => n) : [];
