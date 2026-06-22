/**
 * Official Busia County Government Departments
 *
 * Source: busiacounty.go.ke — County Executive Committee departments
 * and constitutional offices as gazetted.
 *
 * This is the single source of truth used across the entire application:
 *   - Frontend registration & admin forms
 *   - Backend department seeding
 *   - Database cleanup scripts
 *
 * ⚠️  Do NOT add generic names like "Finance", "HR", "Admin" —
 *      those are internal divisions, not official county departments.
 */

const BUSIA_COUNTY_DEPARTMENTS = [
  // County Public Service Board
  'County Public Service Board',

  // County Executive Committee (CEC) Departments
  'The County Treasury and Economic Planning',
  'Public Service Management and Governance',
  'Health and Sanitation',
  'Education and Industrial Skills Development',
  'Smart Agriculture, Livestock, Fisheries and Blue Economy',
  'Strategic Partnerships, ICT and Digital Economy',
  'Lands, Housing and Urban Development',
  'Transport, Roads and Public Works',
  'Water, Irrigation, Environment, Natural Resources, Climate Change and Energy',
  'Trade, Investment, Industrialization, Cooperatives and SME',
  'Youth, Sports, Tourism, Culture, Social Protection, Gender Affairs and Creative Arts',
];

module.exports = { BUSIA_COUNTY_DEPARTMENTS };
