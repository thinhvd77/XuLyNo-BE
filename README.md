# XLN Server

This is an Express.js backend server for the XLN project, providing authentication, case management, and RESTful APIs.

## Features

- User authentication with Passport (Local & JWT strategies)
- Case management APIs
- Modular structure (controllers, services, models)
- Environment-based configuration

## Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- npm
- (Optional) A running database instance (configured in `src/config/dataSource.js`)

### Installation
```bash
npm install
```

### Running the Server
```bash
npm start
```
The server will start on [http://localhost:3000](http://localhost:3000) by default.

## Project Structure

- `src/app.js` - Main application entry point
- `src/api/` - API route definitions
- `src/config/` - Configuration files (database, passport, etc.)
- `src/controllers/` - Request handlers
- `src/middleware/` - Express middleware
- `src/models/` - Database models (User, DebtCase, CaseDocument)
- `src/routes/` - Route index
- `src/services/` - Business logic/services
- `package.json` - Project metadata and dependencies

## Environment Variables

Create a `.env` file in the project root with the following variables:
```
JWT_SECRET=your_jwt_secret
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name
```

## License

MIT
