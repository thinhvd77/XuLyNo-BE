const { DataSource } = require("typeorm");
require('dotenv').config();

const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false, // DEV only!
    logging: false,
    entities: [__dirname + '/../models/*.js'], // Đường dẫn tới tất cả các file model
    migrations: [__dirname + '/../database/migrations/*.js'],
});

module.exports = { AppDataSource };
