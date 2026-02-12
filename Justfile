# Justfile for UPPS

# Run all preflight checks (build + lint + test)
preflight:
    npm run build && npm run lint && npm test
