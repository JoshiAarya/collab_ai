import PendingSignal from '../../models/PendingSignal.js';

export default class SignalBuffer {
  static async addSignal(projectId, discussionId, classifiedSignal) {
    const signal = new PendingSignal({
      projectId,
      discussionId,
      type: classifiedSignal.type,
      tier: classifiedSignal.tier,
      confidence: classifiedSignal.confidence,
      isUncertain: classifiedSignal.isUncertain,
      rawText: classifiedSignal.text,
      messageId: classifiedSignal.messageId,
      proposedBy: {
        userId: classifiedSignal.userId,
        username: classifiedSignal.username
      },
      timestamp: classifiedSignal.timestamp,
      status: classifiedSignal.tier === 3 ? 'low_confidence' : 'pending'
    });
    return await signal.save();
  }

  static async getPendingSignals(projectId) {
    return await PendingSignal.find({ projectId, status: 'pending' }).sort({ timestamp: -1 });
  }

  static async getPendingCount(projectId) {
    return await PendingSignal.countDocuments({ projectId, status: 'pending' });
  }

  static async confirmSignal(signalId) {
    return await PendingSignal.findByIdAndUpdate(
      signalId,
      { status: 'confirmed' },
      { new: true }
    );
  }

  static async dismissSignal(signalId) {
    return await PendingSignal.findByIdAndUpdate(
      signalId,
      { status: 'dismissed' },
      { new: true }
    );
  }

  static async autoCapture(signalId) {
    return await PendingSignal.findByIdAndUpdate(
      signalId,
      { status: 'auto_captured' },
      { new: true }
    );
  }
}
