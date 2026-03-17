# Budget App - Justfile
# Run `just --list` to see all available recipes

# Format all source files with Prettier
format:
    npm run format

# Check formatting without writing (useful for CI)
format-check:
    npm run format:check

# Run ESLint
lint:
    npm run lint

# Run both lint and format check
check: lint format-check

# Start dev server
dev:
    npm run dev

# Build for production
build:
    npm run build
