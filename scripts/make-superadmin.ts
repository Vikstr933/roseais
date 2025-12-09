/**
 * Make a user a superadmin
 * Usage: npx tsx scripts/make-superadmin.ts <email>
 */

import { db } from '../db';
import { users } from '../db/schema-pg';
import { eq } from 'drizzle-orm';

const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/make-superadmin.ts <email>');
  process.exit(1);
}

async function makeSuperadmin() {
  try {
    console.log(`🔍 Looking for user: ${email}`);

    // Update user role
    const result = await db
      .update(users)
      .set({ role: 'superadmin' })
      .where(eq(users.email, email))
      .returning();

    if (result.length === 0) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    const user = result[0];
    console.log(`✅ User updated successfully!`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Display Name: ${user.displayName}`);

    console.log(`\n🎉 ${email} is now a SUPERADMIN!`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

makeSuperadmin();
