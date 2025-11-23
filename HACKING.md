# Hacking on the Retirement Calculator

## Tech Stack

-   **Framework**: [React](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Persistence**: `localStorage` via custom hooks.

## Getting Started

### Prerequisites

-   Node.js (v18 or v20 recommended)
-   npm

### Installation

Clone the repository and install dependencies. Note that due to some ESLint plugin peer dependency conflicts, you may need to use legacy peer resolution or ensure you are using the fixed dependencies in `package.json`.

```bash
npm install
# If you encounter ERESOLVE errors:
npm ci --legacy-peer-deps
```

### Running Locally

Start the development server:

```bash
npm run dev
```

Open your browser to the URL shown (usually `http://localhost:5173/retire/`).

### Building

To build for production:

```bash
npm run build
```

The output will be in the `dist/` directory.

## Project Structure

-   `src/components/`: React UI components (`Wizard`, `Results`, `UI` elements).
-   `src/logic/`: Core calculation engine (`RetirementCalculator.ts`) and type definitions.
-   `src/data/`: JSON configuration files for Taxes and Healthcare.
-   `scripts/`: Utility scripts.

## Data Updates

The application uses hardcoded JSON files for tax brackets to ensure stability and performance. To update this data (e.g., for a new tax year), you can use the fetch script as a starting point:

```bash
node scripts/fetch_tax_data.js
```

*Note: The script currently mocks the fetch process and writes default 2025 data. To make it operational for real-time scraping, you would need to implement the axios/cheerio logic inside `fetchTaxData`.*
