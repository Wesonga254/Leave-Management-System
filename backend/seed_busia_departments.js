/**
 * Busia County Government — Department Seed & Cleanup Script
 * 
 * This script:
 *   1. Inserts official Busia County departments (if missing)
 *   2. Removes non-official / duplicate departments from the departments table
 *   3. Migrates users on removed departments to the closest official match
 * 
 * Usage: node seed_busia_departments.js
 */

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const { BUSIA_COUNTY_DEPARTMENTS } = require('../shared/departments');

(async () => {
  const dbPath = path.join(__dirname, 'database.sqlite');
  console.log(`\n📂 Opening database: ${dbPath}\n`);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // ── Step 1: Show current state ─────────────────────────────────
  const existing = await db.all('SELECT id, name FROM departments ORDER BY id');
  console.log(`📋 Existing departments: ${existing.length}`);
  existing.forEach(d => console.log(`   [${d.id}] ${d.name}`));

  // ── Step 2: Insert official departments ────────────────────────
  let inserted = 0;
  let skipped = 0;

  for (const name of BUSIA_COUNTY_DEPARTMENTS) {
    const exists = await db.get(
      'SELECT id, name FROM departments WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
      [name]
    );

    if (exists) {
      console.log(`   ⏭ Skipped (already exists as "${exists.name}" id=${exists.id}): ${name}`);
      skipped++;
    } else {
      await db.run('INSERT INTO departments (name) VALUES (?)', [name]);
      const newDept = await db.get('SELECT id FROM departments WHERE name = ?', [name]);
      console.log(`   ✅ Inserted [${newDept.id}]: ${name}`);
      inserted++;
    }
  }

  // ── Step 3: Remove non-official departments ────────────────────
  const officialLower = BUSIA_COUNTY_DEPARTMENTS.map(n => n.toLowerCase().trim());
  const toRemove = existing.filter(d => !officialLower.includes(d.name.toLowerCase().trim()));

  console.log(`\n🧹 Non-official departments to remove: ${toRemove.length}`);

  // Map of generic department → closest official match for user migration
  const migrationMap = {
    'finance': 'The County Treasury and Economic Planning',
    'administration': 'Public Service Management and Governance',
    'human resources': 'Public Service Management and Governance',
    'public relations': 'Office of the Governor',
    'internal audit': 'The County Treasury and Economic Planning',
    'supply chain management': 'The County Treasury and Economic Planning',
    'legal affairs': 'Office of the Governor',
    'ict': 'Strategic Partnerships, ICT and Digital Economy',
    'it': 'Strategic Partnerships, ICT and Digital Economy',
    'engineering': 'Transport, Roads and Public Works',
    'marketing': 'Trade, Investment, Industrialization, Cooperatives and SME',
    'operations': 'Public Service Management and Governance',
  };

  let removed = 0;
  let migrated = 0;

  for (const dept of toRemove) {
    const lowerName = dept.name.toLowerCase().trim();
    const targetName = migrationMap[lowerName];

    if (targetName) {
      const targetDept = await db.get(
        'SELECT id FROM departments WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
        [targetName]
      );

      if (targetDept) {
        // Migrate users from removed department to official one
        const result = await db.run(
          `UPDATE users SET department = ?, department_id = ? WHERE department_id = ?`,
          [targetName, targetDept.id, dept.id]
        );
        if (result.changes > 0) {
          console.log(`   🔗 Migrated ${result.changes} user(s) from "${dept.name}" → "${targetName}"`);
          migrated += result.changes;
        }
      }
    }

    // Also migrate users who have the text but no department_id
    if (targetName) {
      const textResult = await db.run(
        `UPDATE users SET department = ? WHERE LOWER(TRIM(department)) = LOWER(TRIM(?)) AND department_id IS NULL`,
        [targetName, dept.name]
      );
      if (textResult.changes > 0) {
        console.log(`   🔗 Migrated ${textResult.changes} user(s) with text match "${dept.name}" → "${targetName}"`);
        migrated += textResult.changes;
      }
    }

    // Remove the non-official department
    await db.run('DELETE FROM departments WHERE id = ?', [dept.id]);
    console.log(`   🗑️  Removed [${dept.id}] ${dept.name}`);
    removed++;
  }

  // ── Step 4: Sync remaining users without department_id ─────────
  const synced = await db.run(`
    UPDATE users
    SET department_id = (
      SELECT d.id FROM departments d WHERE LOWER(TRIM(d.name)) = LOWER(TRIM(users.department))
    )
    WHERE department_id IS NULL
      AND department IS NOT NULL
      AND TRIM(department) != ''
  `);

  // ── Step 5: Remove duplicate departments (case-insensitive) ────
  const dupes = await db.all(`
    SELECT MIN(id) as keep_id, LOWER(TRIM(name)) as norm_name, COUNT(*) as cnt
    FROM departments
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  `);

  let dupsRemoved = 0;
  for (const dup of dupes) {
    const allMatches = await db.all(
      `SELECT id, name FROM departments WHERE LOWER(TRIM(name)) = ? ORDER BY id`,
      [dup.norm_name]
    );
    const keepId = allMatches[0].id;
    const removeIds = allMatches.slice(1).map(d => d.id);

    for (const rid of removeIds) {
      // Migrate users to the kept department
      await db.run('UPDATE users SET department_id = ? WHERE department_id = ?', [keepId, rid]);
      await db.run('DELETE FROM departments WHERE id = ?', [rid]);
      console.log(`   🔄 Deduplicated: removed id=${rid}, kept id=${keepId} ("${allMatches[0].name}")`);
      dupsRemoved++;
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`✅ Inserted:    ${inserted} new departments`);
  console.log(`⏭ Skipped:     ${skipped} (already existed)`);
  console.log(`🗑️  Removed:     ${removed} non-official departments`);
  console.log(`🔄 Deduped:     ${dupsRemoved} duplicate departments`);
  console.log(`🔗 Migrated:    ${migrated} users to official departments`);
  console.log(`🔗 Synced:      ${synced.changes || 0} users linked to departments`);

  // Show final state
  const final = await db.all('SELECT id, name, director_id FROM departments ORDER BY name');
  console.log(`\n📋 Final departments: ${final.length}`);
  final.forEach(d => console.log(`   [${d.id}] ${d.name}${d.director_id ? ` (Director: user ${d.director_id})` : ''}`));

  console.log(`\n✅ Done — Only official Busia County departments remain.\n`);
  await db.close();
})();
