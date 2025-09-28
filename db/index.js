"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
var postgres_js_1 = require("drizzle-orm/postgres-js");
var postgres_1 = require("postgres");
var schema = require("./schema");
var dotenv = require("dotenv");
dotenv.config();
if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}
// Create the connection
var client = (0, postgres_1.default)(process.env.DATABASE_URL);
// Create the db instance
exports.db = (0, postgres_js_1.drizzle)(client, { schema: schema });
