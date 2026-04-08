export default class SignalClassifier {
  static classify(message, nextContext = '') {
    if (!message || !message.text) return null;
    if (message.text.startsWith('@CollabAI')) return null;

    const t1Decisions = [
      "actually we(?:'re| are) (?:switching|moving|going) (?:to|with)",
      "instead of .+ we(?:'re| are| will)",
      "we decided (?:on|to)",
      "we(?:'re| are) (?:going with|using)",
      "we will use",
      "let's stick to",
      ".+ it is\\.?$",
      "switching from .+ to",
      "we won't use",
      "we ruled out",
      "final decision",
      "agreed on"
    ];

    const t2Decisions = [
      "we should (?:use|adopt|go with|switch to)",
      "let's (?:use|go with|adopt|try|establish|set up|revisit)",
      "I think .+ is better",
      "I prefer",
      "I propose",
      "probably (?:use|go with|switch to)",
      "leaning towards",
      "proposing we use",
      "what if we use",
      "maybe .+ instead"
    ];

    const t1Blockers = [
      "blocking us",
      "we're blocked",
      "can't proceed",
      "critical (?:issue|bug|vulnerability|flaw)",
      "production is down",
      "this breaks",
      "500ing",
      "(?:is|are) crashing",
      "signature verification failed"
    ];

    const t2Blockers = [
      "issue with",
      "problem (?:is|with)",
      "concern about",
      "risk here",
      "this might fail",
      "not sure if .+ works",
      "major (?:flaw|issue|bug)",
      "failed to"
    ];

    const t1Actions = [
      "I'll (?:handle|build|set up|implement|write|create|fix|push|deploy|update|refactor|rewrite|switch|force)",
      "I will (?:handle|build|set up|implement|write|create|fix|push|deploy|update|refactor|rewrite|switch)",
      "I am (?:handling|building|setting up|implementing|writing|creating|fixing|pushing|deploying|updating|refactoring|rewriting|switching|forcing)",
      ".+ you (?:handle|take|set up|own)",
      "can you (?:set up|build|implement|fix|write|update)",
      "assigning .+ to"
    ];

    const t2Actions = [
      "someone (?:should|needs to|must)",
      "we need to (?:build|implement|set up|fix|write)",
      "needs to be done"
    ];

    const check = (patterns) => {
      const matchPattern = patterns.find(p => new RegExp(p, 'i').test(message.text));
      return matchPattern ? matchPattern : null;
    };

    const username = message.username || message.user || 'Unknown';
    const userId = message.userId || message.user || null;
    const timestamp = message.timestamp || Date.now();
    const messageId = message._id || null;

    let pattern;
    let tier = null;
    let type = null;

    if ((pattern = check(t1Decisions))) { tier = 1; type = 'decision'; }
    else if ((pattern = check(t1Blockers))) { tier = 1; type = 'blocker'; }
    else if ((pattern = check(t1Actions))) { tier = 1; type = 'action'; }
    else if ((pattern = check(t2Decisions))) { tier = 2; type = 'decision'; }
    else if ((pattern = check(t2Blockers))) { tier = 2; type = 'blocker'; }
    else if ((pattern = check(t2Actions))) { tier = 2; type = 'action'; }

    let confidence = 0.0;
    let isUncertain = false;

    if (!tier) {
      tier = 3;
      type = 'noise';
      confidence = 0.1;
      pattern = 'none';
      return createSignal(tier, type, pattern, message.text, messageId, userId, username, timestamp, confidence, isUncertain);
    }

    if (tier === 1) confidence = 0.9;
    else if (tier === 2) confidence = 0.6;

    // False Positive Checks (Walk-backs)
    const walkBackMatchNext = nextContext && /(but|actually|instead|monolith|not yet|out of scope|maybe|re-evaluate)/i.test(nextContext);
    const walkBackMatchSame = /(but|actually|instead|monolith|not yet|out of scope|maybe|re-evaluate)/i.test(message.text);

    if (type === 'decision' && (walkBackMatchNext || walkBackMatchSame)) {
      // Split into direction + uncertainty instead of discarding
      isUncertain = true;
      confidence = Math.max(0.3, confidence - 0.4);
      if (tier === 1) tier = 2; // Downgrade tier but don't discard
    }

    return createSignal(tier, type, pattern, message.text, messageId, userId, username, timestamp, confidence, isUncertain);
  }
}

function createSignal(tier, type, pattern, text, messageId, userId, username, timestamp, confidence = 0, isUncertain = false) {
  return { tier, type, pattern, text, messageId, userId, username, timestamp, confidence, isUncertain };
}
