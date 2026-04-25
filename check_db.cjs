const mysql = require('mysql2/promise');
require('dotenv').config();

const MYSQL_URL = process.env.MYSQL_URL || "mysql://root:XLLWnJWGtSVtzsIOMondWGmLPIEqOYXX@shuttle.proxy.rlwy.net:23244/railway";

async function checkJobs() {
  try {
    const connection = await mysql.createConnection(MYSQL_URL);
    const [rows] = await connection.execute('SELECT * FROM jobs');
    console.log('JOBS_COUNT:', rows.length);
    console.log('JOBS_DATA:', JSON.stringify(rows));
    await connection.end();
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

checkJobs();
