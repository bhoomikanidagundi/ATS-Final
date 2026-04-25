const mysql = require('mysql2/promise');
require('dotenv').config();

const MYSQL_URL = process.env.MYSQL_URL || "mysql://root:XLLWnJWGtSVtzsIOMondWGmLPIEqOYXX@shuttle.proxy.rlwy.net:23244/railway";

async function checkUsers() {
  try {
    const connection = await mysql.createConnection(MYSQL_URL);
    const [rows] = await connection.execute('SELECT email, name, role FROM users');
    console.log('USERS:', JSON.stringify(rows));
    await connection.end();
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

checkUsers();
