// On-chain record format for a bounty payout, stored with the SPL Memo program:
//   bountybridge:v1|owner/repo#123|https://github.com/owner/repo/pull/456

export const MEMO_PREFIX = "bountybridge:v1";
export const MAX_MEMO_BYTES = 509;

export type BountyRecord = {
  repo: string;
  issueNumber: number;
  prUrl: string;
};

const PR_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+\/?$/;

export function isPullRequestUrl(url: string): boolean {
  return PR_URL_RE.test(url.trim());
}

export function buildBountyMemo(record: BountyRecord): string {
  return `${MEMO_PREFIX}|${record.repo}#${record.issueNumber}|${record.prUrl.trim()}`;
}

export function memoByteLength(memo: string): number {
  return new TextEncoder().encode(memo).length;
}

/**
 * Parse the `memo` field returned by getSignaturesForAddress.
 * The RPC prefixes each memo with its byte length ("[57] ...") and joins
 * multiple memos with "; ", so we strip that and look for our prefix.
 */
export function parseBountyMemo(raw: string | null): BountyRecord | null {
  if (!raw) return null;
  for (const part of raw.split("; ")) {
    const text = part.replace(/^\[\d+\]\s*/, "");
    if (!text.startsWith(MEMO_PREFIX + "|")) continue;
    const [, target, prUrl] = text.split("|");
    const match = target?.match(/^(.+)#(\d+)$/);
    if (!match || !prUrl) continue;
    return { repo: match[1], issueNumber: Number(match[2]), prUrl };
  }
  return null;
}
