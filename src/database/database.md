## Overview
The Database Module provides a centralized PostgreSQL connection and query execution layer for the application. It is built using the `pg` library and itegrated into NestJS using dependency injection and lifecycle hooks.

This module is responsible for:
- Managing database connections
- Executing SQL queries
- Handling connection pooling
- Cleaning up resources on shutdown

### Architecture
```
DatabaseModule
   ↓
DatabaseService
   ↓
PostgreSQL (pg Pool)
```

### Files
```
src/database/
 ├── database.module.ts
 ├── database.service.ts
 ├── database.service.spec.ts
```

### Configuration
The database connection is configured via environment variables.
`.env`:
```
DATABASE_URL=postgresql://username:password@host:5432/database
NODE_ENV=development
```

