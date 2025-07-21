require("dotenv").config();
require("reflect-metadata");
const express = require("express");
const cors = require("cors");
const passport = require("passport");
const bcrypt = require("bcrypt");
const apiRoutes = require("./api");
const { AppDataSource } = require("./config/dataSource");
const { User } = require("./models/User");

// Khởi tạo server
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cấu hình Passport
app.use(passport.initialize());
require("./config/passport")(passport);

// Kết nối CSDL và khởi động server
AppDataSource.initialize()
    .then(async () => {
        console.log("✅ Đã kết nối cơ sở dữ liệu thành công!");

        const officerRepository = AppDataSource.getRepository("User");
        const caseRepository = AppDataSource.getRepository("DebtCase");

        let testOfficer = await officerRepository.findOneBy({
            username: "cbtd02",
        });
        if (!testOfficer) {
            console.log("Tạo Cán bộ Tín dụng mẫu...");
            const officerData1 = {
                employee_code: "CBTD001",
                username: "cbtd01",
                fullname: "Nguyễn Long",
                dept: "KHDN",
                branch_code: "6421",
                role: "Nhân viên",
                password: await bcrypt.hash("password123", 10),
            };
            const officerData2 = {
                employee_code: "CBTD002",
                username: "cbtd02",
                fullname: "Nguyễn Long",
                dept: "KHDN",
                branch_code: "6421",
                role: "Nhân viên",
                password: await bcrypt.hash("password123", 10),
            };
            testOfficer1 = await officerRepository.save(
                officerRepository.create(officerData1)
            );
            testOfficer2 = await officerRepository.save(
                officerRepository.create(officerData2)
            );
            console.log(
                "✅ Đã tạo CBTD (username: cbtd01, password: password123)"
            );

            // Tạo hồ sơ mẫu cho CBTD này
            console.log("Tạo Hồ sơ nợ mẫu...");
            const caseData1 = {
                customer_code: "KH001",
                customer_name: "Công ty TNHH A",
                outstanding_debt: 150000000,
                state: "Mới",
                assigned_employee_code: testOfficer1.employee_code,
            };
            const caseData2 = {
                customer_code: "KH002",
                customer_name: "Công ty Cổ phần B",
                outstanding_debt: 320000000,
                state: "Đang xử lý",
                assigned_employee_code: testOfficer1.employee_code,
            };
            await caseRepository.save(caseRepository.create(caseData1));
            await caseRepository.save(caseRepository.create(caseData2));
            console.log("✅ Đã tạo 2 hồ sơ nợ mẫu cho CBTD001");
        }

        // Routes
        app.use("/api", apiRoutes);

        // Route gốc để health check
        app.get("/", (req, res) => {
            res.send("Welcome to Debt Collection API with Express.js!");
        });

        app.listen(PORT, () => {
            console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
        });
    })
    .catch((error) => console.log("❌ Lỗi kết nối cơ sở dữ liệu: ", error));
