# Resume PDF Templates

This directory contains HTML/CSS templates for generating professional PDF resumes.

## Template Structure

Templates use a simple variable replacement system:
- `{{variable}}` - Replaces with data value
- `{{#if field}}...{{/if}}` - Conditional blocks

## Available Templates

1. **modern** - Two-column layout with sidebar (default)
2. **classic** - Single column, traditional layout
3. **minimal** - Clean, minimal design
4. **professional** - Corporate-style layout

## Customization

Templates support the following options:
- `template`: Template name (modern, classic, minimal, professional)
- `format`: Page format (A4, Letter)
- `fontSize`: Text size (small, medium, large)
- `colorScheme`: Color theme (blue, green, purple, gray)
- `margin`: Custom margins (top, right, bottom, left)

## Template Variables

- `{{name}}` - Full name
- `{{title}}` - Job title/profession
- `{{email}}` - Email address
- `{{phone}}` - Phone number
- `{{location}}` - Location/address
- `{{linkedIn}}` - LinkedIn profile
- `{{website}}` - Personal website
- `{{summary}}` - Professional summary
- `{{experience}}` - Work experience section
- `{{education}}` - Education section
- `{{skills}}` - Skills section
- `{{certifications}}` - Certifications section
- `{{languages}}` - Languages section
- `{{projects}}` - Projects section

## Color Schemes

- **blue**: Professional blue (#2563eb)
- **green**: Fresh green (#059669)
- **purple**: Creative purple (#7c3aed)
- **gray**: Neutral gray (#374151)

## Usage

Templates are automatically loaded from this directory. If a template file doesn't exist, the service falls back to inline templates defined in `ResumePDFService.ts`.

