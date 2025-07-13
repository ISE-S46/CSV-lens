# Test Guide

## Prerequisite
**Install required packages**
```bash
npm install
```
**Create dedicated database container for testing**
```bash
docker-compose up -d
```
**Create .env file for testing at /Test/Backend**
```bash
DB_USER=your_DB_user
DB_PASSWORD=your_DB_password
DB_NAME=your_DB_name
DB_HOST=localhost
DB_PORT=5433 # Must be different from the main .env file

NODE_ENV=test

JWT_SECRET=your_JWT_secret_key_here
REFRESH_TOKEN_SECRET=your_refresh_token_secret_key_here
COOKIE_SECRET=your_cookie_secret_key_here

# API Base URL for tests
API_BASE_URL=/api # Must be the same as the main .env
SERVER_PORT=3003 # Must be different from the main .env file
```

## Database Testing
Open TestUserAndDB.sql file in your database viewer file (for example: DBeaver) and run specific script inside it.

Feel free to create more test script.

## Auto Testing

### Test all test cases
```bash
npm run test
``` 

### Test only on Frontend
```bash
npm run test:frontend
``` 

### Test only on Backend
```bash
npm run test:backend
``` 
### Test specific test file
Example 1: /Backend/unit/dataRetrieval.test.js
```bash
npm run test:backend dataRetrieval.test.js
``` 
Example 2: /Frontend/integration/auth.test.js
```bash
npm run test:frontend auth.test.js
``` 

## Manual Testing

Upload the CSV files in /DatabaseTest and test it in the web application.