const { DataSource } = require("typeorm");
const { User } = require("../models/User");
const { DebtCase } = require("../models/DebtCase");

const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [User, DebtCase],
    synchronize: true, // DEV only!
    logging: false,
});

module.exports = { AppDataSource };
