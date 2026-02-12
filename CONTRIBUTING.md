# Contributing to UPPS

Thank you for your interest in contributing to UPPS! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Project Structure](#project-structure)

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **MySQL** 8.x (or Docker for containerized development)
- **Git**

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone git@github.com:YOUR_USERNAME/uas-planner.git
   cd uas-planner
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream git@github.com:0xMastxr/uas-planner.git
   ```

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local configuration:

```dotenv
DATABASE_URL="mysql://root:password@localhost:3306/uas_planner"
JWT_SECRET="your-development-secret-here"
```

### 3. Database Setup

**Option A: Docker (Recommended)**
```bash
docker-compose up -d
```

**Option B: Local MySQL**
```bash
mysql -u root -p
CREATE DATABASE uas_planner;
```

### 4. Run Migrations

```bash
npx prisma migrate dev
```

### 5. Start Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

### 6. Run Tests

```bash
npm test
```

## Code Style

### TypeScript

- Use TypeScript for all new code
- Enable strict mode (`"strict": true` in tsconfig.json)
- Prefer `interface` over `type` for object shapes
- Use explicit return types for functions

```typescript
// ✅ Good
interface User {
  id: number
  email: string
}

function getUser(id: number): Promise<User | null> {
  // ...
}

// ❌ Avoid
type User = {
  id: number
  email: string
}

function getUser(id) {
  // ...
}
```

### React Components

- Use functional components with hooks
- Use named exports (not default exports)
- Place component files in appropriate directories under `app/components/`

```typescript
// ✅ Good
export function UserProfile({ user }: { user: User }) {
  const [loading, setLoading] = useState(false)
  // ...
}

// ❌ Avoid
export default class UserProfile extends React.Component {
  // ...
}
```

### File Naming

- React components: `PascalCase.tsx` (e.g., `UserProfile.tsx`)
- Utilities/hooks: `camelCase.ts` (e.g., `useAuth.ts`)
- API routes: `route.ts` in appropriate directory
- Test files: `*.test.ts` in `__tests__/` directory

### CSS/Styling

- Use Tailwind CSS utility classes
- Use CSS custom properties from `themes.css` for colors
- Avoid inline styles unless dynamic

```tsx
// ✅ Good
<div className="bg-surface-primary text-text-primary p-4 rounded-lg">

// ❌ Avoid
<div style={{ backgroundColor: '#1f2937', padding: '16px' }}>
```

### JSDoc Comments

Add JSDoc comments to all exported functions and complex logic:

```typescript
/**
 * Validates and parses a flight plan configuration.
 * 
 * @param config - The raw configuration object
 * @returns Validated FlightPlanConfig
 * @throws {ValidationError} When configuration is invalid
 * 
 * @example
 * ```typescript
 * const config = parseFlightPlanConfig(rawData)
 * ```
 */
export function parseFlightPlanConfig(config: unknown): FlightPlanConfig {
  // ...
}
```

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, semicolons, etc.) |
| `refactor` | Code refactoring (no feature/fix) |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, etc. |

### Scopes (Optional)

- `api` - API routes
- `ui` - User interface
- `auth` - Authentication
- `db` - Database/Prisma
- `flight-plans` - Flight plan features
- `scan` - SCAN pattern generator

### Examples

```bash
# Feature
feat(scan): add polygon area validation

# Bug fix
fix(auth): resolve token refresh race condition

# Documentation
docs: update API documentation for reset endpoint

# Refactoring
refactor(ui): extract StatusBadge component

# Tests
test(validators): add coverage for bulk operations
```

### Bad Examples (Avoid)

```bash
# ❌ Too vague
fix: bug fix

# ❌ Not using conventional format
Fixed the login issue

# ❌ Multiple changes in one commit
feat: add SCAN generator and fix auth and update docs
```

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make Changes

- Write clean, tested code
- Follow the code style guidelines
- Update documentation if needed

### 3. Run Quality Checks

```bash
# Run tests
npm test

# Run linting (if configured)
npm run lint

# Build to check for errors
npm run build
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat(scope): description of changes"
```

### 5. Push and Create PR

```bash
git push origin feat/your-feature-name
```

Then create a Pull Request on GitHub.

### PR Requirements

- [ ] Clear description of changes
- [ ] Tests pass
- [ ] No build errors
- [ ] Documentation updated (if applicable)
- [ ] Follows commit conventions

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Writing Tests

Tests are located in `lib/__tests__/` directory.

```typescript
// lib/__tests__/my-utility.test.ts
import { myFunction } from '../my-utility'

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input')
    expect(result).toBe('expected')
  })

  it('should handle edge cases', () => {
    expect(() => myFunction(null)).toThrow()
  })
})
```

### Test Categories

- **Unit tests**: Test individual functions (`lib/__tests__/`)
- **Integration tests**: Test API routes (coming soon)
- **E2E tests**: Test full user flows (coming soon)

## Project Structure

```
uas-planner/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── auth/             # Authentication endpoints
│   │   ├── flightPlans/      # Flight plan CRUD
│   │   ├── folders/          # Folder management
│   │   └── ...
│   ├── components/           # React components
│   │   ├── auth/             # Auth components
│   │   ├── flight-plans/     # Flight plan UI
│   │   ├── plan-generator/   # Plan generator UI
│   │   └── ui/               # Shared UI components
│   ├── hooks/                # Custom React hooks
│   └── styles/               # CSS files
├── lib/                      # Shared utilities
│   ├── __tests__/            # Unit tests
│   ├── auth.ts               # Auth utilities
│   ├── validators.ts         # Zod schemas
│   └── ...
├── prisma/                   # Database schema
└── public/                   # Static assets
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | JWT authentication utilities |
| `lib/validators.ts` | Zod validation schemas |
| `lib/scan-generator.ts` | SCAN pattern algorithm |
| `lib/date-utils.ts` | Date/timezone helpers |
| `app/styles/themes.css` | Theme CSS variables |

## Questions?

If you have questions about contributing:

1. Check existing issues and PRs
2. Review the documentation
3. Open a new issue with your question

---

Thank you for contributing to UPPS! 🚀
