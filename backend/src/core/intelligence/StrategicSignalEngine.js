/**
 * StrategicSignalEngine
 * Derives high-level project intelligence signals from the entity model.
 * Deterministic, no LLM calls, no persistence.
 * Previously read from ProjectInsights (dead collection) — now reads from
 * Decision, Blocker, Topic, ProjectState directly.
 */

import logger from '../../utils/logger.js';
import Decision from '../../models/Decision.js';
import Blocker from '../../models/Blocker.js';
import Topic from '../../models/Topic.js';
import ProjectState from '../../models/ProjectState.js';
import Message from '../../models/Message.js';

class StrategicSignalEngine {
  async generateSignals({ projectId }) {
    const startTime = Date.now();
    try {
      const [decisions, blockers, topics] = await Promise.all([
        Decision.find({ projectId, status: 'active', needsHumanValidation: { $ne: true } }).lean(),
        Blocker.find({ projectId, resolved: false }).lean(),
        Topic.find({ projectId, status: 'stable' }).lean()
      ]);

      if (!decisions.length && !blockers.length && !topics.length) return [];

      const metrics = await this._computeMetrics(projectId);
      const signals = [
        ...this._decisionDrift(topics, decisions),
        ...this._blockerStagnation(blockers),
        ...this._momentumDrop(decisions, metrics)
      ];

      logger.debug('Strategic signals generated', { projectId, signalCount: signals.length, durationMs: Date.now() - startTime });
      return signals;
    } catch (error) {
      logger.error('Signal generation failed', { projectId, error: error.message });
      return [];
    }
  }

  async _computeMetrics(projectId) {
    const now = Date.now();
    const sevenDaysAgo  = new Date(now - 7  * 86400000);
    const fourteenDaysAgo = new Date(now - 14 * 86400000);
    const [recent, previous] = await Promise.all([
      Message.countDocuments({ projectId, timestamp: { $gte: sevenDaysAgo.getTime() } }),
      Message.countDocuments({ projectId, timestamp: { $gte: fourteenDaysAgo.getTime(), $lt: sevenDaysAgo.getTime() } })
    ]);
    return { recentMessages: recent, previousMessages: previous };
  }

  // Topic discussed 5+ times but no decision mentions any of its keywords
  _decisionDrift(topics, decisions) {
    const signals = [];
    const decisionText = decisions.map(d => d.text.toLowerCase()).join(' ');
    for (const t of topics) {
      if (t.count < 5) continue;
      const kws = this._kw(t.name);
      if (!kws.some(w => decisionText.includes(w))) {
        signals.push({
          type: 'decision_drift',
          severity: 'medium',
          message: `Topic "${t.name}" discussed ${t.count}x but no decision recorded.`,
          topic: t.name
        });
      }
    }
    return signals;
  }

  // Blocker open >= 3 days
  _blockerStagnation(blockers) {
    const signals = [];
    const now = Date.now();
    for (const b of blockers) {
      if (!b.raisedAt) continue;
      const days = Math.floor((now - new Date(b.raisedAt).getTime()) / 86400000);
      if (days >= 3) {
        signals.push({
          type: 'blocker_stagnation',
          severity: days >= 5 ? 'high' : 'medium',
          message: `Blocker "${b.text.substring(0, 60)}" unresolved for ${days} days.`,
          daysOpen: days
        });
      }
    }
    return signals;
  }

  // Activity dropping with no recent decisions
  _momentumDrop(decisions, { recentMessages, previousMessages }) {
    const fiveDaysAgo = Date.now() - 5 * 86400000;
    const recentDecisions = decisions.filter(d => d.timestamp && new Date(d.timestamp).getTime() > fiveDaysAgo);
    const baseline = previousMessages || 1;
    const dropPct = ((baseline - recentMessages) / baseline) * 100;
    if (recentDecisions.length === 0 && (dropPct >= 50 || recentMessages < 5)) {
      return [{
        type: 'momentum_drop',
        severity: 'low',
        message: `No decisions in 5 days and activity dropped ${Math.round(dropPct)}%.`
      }];
    }
    return [];
  }

  _kw(text) {
    const stop = new Set(['the','a','an','is','it','in','on','at','to','for','of','and','or','system','pipeline','infrastructure','management']);
    return text.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stop.has(w));
  }
}

export default new StrategicSignalEngine();
