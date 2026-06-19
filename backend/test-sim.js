import mongoose from 'mongoose';
import EmbeddingService from './src/core/embeddings/EmbeddingService.js';
import VectorStore from './src/core/vector/VectorStore.js';

async function run() {
  await mongoose.connect('mongodb+srv://nk:nikunj19@cluster0.yfvnmwz.mongodb.net/collab-ai?retryWrites=true&w=majority&appName=Cluster0');
  const Decision = (await import('./src/models/Decision.js')).default;
  const decs = await Decision.find({}).lean();
  
  const queryText = 'who decided on frontend UI library and what is it ?';
  const queryEmbedding = await EmbeddingService.embedText(queryText);

  const results = decs.map(d => {
    let similarity = null;
    if (d.embedding) {
      similarity = VectorStore.cosineSimilarity(queryEmbedding, d.embedding);
    }
    return { text: d.text, similarity };
  });

  results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

run().catch(console.error);
