const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString =
  process.env.POSTGRES_URL ||
  'postgresql://neondb_owner:npg_LFNBVJC4M9mZ@ep-blue-dream-b4fmcwi9-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const filePath = path.join(__dirname, 'extracted_testcases.json');
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  console.log('Loading extracted test cases from disk...');
  const testcaseMap = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const entries = Object.entries(testcaseMap);
  console.log(`Loaded test cases for ${entries.length} questions.`);

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });

  console.log('Updating Neon PostgreSQL in batches...');
  const BATCH_SIZE = 100;
  let updatedCount = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    
    // Build update query using VALUES
    const valueTuples = [];
    const queryParams = [];
    let paramIndex = 1;

    for (const [idStr, ioList] of batch) {
      valueTuples.push(`($${paramIndex}::int, $${paramIndex + 1}::jsonb)`);
      queryParams.push(parseInt(idStr, 10), JSON.stringify(ioList));
      paramIndex += 2;
    }

    const query = `
      UPDATE questions AS q
      SET input_output = v.io
      FROM (VALUES ${valueTuples.join(', ')}) AS v(id, io)
      WHERE q.id = v.id;
    `;

    await pool.query(query, queryParams);
    updatedCount += batch.length;
    process.stdout.write(`Updated ${updatedCount} / ${entries.length} questions in Neon DB...\r`);
  }

  console.log(`\nSuccessfully updated test cases for all ${updatedCount} questions in Neon DB!`);

  // Verify distribution
  const statsRes = await pool.query(`
    SELECT jsonb_array_length(input_output) as count, COUNT(*) as freq 
    FROM questions 
    GROUP BY count 
    ORDER BY count ASC
  `);
  console.log('\nNew Test Case Distribution in Neon DB:');
  console.table(statsRes.rows);

  // Clean up temporary extracted file
  try {
    fs.unlinkSync(filePath);
    console.log('Cleaned up temporary extracted_testcases.json');
  } catch {}

  await pool.end();
}

main().catch(err => {
  console.error('Error updating Neon test cases:', err);
  process.exit(1);
});
