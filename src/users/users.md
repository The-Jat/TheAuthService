### Overview
The Users Module manages user-related operations including creation, retrieval, and domain logic. It follows a layered architecture separating domain, application, and infrastructure concerns.

### Architecture
```
Controller → Service → Repository Interface → Repository Implementation → Database
```

### Structure
```
users/
 ├── domain/
 │    ├── user.ts
 │    ├── user.repository.ts
 │
 ├── infrastructure/
 │    ├── pg-user.repository.ts
 │
 ├── users.controller.ts
 ├── users.service.ts
 ├── users.module.ts
```

### Domain Layer
`User` Entity
Represents a user in the system.
Properties:
- id: number
- email: string
- password: string
- name: string
- role: string

### Methods
```TypeScript
validatePassword(password, compareFn)
```
Used to validate password using injected comparison function.

### Repository Interface
`UserRepository`
Defines contract for user data access.
This defines WHAT operations exist, not HOW
#### Methods
```
create(email, password, name): Promise<User>
findByEmail(email): Promise<User | null>
findById(id): Promise<User | null>
```

### Infrastructure Layer
`PgUserRepository`
PostgreSQL implementation of `UserRepository`.

#### Responsibilities
- Execute SQL queries
- Map database rows to domain entities

#### Example Query
```
SELECT * FROM users WHERE email = $1;
```

### Service Layer
`UsersService`
Handles application logic.

#### Methods
- `createUser()`
- `findByEmail()`
- `findById()`

### Controller Layer
`UsersController`
Handle HTTP requests.

#### Endpoints
Create User
```
POST /users
```

Get User
```
GET /users?email=...
```

Guards Applied:
- JWT Authentication
- Role-based access
- Scope-based access

### Module Wiring
`users.module.ts`
```
{
  provide: 'UserRepository',
  useClass: PgUserRepository,
}
```

This is Dependency Injection binding
Meaning:
When someone asks for:
```
@Inject('UserRepository`)
```
NestJS gives:
```
PgUserRepository
```

### Workflow
### CASE 1: Create User

Step 1: HTTP Request
```
POST /users
```

Step 2: Controller
```
createUser(...)
```

Extracts:
- email
- password
- name

Step 3: Service
```
this.usersService.createUser(...)
```

Step 4: Repository Interface
```
this.userRepo.create(...)
```

Step 5: PgUserRepository
```
INSERT INTO users ...
RETURNING *
```

Step 6: DatabaseService
```
this.pool.query(...)
```

Step 7: PostgreSQL
- Executes query
- Returns row

Step 8: Mapping
```
return new User(...)
```

Step 9: Response
User object returned to client


### CASE 2: Get User (Protected)

Step 1: Request
```
GET /users?email=test@test.com
Authorization: Bearer <JWT>
```

Step 2: Guards Execute
1. JwtAuthGuard
- Verifies token
2. RolesGuard
- Checks role = 'user'
3. ScopesGuard
- Checks scope = read:users

Step 3: Controller Runs
```
getUser(...)
```

Step 4: Service
```
findByEmail(email)
```

Step 5: Repository
```
SELECT * FROM users WHERE email = $1;
```

Step 6: DB -> Entity -> Response
