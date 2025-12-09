import { Router } from 'express';
import { db } from '../../db/index.js';
import { users } from '../../db/schema-pg.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

// Update user profile
router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { username, displayName, avatarUrl } = req.body;

    const [updatedUser] = await db
      .update(users)
      .set({
        username: username || undefined,
        displayName: displayName || undefined,
        avatarUrl: avatarUrl || undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't send password back
    const { password, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.post('/change-password', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    // Validate new password
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
    }
    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
    }
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one number' });
    }

    // Get current user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get company information
router.get('/company/:userId', authenticateUser, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Ensure user can only access their own data
    if (userId !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [user] = await db
      .select({
        companyName: users.companyName,
        vatNumber: users.vatNumber,
        addressLine1: users.addressLine1,
        addressLine2: users.addressLine2,
        city: users.city,
        state: users.state,
        zipCode: users.zipCode,
        country: users.country,
        phone: users.phone,
        website: users.website,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching company info:', error);
    res.status(500).json({ error: 'Failed to fetch company information' });
  }
});

// Update company information
router.put('/company', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      companyName,
      vatNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      country,
      phone,
      website,
    } = req.body;

    const [updatedUser] = await db
      .update(users)
      .set({
        companyName: companyName || undefined,
        vatNumber: vatNumber || undefined,
        addressLine1: addressLine1 || undefined,
        addressLine2: addressLine2 || undefined,
        city: city || undefined,
        state: state || undefined,
        zipCode: zipCode || undefined,
        country: country || undefined,
        phone: phone || undefined,
        website: website || undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'Company information updated successfully' });
  } catch (error) {
    console.error('Error updating company info:', error);
    res.status(500).json({ error: 'Failed to update company information' });
  }
});

// Get user preferences
router.get('/preferences/:userId', authenticateUser, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Ensure user can only access their own data
    if (userId !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [user] = await db
      .select({
        preferences: users.preferences,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return default preferences if none set
    const defaultPreferences = {
      theme: 'system',
      language: 'en',
      timezone: 'UTC',
      emailNotifications: true,
      pushNotifications: false,
      marketingEmails: false,
      weeklyDigest: true,
      codeStyle: 'comfortable',
      autoSave: true,
      enableAssistant: true,
    };

    res.json(user.preferences || defaultPreferences);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update user preferences
router.put('/preferences', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const preferences = req.body;

    const [updatedUser] = await db
      .update(users)
      .set({
        preferences: preferences as any,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;
