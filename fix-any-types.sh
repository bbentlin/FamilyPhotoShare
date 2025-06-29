#!/bin/bash

# Fix common any patterns across all files
find src -name "*.tsx" -exec sed -i '' 's/} catch (error: any)/} catch (error: unknown)/g' {} \;
find src -name "*.tsx" -exec sed -i '' 's/} catch (err: any)/} catch (err: unknown)/g' {} \;
find src -name "*.tsx" -exec sed -i '' 's/useState<any>/useState<unknown>/g' {} \;

# Fix specific state types
sed -i '' 's/useState<unknown>\(\[\]\)/useState<Photo[]>([]/g' src/app/dashboard/page.tsx
sed -i '' 's/useState<unknown>\(\[\]\)/useState<Album[]>([]/g' src/app/dashboard/page.tsx
sed -i '' 's/useState<unknown>("")/useState<string>("")/g' src/app/invite/page.tsx

echo "✅ Fixed TypeScript any types"
