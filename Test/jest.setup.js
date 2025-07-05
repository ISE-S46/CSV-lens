import dotenv from 'dotenv';
import path from 'path';

const TEST_DIR = process.cwd();

// Load the .env file from /Test/Backend
dotenv.config({ path: path.resolve(TEST_DIR, 'Backend', '.env') });