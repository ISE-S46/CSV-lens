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