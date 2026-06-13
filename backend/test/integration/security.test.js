import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// No real embeddings or LLM calls in tests — deterministic fakes.
vi.mock('../../src/core/embeddings/EmbeddingService.js', () => ({
  default: {
    embedText: vi.fn(async () => Array(384).fill(0.1)),
    embedBatch: vi.fn(async (texts) => texts.map(() => Array(384).fill(0.1))),
    initialize: vi.fn(async () => null)
  }
}));

vi.mock('../../src/core/orchestrator/AIOrchestrator.js', () => ({
  default: {
    selectModel: (c) => c || { provider: 'server', model: 'llama-3.1-8b-instant' },
    callProvider: vi.fn(async () => '{"text": "Normalized decision", "rationale": ""}'),
    handleRequest: vi.fn(async () => 'ok'),
    handleStreamingRequest: vi.fn(async () => 'ok'),
    handleSummaryRequest: vi.fn(async () => 'A summary.'),
    handleSummaryRefinement: vi.fn(async () => 'A refined summary.')
  }
}));

import { createTestApp } from '../helpers/app.js';

let mongod;
let app;

// Registered users: { token, userId }
let alice, bob, carol;
// alice owns project P1; carol owns project P2 (the attacker's own project)
let p1, p2;

async function register(username) {
  const res = await request(app).post('/api/auth/register').send({
    username,
    email: `${username}@example.com`,
    password: 'password123'
  });
  expect(res.body.success).toBe(true);
  return { token: res.body.token, userId: res.body.user._id };
}

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createTestApp();

  alice = await register('alice');
  bob = await register('bob');
  carol = await register('carol');

  const p1Res = await request(app).post('/api/projects')
    .set(auth(alice))
    .send({ title: 'Project One', problemStatement: 'Build the thing' });
  p1 = p1Res.body.project;

  const p2Res = await request(app).post('/api/projects')
    .set(auth(carol))
    .send({ title: 'Attacker Project', problemStatement: 'Up to no good' });
  p2 = p2Res.body.project;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('authentication', () => {
  it('rejects unauthenticated access to projects', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/api/projects').set({ Authorization: 'Bearer bogus' });
    expect(res.status).toBe(401);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
  });
});

describe('project membership boundaries', () => {
  it('blocks non-members from reading a project', async () => {
    const res = await request(app).get(`/api/projects/${p1._id}`).set(auth(bob));
    expect(res.status).toBe(403);
  });

  it('allows joining via invite code, then grants access', async () => {
    const join = await request(app).post('/api/projects/join')
      .set(auth(bob))
      .send({ inviteCode: p1.inviteCode });
    expect(join.body.success).toBe(true);

    const res = await request(app).get(`/api/projects/${p1._id}`).set(auth(bob));
    expect(res.status).toBe(200);
  });

  it('does not join a discussion from a different project via invite', async () => {
    // Carol creates a discussion in her own project, then tries to use P1's
    // invite code with her P2 discussionId.
    const disc = await request(app).post(`/api/projects/${p2._id}/discussions`)
      .set(auth(carol))
      .send({ title: 'Private discussion' });
    const foreignDiscussionId = disc.body.discussion._id;

    const join = await request(app).post('/api/projects/join')
      .set(auth(carol))
      .send({ inviteCode: p1.inviteCode, discussionId: foreignDiscussionId });
    expect(join.body.success).toBe(true);
    expect(join.body.addedToDiscussion).toBe(false);
  });
});

describe('IDOR regressions', () => {
  it('cannot delete a summary belonging to another project', async () => {
    const Summary = (await import('../../src/models/Summary.js')).default;
    const Discussion = (await import('../../src/models/Discussion.js')).default;
    const d1 = await Discussion.findOne({ projectId: p1._id, isMain: true });

    const summary = await Summary.create({
      projectId: p1._id, discussionId: d1._id,
      content: 'Sensitive summary', type: 'discussion', generatedBy: 'server'
    });

    // Carol is a member of P2 and routes the request through HER project id.
    const res = await request(app)
      .delete(`/api/projects/${p2._id}/discussions/${d1._id}/summaries/${summary._id}`)
      .set(auth(carol));
    expect(res.status).toBe(404);
    expect(await Summary.findById(summary._id)).not.toBeNull();
  });

  it('cannot bookmark a message from another project as a decision', async () => {
    const Message = (await import('../../src/models/Message.js')).default;
    const Discussion = (await import('../../src/models/Discussion.js')).default;
    const d1 = await Discussion.findOne({ projectId: p1._id, isMain: true });

    const message = await Message.create({
      discussionId: d1._id, projectId: p1._id,
      userId: alice.userId, user: 'alice',
      text: 'Secret internal discussion content', timestamp: Date.now()
    });

    const res = await request(app)
      .post(`/api/projects/${p2._id}/decisions`)
      .set(auth(carol))
      .send({ messageId: message._id.toString() });
    expect(res.status).toBe(404);
  });

  it('cannot read document chunks from another project', async () => {
    const upload = await request(app)
      .post(`/api/projects/${p1._id}/documents`)
      .set(auth(alice))
      .send({ title: 'notes.md', content: 'Confidential design notes '.repeat(20), fileType: 'text' });
    expect(upload.body.success).toBe(true);
    const docId = upload.body.document._id;

    const res = await request(app)
      .get(`/api/projects/${p2._id}/documents/${docId}/chunks`)
      .set(auth(carol));
    expect(res.status).toBe(404);
  });
});

describe('project lifecycle', () => {
  it('owner can remove a member, revoking access', async () => {
    const res = await request(app)
      .delete(`/api/projects/${p1._id}/members/${bob.userId}`)
      .set(auth(alice));
    expect(res.body.success).toBe(true);

    const denied = await request(app).get(`/api/projects/${p1._id}`).set(auth(bob));
    expect(denied.status).toBe(403);
  });

  it('non-owner cannot remove members', async () => {
    await request(app).post('/api/projects/join').set(auth(bob)).send({ inviteCode: p1.inviteCode });
    const res = await request(app)
      .delete(`/api/projects/${p1._id}/members/${alice.userId}`)
      .set(auth(bob));
    expect(res.status).toBe(403);
  });

  it('a member can leave; the owner cannot', async () => {
    const leave = await request(app).post(`/api/projects/${p1._id}/leave`).set(auth(bob));
    expect(leave.body.success).toBe(true);

    const denied = await request(app).get(`/api/projects/${p1._id}`).set(auth(bob));
    expect(denied.status).toBe(403);

    const ownerLeave = await request(app).post(`/api/projects/${p1._id}/leave`).set(auth(alice));
    expect(ownerLeave.status).toBe(400);
  });

  it('only the owner can delete a project, and deletion cascades', async () => {
    const denied = await request(app).delete(`/api/projects/${p2._id}`).set(auth(alice));
    expect(denied.status).toBe(403);

    const Message = (await import('../../src/models/Message.js')).default;
    const Discussion = (await import('../../src/models/Discussion.js')).default;
    const d2 = await Discussion.findOne({ projectId: p2._id, isMain: true });
    await Message.create({
      discussionId: d2._id, projectId: p2._id,
      userId: carol.userId, user: 'carol', text: 'to be cascaded', timestamp: Date.now()
    });

    const res = await request(app).delete(`/api/projects/${p2._id}`).set(auth(carol));
    expect(res.body.success).toBe(true);

    expect(await Discussion.countDocuments({ projectId: p2._id })).toBe(0);
    expect(await Message.countDocuments({ projectId: p2._id })).toBe(0);

    const gone = await request(app).get(`/api/projects/${p2._id}`).set(auth(carol));
    expect(gone.status).toBe(403); // project no longer exists → not a member
  });
});

describe('message pagination', () => {
  it('pages backwards through history with ?before=', async () => {
    const Message = (await import('../../src/models/Message.js')).default;
    const Discussion = (await import('../../src/models/Discussion.js')).default;
    const d1 = await Discussion.findOne({ projectId: p1._id, isMain: true });

    // Insert sequentially so ObjectIds are strictly increasing.
    const total = 120;
    for (let i = 0; i < total; i++) {
      await Message.create({
        discussionId: d1._id, projectId: p1._id,
        userId: alice.userId, user: 'alice',
        text: `message number ${i}`, timestamp: Date.now() + i
      });
    }

    const page1 = await request(app)
      .get(`/api/projects/${p1._id}/discussions/${d1._id}/messages?limit=50`)
      .set(auth(alice));
    expect(page1.body.success).toBe(true);
    expect(page1.body.messages).toHaveLength(50);
    expect(page1.body.hasMore).toBe(true);
    // Newest page — last message is the most recent
    expect(page1.body.messages[49].text).toBe(`message number ${total - 1}`);

    const oldestOnPage1 = page1.body.messages[0];
    const page2 = await request(app)
      .get(`/api/projects/${p1._id}/discussions/${d1._id}/messages?limit=50&before=${oldestOnPage1._id}`)
      .set(auth(alice));
    expect(page2.body.messages).toHaveLength(50);
    // Strictly older, contiguous
    expect(page2.body.messages[49].text).toBe(`message number ${total - 51}`);

    const oldestOnPage2 = page2.body.messages[0];
    const page3 = await request(app)
      .get(`/api/projects/${p1._id}/discussions/${d1._id}/messages?limit=50&before=${oldestOnPage2._id}`)
      .set(auth(alice));
    expect(page3.body.messages.length).toBeLessThan(50);
    expect(page3.body.hasMore).toBe(false);
  });

  it('rejects pagination for non-members', async () => {
    const Discussion = (await import('../../src/models/Discussion.js')).default;
    const d1 = await Discussion.findOne({ projectId: p1._id, isMain: true });

    const dave = await register('dave'); // never joined P1
    const res = await request(app)
      .get(`/api/projects/${p1._id}/discussions/${d1._id}/messages`)
      .set(auth(dave));
    expect(res.status).toBe(403);
  });
});
