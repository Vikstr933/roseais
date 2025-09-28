import { Router } from 'express';
import { db } from '../../db';
import { companies } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/companies - Get all companies
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/companies - Fetching all companies');
    const allCompanies = await db.select().from(companies);

    // Transform the data to match the expected format
    const transformedCompanies = allCompanies.map(company => ({
      id: company.id,
      name: company.name,
      description: company.description,
      founded: company.founded,
      website: company.website,
      logoUrl: company.logoUrl,
      products: typeof company.products === 'string' ? JSON.parse(company.products) : company.products
    }));

    console.log(`Fetched ${transformedCompanies.length} companies`);
    res.json(transformedCompanies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// GET /api/companies/:id - Get specific company
router.get('/:id', async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const company = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);

    if (!company || company.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const companyData = company[0];

    // Transform the data to match the expected format
    const transformedCompany = {
      id: companyData.id,
      name: companyData.name,
      description: companyData.description,
      founded: companyData.founded,
      website: companyData.website,
      logoUrl: companyData.logoUrl,
      products: typeof companyData.products === 'string' ? JSON.parse(companyData.products) : companyData.products
    };

    res.json(transformedCompany);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// POST /api/companies - Create new company
router.post('/', async (req, res) => {
  try {
    const { name, description, founded, website, logoUrl, products } = req.body;

    if (!name || !description || !website) {
      return res.status(400).json({ error: 'Name, description, and website are required' });
    }

    const newCompany = await db.insert(companies).values({
      name,
      description,
      founded,
      website,
      logoUrl,
      products: JSON.stringify(products || [])
    }).returning();

    console.log('Created company:', newCompany[0]);
    res.status(201).json(newCompany[0]);
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// PUT /api/companies/:id - Update company
router.put('/:id', async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const { name, description, founded, website, logoUrl, products } = req.body;

    const updateData: any = {};

    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (founded) updateData.founded = founded;
    if (website) updateData.website = website;
    if (logoUrl) updateData.logoUrl = logoUrl;
    if (products) updateData.products = JSON.stringify(products);

    const updatedCompany = await db.update(companies)
      .set(updateData)
      .where(eq(companies.id, companyId))
      .returning();

    if (!updatedCompany || updatedCompany.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    console.log('Updated company:', updatedCompany[0]);
    res.json(updatedCompany[0]);
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// DELETE /api/companies/:id - Delete company
router.delete('/:id', async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);

    const deletedCompany = await db.delete(companies)
      .where(eq(companies.id, companyId))
      .returning();

    if (!deletedCompany || deletedCompany.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    console.log('Deleted company:', deletedCompany[0]);
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

export default router;
