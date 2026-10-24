/**
 * G25 Dedicated Unit Test Suite for BM25Engine (Bloque D)
 *
 * Verifies the extracted pure retrieval engine without requiring StorageEngine,
 * validating tokenization, stemming (EN/ES), field weighting, coordination curves,
 * quadratic suppression for unanswerable queries, and TMS state ranking.
 */

const assert = require('assert');
const { BM25Engine, BM25_STOPWORDS, stemWord, matchTerm } = require('../../dist/storage/retrieval/bm25');

function runBM25UnitTests() {
  console.log('================================================================');
  console.log('   G25 Bloque D: BM25Engine Pure Unit Test Suite                ');
  console.log('================================================================\n');

  const engine = new BM25Engine();
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // 1. Multilingual Tokenization
  test('Tokenization normalizes accents and removes punctuation', () => {
    const tokens = engine.tokenizeText('Arquitectura de Gestión & Memoria Concurrente!');
    assert(tokens.includes('arquitectura'), 'Missing arquitectura');
    assert(tokens.includes('gestion'), 'Accent not stripped from gestion');
    assert(tokens.includes('memoria'), 'Missing memoria');
    assert(tokens.includes('concurrente'), 'Missing concurrente');
    // Stopwords pruned
    assert(!tokens.includes('de'), 'Spanish stopword "de" should be removed');
  });

  // 2. English & Spanish Stopword Pruning
  test('Stopwords set contains both English and Spanish entries', () => {
    assert(BM25_STOPWORDS.has('the'), 'English "the" missing');
    assert(BM25_STOPWORDS.has('and'), 'English "and" missing');
    assert(BM25_STOPWORDS.has('de'), 'Spanish "de" missing');
    assert(BM25_STOPWORDS.has('para'), 'Spanish "para" missing');
    assert(BM25_STOPWORDS.has('tambien'), 'Spanish "tambien" missing');
  });

  // 3. Suffix Stemming
  test('Multilingual stemWord stems English and Spanish inflections', () => {
    assert.strictEqual(stemWord('reservations'), 'reserv');
    assert.strictEqual(stemWord('transactional'), 'transactional');
    assert.strictEqual(stemWord('configuraciones'), 'configur');
    assert.strictEqual(stemWord('aislamiento'), 'aisl');
    assert.strictEqual(stemWord('actualizados'), 'actualiz');
  });

  // 4. Term Matching
  test('matchTerm supports exact, prefix, and stem matching', () => {
    assert(matchTerm('storage', 'storage'), 'Exact match');
    assert(matchTerm('transactions', 'transaction'), 'Stem match');
    assert(matchTerm('configuracion', 'configurar'), 'Spanish prefix stem match');
    assert(!matchTerm('database', 'network'), 'Negative match');
  });

  // 5. Field Weighting: Title > Tags > Content > Topic
  test('Field weighting gives highest priority to Title and Tags', () => {
    const titleOnlyItem = {
      id: 'ITEM-1',
      type: 'FINDING',
      classification: 'TECHNICAL',
      title: 'PostgreSQL Database Cluster',
      content: 'General system notes without the keywords.',
      provenance: {},
    };
    const contentOnlyItem = {
      id: 'ITEM-2',
      type: 'FINDING',
      classification: 'TECHNICAL',
      title: 'System Notes',
      content: 'PostgreSQL Database Cluster information and setup guide.',
      provenance: {},
    };

    const qTerms = ['postgresql', 'database'];
    const s1 = engine.scoreKnowledgeItem(qTerms, titleOnlyItem);
    const s2 = engine.scoreKnowledgeItem(qTerms, contentOnlyItem);

    assert(s1 > s2, `Title match (${s1}) should score higher than content match (${s2})`);
  });

  // 6. Quadratic Suppression for Out-of-Domain Polysemy
  test('Quadratic suppression heavily penalizes single-term item matches on multi-term queries', () => {
    const genericItem = {
      id: 'ITEM-GENERIC',
      type: 'FINDING',
      classification: 'TECHNICAL',
      title: 'General Stock Management Rules',
      content: 'Items must be counted daily for consistency.',
      provenance: {},
    };

    // 4-term out-of-domain query where only 1 word matches
    const outOfDomainQuery = ['quantum', 'cryptography', 'stock', 'satellite'];
    const score = engine.scoreKnowledgeItem(outOfDomainQuery, genericItem);

    assert(score < 0.20, `Score for 1/4 out-of-domain match should be < 0.20, got ${score}`);
  });

  // 7. TMS Lifecycle Multipliers
  test('TMS Lifecycle state gives 1.35x to ACCEPTED and 0.05x to SUPERSEDED on normal queries', () => {
    const acceptedItem = {
      id: 'ADR-ACC',
      type: 'DECISION',
      classification: 'ARCHITECTURE',
      title: 'Database Schema Design',
      content: 'Core architecture conventions.',
      lifecycleState: 'ACCEPTED',
      provenance: {},
    };
    const supersededItem = {
      id: 'ADR-SUP',
      type: 'DECISION',
      classification: 'ARCHITECTURE',
      title: 'Database Schema Design',
      content: 'Core architecture conventions.',
      lifecycleState: 'SUPERSEDED',
      provenance: {},
    };

    const q = ['database', 'schema'];
    const sAcc = engine.scoreKnowledgeItem(q, acceptedItem);
    const sSup = engine.scoreKnowledgeItem(q, supersededItem);

    assert(sAcc > sSup * 10, `ACCEPTED score (${sAcc}) should dominate SUPERSEDED (${sSup})`);
  });

  // 8. Historical Query Multiplier Inversion
  test('Historical query boosts SUPERSEDED items when query explicitly asks for historical context', () => {
    const supersededItem = {
      id: 'ADR-HIST',
      type: 'DECISION',
      classification: 'ARCHITECTURE',
      title: 'Legacy MongoDB Clustering',
      content: 'Old storage architecture.',
      lifecycleState: 'SUPERSEDED',
      provenance: {},
    };

    const normalScore = engine.scoreKnowledgeItem(['mongodb', 'clustering'], supersededItem, undefined, undefined, undefined, undefined, 'mongodb clustering');
    const histScore = engine.scoreKnowledgeItem(['mongodb', 'clustering'], supersededItem, undefined, undefined, undefined, undefined, 'prior superseded mongodb clustering legacy');

    assert(histScore > normalScore * 10, `Historical query score (${histScore}) should exceed normal (${normalScore})`);
  });

  // 9. Deterministic Tie-Breaking
  test('rankMatches tie-breaks identical scores by lifecycle state then stable ID', () => {
    const itemA = { id: 'ITEM-A', type: 'FINDING', classification: 'TECHNICAL', title: 'T', content: 'C', lifecycleState: 'DRAFT', provenance: {} };
    const itemB = { id: 'ITEM-B', type: 'FINDING', classification: 'TECHNICAL', title: 'T', content: 'C', lifecycleState: 'ACCEPTED', provenance: {} };

    const matches = [
      { item: itemA, score: 5.0, researchId: 'R1', topic: 'T' },
      { item: itemB, score: 5.0, researchId: 'R2', topic: 'T' },
    ];

    const ranked = engine.rankMatches(['term'], matches);
    assert.strictEqual(ranked[0].item.id, 'ITEM-B', 'ACCEPTED item should win tie over DRAFT');
  });

  console.log(`\nAll ${passed}/${total} BM25Engine unit tests PASSED.\n`);
  return { passed, total };
}

if (require.main === module) {
  runBM25UnitTests();
}

module.exports = { runBM25UnitTests };
