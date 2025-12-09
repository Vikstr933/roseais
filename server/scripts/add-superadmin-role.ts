/**
 * Add superadmin role to users table and set Viktor as superadmin
 */
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function addSuperadminRole() {
  try {
    console.log('🔧 Adding role column to users table...');
    
    // Add role column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'
    `);
    
    console.log('✅ Role column added');
    
    // Update Viktor's account to superadmin
    console.log('👑 Setting superadmin role...');
    
    await db.execute(sql`
      UPDATE users 
      SET role = 'superadmin' 
      WHERE username = 'admin' OR email LIKE '%viktor%'
    `);
    
    // Show all superadmins
    const superadmins = await db.execute(sql`
      SELECT id, username, email, role 
      FROM users 
      WHERE role = 'superadmin'
    `);
    
    console.log('\n👑 Superadmins:');
    console.log(superadmins.rows);
    
    console.log('\n✅ Superadmin role setup complete!');
    console.log('\nRoles:');
    console.log('  - superadmin: Full access to all features');
    console.log('  - admin: Manage users and content');
    console.log('  - user: Standard access');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

addSuperadminRole()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

