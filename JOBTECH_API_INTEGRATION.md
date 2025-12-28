# JobTech API Integration Guide

## API Information

**Base URL**: `https://jobsearch.api.jobtechdev.se/search`

**Authentication**: Ingen API-nyckel krävs för grundläggande sökningar

**Dokumentation**: 
- https://jobtechdev.se/
- https://github.com/JobtechSwe/getting-started-code-examples

## Request Example

```typescript
const params = {
  q: 'utvecklare stockholm',  // Search query
  limit: 100,                  // Max 100 results per request (use 0 to get count only)
  offset: 0,                   // For pagination (optional)
  remote: 'true',              // Filter for remote jobs (optional)
  municipality: 'tfRE_hXa_eq7', // Municipality code/conceptId (optional)
  region: 'CifL_Rzy_Mku',      // Region code/conceptId (optional)
  'occupation-field': 'apaJ_2ja_LuF', // Occupation field conceptId (optional)
};

const response = await axios.get('https://jobsearch.api.jobtechdev.se/search', {
  params,
  headers: {
    'accept': 'application/json',
  }
});
```

## Response Structure

```typescript
{
  total: {
    value: 1234  // Total number of matches
  },
  hits: [
    {
      id: "job-id",
      headline: "Job Title",
      employer: {
        name: "Company Name",
        organization_number: "2021002114"
      },
      workplace_address: {
        municipality: "Stockholm",
        municipality_code: "0180",
        region: "Stockholm",
        region_code: "01",
        country: "Sverige",
        street_address: "Vasagatan 1",
        postcode: "111 20",
        city: "Stockholm",
        coordinates: [59.3293, 18.0686] // [latitude, longitude]
      },
      description: {
        text: "Job description...",
        text_formatted: "Formatted description with HTML..."
      },
      webpage_url: "https://job-url",
      application_details: {
        url: "https://apply-url",
        email: "apply@example.com",
        information: "Apply via email"
      },
      must_have: {
        skills: [
          { namn: "JavaScript", label: "JavaScript", vikt: 10 }
        ],
        languages: [...],
        work_experiences: [...]
      },
      nice_to_have: {
        skills: [
          { namn: "TypeScript", label: "TypeScript", vikt: 5 }
        ]
      },
      publication_date: "2025-01-15T10:00:00Z",
      application_deadline: "2025-02-15"
    }
  ]
}
```

## Key Features

### Skills Extraction
JobTech API provides structured skills in two categories:
- **must_have.skills[]**: Required skills (weight 10 or higher)
- **nice_to_have.skills[]**: Preferred skills (weight 5 or lower)

These are taxonomy-based and more reliable than text extraction!

### Location Filtering
- Use `municipality` or `region` with Taxonomy conceptIds
- Use `position` (lat,lon) and `position.radius` (km) for geographic search
- Use `country` conceptId for country filtering

### Other Useful Filters
- `remote=true` - Remote work jobs
- `occupation-name` - Specific job title (conceptId)
- `occupation-field` - Field of work (conceptId)
- `employer` - Organization number or prefix

## Important Notes

1. **Limit**: Maximum 100 results per request
2. **Pagination**: Use `offset` parameter to get more results
3. **Count Only**: Set `limit: 0` to get total count without fetching jobs
4. **No API Key**: Basic searches require no authentication
5. **Taxonomy IDs**: Use Taxonomy API to get conceptIds for structured filters
6. **Rate Limits**: Be aware of HTTP 429 (rate limit exceeded)

## Error Codes

- **400**: Bad Request (wrong query parameters)
- **404**: Missing ad (ad not found)
- **429**: Rate limit exceeded
- **500**: Internal Server Error

## Implementation in JobMatchingService

Se `CV_IMPLEMENTATION_GUIDE.md` för komplett implementation av `JobMatchingService` som använder JobTech API med stöd för:
- Structured skills från `must_have` och `nice_to_have`
- Pagination med `offset` och `limit`
- Location filtering
- Fuzzy skill matching

