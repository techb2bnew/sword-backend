const jwt = require('jsonwebtoken');
const JWT_SECRET = "sword_erp_secret_key";
const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET);
console.log(token);
